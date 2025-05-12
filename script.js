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
    console.log('[DOM CHECK] connectAreaDiv:', connectAreaDiv ? 'Found' : 'NOT FOUND');
    const loadingSpinnerDiv = document.getElementById('loading-spinner');
    console.log('[DOM CHECK] loadingSpinnerDiv:', loadingSpinnerDiv ? 'Found' : 'NOT FOUND');

    // UI Elements - Intro
    const introOverlay = document.getElementById('intro-sequence-overlay');
    console.log('[DOM CHECK] introOverlay:', introOverlay ? 'Found' : 'NOT FOUND');
    const storyPartElements = [
        document.getElementById('story-part-1'),
        document.getElementById('story-part-2'),
        document.getElementById('story-part-3'),
    ];
    console.log('[DOM CHECK] story-part-1:', storyPartElements[0] ? 'Found' : 'NOT FOUND');
    console.log('[DOM CHECK] story-part-2:', storyPartElements[1] ? 'Found' : 'NOT FOUND');
    console.log('[DOM CHECK] story-part-3:', storyPartElements[2] ? 'Found' : 'NOT FOUND');
    const donkeyNamingPage = document.getElementById('donkey-naming-page');
    console.log('[DOM CHECK] donkeyNamingPage:', donkeyNamingPage ? 'Found' : 'NOT FOUND');

    // UI Elements - Game Core
    const gameContainerDiv = document.getElementById('game-container');
    console.log('[DOM CHECK] gameContainerDiv:', gameContainerDiv ? 'Found' : 'NOT FOUND');
    const donkeyDisplayDiv = document.getElementById('donkey-display'); // For animations
    const donkeyNameP = document.getElementById('donkey-name'); // Get the donkey name paragraph
    
    // UI Elements - Persistent Balances (Top Right)
    const topTonkeyBalanceSpan = document.getElementById('top-tonkey-balance');
    const topLhbBalanceSpan = document.getElementById('top-lhb-balance');

    // UI Elements - Tabs
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabPanels = document.querySelectorAll('.tab-panel');
    
    // UI Elements - Stats & Inventory (within Inventory Tab)
    const tonkeyBalanceGameSpan = document.getElementById('tonkey-balance-game'); // This might be null if removed from HTML, adjust if so
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

    // Map Constants
    const LHB_REWARD_MIN = 1;
    const LHB_REWARD_MAX = 10;
    const ITEM_FIND_CHANCE = 0.15; // 15% chance to find an item
    const PREMIUM_MAP_COST = 100; // Cost in LHB - Note: Shop purchase uses Tonkey Token cost
    const MAP_ROWS = 10; // Map dimensions
    const MAP_COLS = 10;

    // State Variables
    let mapData = []; // Map state variable is needed
    const mapGridContainer = document.getElementById('map-grid-container');
    const mapMessage = document.getElementById('map-message');

    const tonConnectUI = new TonConnectUI({
        manifestUrl: 'https://dasberkant.github.io/tonkey_game/tonconnect-manifest.json', // Ensure this is your GitHub Pages URL
        buttonRootId: 'tonconnect-button-root',
        uiOptions: { twaReturnUrl: 'https://dasberkant.github.io/tonkey_game/' }
    });

    // --- Map Functions (defined inside initializeAppLogic) ---
    function initializeMap() {
        // Only init if needed (e.g., load failed or dimensions changed)
        if (!mapData || mapData.length !== MAP_ROWS || (mapData.length > 0 && (!mapData[0] || mapData[0].length !== MAP_COLS))) {
            mapData = [];
            for (let r = 0; r < MAP_ROWS; r++) {
                mapData[r] = [];
                for (let c = 0; c < MAP_COLS; c++) {
                    mapData[r][c] = 0; // 0 = undiscovered
                }
            }
            console.log("Map initialized with default values.");
        } else {
            console.log("Map already populated, possibly from saved state.");
        }
    }

    function renderMap() {
        if (!mapGridContainer) {
            console.warn("Map grid container not found during renderMap!");
            return;
        }
        mapGridContainer.innerHTML = ''; // Clear previous grid
        mapGridContainer.style.gridTemplateColumns = `repeat(${MAP_COLS}, 1fr)`;
        mapGridContainer.style.gridTemplateRows = `repeat(${MAP_ROWS}, 1fr)`;

        for (let r = 0; r < MAP_ROWS; r++) {
            for (let c = 0; c < MAP_COLS; c++) {
                const cell = document.createElement('div');
                cell.classList.add('map-cell');
                cell.dataset.row = r;
                cell.dataset.col = c;

                if (mapData && mapData[r] && mapData[r][c] === 1) { // Check mapData state
                    cell.classList.add('discovered');
                }
                mapGridContainer.appendChild(cell);
            }
        }
        // console.log("Map rendered.");
    }
    // --- End Map Functions ---

    // --- Central UI Visibility Management ---
    function updateUIVisibility() {
        const introDone = localStorage.getItem(LOCAL_STORAGE_INTRO_KEY) === 'true';
        const isConnected = tonConnectUI.connected; // Or check userWalletAddress if more direct

        console.log(`[UIUpdate] Updating visibility. IntroDone: ${introDone}, IsConnected: ${isConnected}, CurrentStoryPart: ${currentStoryPart}`);

        // Ensure all are potentially hidden first, then show the correct one.
        if (introOverlay) introOverlay.classList.add('hidden');
        else console.error("[UIUpdate] introOverlay is null!");

        if (connectAreaDiv) connectAreaDiv.classList.add('hidden');
        else console.error("[UIUpdate] connectAreaDiv is null!");

        if (gameContainerDiv) gameContainerDiv.classList.add('hidden');
        else console.error("[UIUpdate] gameContainerDiv is null!");
        
        // Naming page is part of intro sequence, managed by showStoryPart, but ensure it's hidden if introOverlay is hidden.
        if (donkeyNamingPage && introDone) donkeyNamingPage.classList.add('hidden');


        if (!introDone) {
            console.log("[UIUpdate] Showing intro sequence.");
            if (introOverlay) {
                introOverlay.classList.remove('hidden');
                // showStoryPart will manage children of introOverlay (story parts, naming page)
                showStoryPart(currentStoryPart); // Ensure currentStoryPart is correctly set
            }
        } else if (!isConnected) {
            console.log("[UIUpdate] Intro done, not connected. Showing connect area.");
            if (connectAreaDiv) connectAreaDiv.classList.remove('hidden');
        } else { // Intro done AND connected
            console.log("[UIUpdate] Intro done, connected. Showing game container.");
            if (gameContainerDiv) gameContainerDiv.classList.remove('hidden');
        }
    }

    // --- UI Update Functions ---
    function updateAllDisplays() {
        // Update persistent top-right balances
        // The line that was here trying to set topTonkeyBalanceSpan.textContent has been removed.
        // topTonkeyBalanceSpan is updated by fetchAndDisplayTonkeyBalance() or by onStatusChange() upon disconnect.
        
        if (topLhbBalanceSpan) topLhbBalanceSpan.textContent = luckyHayBales;
        else console.error("topLhbBalanceSpan not found");

        // Update balances in the Inventory Tab
        // Note: tonkeyBalanceGameSpan (the variable for an element with id 'tonkey-balance-game') is null 
        // because the HTML element was removed. So, no update needed for it here.
        if (lhbBalanceSpan) lhbBalanceSpan.textContent = luckyHayBales;
        else console.error("lhbBalanceSpan (inventory tab) not found");

        if (geodesCountSpan) geodesCountSpan.textContent = mysteryGeodesCount;
        else console.error("geodesCountSpan not found");
        if (pebblesCountSpan) pebblesCountSpan.textContent = shinyPebblesCount;
        else console.error("pebblesCountSpan not found");
        if (ancientCoinsCountSpan) ancientCoinsCountSpan.textContent = ancientCoinsCount;
        else console.error("ancientCoinsCountSpan not found");
        if (premiumMapStatusSpan) {
            premiumMapStatusSpan.textContent = hasPremiumMap ? "Acquired" : "Not Owned";
            premiumMapStatusSpan.style.color = hasPremiumMap ? 'green' : 'grey';
        } else console.error("premiumMapStatusSpan not found");
        if (blueprintFragmentsCountSpan) blueprintFragmentsCountSpan.textContent = blueprintFragmentsCount;
        else console.error("blueprintFragmentsCountSpan not found");
        
        if (crackGeodeButton) crackGeodeButton.disabled = mysteryGeodesCount === 0;
        else console.error("crackGeodeButton not found");
        if (exploreButton) exploreButton.textContent = `Go Exploring! (-${EXPLORE_COST_LHB} LHB)`;
        else console.error("exploreButton not found");
        
        if (donkeyNameP) donkeyNameP.textContent = currentDonkeyName; // Update donkey name display
        else console.error("donkeyNameP not found");
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
        if (!userWalletAddress || !tonClient) { 
            if (topTonkeyBalanceSpan) topTonkeyBalanceSpan.textContent = 'N/A'; 
            // if (tonkeyBalanceGameSpan) tonkeyBalanceGameSpan.textContent = 'N/A'; // If it still exists
            return; 
        }
        if (topTonkeyBalanceSpan) topTonkeyBalanceSpan.textContent = '...'; // Fetching indicator for top display
        // if (tonkeyBalanceGameSpan) tonkeyBalanceGameSpan.textContent = '...'; // Fetching indicator for tab display if it exists

        userTonkeyWalletAddress = await getJettonWalletAddress(userWalletAddress, tonkeyMasterAddress);
        if (userTonkeyWalletAddress) {
            const balance = await getJettonBalance(userTonkeyWalletAddress);
            if (topTonkeyBalanceSpan) topTonkeyBalanceSpan.textContent = balance;
            // if (tonkeyBalanceGameSpan) tonkeyBalanceGameSpan.textContent = balance; // If it still exists
        } else {
            if (topTonkeyBalanceSpan) topTonkeyBalanceSpan.textContent = '0.00';
            // if (tonkeyBalanceGameSpan) tonkeyBalanceGameSpan.textContent = '0.00 (No Jetton Wallet)'; // If it still exists
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
        console.log("Explore button clicked");
        if (luckyHayBales < EXPLORE_COST_LHB) {
            showTemporaryMessage(exploreMessageP, `${currentDonkeyName} needs more LHB for an adventure!`, 3000, true);
            if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
            return;
        }
        luckyHayBales -= EXPLORE_COST_LHB;

        // --- Map Exploration Part --- 
        let mapUpdateMsg = "";
        let undiscoveredCells = [];
        if (mapData && mapData.length === MAP_ROWS) { // Ensure mapData is initialized
            for (let r = 0; r < MAP_ROWS; r++) {
                for (let c = 0; c < MAP_COLS; c++) {
                    if (mapData[r][c] === 0) {
                        undiscoveredCells.push({ r, c });
                    }
                }
            }
        } else {
             console.error("Explore clicked but mapData is not ready!");
             initializeMap(); // Attempt to fix it
             // Re-calculate undiscovered cells after fixing (optional, maybe just skip reveal this time)
             mapUpdateMsg = "Map data needed refresh.";
        }

        if (undiscoveredCells.length > 0) {
            const randomIndex = Math.floor(Math.random() * undiscoveredCells.length);
            const cellToReveal = undiscoveredCells[randomIndex];
            mapData[cellToReveal.r][cellToReveal.c] = 1; // Mark discovered
            renderMap(); // Update map visually
            mapUpdateMsg = `Discovered a new area at (${cellToReveal.c + 1}, ${cellToReveal.r + 1})!`;
            if (mapMessage) { // Check element exists
                mapMessage.textContent = mapUpdateMsg;
                mapMessage.className = 'message-area success';
            } else { console.warn("mapMessage element not found for update."); }
        } else if (!mapUpdateMsg) { // Avoid overwriting refresh message
            mapUpdateMsg = "The entire map is already explored!";
            if (mapMessage) {
                mapMessage.textContent = mapUpdateMsg;
                mapMessage.className = 'message-area info';
            }
        }
        // Clear map message after a delay?
        // setTimeout(() => { if(mapMessage) mapMessage.textContent = ''; }, 5000);
        // --- End Map Exploration Part ---

        // Existing reward calculation logic...
        let foundLHB = 0;
        let foundGeode = false;
        let foundPebbles = 0;
        let foundAncientCoin = false;
        let outcomeMessage = "";

        if (hasPremiumMap && mapUpdateMsg.includes('Discovered')) { // Use premium map only if a new area was discovered
            hasPremiumMap = false; // Consume the map
            // TODO: Optionally give a better reward or reveal more map cells here?
            // For now, just consuming it.
            outcomeMessage = `✨ Used the Premium Map while exploring!`;
             // Update premium map status display
             if(premiumMapStatusSpan) premiumMapStatusSpan.textContent = 'Not Owned'; premiumMapStatusSpan.style.color = 'grey';
        }
        
        // Continue with standard random rewards (or adjust based on premium map use)
        const roll = Math.random();
        if (roll < 0.01) { 
            foundLHB = Math.floor(Math.random()*2)+1; luckyHayBales += foundLHB;
            outcomeMessage += ` ${currentDonkeyName} got distracted but still found ${foundLHB} LHB.`;
        } else if (roll < 0.05) { 
            foundAncientCoin = true; ancientCoinsCount++;
            outcomeMessage += ` Incredible! ${currentDonkeyName} sniffed out an Ancient Coin!`;
        } else if (roll < 0.20) { 
            foundPebbles = Math.floor(Math.random() * 3) + 1; shinyPebblesCount += foundPebbles;
            outcomeMessage += ` ${currentDonkeyName} uncovered ${foundPebbles} Shiny Pebbles!`;
        } else if (roll < 0.40) { 
            foundGeode = true; mysteryGeodesCount++;
            outcomeMessage += ` Great Scott! ${currentDonkeyName} spotted a Mystery Geode!`;
        } else { 
            foundLHB = Math.floor(Math.random() * 11) + 5; luckyHayBales += foundLHB;
            outcomeMessage += ` ${currentDonkeyName} munched on grass and found ${foundLHB} LHB!`;
        }

        showTemporaryMessage(exploreMessageP, outcomeMessage.trim(), 3500); // Show item/LHB rewards in Action tab

        updateAllDisplays(); // Update numerical displays
        saveGameState(); // Save after exploration changes state
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
            // updateAllDisplays() is called in handleShopPurchase
        });
    });
    // --- End Game Logic ---

    // --- Tab Navigation Logic ---
    function showTab(tabIdToShow) {
        console.log("[Tabs] Attempting to show tab:", tabIdToShow);
        tabPanels.forEach(panel => {
            if (panel) {
                panel.classList.add('hidden');
            } else {
                console.error("[Tabs] A tab panel element is null.");
            }
        });
        const panelToShow = document.getElementById(tabIdToShow);
        if (panelToShow) {
            panelToShow.classList.remove('hidden');
            console.log("[Tabs] Successfully shown tab:", tabIdToShow);
        } else {
            console.error("[Tabs] Panel to show not found:", tabIdToShow);
        }

        tabButtons.forEach(button => {
            if (button) {
                button.classList.remove('active');
                if (button.getAttribute('data-tab') === tabIdToShow) {
                    button.classList.add('active');
                }
            } else {
                console.error("[Tabs] A tab button element is null.");
            }
        });
    }

    tabButtons.forEach(button => {
        if (button) {
            button.addEventListener('click', () => {
                const tabId = button.getAttribute('data-tab');
                if (tabId) {
                    showTab(tabId);
                }
            });
        } else {
            console.error("[Tabs] Failed to attach listener: A tab button element is null.");
        }
    });

    // --- Initialization & Wallet Connection Handling ---
    tonConnectUI.onStatusChange(async wallet => {
        console.log("[Debug] onStatusChange triggered. Wallet:", wallet ? wallet.account.address : 'null');
        if(loadingSpinnerDiv) loadingSpinnerDiv.classList.remove('hidden');
        else console.error("[onStatusChange] loadingSpinnerDiv is null!");


        if (wallet) {
            console.log("[Debug] Wallet connected processing.");
            userWalletAddress = wallet.account.address;
            tonClient = getTonClient(wallet.account.chain);
            await fetchAndDisplayTonkeyBalance(); // Fetch balance when connected
                                                // game state (like LHB) should NOT reset on connect, only on disconnect.
        } else { // Disconnected or initial state (before intro completion handled by updateUIVisibility)
            console.log("[Debug] Wallet disconnected or not yet connected processing.");
            userWalletAddress = null; tonClient = null; userTonkeyWalletAddress = null;
            // Reset game state on disconnect
            luckyHayBales = 50; mysteryGeodesCount = 0; shinyPebblesCount = 0; ancientCoinsCount = 0; hasPremiumMap = false; blueprintFragmentsCount = 0;
            currentDonkeyName = "Barnaby"; // Reset name on disconnect if not persisted elsewhere or re-fetched
            
            if (topTonkeyBalanceSpan) topTonkeyBalanceSpan.textContent = '--'; // Explicitly clear Tonkey balance on disconnect

            // Consider if donkey name should also be cleared from localStorage on disconnect, or if it persists. For now, it persists.
        }

        updateUIVisibility(); // Central place to update visibility
        updateAllDisplays(); // Update numerical displays after state changes & potential game state reset

        // Haptic feedback based on the new state
        const introDone = localStorage.getItem(LOCAL_STORAGE_INTRO_KEY) === 'true';
        if (wallet && introDone) { // Connected and intro done
            if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
        } else if (!wallet && introDone) { // Disconnected and intro done
            if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
        }

        if(loadingSpinnerDiv) loadingSpinnerDiv.classList.add('hidden');
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
        console.log(`[IntroDebug] showStoryPart called with index: ${index}. Target element IDs: story-part-1, story-part-2, story-part-3`);
        storyPartElements.forEach((part, i) => {
            if (!part) { console.error(`[IntroDebug] Story part element at index ${i} is null! Make sure storyPartElements array is correct.`); return; }
            const shouldHide = i !== index;
            part.classList.toggle('hidden', shouldHide);
            // console.log(`[IntroDebug] Story part ${i} (${part.id}) hidden: ${shouldHide}`);
        });

        if (!donkeyNamingPage) console.error("[IntroDebug] donkeyNamingPage element is null in showStoryPart!");

        if (index >= storyPartElements.filter(p => p !== null).length) { // Check against actual available story parts
            if (donkeyNamingPage) donkeyNamingPage.classList.remove('hidden');
            console.log("[IntroDebug] Showing donkey naming page.");
        } else {
             if (donkeyNamingPage) donkeyNamingPage.classList.add('hidden'); // Ensure naming page is hidden during story
        }
    }

    const nextStoryButtons = [
        document.getElementById('next-story-1'),
        document.getElementById('next-story-2'),
        document.getElementById('next-story-3')
    ];

    nextStoryButtons.forEach((button, index) => {
        if(button) button.addEventListener('click', () => {
            currentStoryPart = index + 1;
            showStoryPart(currentStoryPart);
        });
        else console.error(`[IntroDebug] nextStoryButton at index ${index} is null`);
    });

    const donkeyNameInput = document.getElementById('donkey-name-input');
    const confirmDonkeyNameButton = document.getElementById('confirm-donkey-name');
    const tempDonkeyNameDisplay = document.getElementById('temp-donkey-name-display');

    donkeyNameInput.addEventListener('input', () => {
        if(tempDonkeyNameDisplay) tempDonkeyNameDisplay.textContent = donkeyNameInput.value.trim() || "Tonkey";
    });

    if (confirmDonkeyNameButton) {
        confirmDonkeyNameButton.addEventListener('click', () => {
            const name = donkeyNameInput ? donkeyNameInput.value.trim() : '';
            if (name && name.length > 0 && name.length <= 20) {
                currentDonkeyName = name;
                localStorage.setItem(LOCAL_STORAGE_DONKEY_NAME_KEY, currentDonkeyName);
                localStorage.setItem(LOCAL_STORAGE_INTRO_KEY, 'true');
                console.log("[IntroDebug] Intro completed. Flag set. Donkey name:", currentDonkeyName);
                
                // No direct DOM manipulation for introOverlay, connectAreaDiv here.
                // updateUIVisibility will handle showing the connectAreaDiv.
                updateUIVisibility();
                updateAllDisplays(); // Update displays like donkey name if it's shown somewhere else.
            } else {
                showAlertFallback('Please give your Tonkey a name (1-20 characters)!');
            }
        });
    } else {
        console.error("[IntroDebugCRITICAL] confirmDonkeyNameButton not found!");
    }

    function initializeView() {
        console.log("[ViewInit] Initializing view state.");
        const hasDoneIntro = localStorage.getItem(LOCAL_STORAGE_INTRO_KEY) === 'true';
        const savedName = localStorage.getItem(LOCAL_STORAGE_DONKEY_NAME_KEY);
        console.log(`[ViewInit] localStorage - hasDoneIntro: ${hasDoneIntro}, savedName: ${savedName}`);

        if (savedName) {
            currentDonkeyName = savedName;
            if(donkeyNameP) donkeyNameP.textContent = currentDonkeyName; // Update display using the new p tag
        } else {
            currentDonkeyName = "Barnaby"; // Default if no saved name
            if(donkeyNameP) donkeyNameP.textContent = currentDonkeyName;
        }
        
        if (!introOverlay) console.error("[ViewInitCRITICAL] introOverlay element NOT FOUND!");
        // if (!connectAreaDiv) console.error("[ViewInitCRITICAL] connectAreaDiv element NOT FOUND!"); // For completeness
        // if (!gameContainerDiv) console.error("[ViewInitCRITICAL] gameContainerDiv element NOT FOUND!"); // For completeness


        if (!hasDoneIntro) {
            console.log("[ViewInit] Intro not completed or first run. Setting story to part 0.");
            currentStoryPart = 0; 
        } else {
            console.log("[ViewInit] Intro already completed.");
            // currentStoryPart might be irrelevant if intro is done, but doesn't hurt to be out of bounds for story parts
            currentStoryPart = storyPartElements.length; // Effectively ensures naming page or nothing is shown by showStoryPart if called
        }
        // All UI showing/hiding is now handled by updateUIVisibility
        updateUIVisibility();

        // Now load all game state here before initializing map/view
        loadGameState(); // Load LHB, items, AND map data
        
        // Initialize map using potentially loaded data
        initializeMap(); 
    }

    disconnectButton.addEventListener('click', async () => {
        if (tonConnectUI.connected) {
            await tonConnectUI.disconnect();
            // onStatusChange will handle UI changes and state reset
            showAlertFallback('You have left the trail. Come back soon!');
        }
    });

    initializeView(); // Sets up intro/connect/game visibility and loads game state/map
    renderMap();     // Render the map based on initial/loaded state after view is initialized
    updateAllDisplays(); // Update all text displays based on loaded state
    showTab('actions-tab-content'); // Set default tab after everything is loaded and rendered
}

