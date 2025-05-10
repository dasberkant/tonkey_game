import { TonConnectUI } from '@tonconnect/ui';
import { TonClient, Address, Cell, beginCell, toNano, fromNano } from 'ton';

// Destructuring for TonClient etc. is now handled by the import
// let TonClient, Address, Cell, beginCell, toNano, fromNano; // Remove this

// function initializeTonLib() { // This function is no longer needed with direct imports
//    ({ TonClient, Address, Cell, beginCell, toNano, fromNano } = window.Ton);
// }

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

        // const tonConnectUI = new window.TON_CONNECT_UI.TonConnectUI({ // Remove this instantiation
        const tonConnectUI = new TonConnectUI({ // Use the imported TonConnectUI
            manifestUrl: 'https://dasberkant.github.io/tonkey_game/tonconnect-manifest.json',
            buttonRootId: 'tonconnect-button-root',
            uiOptions: {
                twaReturnUrl: 'https://dasberkant.github.io/tonkey_game/' // TODO: Replace with your actual TMA URL
            }
        });

        function getTonClient(network) {
            // if (!TonClient) { // TonClient is available from import
            //     console.error('CRITICAL: TonClient is not initialized! Cannot create TON API client.');
            //     return null;
            // }
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

                // console.log(`Attempting get_wallet_address for owner ${ownerAddress} on master ${jettonMasterAddr}`);

                const result = await tonClient.runMethod(
                    masterAddress,
                    'get_wallet_address',
                    [{ type: 'slice', cell: beginCell().storeAddress(ownerAddr).endCell() }] // Reverted to standard slice argument
                );
                // console.log('get_wallet_address result:', result);
                return result.stack.readAddress().toString();
            } catch (error) {
                console.error('Error getting Jetton wallet address:', error);
                // Log more details from the error if available
                if (error.response && error.response.data) {
                    console.error('RPC Error details:', error.response.data);
                }
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
                console.log('TonConnectUI onStatusChange - Wallet object:', JSON.stringify(wallet, null, 2)); // DETAILED LOGGING
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