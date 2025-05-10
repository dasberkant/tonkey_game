import { TonConnectUI } from '@tonconnect/ui';
import { TonClient, Address, Cell, beginCell, toNano, fromNano } from 'ton';

// Destructuring for TonClient etc. is now handled by the import
// let TonClient, Address, Cell, beginCell, toNano, fromNano; // Remove this

// function initializeTonLib() { // This function is no longer needed with direct imports
//    ({ TonClient, Address, Cell, beginCell, toNano, fromNano } = window.Ton);
// }

// Helper function to introduce a delay
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

document.addEventListener('DOMContentLoaded', () => {
    const tg = window.Telegram.WebApp;
    if (tg) {
        tg.ready();
        tg.expand();
    }
    initializeAppLogic();
});

// --------------- APP LOGIC STARTS HERE ----------------- 
function initializeAppLogic() {
    const tg = window.Telegram.WebApp; // Ensure tg is available in this scope

    // UI Elements - Connection
    const connectAreaDiv = document.getElementById('connect-area');
    const loadingSpinnerDiv = document.getElementById('loading-spinner');

    // UI Elements - Game Core
    const gameContainerDiv = document.getElementById('game-container');
    const donkeyDisplayDiv = document.getElementById('donkey-display'); // For animations
    
    // UI Elements - Stats & Inventory
    const tonkeyBalanceGameSpan = document.getElementById('tonkey-balance-game');
    const lhbBalanceSpan = document.getElementById('lhb-balance');
    const geodesCountSpan = document.getElementById('geodes-count');
    const pebblesCountSpan = document.getElementById('pebbles-count');
    const premiumMapStatusSpan = document.getElementById('premium-map-status');
    const blueprintFragmentsCountSpan = document.getElementById('blueprint-fragments-count'); // For future

    // UI Elements - Actions
    const exploreButton = document.getElementById('explore-button');
    const exploreMessageP = document.getElementById('explore-message');
    const crackGeodeButton = document.getElementById('crack-geode-button');
    const geodeMessageP = document.getElementById('geode-message');

    // UI Elements - Shop
    const buyPremiumMapButton = document.getElementById('buy-premium-map-button');
    const premiumMapCostSpan = document.getElementById('premium-map-cost'); // Assuming costs are static in HTML for now
    const buyGourmetOatsButton = document.getElementById('buy-gourmet-oats-button');
    const gourmetOatsCostSpan = document.getElementById('gourmet-oats-cost');

    // Game Constants & State
    const tonkeyMasterAddress = 'EQCn9sEMALm9Np1tkKZmKuK9h9z1mSbyDWQOPOup9mhe5pFB';
    const SHOP_RECIPIENT_ADDRESS = 'UQC4PB_Zs2z-1CetayPu1qE5yokaoZCoYc2TIrb3ZZDMwUIj'; // Placeholder
    const EXPLORE_COST_LHB = 5;

    let userTonkeyWalletAddress = null;
    let tonClient = null;
    let userWalletAddress = null; // Raw user address from wallet connection

    // Player Game State
    let luckyHayBales = 50; // Start with some LHB
    let mysteryGeodesCount = 0;
    let shinyPebblesCount = 0;
    let hasPremiumMap = false;
    let blueprintFragmentsCount = 0; // For future use

    const CHAIN = { MAINNET: '-239', TESTNET: '-3' };

    // --- Helper Functions (showAlertFallback, showConfirmFallback - Keep as is) ---
    function showAlertFallback(message) {
        if (tg && tg.showAlert && typeof tg.showAlert === 'function') {
            try { tg.showAlert(message); } catch (e) { window.alert(message); }
        } else { window.alert(message); }
    }
    async function showConfirmFallback(message) {
        if (tg && tg.showConfirm && typeof tg.showConfirm === 'function') {
            try { return await new Promise(resolve => { tg.showConfirm(message, (ok) => resolve(ok)); }); }
            catch (e) { return window.confirm(message); }
        } else { return window.confirm(message); }
    }
    // --- End Helper Functions ---

    const tonConnectUI = new TonConnectUI({
        manifestUrl: 'https://dasberkant.github.io/tonkey_game/tonconnect-manifest.json', // Ensure this is your GitHub Pages URL
        buttonRootId: 'tonconnect-button-root',
        uiOptions: { twaReturnUrl: 'https://dasberkant.github.io/tonkey_game/' }
    });

    // --- UI Update Functions ---
    function updateAllDisplays() {
        lhbBalanceSpan.textContent = luckyHayBales;
        geodesCountSpan.textContent = mysteryGeodesCount;
        pebblesCountSpan.textContent = shinyPebblesCount;
        premiumMapStatusSpan.textContent = hasPremiumMap ? "Active! Next explore is special." : "None";
        blueprintFragmentsCountSpan.textContent = blueprintFragmentsCount;
        
        crackGeodeButton.disabled = mysteryGeodesCount === 0;
        exploreButton.textContent = `Go Exploring! (-${EXPLORE_COST_LHB} LHB)`;
        if(hasPremiumMap) {
             premiumMapStatusSpan.style.color = '#27AE60'; // Green if active
        } else {
            premiumMapStatusSpan.style.color = 'inherit'; // Default color
        }
    }

    // --- TON Blockchain Interaction Functions (getTonClient, getJettonWalletAddress, getJettonBalance - Keep largely as is) ---
    function getTonClient(networkChainId) {
        if (networkChainId === CHAIN.MAINNET) return new TonClient({ endpoint: 'https://toncenter.com/api/v2/jsonRPC' });
        return new TonClient({ endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC' });
    }
    async function getJettonWalletAddress(ownerAddressStr, jettonMasterAddrStr) {
        if (!tonClient) return null;
        try {
            const result = await tonClient.runMethod(Address.parse(jettonMasterAddrStr), 'get_wallet_address', [{ type: 'slice', cell: beginCell().storeAddress(Address.parse(ownerAddressStr)).endCell() }]);
            return result.stack.readAddress().toString();
        } catch (error) { console.error('Error getting Jetton wallet address:', error); return null; }
    }
    async function getJettonBalance(jettonWalletAddrStr) {
        if (!tonClient || !jettonWalletAddrStr) return 'Error';
        try {
            const result = await tonClient.runMethod(Address.parse(jettonWalletAddrStr), 'get_wallet_data');
            return parseFloat(fromNano(result.stack.readBigNumber())).toFixed(2);
        } catch (error) {
            console.error('Error getting Jetton balance:', error);
            if (error.message && (error.message.includes('exit_code: -13') || error.message.includes('method not found'))) return '0.00';
            return 'Error';
        }
    }
    async function fetchAndDisplayTonkeyBalance() {
        if (!userWalletAddress || !tonClient) { tonkeyBalanceGameSpan.textContent = 'N/A'; return; }
        tonkeyBalanceGameSpan.textContent = '...'; // Fetching indicator
        userTonkeyWalletAddress = await getJettonWalletAddress(userWalletAddress, tonkeyMasterAddress);
        if (userTonkeyWalletAddress) {
            const balance = await getJettonBalance(userTonkeyWalletAddress);
            tonkeyBalanceGameSpan.textContent = balance;
        } else {
            tonkeyBalanceGameSpan.textContent = '0.00 (No Jetton Wallet)';
        }
    }
    // --- End TON Blockchain Interaction ---

    // --- Game Logic Functions ---
    function showTemporaryMessage(element, message, duration = 3000, isError = false) {
        element.textContent = message;
        element.classList.toggle('error-message', isError);
        element.classList.remove('itemPop'); // remove animation class if it exists
        void element.offsetWidth; // trigger reflow to restart animation
        element.classList.add('itemPop'); // Add animation class
        setTimeout(() => {
            element.textContent = '';
            element.classList.remove('error-message', isError);
            element.classList.remove('itemPop');
        }, duration);
    }

    exploreButton.addEventListener('click', () => {
        if (luckyHayBales < EXPLORE_COST_LHB) {
            showTemporaryMessage(exploreMessageP, "Barnaby needs more LHB for an adventure!", 3000, true);
            if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
            return;
        }
        luckyHayBales -= EXPLORE_COST_LHB;
        let foundLHB = Math.floor(Math.random() * 8) + 3; // 3-10 LHB
        let foundGeode = false;

        if (hasPremiumMap) {
            foundGeode = true;
            hasPremiumMap = false; // Consume the map
            showTemporaryMessage(exploreMessageP, "✨ Using the Premium Map... Barnaby found a Mystery Geode!", 4000);
            setTimeout(() => showTemporaryMessage(exploreMessageP, `And ${foundLHB} LHB too! What a clever Tonkey!`), 2000); 
        } else if (Math.random() < 0.25) { // 25% chance to find a geode without map
            foundGeode = true;
        }

        luckyHayBales += foundLHB;
        let message = `Barnaby explored and found ${foundLHB} LHB!`;
        if (foundGeode) {
            mysteryGeodesCount++;
            message = `Yahoo! Barnaby found ${foundLHB} LHB and a Mystery Geode!`;
        }
        
        if (!hasPremiumMap || !foundGeode) { // Avoid double messaging if map was used.
            showTemporaryMessage(exploreMessageP, message);
        }

        updateAllDisplays();
        if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
    });

    crackGeodeButton.addEventListener('click', () => {
        if (mysteryGeodesCount <= 0) {
            showTemporaryMessage(geodeMessageP, "No geodes to crack, partner!", 3000, true);
            if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
            return;
        }
        mysteryGeodesCount--;
        let resultMessage = "You crack open the geode... ";
        const randomRoll = Math.random();

        if (randomRoll < 0.6) { // 60% chance for LHB
            const foundLHB = Math.floor(Math.random() * 20) + 10; // 10-29 LHB
            luckyHayBales += foundLHB;
            resultMessage += `and find ${foundLHB} LHB! Sweet as hay!`;
        } else if (randomRoll < 0.9) { // 30% chance for Shiny Pebbles
            const foundPebbles = Math.floor(Math.random() * 3) + 1; // 1-3 Pebbles
            shinyPebblesCount += foundPebbles;
            resultMessage += `it reveals ${foundPebbles} Shiny Pebble(s)! Sparkly!`;
        } else { // 10% chance for a Blueprint Fragment (rare)
            blueprintFragmentsCount++;
            resultMessage += `WOW! A rare Blueprint Fragment! Wonder what this makes?`;
            document.getElementById('blueprint-fragments-count').parentElement.classList.remove('hidden'); // Show if found
        }
        showTemporaryMessage(geodeMessageP, resultMessage, 4000);
        updateAllDisplays();
        if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('heavy');
    });

    async function handleShopPurchase(itemName, tokenAmountString, successCallback) {
        if (!tonConnectUI.connected || !userTonkeyWalletAddress || !tonClient) {
            showAlertFallback('Whoa there! Connect your wallet to do some shoppin'); return;
        }
        
        // Construct the message string separately
        const confirmationMessage = `Trade ${tokenAmountString} Tonkey Tokens for a ${itemName}?`;
        const confirmed = await showConfirmFallback(confirmationMessage);

        if (!confirmed) { showAlertFallback('Maybe next time!'); return; }

        try {
            const body = beginCell()
                .storeUint(0x0f8a7ea5, 32).storeUint(0, 64).storeCoins(toNano(tokenAmountString))
                .storeAddress(Address.parse(SHOP_RECIPIENT_ADDRESS))
                .storeAddress(Address.parse(userWalletAddress)).storeMaybeRef(null) // response_destination_address (sender)
                .storeCoins(toNano('0.005')).storeMaybeRef(null) // forward_ton_amount & forward_payload (none)
                .endCell();
            const transaction = {
                validUntil: Math.floor(Date.now() / 1000) + 360,
                messages: [{
                    address: userTonkeyWalletAddress, // User's jetton wallet address
                    amount: toNano('0.05').toString(), // Amount to send for the transaction itself
                    payload: body.toBoc().toString('base64')
                }]
            };
            await tonConnectUI.sendTransaction(transaction);
            showTemporaryMessage(geodeMessageP, `${itemName} is yours! Happy trails!`, 3000); // Using geodeMessageP for shop success temporarily
            if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
            if (successCallback) successCallback();
            updateAllDisplays(); // Update displays immediately after callback
            setTimeout(fetchAndDisplayTonkeyBalance, 7000);
        } catch (error) {
            console.error(`Shop TX error for ${itemName}:`, error);
            showTemporaryMessage(geodeMessageP, `Transaction for ${itemName} hit a snag: ${(error.message || 'Unknown error')}`, 4000, true);
            if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
        }
    }

    buyPremiumMapButton.addEventListener('click', () => {
        const cost = premiumMapCostSpan.textContent;
        handleShopPurchase('Premium Expedition Map', cost, () => {
            if(hasPremiumMap) {
                showTemporaryMessage(geodeMessageP, "You already have a Premium Map, Tonkey!");
                return; // Prevent buying multiple if we want to limit it
            }
            hasPremiumMap = true;
            // No LHB change here, map is an item.
        });
    });
    buyGourmetOatsButton.addEventListener('click', () => {
        const cost = gourmetOatsCostSpan.textContent;
        handleShopPurchase('Gourmet Oats Package', cost, () => {
            luckyHayBales += 100;
            // updateLHBDisplay() is called in updateAllDisplays() which is called in handleShopPurchase
        });
    });
    // --- End Game Logic ---

    // --- Initialization & Wallet Connection Handling ---
    tonConnectUI.onStatusChange(async wallet => {
        loadingSpinnerDiv.classList.remove('hidden');
        if (wallet) {
            userWalletAddress = wallet.account.address;
            tonClient = getTonClient(wallet.account.chain);
            connectAreaDiv.classList.add('hidden');
            gameContainerDiv.classList.remove('hidden');
            await fetchAndDisplayTonkeyBalance();
            updateAllDisplays(); 
            if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
        } else {
            userWalletAddress = null; tonClient = null; userTonkeyWalletAddress = null;
            connectAreaDiv.classList.remove('hidden');
            gameContainerDiv.classList.add('hidden');
            tonkeyBalanceGameSpan.textContent = '--';
             // Reset game state on disconnect for simplicity, or persist via localStorage later
            luckyHayBales = 50; mysteryGeodesCount = 0; shinyPebblesCount = 0; hasPremiumMap = false; blueprintFragmentsCount = 0;
            updateAllDisplays(); 
            if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
        }
        loadingSpinnerDiv.classList.add('hidden');
    });

    if (tg && tg.MainButton) {
        tg.MainButton.setText('Close Stable');
        tg.MainButton.textColor = '#FFFFFF';
        tg.MainButton.color = '#AF601A'; // Donkey brown
        tg.MainButton.show();
        tg.MainButton.onClick(() => { tg.close(); });
    }
    updateAllDisplays(); // Initial UI setup
}
// --------------- APP LOGIC ENDS HERE ----------------- 