// Make map functions accessible outside initializeAppLogic if needed, 
// otherwise define them inside or pass necessary variables.
// For simplicity, define them outside for now, assuming mapData and constants are accessible.

// Need to declare mapData outside initializeAppLogic or pass it around.
// Let's keep mapData declared inside initializeAppLogic for now and pass it where needed,
// or make map functions inner functions of initializeAppLogic.

// Decision: Make map functions inner functions of initializeAppLogic for easier access to state and UI elements.

function initializeUI() {
    // Assign elements to the declared variables
    connectWalletButton = document.getElementById('ton-connect-button-root');
    walletInfoDiv = document.getElementById('wallet-info');
    disconnectButton = document.getElementById('disconnect-button');
    gameContainerDiv = document.getElementById('game-container');
    actionsTabContent = document.getElementById('actions-tab-content');
    shopTabContent = document.getElementById('shop-tab-content');
    inventoryTabContent = document.getElementById('inventory-tab-content');
    mapTabContent = document.getElementById('map-tab-content');
    mapGridContainer = document.getElementById('map-grid-container');
    mapMessage = document.getElementById('map-message');

    spendInput = document.getElementById('spend-amount');
    spendButton = document.getElementById('spend-button');
    spendMessage = document.getElementById('spend-message');
    exploreButton = document.getElementById('explore-button');
    exploreMessage = document.getElementById('explore-message');

    tonkeyBalanceSpan = document.getElementById('tonkey-balance');
    lhbBalanceSpan = document.getElementById('lhb-balance');
    carrotCountSpan = document.getElementById('carrot-count');
    stickCountSpan = document.getElementById('stick-count');
    premiumMapStatusSpan = document.getElementById('premium-map-status');

    buyPremiumMapButton = document.getElementById('buy-premium-map-button');
    shopMessage = document.getElementById('shop-message');
    inventoryMessage = document.getElementById('inventory-message');

    // Tab related elements
    tabButtons = document.querySelectorAll('.tab-button');
    tabPanels = document.querySelectorAll('.tab-panel');

    // Event Listeners
    if (disconnectButton) {
        disconnectButton.addEventListener('click', disconnectWallet);
    } else {
        console.error("Disconnect button not found during initialization.");
    }
    if (spendButton) {
        spendButton.addEventListener('click', initiateSpendTransaction);
    } else {
        console.error("Spend button not found during initialization.");
    }
    if (exploreButton) {
        exploreButton.addEventListener('click', explore);
    } else {
        console.error("Explore button not found during initialization.");
    }
    if (buyPremiumMapButton) {
        buyPremiumMapButton.addEventListener('click', buyPremiumMap);
    } else {
        console.error("Buy Premium Map button not found during initialization.");
    }

    setupTabs();

    // Show default tab (actions)
    showTab('actions-tab-content');
}

