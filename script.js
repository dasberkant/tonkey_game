import { TonConnectUI } from 'https://esm.sh/@tonconnect/ui';

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
                console.error('Failed to load TON library after multiple attempts.');
                tg.showAlert('Error: TON Blockchain library failed to load. Please try reloading the app.');
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

        const tonConnectUI = new TonConnectUI({
            manifestUrl: 'https://ton-connect.github.io/demo-dapp-with-react-ui/tonconnect-manifest.json', // Replace with your hosted manifest
            buttonRootId: 'tonconnect-button-root'
        });

        function getTonClient(network) {
            if (!TonClient) {
                console.error('TonClient is not initialized!');
                tg.showAlert('Critical error: TonClient not available.');
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
                tg.showAlert('Error getting Jetton wallet address: ' + (error.message || error.toString()));
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
                tg.showAlert('Error fetching balance: ' + (error.message || error.toString()));
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
                tg.HapticFeedback.notificationOccurred('success');
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
                tg.showAlert('Please connect your wallet, ensure Tonkey wallet is found, and TON client is ready.');
                return;
            }

            const amountString = spendAmountInput.value;
            if (!amountString || parseFloat(amountString) <= 0) {
                tg.showAlert('Please enter a valid amount to spend.');
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
                tg.showPopup({
                    title: 'Confirm Transaction',
                    message: `Send ${amountString} TONKEY to ${recipientAddress.slice(0,6)}...? This is a REAL transaction.`,
                    buttons: [
                        { id: 'confirm', type: 'default', text: 'Confirm' },
                        { id: 'cancel', type: 'destructive', text: 'Cancel' },
                    ]
                }, async (buttonId) => {
                    if (buttonId === 'confirm') {
                        try {
                            const result = await tonConnectUI.sendTransaction(transaction);
                            console.log('Transaction sent:', result);
                            tg.showAlert('Transaction sent successfully! Check your wallet.');
                            tg.HapticFeedback.notificationOccurred('success');
                            setTimeout(async () => {
                                if (userTonkeyWalletAddress && tonConnectUI.connected && tonClient) {
                                    const balance = await getJettonBalance(userTonkeyWalletAddress);
                                    if (balance !== null) {
                                        tonkeyBalanceSpan.textContent = `${parseFloat(balance).toFixed(2)} TONKEY`; 
                                    }
                                }
                            }, 5000); 
                        } catch (error) {
                            console.error('Transaction error:', error);
                            tg.showAlert('Transaction failed: ' + (error.message || 'Unknown error'));
                            tg.HapticFeedback.notificationOccurred('error');
                        }
                    }
                });
            } catch (e) {
                console.error('Error with spend popup or transaction preparation:', e);
                tg.HapticFeedback.notificationOccurred('error');
            }
        });

        tg.MainButton.setText('Close App');
        tg.MainButton.textColor = '#FFFFFF';
        tg.MainButton.color = '#FF0000';
        tg.MainButton.show();
        tg.MainButton.onClick(() => {
            tg.close();
        });
    } // --------------- APP LOGIC ENDS HERE -----------------
}); 