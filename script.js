import { TonConnectUI } from 'https://esm.sh/@tonconnect/ui';

// Access TON classes from the global window.Ton object loaded by the CDN script
const { TonClient, Address, Cell, beginCell, toNano, fromNano } = window.Ton;

document.addEventListener('DOMContentLoaded', () => {
    const tg = window.Telegram.WebApp;
    tg.ready(); // Inform Telegram that the app is ready
    tg.expand(); // Expand the app to full height

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

    // Initialize TonConnectUI
    // IMPORTANT: Replace with your own hosted manifest URL in a production environment
    const tonConnectUI = new TonConnectUI({
        manifestUrl: 'https://ton-connect.github.io/demo-dapp-with-react-ui/tonconnect-manifest.json', // Replace with your hosted manifest
        buttonRootId: 'tonconnect-button-root' // ID of the div where the button will be rendered
    });

    function getTonClient(network) {
        if (network === 'mainnet') {
            return new TonClient({
                endpoint: 'https://toncenter.com/api/v2/jsonRPC',
                // You can add apiKey if you have one from toncenter.com
            });
        }
        return new TonClient({
            endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
            // You can add apiKey if you have one from testnet.toncenter.com
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
            // The stack for get_wallet_data is (balance, owner_address, jetton_master_address, jetton_wallet_code)
            const balance = result.stack.readBigNumber(); // balance is a BigNumber
            return fromNano(balance); // Assuming Tonkey uses 9 decimals like TON.
                                       // If Tonkey has different decimals, adjust this. e.g. balance / (10**TONKEY_DECIMALS)
        } catch (error) {
            console.error('Error getting Jetton balance:', error);
            // It's common for a Jetton wallet to not exist if balance is 0, which might throw.
            // Or it could be other errors.
            if (error.message && error.message.includes('exit_code: -13') || error.message.includes('method not found')){
                // Smart contract exit code -13 or method not found often means wallet not initialized (0 balance)
                return '0'; 
            }
            tg.showAlert('Error fetching balance: ' + (error.message || error.toString()));
            return null;
        }
    }

    // Subscribe to wallet connection status changes
    tonConnectUI.onStatusChange(async wallet => {
        if (wallet) {
            const address = wallet.account.address;
            const network = wallet.account.chain; 
            tonClient = getTonClient(network);

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
                    // Format based on TONKEY_DECIMALS if it's different from 9 or if fromNano isn't already handling it
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
        if (!tonConnectUI.connected || !userTonkeyWalletAddress) {
            tg.showAlert('Please connect your wallet and ensure Tonkey wallet is found.');
            return;
        }

        const amountString = spendAmountInput.value;
        if (!amountString || parseFloat(amountString) <= 0) {
            tg.showAlert('Please enter a valid amount to spend.');
            return;
        }
        
        // Assuming amount is in human-readable format, convert to smallest units
        const jettonAmount = toNano(amountString); // Use toNano if Tonkey has 9 decimals
                                                     // Otherwise, amount * (10**TONKEY_DECIMALS)

        // IMPORTANT: Replace with the actual recipient address
        const recipientAddress = 'UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA_Tal'; // Placeholder
        const forwardTonAmount = toNano('0.05'); // Amount of TON to forward for gas, e.g., 0.05 TON

        // Construct the Jetton transfer payload
        const body = beginCell()
            .storeUint(0x0f8a7ea5, 32) // op_code for jetton transfer
            .storeUint(0, 64) // query_id
            .storeCoins(jettonAmount) // jetton_amount (in smallest units)
            .storeAddress(Address.parse(recipientAddress)) // destination_address
            .storeAddress(Address.parse(tonConnectUI.wallet.account.address)) // response_destination_address
            .storeMaybeRef(null) // custom_payload (Cell | null)
            .storeCoins(forwardTonAmount) // forward_ton_amount
            .storeMaybeRef(null) // forward_payload (Cell | null)
            .endCell();

        const transaction = {
            validUntil: Math.floor(Date.now() / 1000) + 360, // 6 minutes from now
            messages: [
                {
                    address: userTonkeyWalletAddress, // Send to the user's own Jetton wallet for Tonkey
                    amount: toNano('0.1').toString(), // Amount of TON to send with the message (for gas)
                    payload: body.toBoc().toString('base64') // Payload as base64 string
                }
            ]
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
                        // Optionally, re-fetch balance after a short delay
                        setTimeout(async () => {
                            if (userTonkeyWalletAddress && tonConnectUI.connected) {
                                const balance = await getJettonBalance(userTonkeyWalletAddress);
                                if (balance !== null) {
                                    tonkeyBalanceSpan.textContent = `${parseFloat(balance).toFixed(2)} TONKEY`; 
                                }
                            }
                        }, 5000); // 5 seconds delay
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

    // Configure Telegram Main Button (optional)
    tg.MainButton.setText('Close App');
    tg.MainButton.textColor = '#FFFFFF';
    tg.MainButton.color = '#FF0000'; // Red color for close
    tg.MainButton.show();
    tg.MainButton.onClick(() => {
        tg.close(); // Close the Mini App
    });
}); 