function setupTabs() {
    // ... existing code ...
}

// --- Game Actions ---

function explore() {
    if (!currentWalletInfo) {
        exploreMessage.textContent = "Connect your wallet to explore!";
        exploreMessage.className = 'message-area error';
        return;
    }
    console.log("Explore action triggered. LHB:", lhbBalance, "Carrots:", carrotCount, "Sticks:", stickCount);
    if (lhbBalance < 1 && carrotCount < 1 && stickCount < 1) {
        exploreMessage.textContent = "You need at least 1 LHB, Carrot, or Stick to explore!";
        exploreMessage.className = 'message-area error';
        return;
    }

    let costMsg = "";
    if (lhbBalance >= 1) {
        lhbBalance -= 1;
        costMsg = "Used 1 LHB.";
    } else if (carrotCount >= 1) {
        carrotCount -= 1;
        costMsg = "Used 1 Carrot.";
    } else if (stickCount >= 1) {
        stickCount -= 1;
        costMsg = "Used 1 Stick.";
    }

    let undiscoveredCells = [];
    if (mapData && mapData.length === MAP_ROWS) { // Ensure mapData is initialized
        for (let r = 0; r < MAP_ROWS; r++) {
            for (let c = 0; c < MAP_COLS; c++) {
                if (mapData[r][c] === 0) {
                    undiscoveredCells.push({ r, c });
                }
            }
        }
    } else {
        exploreMessage.textContent = "Map data not ready. Please wait or refresh.";
        exploreMessage.className = 'message-area error';
        initializeMap(); // Attempt to re-initialize if map data is missing
        renderMap();
        return;
    }


    let mapUpdateMsg = "";
    if (undiscoveredCells.length > 0) {
        const randomIndex = Math.floor(Math.random() * undiscoveredCells.length);
        const cellToReveal = undiscoveredCells[randomIndex];
        mapData[cellToReveal.r][cellToReveal.c] = 1;
        renderMap();
        mapUpdateMsg = `Discovered a new area at (${cellToReveal.c + 1}, ${cellToReveal.r + 1})!`;
        if(mapMessage) { // Check if mapMessage element exists
             mapMessage.textContent = mapUpdateMsg;
             mapMessage.className = 'message-area success';
        }
        console.log(mapUpdateMsg);
    } else {
        mapUpdateMsg = "The entire map is already explored!";
        if(mapMessage) {
            mapMessage.textContent = mapUpdateMsg;
            mapMessage.className = 'message-area info';
        }
    }

    let rewardMsg = "";
    const reward = Math.floor(Math.random() * (LHB_REWARD_MAX - LHB_REWARD_MIN + 1)) + LHB_REWARD_MIN;
    lhbBalance += reward;
    rewardMsg = `Found ${reward} Lucky Hay Bales (LHB)!`;

    let itemFoundMsg = "";
    if (Math.random() < ITEM_FIND_CHANCE) {
        const items = ['Carrot', 'Stick'];
        const foundItem = items[Math.floor(Math.random() * items.length)];
        if (foundItem === 'Carrot') {
            carrotCount++;
            itemFoundMsg = "Found a juicy Carrot!";
        } else {
            stickCount++;
            itemFoundMsg = "Found a sturdy Stick!";
        }
    }

    exploreMessage.textContent = `${costMsg} ${rewardMsg} ${itemFoundMsg}`.trim();
    exploreMessage.className = 'message-area success';
    updateAllDisplays();
    saveGameState();
}

