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
    let luckyHayBales = 50;
    let mysteryGeodesCount = 0;
    let shinyPebblesCount = 0;
    let ancientCoinsCount = 0;
    let hasPremiumMap = false;
    let blueprintFragmentsCount = 0;
    let mapData = []; // Will store map cell data
    let currentMapPosition = { row: -1, col: -1 }; // Current position on map

    const CHAIN = { MAINNET: '-239', TESTNET: '-3' };

    // Map Constants
    const MAP_ROWS = 10;
    const MAP_COLS = 10;
    const TERRAIN_TYPES = ['grass', 'hills', 'mountains', 'water', 'forest', 'desert'];
    const SPECIAL_LOCATION_CHANCE = 0.15; // 15% chance for a cell to be a special location

    // State Variables
    const mapGridContainer = document.getElementById('map-grid-container');
    const mapMessage = document.getElementById('map-message');

    const tonConnectUI = new TonConnectUI({
        manifestUrl: 'https://dasberkant.github.io/tonkey_game/tonconnect-manifest.json', // Ensure this is your GitHub Pages URL
        buttonRootId: 'tonconnect-button-root',
        uiOptions: { twaReturnUrl: 'https://dasberkant.github.io/tonkey_game/' }
    });

    // --- Map Functions ---
    function initializeMap() {
        console.log("[Map] Initializing map data");
        
        // Force creation of a new map data structure regardless of prior state
        mapData = [];
        
        // Generate terrain data for all cells
        for (let r = 0; r < MAP_ROWS; r++) {
            mapData[r] = [];
            for (let c = 0; c < MAP_COLS; c++) {
                // Cell format: { discovered: false, terrain: 'type', special: false }
                const terrainIndex = Math.floor(Math.random() * TERRAIN_TYPES.length);
                const terrainType = TERRAIN_TYPES[terrainIndex];
                const isSpecial = Math.random() < SPECIAL_LOCATION_CHANCE;
                
                mapData[r][c] = {
                    discovered: false,
                    terrain: terrainType,
                    special: isSpecial,
                    isCurrent: false
                };
            }
        }
        
        // Ensure starting position is available at center
        const centerRow = Math.floor(MAP_ROWS / 2);
        const centerCol = Math.floor(MAP_COLS / 2);
        
        // Set the center cell as discovered and make it the current position
        mapData[centerRow][centerCol].discovered = true;
        mapData[centerRow][centerCol].terrain = 'grass'; // Start on grass
        mapData[centerRow][centerCol].special = false; // No special at start
        mapData[centerRow][centerCol].isCurrent = true;
        currentMapPosition = { row: centerRow, col: centerCol };
        
        console.log("[Map] New map initialized with center revealed at:", currentMapPosition);
        console.log("[Map] First few cells:", mapData[0][0], mapData[0][1], mapData[centerRow][centerCol]);
        
        // Explicitly call renderMap after initialization
        renderMap();
    }

    function renderMap() {
        console.log("[Map] renderMap called");
        
        // Check if we're in the initializeAppLogic scope
        const mapContainer = document.getElementById('map-grid-container');
        if (!mapContainer) {
            console.error("[Map] Map container #map-grid-container not found in DOM!");
            return;
        }
        
        // Check if mapData is properly initialized
        if (!mapData || !Array.isArray(mapData) || mapData.length === 0) {
            console.error("[Map] mapData is not properly initialized:", mapData);
            initializeMap(); // Try to initialize the map
            if (!mapData || !Array.isArray(mapData) || mapData.length === 0) {
                console.error("[Map] Failed to initialize mapData even after calling initializeMap()");
                return; // Still failed, give up
            }
        }
        
        console.log("[Map] Clearing map container and setting up grid");
        // Clear existing content
        mapContainer.innerHTML = '';
        
        // Set grid dimensions
        mapContainer.style.gridTemplateColumns = `repeat(${MAP_COLS}, 1fr)`;
        mapContainer.style.gridTemplateRows = `repeat(${MAP_ROWS}, 1fr)`;
        
        // Create cells
        console.log("[Map] Creating map cells");
        for (let r = 0; r < MAP_ROWS; r++) {
            for (let c = 0; c < MAP_COLS; c++) {
                const cell = document.createElement('div');
                cell.classList.add('map-cell');
                cell.dataset.row = r;
                cell.dataset.col = c;
                
                // Safety check - make sure mapData[r][c] exists
                if (!mapData[r] || !mapData[r][c]) {
                    console.error(`[Map] mapData[${r}][${c}] is undefined!`);
                    continue;
                }
                
                // Apply appropriate classes based on cell data
                if (mapData[r][c].discovered) {
                    cell.classList.add('discovered');
                    cell.classList.add(`terrain-${mapData[r][c].terrain}`);
                    
                    if (mapData[r][c].special) {
                        cell.classList.add('special-location');
                    }
                    
                    // Mark current position
                    if (r === currentMapPosition.row && c === currentMapPosition.col) {
                        cell.classList.add('current-location');
                    }
                }
                
                // Add click listener to show cell info
                cell.addEventListener('click', () => handleMapCellClick(r, c));
                
                mapContainer.appendChild(cell);
            }
        }
        
        console.log("[Map] Map rendering complete");
        
        // Force a layout reflow to ensure the grid is visible
        void mapContainer.offsetHeight;
    }
    
    function handleMapCellClick(row, col) {
        // Only handle clicks on discovered cells
        if (!mapData[row][col].discovered) {
            showTemporaryMessage(mapMessage, "This area hasn't been explored yet! Use the Explore button to discover new areas.", 3000);
            return;
        }
        
        // Clear any current cell
        if (currentMapPosition.row !== -1 && currentMapPosition.col !== -1) {
            mapData[currentMapPosition.row][currentMapPosition.col].isCurrent = false;
        }
        
        // Set new current position
        currentMapPosition = { row, col };
        mapData[row][col].isCurrent = true;
        
        // Get terrain info
        const terrainType = mapData[row][col].terrain;
        let terrainDescription = "";
        
        switch(terrainType) {
            case 'grass':
                terrainDescription = "Lush grassy plains stretch out before you. Perfect for grazing!";
                break;
            case 'hills':
                terrainDescription = "Rolling hills with a nice view. A bit of a climb for Tonkey!";
                break;
            case 'mountains':
                terrainDescription = "Majestic mountains tower overhead. The air is thin up here!";
                break;
            case 'water':
                terrainDescription = "A sparkling body of water. Tonkey isn't keen on swimming!";
                break;
            case 'forest':
                terrainDescription = "Dense forests with dappled sunlight. Watch for forest critters!";
                break;
            case 'desert':
                terrainDescription = "Arid desert sands. Tonkey's hooves sink slightly with each step.";
                break;
            default:
                terrainDescription = "An interesting area to explore.";
        }
        
        // Add special location info if applicable
        if (mapData[row][col].special) {
            terrainDescription += " There's something special about this place...";
        }
        
        // Display the information
        if (mapMessage) {
            mapMessage.textContent = terrainDescription;
            mapMessage.className = 'message-area';
        }
        
        // Re-render map to show new current position
        renderMap();
        saveGameState();
    }

    // --- Modify explore button to update map ---
    exploreButton.addEventListener('click', () => {
        // Instead of duplicating all the logic here, simply call the explore function
        explore();
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
        
        // Add special handling for map tab
        if (tabIdToShow === 'map-tab-content') {
            console.log("[Map] Map tab selected, forcing map render");
            setTimeout(() => {
                renderMap(); // Re-render the map when the tab is shown
            }, 100); // Small delay to ensure the tab is visible first
        }
        
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
    initializeMap(); // Ensure map is initialized
    renderMap();     // Render the map based on initial/loaded state after view is initialized
    updateAllDisplays(); // Update all text displays based on loaded state
    showTab('actions-tab-content'); // Set default tab after everything is loaded and rendered
    
    // Add a debug button to the UI for direct map access
    const debugContainer = document.createElement('div');
    debugContainer.style.position = 'fixed';
    debugContainer.style.bottom = '10px';
    debugContainer.style.right = '10px';
    debugContainer.style.zIndex = '9999';
    
    const debugButton = document.createElement('button');
    debugButton.textContent = 'Debug Map';
    debugButton.style.padding = '5px';
    debugButton.style.fontSize = '12px';
    debugButton.style.backgroundColor = '#ff6b6b';
    debugButton.addEventListener('click', () => {
        console.log("[Debug] Forcing map rendering...");
        console.log("[Debug] Current map data:", mapData);
        console.log("[Debug] Map container:", document.getElementById('map-grid-container'));
        
        showTab('map-tab-content');
        setTimeout(() => {
            initializeMap(); // Force reinitialize
            renderMap(); // Force render
        }, 100);
    });
    
    debugContainer.appendChild(debugButton);
    document.body.appendChild(debugContainer);
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
    console.log("[Explore] Explore function called");
    if (luckyHayBales < EXPLORE_COST_LHB) {
        exploreMessageP.textContent = `${currentDonkeyName} needs more LHB for an adventure!`;
        exploreMessageP.className = 'message-area error';
        return;
    }

    // Deduct cost
    luckyHayBales -= EXPLORE_COST_LHB;
    
    // --- Map Exploration Logic ---
    let potentialCells = [];
    
    // First, check if map data is properly initialized
    if (!mapData || !Array.isArray(mapData) || mapData.length !== MAP_ROWS) {
        console.error("[Explore] Map data not properly initialized!");
        initializeMap(); // Re-initialize the map
    }
    
    // Find unexplored cells adjacent to current position or any discovered cell
    if (currentMapPosition.row !== -1 && currentMapPosition.col !== -1) {
        // Check cells adjacent to current position first
        const directions = [
            [-1, 0], [1, 0], [0, -1], [0, 1], // Cardinal directions
            [-1, -1], [-1, 1], [1, -1], [1, 1] // Diagonals
        ];
        
        for (const [dr, dc] of directions) {
            const newRow = currentMapPosition.row + dr;
            const newCol = currentMapPosition.col + dc;
            
            if (newRow >= 0 && newRow < MAP_ROWS && newCol >= 0 && newCol < MAP_COLS && 
                mapData[newRow][newCol] && !mapData[newRow][newCol].discovered) {
                potentialCells.push({ row: newRow, col: newCol, distance: 1 });
            }
        }
    }
    
    // If no adjacent cells to current position, find cells adjacent to any discovered cell
    if (potentialCells.length === 0) {
        for (let r = 0; r < MAP_ROWS; r++) {
            for (let c = 0; c < MAP_COLS; c++) {
                if (mapData[r][c] && mapData[r][c].discovered) {
                    // Check adjacent cells (only cardinal directions)
                    const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
                    for (const [dr, dc] of directions) {
                        const newRow = r + dr;
                        const newCol = c + dc;
                        
                        if (newRow >= 0 && newRow < MAP_ROWS && newCol >= 0 && newCol < MAP_COLS && 
                            mapData[newRow][newCol] && !mapData[newRow][newCol].discovered) {
                            // Add if not already in the list
                            if (!potentialCells.some(cell => cell.row === newRow && cell.col === newCol)) {
                                potentialCells.push({ row: newRow, col: newCol, distance: 2 });
                            }
                        }
                    }
                }
            }
        }
    }
    
    // If still no cells, find any undiscovered cell
    if (potentialCells.length === 0) {
        for (let r = 0; r < MAP_ROWS; r++) {
            for (let c = 0; c < MAP_COLS; c++) {
                if (mapData[r][c] && !mapData[r][c].discovered) {
                    potentialCells.push({ row: r, col: c, distance: 999 });
                    // We just need to find one undiscovered cell to continue
                    break;
                }
            }
            if (potentialCells.length > 0) break;
        }
    }
    
    // Reveal a cell if we found potential cells
    let mapUpdateMsg = "";
    
    if (potentialCells.length > 0) {
        // Choose which cell to reveal based on Premium Map status
        let cellToReveal;
        
        if (hasPremiumMap) {
            // With Premium Map: Prefer special locations or closer cells
            potentialCells.sort((a, b) => {
                // First sort by whether it's a special location
                const aSpecial = mapData[a.row][a.col].special ? 1 : 0;
                const bSpecial = mapData[b.row][b.col].special ? 1 : 0;
                
                if (bSpecial !== aSpecial) return bSpecial - aSpecial;
                
                // Then by distance (closer is better)
                return a.distance - b.distance;
            });
            
            cellToReveal = potentialCells[0]; // Take best cell
            hasPremiumMap = false; // Consume the premium map
            
            mapUpdateMsg = `Using the Premium Map, ${currentDonkeyName} found a promising area!`;
        } else {
            // Regular exploration - random cell
            const randomIndex = Math.floor(Math.random() * Math.min(potentialCells.length, 3));
            cellToReveal = potentialCells[randomIndex];
            mapUpdateMsg = `${currentDonkeyName} explored and discovered a new area!`;
        }
        
        // Update the cell to be discovered
        mapData[cellToReveal.row][cellToReveal.col].discovered = true;
        
        // Update current position
        mapData[currentMapPosition.row][currentMapPosition.col].isCurrent = false;
        currentMapPosition = { row: cellToReveal.row, col: cellToReveal.col };
        mapData[cellToReveal.row][cellToReveal.col].isCurrent = true;
        
        // Get terrain details for the message
        const terrainType = mapData[cellToReveal.row][cellToReveal.col].terrain;
        const isSpecial = mapData[cellToReveal.row][cellToReveal.col].special;
        
        let terrainMsg = "";
        switch(terrainType) {
            case 'grass': terrainMsg = "grassy plains"; break;
            case 'hills': terrainMsg = "rolling hills"; break;
            case 'mountains': terrainMsg = "steep mountains"; break;
            case 'water': terrainMsg = "sparkling waters"; break;
            case 'forest': terrainMsg = "dense forest"; break;
            case 'desert': terrainMsg = "arid desert"; break;
            default: terrainMsg = "interesting terrain";
        }
        
        // Update the map message
        if (mapMessage) {
            mapMessage.textContent = `${mapUpdateMsg} You found ${isSpecial ? "a special area with " : ""}${terrainMsg}!`;
            mapMessage.className = 'message-area success';
        }
        
        // Re-render the map
        renderMap();
        
        // Terrain-specific bonuses for rewards
        let terrainBonus = 0;
        switch(terrainType) {
            case 'mountains': terrainBonus = 0.1; break; // Better for geodes
            case 'forest': terrainBonus = 0.05; break;   // Better for LHB
            case 'desert': terrainBonus = 0.1; break;    // Better for ancient coins
            case 'water': terrainBonus = 0.05; break;    // Better for pebbles
        }
        
        // Special location bonus
        if (isSpecial) terrainBonus += 0.15;
        
        // Standard rewards with terrain bonuses
        let outcomeMessage = "";
        const roll = Math.random();
        
        if (roll < 0.01) {
            // Very rare: almost nothing
            const foundLHB = Math.floor(Math.random() * 2) + 1;
            luckyHayBales += foundLHB;
            outcomeMessage = `${currentDonkeyName} got distracted but still found ${foundLHB} LHB.`;
        } else if (roll < (0.05 + terrainBonus)) {
            // Rare: Ancient Coin
            ancientCoinsCount++;
            outcomeMessage = `Incredible! ${currentDonkeyName} sniffed out a rare Ancient Coin!`;
        } else if (roll < (0.20 + terrainBonus)) {
            // Uncommon: Shiny Pebbles
            const foundPebbles = Math.floor(Math.random() * 3) + 1;
            shinyPebblesCount += foundPebbles;
            outcomeMessage = `${currentDonkeyName} found ${foundPebbles} Shiny Pebble${foundPebbles > 1 ? 's' : ''}!`;
        } else if (roll < (0.40 + terrainBonus)) {
            // Common: Geode
            mysteryGeodesCount++;
            outcomeMessage = `Great Scott! ${currentDonkeyName} spotted a Mystery Geode!`;
        } else {
            // Very common: LHB
            const foundLHB = Math.floor(Math.random() * 11) + 5;
            luckyHayBales += foundLHB;
            outcomeMessage = `${currentDonkeyName} munched on grass and found ${foundLHB} LHB!`;
        }
        
        // Display reward message
        exploreMessageP.textContent = outcomeMessage;
        exploreMessageP.className = 'message-area success';
    } else {
        // No more cells to explore
        mapUpdateMsg = "The entire map has been explored!";
        if (mapMessage) {
            mapMessage.textContent = mapUpdateMsg;
            mapMessage.className = 'message-area info';
        }
        
        // Still give some LHB as consolation
        const foundLHB = Math.floor(Math.random() * 5) + 3;
        luckyHayBales += foundLHB;
        exploreMessageP.textContent = `The map is fully explored, but ${currentDonkeyName} still found ${foundLHB} LHB!`;
        exploreMessageP.className = 'message-area info';
    }
    
    // Update displays and save state
    updateAllDisplays();
    saveGameState();
    
    // Haptic feedback
    if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
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
    console.log("[GameState] Loading game state...");
    // Load basic game state
    luckyHayBales = parseInt(localStorage.getItem('lhbBalance') || '50');
    mysteryGeodesCount = parseInt(localStorage.getItem('mysteryGeodesCount') || '0');
    shinyPebblesCount = parseInt(localStorage.getItem('shinyPebblesCount') || '0');
    ancientCoinsCount = parseInt(localStorage.getItem('ancientCoinsCount') || '0');
    hasPremiumMap = localStorage.getItem('hasPremiumMap') === 'true';
    blueprintFragmentsCount = parseInt(localStorage.getItem('blueprintFragmentsCount') || '0');
    
    // Load map data with proper format
    const savedMapDataString = localStorage.getItem('mapData');
    if (savedMapDataString) {
        try {
            mapData = JSON.parse(savedMapDataString);
            
            // Handle legacy map data format (convert if needed)
            if (Array.isArray(mapData) && mapData.length > 0 && typeof mapData[0][0] === 'number') {
                console.log("[GameState] Converting legacy map format");
                const newMapData = [];
                for (let r = 0; r < mapData.length; r++) {
                    newMapData[r] = [];
                    for (let c = 0; c < mapData[r].length; c++) {
                        const terrainType = TERRAIN_TYPES[Math.floor(Math.random() * TERRAIN_TYPES.length)];
                        const isSpecial = Math.random() < SPECIAL_LOCATION_CHANCE;
                        newMapData[r][c] = {
                            discovered: mapData[r][c] === 1,
                            terrain: terrainType,
                            special: isSpecial && mapData[r][c] === 1 // Only mark as special if discovered
                        };
                    }
                }
                mapData = newMapData;
            }
            
            // Validate structure and dimensions
            if (Array.isArray(mapData) && mapData.length === MAP_ROWS &&
                mapData.every(row => Array.isArray(row) && row.length === MAP_COLS)) {
                console.log("[GameState] Map data loaded successfully");
                
                // Load current position
                const savedPosition = localStorage.getItem('currentMapPosition');
                if (savedPosition) {
                    try {
                        currentMapPosition = JSON.parse(savedPosition);
                    } catch (e) {
                        console.error("[GameState] Failed to parse current position", e);
                        // Will be recalculated in initializeMap
                    }
                }
            } else {
                console.warn("[GameState] Saved map has incorrect dimensions/structure. Re-initializing map.");
                mapData = []; // Will trigger re-initialization in initializeMap
            }
        } catch (e) {
            console.error("[GameState] Failed to parse map data", e);
            mapData = []; // Will trigger re-initialization in initializeMap
        }
    } else {
        console.log("[GameState] No saved map data found. Will initialize new map.");
        mapData = []; // Will trigger re-initialization in initializeMap
    }
}

function saveGameState() {
    console.log("[GameState] Saving game state...");
    // Save basic game state
    localStorage.setItem('lhbBalance', luckyHayBales.toString());
    localStorage.setItem('mysteryGeodesCount', mysteryGeodesCount.toString());
    localStorage.setItem('shinyPebblesCount', shinyPebblesCount.toString());
    localStorage.setItem('ancientCoinsCount', ancientCoinsCount.toString());
    localStorage.setItem('hasPremiumMap', hasPremiumMap.toString());
    localStorage.setItem('blueprintFragmentsCount', blueprintFragmentsCount.toString());
    
    // Save map data
    if (mapData && mapData.length === MAP_ROWS) {
        localStorage.setItem('mapData', JSON.stringify(mapData));
        localStorage.setItem('currentMapPosition', JSON.stringify(currentMapPosition));
        console.log("[GameState] Map data saved");
    } else {
        console.warn("[GameState] Attempted to save invalid map data. Skipping map save.");
    }
}

// --- Utility Functions ---
// ... existing code ...
// --------------- APP LOGIC ENDS HERE ----------------- 
// Removed duplicate function definitions previously outside initializeAppLogic