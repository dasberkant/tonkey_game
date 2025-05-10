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
    const ancientCoinsCountSpan = document.getElementById('ancient-coins-count');
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
    const disconnectButton = document.getElementById('disconnect-button');

    // Game Constants & State
    const tonkeyMasterAddress = 'EQCn9sEMALm9Np1tkKZmKuK9h9z1mSbyDWQOPOup9mhe5pFB';
    const SHOP_RECIPIENT_ADDRESS = 'UQC4PB_Zs2z-1CetayPu1qE5yokaoZCoYc2TIrb3ZZDMwUIj'; // Placeholder
    const EXPLORE_COST_LHB = 5;
    const LOCAL_STORAGE_INTRO_KEY = 'hasCompletedIntro_TonkeyTrail_v1'; // Versioned key
    const LOCAL_STORAGE_DONKEY_NAME_KEY = 'tonkeyTrailDonkeyName_v1';

    let userTonkeyWalletAddress = null;
    let tonClient = null;
    let userWalletAddress = null; // Raw user address from wallet connection
    let currentDonkeyName = "Barnaby"; // Default

    // Player Game State
    let luckyHayBales = 50; // Start with some LHB
    let mysteryGeodesCount = 0;
    let shinyPebblesCount = 0;
    let ancientCoinsCount = 0;
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
        ancientCoinsCountSpan.textContent = ancientCoinsCount;
        premiumMapStatusSpan.textContent = hasPremiumMap ? "Active! Next explore is special." : "None";
        premiumMapStatusSpan.style.color = hasPremiumMap ? '#27AE60' : 'inherit';
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
            showTemporaryMessage(exploreMessageP, `${currentDonkeyName} needs more LHB for an adventure!`, 3000, true);
            if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
            return;
        }
        luckyHayBales -= EXPLORE_COST_LHB;
        let foundLHB = 0;
        let foundGeode = false;
        let foundPebbles = 0;
        let foundAncientCoin = false;
        let outcomeMessage = "";

        if (hasPremiumMap) {
            foundGeode = true;
            hasPremiumMap = false; 
            foundLHB = Math.floor(Math.random() * 5) + 3; // 3-7 LHB with map
            luckyHayBales += foundLHB;
            outcomeMessage = `✨ Using the Premium Map, ${currentDonkeyName} unerringly led you to a Mystery Geode and ${foundLHB} LHB!`;
            showTemporaryMessage(exploreMessageP, outcomeMessage, 4000);
        } else {
            const roll = Math.random();
            if (roll < 0.01) { // 1% nothing
                foundLHB = Math.floor(Math.random()*2)+1; // 1-2 LHB consolation
                luckyHayBales += foundLHB;
                outcomeMessage = `${currentDonkeyName} got distracted by a pretty butterfly but still found ${foundLHB} LHB.`;
            } else if (roll < 0.05) { // 4% Ancient Coin (total 5% rare tier)
                foundAncientCoin = true;
                ancientCoinsCount++;
                outcomeMessage = `Incredible! ${currentDonkeyName} sniffed out a rare Ancient Coin! These look valuable...`;
            } else if (roll < 0.20) { // 15% Shiny Pebbles (total 20% uncommon tier)
                foundPebbles = Math.floor(Math.random() * 3) + 1;
                shinyPebblesCount += foundPebbles;
                outcomeMessage = `${currentDonkeyName} kicked up some dust and uncovered ${foundPebbles} Shiny Pebbles!`;
            } else if (roll < 0.40) { // 20% Geode (total 40% good tier)
                foundGeode = true;
                mysteryGeodesCount++;
                outcomeMessage = `Great Scott! ${currentDonkeyName}'s keen eyes spotted a Mystery Geode!`;
            } else { // 60% Common LHB
                foundLHB = Math.floor(Math.random() * 11) + 5; // 5-15 LHB
                luckyHayBales += foundLHB;
                outcomeMessage = `${currentDonkeyName} munched on some grass and found ${foundLHB} Lucky Hay Bales!`;
            }
            showTemporaryMessage(exploreMessageP, outcomeMessage, 3500);
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
        let resultMessage = `${currentDonkeyName} carefully cracks open the geode... `;
        const randomRoll = Math.random();
        if (randomRoll < 0.6) { const foundLHB = Math.floor(Math.random()*20)+10; luckyHayBales+=foundLHB; resultMessage+=`and find ${foundLHB} LHB! Sweet as hay!`;}
        else if (randomRoll < 0.9) { const foundPebbles = Math.floor(Math.random()*3)+1; shinyPebblesCount+=foundPebbles; resultMessage+=`it reveals ${foundPebbles} Shiny Pebble(s)! Sparkly!`;}
        else { blueprintFragmentsCount++; resultMessage+=`WOW! A rare Blueprint Fragment! Wonder what this makes?`; document.getElementById('blueprint-fragments-count').parentElement.classList.remove('hidden');}
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
            showTemporaryMessage(geodeMessageP, `${itemName} is yours, happy trails with ${currentDonkeyName}!`, 3000);
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
                showTemporaryMessage(geodeMessageP, `Your Tonkey, ${currentDonkeyName}, already has a Premium Map!`);
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
            luckyHayBales = 50; mysteryGeodesCount = 0; shinyPebblesCount = 0; ancientCoinsCount = 0; hasPremiumMap = false; blueprintFragmentsCount = 0;
            updateAllDisplays(); 
            if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
        }
        loadingSpinnerDiv.classList.add('hidden');
    });

    if (tg && tg.MainButton) {
        tg.MainButton.setText('Close Trail');
        tg.MainButton.textColor = '#FFFFFF';
        tg.MainButton.color = '#AF601A'; // Donkey brown
        tg.MainButton.show();
        tg.MainButton.onClick(() => { tg.close(); });
    }

    // --- Intro Sequence Logic ---
    let currentStoryPart = 0;
    function showStoryPart(index) {
        console.log(`[IntroDebug] showStoryPart called with index: ${index}`);
        const storyParts = [
            document.getElementById('story-part-1'),
            document.getElementById('story-part-2'),
            document.getElementById('story-part-3')
        ];
        storyParts.forEach((part, i) => {
            if (!part) {
                console.error(`[IntroDebug] Story part element at index ${i} is null!`)
                return;
            }
            const shouldHide = i !== index;
            part.classList.toggle('hidden', shouldHide);
            console.log(`[IntroDebug] Story part ${i} hidden: ${shouldHide}`);
        });
        if (index >= storyParts.length) { // End of story, show naming
            const donkeyNamingPage = document.getElementById('donkey-naming-page');
            if(donkeyNamingPage) donkeyNamingPage.classList.remove('hidden');
            else console.error("[IntroDebug] donkeyNamingPage element is null!");
            console.log("[IntroDebug] Showing donkey naming page.");
        }
    }

    const nextStoryButtons = [
        document.getElementById('next-story-1'),
        document.getElementById('next-story-2'),
        document.getElementById('next-story-3')
    ];

    nextStoryButtons.forEach((button, index) => {
        button.addEventListener('click', () => {
            currentStoryPart = index + 1;
            showStoryPart(currentStoryPart);
        });
    });

    const donkeyNamingPage = document.getElementById('donkey-naming-page');
    const donkeyNameInput = document.getElementById('donkey-name-input');
    const confirmDonkeyNameButton = document.getElementById('confirm-donkey-name');
    const tempDonkeyNameDisplay = document.getElementById('temp-donkey-name-display');

    donkeyNameInput.addEventListener('input', () => {
        tempDonkeyNameDisplay.textContent = donkeyNameInput.value.trim() || "Tonkey";
    });

    if (confirmDonkeyNameButton) {
        confirmDonkeyNameButton.addEventListener('click', () => {
            const name = donkeyNameInput ? donkeyNameInput.value.trim() : '';
            if (name && name.length > 0 && name.length <= 20) {
                currentDonkeyName = name;
                localStorage.setItem(LOCAL_STORAGE_DONKEY_NAME_KEY, currentDonkeyName);
                localStorage.setItem(LOCAL_STORAGE_INTRO_KEY, 'true');
                console.log("[IntroDebug] Intro completed. Flag set. Donkey name:", currentDonkeyName);
                if(donkeyNamingPage) donkeyNamingPage.classList.add('hidden');
                if(connectAreaDiv) connectAreaDiv.classList.remove('hidden'); 
                updateAllDisplays();
            } else {
                showAlertFallback('Please give your Tonkey a name (1-20 characters)!');
            }
        });
    } else {
        console.error("[IntroDebug] confirmDonkeyNameButton not found!");
    }

    function checkIntroStatus() {
        console.log("[IntroDebug] checkIntroStatus called.");
        const hasDoneIntro = localStorage.getItem(LOCAL_STORAGE_INTRO_KEY);
        const savedName = localStorage.getItem(LOCAL_STORAGE_DONKEY_NAME_KEY);
        console.log(`[IntroDebug] localStorage - hasDoneIntro: ${hasDoneIntro}, savedName: ${savedName}`);

        if (savedName) currentDonkeyName = savedName;

        // --- ADDED DEBUG FOR introOverlay --- 
        const introOverlay = document.getElementById('intro-sequence-overlay');
        if (!introOverlay) {
            console.error("[IntroDebugCRITICAL] introOverlay element NOT FOUND by getElementById!");
        } else {
            console.log("[IntroDebug] introOverlay found. Current classes:", introOverlay.className);
        }
        // --- END ADDED DEBUG ---

        if (hasDoneIntro === 'true') {
            console.log("[IntroDebug] Intro already completed. Showing connect area.");
            if(introOverlay) introOverlay.classList.add('hidden');
            else console.error("[IntroDebug] introOverlay element is null in hasDoneIntro branch!"); // Should not happen if above check passes
            if(connectAreaDiv) connectAreaDiv.classList.remove('hidden');
            else console.error("[IntroDebug] connectAreaDiv element is null in hasDoneIntro branch!");
        } else {
            console.log("[IntroDebug] Intro not completed or first run. Starting intro sequence.");
            if(introOverlay) {
                introOverlay.classList.remove('hidden');
                console.log("[IntroDebug] Called introOverlay.classList.remove('hidden'). New classes:", introOverlay.className);
            } else {
                // This path should ideally not be taken if the earlier check is in place
                console.error("[IntroDebug] introOverlay element is null in fresh intro branch! CANNOT SHOW INTRO.");
            }
            if(connectAreaDiv) connectAreaDiv.classList.add('hidden');
            if(gameContainerDiv) gameContainerDiv.classList.add('hidden');
            showStoryPart(0);
        }
    }

    disconnectButton.addEventListener('click', async () => {
        if (tonConnectUI.connected) {
            await tonConnectUI.disconnect();
            // onStatusChange will handle UI changes and state reset
            showAlertFallback('You have left the trail. Come back soon!');
        }
    });

    checkIntroStatus(); // This will show intro or connect area
    updateAllDisplays(); // Initial UI setup for default values
}
// --------------- APP LOGIC ENDS HERE ----------------- 