function buyPremiumMap() {
    if (!currentWalletInfo) {
        shopMessage.textContent = "Connect your wallet first!";
        shopMessage.className = 'message-area error';
        return;
    }
    if (hasPremiumMap) {
        shopMessage.textContent = "You already own the Premium Map.";
        shopMessage.className = 'message-area info';
        return;
    }
    if (lhbBalance < PREMIUM_MAP_COST) {
        shopMessage.textContent = `Not enough LHB. You need ${PREMIUM_MAP_COST}.`;
        shopMessage.className = 'message-area error';
        return;
    }

    lhbBalance -= PREMIUM_MAP_COST;
    hasPremiumMap = true;
    // premiumMapStatusSpan, buyPremiumMapButton, shopMessage will be updated in updateAllDisplays
    shopMessage.textContent = "Successfully bought the Premium Map! It might reveal more when exploring.";
    shopMessage.className = 'message-area success';
    updateAllDisplays();
    saveGameState();
}

// --- Blockchain Interaction (TonConnect & ton.js) ---
// ... existing code ...

// --- UI Update Functions ---

function updateWalletInfo(walletInfo) {
// ... existing code ...
}

function updateUIForConnectionState(isConnected) {
// ... existing code ...
}

function updateAllDisplays() {
    // Ensure elements are available before trying to update them
    if (!tonkeyBalanceSpan || !lhbBalanceSpan || !carrotCountSpan || !stickCountSpan || 
        !premiumMapStatusSpan || !buyPremiumMapButton || !spendInput || !spendButton || !exploreButton) {
        // console.warn("UI elements not ready for updateAllDisplays. DOM might not be fully initialized.");
        return;
    }

    tonkeyBalanceSpan.textContent = currentTonkeyBalance !== null ? `${currentTonkeyBalance} TKY` : 'Loading...';
    lhbBalanceSpan.textContent = lhbBalance;
    carrotCountSpan.textContent = carrotCount;
    stickCountSpan.textContent = stickCount;

    premiumMapStatusSpan.textContent = hasPremiumMap ? 'Acquired' : 'Not Owned';
    premiumMapStatusSpan.style.color = hasPremiumMap ? 'green' : 'grey';
    buyPremiumMapButton.disabled = hasPremiumMap || luckyHayBales < PREMIUM_MAP_COST;

    // Input States
    const interactable = !!userWalletAddress; // Can interact if wallet is connected
    spendInput.disabled = !interactable;
    spendButton.disabled = !interactable;
    exploreButton.disabled = !interactable;

    // Render map (Only if needed, usually handled by explore action)
    // renderMap();
}

