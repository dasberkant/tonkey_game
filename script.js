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
    tg.ready();
    tg.expand();

    // The polling for window.Ton is no longer needed as we import 'ton' directly
    // const MAX_POLL_COUNT = 10;
    // let pollCount = 0;

    // function checkTonLibAndInit() { ... } // Remove this function
    // checkTonLibAndInit(); // Remove this call

    // Directly call initializeAppLogic as dependencies are handled by the bundler
    initializeAppLogic();

    // --------------- APP LOGIC STARTS HERE (moved into a function) ----------------- 
    function initializeAppLogic() {
        // UI Elements - Connection & Old
        const connectAreaDiv = document.getElementById('connect-area');
        const loadingSpinnerDiv = document.getElementById('loading-spinner');
        // const walletInfoDiv = document.getElementById('wallet-info'); // Kept for now, but display:none
        // const spendSectionDiv = document.getElementById('spend-section'); // Kept for now, but display:none

        // UI Elements - Game
        const gameContainerDiv = document.getElementById('game-container');
        const donkeyAreaDiv = document.getElementById('donkey-area'); // For future donkey image/customization
        const tonkeyBalanceGameSpan = document.getElementById('tonkey-balance-game');
        const lhbBalanceSpan = document.getElementById('lhb-balance');
        const exploreButton = document.getElementById('explore-button');
        const exploreMessageP = document.getElementById('explore-message');
        const buyPremiumMapButton = document.getElementById('buy-premium-map-button');
        const premiumMapCostSpan = document.getElementById('premium-map-cost');
        const buyGourmetOatsButton = document.getElementById('buy-gourmet-oats-button');
        const gourmetOatsCostSpan = document.getElementById('gourmet-oats-cost');

        const tonkeyMasterAddress = 'EQCn9sEMALm9Np1tkKZmKuK9h9z1mSbyDWQOPOup9mhe5pFB';
        const TONKEY_DECIMALS = 9;
        const SHOP_RECIPIENT_ADDRESS = 'UQC4PB_Zs2z-1CetayPu1qE5yokaoZCoYc2TIrb3ZZDMwUIj'; // Placeholder for game treasury/burn

        let userTonkeyWalletAddress = null;
        let tonClient = null;
        let luckyHayBales = 100; // Starting LHB
        let userWalletAddress = null; // store raw user address

        const CHAIN = {
            MAINNET: '-239',
            TESTNET: '-3'
        };

        // const tonConnectUI = new window.TON_CONNECT_UI.TonConnectUI({ // Remove this instantiation
        const tonConnectUI = new TonConnectUI({ // Use the imported TonConnectUI
            manifestUrl: 'https://dasberkant.github.io/tonkey_game/tonconnect-manifest.json',
            buttonRootId: 'tonconnect-button-root',
            uiOptions: {
                twaReturnUrl: 'https://dasberkant.github.io/tonkey_game/' // TODO: Replace with your actual TMA URL
            }
        });

        function updateLHBDisplay() {
            lhbBalanceSpan.textContent = luckyHayBales;
        }
        updateLHBDisplay(); // Initial display

        function getTonClient(networkChainId) {
            if (networkChainId === CHAIN.MAINNET) {
                return new TonClient({
                    // endpoint: 'https://ton.orbs.network/json-rpc', // Switched to Orbs Network RPC
                    endpoint: 'https://toncenter.com/api/v2/jsonRPC', // Reverted to toncenter.com for Mainnet
                });
            }
            // Default to Testnet if not Mainnet (or add more specific checks if other networks are possible)
            return new TonClient({
                // endpoint: 'https://testnet.tonhubapi.com/jsonRPC', // Assuming Tonhub has a similar testnet endpoint structure
                endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC', // Reverted to toncenter for Testnet
            });
        }

        async function getJettonWalletAddress(ownerAddressStr, jettonMasterAddrStr) {
            if (!tonClient) return null;
            try {
                const masterAddress = Address.parse(jettonMasterAddrStr);
                const ownerAddr = Address.parse(ownerAddressStr);
                const result = await tonClient.runMethod(masterAddress, 'get_wallet_address', [{ type: 'slice', cell: beginCell().storeAddress(ownerAddr).endCell() }]);
                return result.stack.readAddress().toString();
            } catch (error) {
                console.error('Error getting Jetton wallet address:', error);
                return null;
            }
        }

        async function getJettonBalance(jettonWalletAddrStr) {
            if (!tonClient || !jettonWalletAddrStr) return 'Error';
            try {
                const walletAddress = Address.parse(jettonWalletAddrStr);
                const result = await tonClient.runMethod(walletAddress, 'get_wallet_data');
                const balance = result.stack.readBigNumber(); // balance is a BigNumber
                // Format with TONKEY_DECIMALS
                return parseFloat(fromNano(balance)).toFixed(2); // Using fromNano for jettons with decimals
            } catch (error) {
                console.error('Error getting Jetton balance:', error);
                if (error.message && (error.message.includes('exit_code: -13') || error.message.includes('method not found'))){
                     return '0.00'; // Wallet exists but might be uninitialized for jettons or empty
                }
                return 'Error';
            }
        }
        
        async function fetchAndDisplayTonkeyBalance() {
            if (!userWalletAddress || !tonClient) {
                tonkeyBalanceGameSpan.textContent = 'N/A';
                return;
            }
            tonkeyBalanceGameSpan.textContent = 'Fetching...';
            userTonkeyWalletAddress = await getJettonWalletAddress(userWalletAddress, tonkeyMasterAddress);
            if (userTonkeyWalletAddress) {
                const balance = await getJettonBalance(userTonkeyWalletAddress);
                tonkeyBalanceGameSpan.textContent = balance;
            } else {
                tonkeyBalanceGameSpan.textContent = '0.00 (No Jetton Wallet)';
            }
        }

        tonConnectUI.onStatusChange(async wallet => {
            loadingSpinnerDiv.classList.remove('hidden');
            if (wallet) {
                userWalletAddress = wallet.account.address; // Store raw address
                const networkChainId = wallet.account.chain;
                tonClient = getTonClient(networkChainId);

                connectAreaDiv.classList.add('hidden');
                gameContainerDiv.style.display = 'block';
                
                await fetchAndDisplayTonkeyBalance();
                updateLHBDisplay(); // Ensure LHB is current

                if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
                loadingSpinnerDiv.classList.add('hidden');

            } else {
                userWalletAddress = null;
                tonClient = null;
                userTonkeyWalletAddress = null;
                
                connectAreaDiv.classList.remove('hidden');
                gameContainerDiv.style.display = 'none';
                tonkeyBalanceGameSpan.textContent = '--';
                // LHB balance can remain as it's client-side for now
                if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('light');
                loadingSpinnerDiv.classList.add('hidden');
            }
        });

        exploreButton.addEventListener('click', () => {
            const cost = 5;
            if (luckyHayBales >= cost) {
                luckyHayBales -= cost;
                const foundLHB = Math.floor(Math.random() * 10) + 5; // Found 5-14 LHB
                luckyHayBales += foundLHB;
                updateLHBDisplay();
                exploreMessageP.textContent = `Your Tonkey explored and found ${foundLHB} LHB!`;
                if (tg && tg.HapticFeedback) tg.HapticFeedback.impactOccurred('medium');
                setTimeout(() => exploreMessageP.textContent = '', 3000);
            } else {
                exploreMessageP.textContent = "Not enough LHB to explore!";
                if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
                setTimeout(() => exploreMessageP.textContent = '', 3000);
            }
        });

        async function handleShopPurchase(itemName, tokenAmountString, successCallback) {
            if (!tonConnectUI.connected || !userTonkeyWalletAddress || !tonClient) {
                showAlertFallback('Please connect your wallet properly to make a purchase.');
                return;
            }
            
            const confirmed = await showConfirmFallback(
                `Confirm purchase of ${itemName} for ${tokenAmountString} Tonkey Tokens? This is a REAL transaction.`
            );

            if (!confirmed) {
                showAlertFallback('Purchase cancelled.');
                return;
            }

            try {
                const jettonAmount = toNano(tokenAmountString); 
                const forwardTonAmount = toNano('0.005'); // Standard forward amount

                // Generic payload for item purchase, can be expanded later
                const body = beginCell()
                    .storeUint(0x0f8a7ea5, 32) // op code for jetton transfer
                    .storeUint(0, 64) // query_id
                    .storeCoins(jettonAmount)
                    .storeAddress(Address.parse(SHOP_RECIPIENT_ADDRESS))
                    .storeAddress(Address.parse(userWalletAddress)) // response_destination_address (sender)
                    .storeMaybeRef(null) // custom_payload (none for now)
                    .storeCoins(forwardTonAmount) // forward_ton_amount
                    .storeMaybeRef(null) // forward_payload (none for now)
                    .endCell();

                const transaction = {
                    validUntil: Math.floor(Date.now() / 1000) + 360, // 6 minutes
                    messages: [{
                        address: userTonkeyWalletAddress, // User's jetton wallet address
                        amount: toNano('0.05').toString(), // Amount to send for the transaction itself (covering fees)
                        payload: body.toBoc().toString('base64')
                    }]
                };
            
                const result = await tonConnectUI.sendTransaction(transaction);
                console.log('Transaction sent for ' + itemName + ':', result);
                showAlertFallback(`${itemName} purchase successful! Transaction sent.`);
                if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');

                // Call success callback (e.g., to update LHB)
                if (successCallback) successCallback();

                // Refresh Tonkey balance after a delay
                setTimeout(fetchAndDisplayTonkeyBalance, 7000);

            } catch (error) {
                console.error(`Transaction error for ${itemName}:`, error);
                showAlertFallback(`Transaction for ${itemName} failed: ` + (error.message || 'Unknown error'));
                if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
            }
        }

        buyPremiumMapButton.addEventListener('click', async () => {
            const cost = premiumMapCostSpan.textContent; // e.g. "10"
            handleShopPurchase('Premium Expedition Map', cost, () => {
                // Future: Add a "Premium Map" item to player inventory
                console.log('Premium Map effect would be applied here.');
            });
        });
        
        buyGourmetOatsButton.addEventListener('click', async () => {
            const cost = gourmetOatsCostSpan.textContent; // e.g. "5"
            handleShopPurchase('Gourmet Oats Package', cost, () => {
                luckyHayBales += 100;
                updateLHBDisplay();
                showAlertFallback('Added 100 LHB from Gourmet Oats!');
            });
        });

        // Helper function for alerts with fallback
        function showAlertFallback(message) {
            if (tg && tg.showAlert && typeof tg.showAlert === 'function') {
                try {
                    tg.showAlert(message);
                } catch (e) {
                    console.warn("tg.showAlert failed, falling back to window.alert:", e);
                    window.alert(message);
                }
            } else {
                window.alert(message);
            }
        }

        // Helper function for confirmations with fallback
        async function showConfirmFallback(message) {
            if (tg && tg.showConfirm && typeof tg.showConfirm === 'function') {
                try {
                    return await new Promise(resolve => {
                        tg.showConfirm(message, (ok) => resolve(ok));
                    });
                } catch (e) {
                    console.warn("tg.showConfirm failed, falling back to window.confirm:", e);
                    return window.confirm(message);
                }
            } else {
                return window.confirm(message);
            }
        }

        // Configure Telegram Main Button (optional but good for Mini Apps)
        if (tg && tg.MainButton) {
            tg.MainButton.setText('Close Game');
            tg.MainButton.textColor = '#FFFFFF';
            tg.MainButton.color = '#D2691E'; // Donkey brown color
            tg.MainButton.show();
            tg.MainButton.onClick(() => {
                tg.close(); // Close the Mini App
            });
        }
    } // --------------- APP LOGIC ENDS HERE -----------------
}); 