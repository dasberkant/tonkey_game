// import { TonConnectUI } from 'https://esm.sh/@tonconnect/ui'; // Remove this line

// Destructuring will be attempted after window.Ton is confirmed
let TonClient, Address, Cell, beginCell, toNano, fromNano;

function initializeTonLib() {
    // Now that we expect window.Ton to be available, destructure it.
    ({ TonClient, Address, Cell, beginCell, toNano, fromNano } = window.Ton);
}

document.addEventListener('DOMContentLoaded', () => {
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();

    const MAX_POLL_COUNT = 10; // Try for 5 seconds (10 * 500ms)
    let pollCount = 0;

    function checkTonLibAndInit() {
        if (window.Ton && window.Ton.TonClient) { // Check for a specific property to be more robust
            console.log('TON library loaded.');
            initializeTonLib();
            initializeAppLogic(); // This function will contain the rest of your original script logic
        } else {
            pollCount++;
            if (pollCount < MAX_POLL_COUNT) {
                console.log(`TON library not ready, attempt ${pollCount}/${MAX_POLL_COUNT}. Retrying in 500ms...`);
                setTimeout(checkTonLibAndInit, 500);
            } else {
                console.error('CRITICAL: Failed to load TON library after multiple attempts. App functionality will be limited.');
            }
        }
    }

    checkTonLibAndInit(); // Start the check

    // --------------- APP LOGIC STARTS HERE (moved into a function) ----------------- 
    function initializeAppLogic() {
        const walletInfoDiv = document.getElementById('wallet-info');
        const walletAddressSpan = document.getElementById('wallet-address');
        const walletNetworkSpan = document.getElementById('wallet-network');
        const tonkeyBalanceSpan = document.getElementById('tonkey-balance');
        const spendSectionDiv = document.getElementById('spend-section');
        const spendAmountInput = document.getElementById('spend-amount-input');
        const spendButton = document.getElementById('spend-button');

        const tonkeyMasterAddress = 'EQCn9sEMALm9Np1tkKZmKuK9h9z1mSbyDWQOPOup9mhe5pFB';
        const TONKEY_DECIMALS = 9; // IMPORTANT: Replace with your Tonkey's actual decimals
        let userTonkeyWalletAddress = null;
        let tonClient = null;

        // Use the globally available TON_CONNECT_UI
        if (!window.TON_CONNECT_UI || !window.TON_CONNECT_UI.TonConnectUI) {
            console.error('CRITICAL: TON Connect UI library not found. Please check index.html.');
            // Optionally, show an error to the user via Telegram WebApp API if it's available
            if (tg && tg.showAlert) {
                 tg.showAlert('Error: TON Connect UI library failed to load.');
            } else {
                // Fallback if tg.showAlert is not available or tg is not defined
                alert('Error: TON Connect UI library failed to load.');
            }
            return; // Stop initialization
        }
        const tonConnectUI = new window.TON_CONNECT_UI.TonConnectUI({
            manifestUrl: 'https://dasberkant.github.io/tonkey_game/tonconnect-manifest.json', // Ensure this is your correct manifest URL
            buttonRootId: 'tonconnect-button-root'
        });

        function getTonClient(network) {
            if (!TonClient) {
                console.error('CRITICAL: TonClient is not initialized! Cannot create TON API client.');
                return null;
            }
            if (network === 'mainnet') {
                return new TonClient({
                    endpoint: 'https://toncenter.com/api/v2/jsonRPC',
                });
            }
            return new TonClient({
                endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
            });
        }

        async function getJettonWalletAddress(ownerAddress, jettonMasterAddr) {
            if (!tonClient) return null;
            try {
                const masterAddress = Address.parse(jettonMasterAddr);
                const ownerAddr = Address.parse(ownerAddress);
                
                const result = await tonClient.runMethod(
                    masterAddress,
                    'get_wallet_address',
                    [{ type: 'slice', cell: beginCell().storeAddress(ownerAddr).endCell() }]
                );
                return result.stack.readAddress().toString();
            } catch (error) {
                console.error('Error getting Jetton wallet address:', error);
                return null;
            }
        }

        async function getJettonBalance(jettonWalletAddr) {
            if (!tonClient || !jettonWalletAddr) return null;
            try {
                const walletAddress = Address.parse(jettonWalletAddr);
                const result = await tonClient.runMethod(walletAddress, 'get_wallet_data');
                const balance = result.stack.readBigNumber();
                return fromNano(balance); 
            } catch (error) {
                console.error('Error getting Jetton balance:', error);
                if (error.message && (error.message.includes('exit_code: -13') || error.message.includes('method not found'))){
                    return '0'; 
                }
                console.error('Error fetching balance: ' + (error.message || error.toString()));
                return null;
            }
        }

        tonConnectUI.onStatusChange(async wallet => {
            if (wallet) {
                const address = wallet.account.address;
                const network = wallet.account.chain; 
                tonClient = getTonClient(network);
                if (!tonClient) return; // Stop if client couldn't be initialized

                walletAddressSpan.textContent = `${Address.parse(address).toString({ bounceable: false }).slice(0, 6)}...${Address.parse(address).toString({ bounceable: false }).slice(-4)}`;
                walletNetworkSpan.textContent = network === 'mainnet' ? 'Mainnet' : 'Testnet';
                walletInfoDiv.style.display = 'block';
                spendSectionDiv.style.display = 'block';
                tonkeyBalanceSpan.textContent = 'Fetching...';

                userTonkeyWalletAddress = await getJettonWalletAddress(address, tonkeyMasterAddress);
                if (userTonkeyWalletAddress) {
                    console.log('User Tonkey Wallet Address:', userTonkeyWalletAddress);
                    const balance = await getJettonBalance(userTonkeyWalletAddress);
                    if (balance !== null) {
                        tonkeyBalanceSpan.textContent = `${parseFloat(balance).toFixed(2)} TONKEY`; 
                    } else {
                        tonkeyBalanceSpan.textContent = 'Error fetching';
                    }
                } else {
                    tonkeyBalanceSpan.textContent = 'Wallet not found for Tonkey';
                }
                if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
            } else {
                walletAddressSpan.textContent = '';
                walletNetworkSpan.textContent = '';
                walletInfoDiv.style.display = 'none';
                spendSectionDiv.style.display = 'none';
                tonkeyBalanceSpan.textContent = '-- (Connect to fetch)';
                userTonkeyWalletAddress = null;
                tonClient = null;
            }
        });

        spendButton.addEventListener('click', async () => {
            if (!tonConnectUI.connected || !userTonkeyWalletAddress || !tonClient) {
                const message = !tonConnectUI.connected ? 'Please connect your wallet.' :
                                !userTonkeyWalletAddress ? 'Tonkey wallet address not found.' :
                                'TON client not ready.';
                if (tg && tg.showAlert) tg.showAlert(message);
                else alert(message);
                return;
            }

            const amountString = spendAmountInput.value;
            if (!amountString || parseFloat(amountString) <= 0) {
                if (tg && tg.showAlert) tg.showAlert('Please enter a valid amount to spend.');
                else alert('Please enter a valid amount to spend.');
                return;
            }
            
            const jettonAmount = toNano(amountString);
            const recipientAddress = 'UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA_Tal'; // Placeholder
            const forwardTonAmount = toNano('0.05'); 

            const body = beginCell()
                .storeUint(0x0f8a7ea5, 32)
                .storeUint(0, 64)
                .storeCoins(jettonAmount)
                .storeAddress(Address.parse(recipientAddress))
                .storeAddress(Address.parse(tonConnectUI.wallet.account.address))
                .storeMaybeRef(null)
                .storeCoins(forwardTonAmount)
                .storeMaybeRef(null)
                .endCell();

            const transaction = {
                validUntil: Math.floor(Date.now() / 1000) + 360,
                messages: [{
                    address: userTonkeyWalletAddress,
                    amount: toNano('0.1').toString(),
                    payload: body.toBoc().toString('base64')
                }]
            };

            try {
                // Use a more robust way to confirm, checking for tg.showConfirm first
                let confirmed = false;
                if (tg && tg.showConfirm) {
                    confirmed = await new Promise(resolve => {
                        tg.showConfirm(
                            `Send ${amountString} TONKEY to ${recipientAddress.slice(0,6)}...? This is a REAL transaction.`,
                            (ok) => resolve(ok)
                        );
                    });
                } else if (tg && tg.showPopup) { // Fallback to showPopup if showConfirm is not available
                     await new Promise(resolve => {
                        tg.showPopup({
                            title: 'Confirm Transaction',
                            message: `Send ${amountString} TONKEY to ${recipientAddress.slice(0,6)}...? This is a REAL transaction.`,
                            buttons: [
                                { id: 'confirm', type: 'default', text: 'Confirm' },
                                { id: 'cancel', type: 'destructive', text: 'Cancel' },
                            ]
                        }, (buttonId) => {
                            if (buttonId === 'confirm') confirmed = true;
                            resolve(true); // Close popup handler
                        });
                    });
                } else { // Further fallback to browser confirm
                    confirmed = confirm(`Send ${amountString} TONKEY to ${recipientAddress.slice(0,6)}...? This is a REAL transaction.`);
                }

                if (confirmed) {
                    try {
                        const result = await tonConnectUI.sendTransaction(transaction);
                        console.log('Transaction sent:', result);
                        if (tg && tg.showAlert) tg.showAlert('Transaction sent successfully! Check your wallet.');
                        else alert('Transaction sent successfully! Check your wallet.');
                        if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('success');
                        
                        setTimeout(async () => {
                            if (userTonkeyWalletAddress && tonConnectUI.connected && tonClient) {
                                const balance = await getJettonBalance(userTonkeyWalletAddress);
                                if (balance !== null) {
                                    tonkeyBalanceSpan.textContent = `${parseFloat(balance).toFixed(2)} TONKEY`; 
                                }
                            }
                        }, 7000); // Increased delay for balance update
                    } catch (error) {
                        console.error('Transaction error:', error);
                        const errorMessage = typeof error === 'string' ? error : (error.message || 'Unknown transaction error');
                        if (tg && tg.showAlert) tg.showAlert('Transaction failed: ' + errorMessage);
                        else alert('Transaction failed: ' + errorMessage);
                        if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
                    }
                }
            } catch (e) {
                console.error('Error with confirmation popup or transaction preparation:', e);
                if (tg && tg.HapticFeedback) tg.HapticFeedback.notificationOccurred('error');
            }
        });

        // Configure Telegram Main Button (optional but good for Mini Apps)
        if (tg && tg.MainButton) {
            tg.MainButton.setText('Close App');
            tg.MainButton.textColor = '#FFFFFF';
            tg.MainButton.color = '#FF0000'; // Red color for close
            tg.MainButton.show();
            tg.MainButton.onClick(() => {
                tg.close(); // Close the Mini App
            });
        }
    } // --------------- APP LOGIC ENDS HERE -----------------
}); 