function loadGameState() {
    console.log("Loading game state...");
    luckyHayBales = parseInt(localStorage.getItem('lhbBalance') || '50');
    mysteryGeodesCount = parseInt(localStorage.getItem('mysteryGeodesCount') || '0');
    shinyPebblesCount = parseInt(localStorage.getItem('shinyPebblesCount') || '0');
    ancientCoinsCount = parseInt(localStorage.getItem('ancientCoinsCount') || '0');
    hasPremiumMap = localStorage.getItem('hasPremiumMap') === 'true';
    blueprintFragmentsCount = parseInt(localStorage.getItem('blueprintFragmentsCount') || '0');
    
    const savedMapDataString = localStorage.getItem('mapData');
    if (savedMapDataString) {
        try {
            const parsedMapData = JSON.parse(savedMapDataString);
            // Validate structure and dimensions
            if (Array.isArray(parsedMapData) && parsedMapData.length === MAP_ROWS &&
                parsedMapData.every(row => Array.isArray(row) && row.length === MAP_COLS)) {
                mapData = parsedMapData;
                console.log("Map data loaded successfully.");
            } else {
                console.warn("Saved map data has incorrect dimensions/structure. Resetting map.");
                initializeMap(); // Will create a fresh map
            }
        } catch (e) {
            console.error("Failed to parse map data. Resetting map.", e);
            initializeMap(); // Will create a fresh map
        }
    } else {
        console.log("No saved map data found. Initializing new map.");
        initializeMap(); // Will create a fresh map
    }
}

function saveGameState() {
    console.log("Saving game state...");
    localStorage.setItem('lhbBalance', luckyHayBales.toString());
    localStorage.setItem('mysteryGeodesCount', mysteryGeodesCount.toString());
    localStorage.setItem('shinyPebblesCount', shinyPebblesCount.toString());
    localStorage.setItem('ancientCoinsCount', ancientCoinsCount.toString());
    localStorage.setItem('hasPremiumMap', hasPremiumMap.toString());
    localStorage.setItem('blueprintFragmentsCount', blueprintFragmentsCount.toString());
    
    // Save map state if it's valid
    if (mapData && mapData.length === MAP_ROWS) {
        localStorage.setItem('mapData', JSON.stringify(mapData));
        console.log("Map data saved.");
    } else {
         console.warn("Attempted to save invalid map data. Skipping map save.");
    }
}

// --- Utility Functions ---
// ... existing code ...
// --------------- APP LOGIC ENDS HERE ----------------- 
// Removed duplicate function definitions previously outside initializeAppLogic