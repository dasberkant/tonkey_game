import { TonConnectUI } from 'https://esm.sh/@tonconnect/ui';

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

    // Initialize TonConnectUI
    // IMPORTANT: Replace with your own hosted manifest URL in a production environment
    const tonConnectUI = new TonConnectUI({
        manifestUrl: 'https://dasberkant.github.io/tonkey_game/tonconnect-manifest.json', // or your hosted manifest, e.g., 'https://your-app.com/tonconnect-manifest.json'
        buttonRootId: 'tonconnect-button-root' // ID of the div where the button will be rendered
    });

    // Subscribe to wallet connection status changes
    tonConnectUI.onStatusChange(wallet => {
        if (wallet) {
            // Wallet connected
            const address = wallet.account.address;
            const network = wallet.account.chain; // e.g., CHAIN.MAINNET or CHAIN.TESTNET
            
            walletAddressSpan.textContent = `${address.slice(0, 6)}...${address.slice(-4)}`;
            walletNetworkSpan.textContent = network === 'mainnet' ? 'Mainnet' : 'Testnet'; // Adjust based on actual values from sdk
            
            walletInfoDiv.style.display = 'block';
            spendSectionDiv.style.display = 'block';
            tonkeyBalanceSpan.textContent = 'Fetching...'; // Placeholder

            // TODO: Fetch actual Tonkey token balance
            // This requires:
            // 1. The address of the Tonkey Jetton Master contract.
            // 2. A library like 'ton' or 'tonweb' to interact with the TON blockchain.
            // 3. Logic to derive the user's Jetton wallet address for Tonkey and call the 'get_wallet_data' method.
            // Example (conceptual):
            // const tonkeyMasterAddress = 'EQ...'; // Tonkey Jetton Master Address
            // const balance = await getJettonBalance(wallet.account.address, tonkeyMasterAddress);
            // tonkeyBalanceSpan.textContent = balance + ' TONKEY';
            setTimeout(() => { // Mock fetching balance
                tonkeyBalanceSpan.textContent = '12345 TONKEY (Mock)';
            }, 1000);

            tg.HapticFeedback.notificationOccurred('success');
        } else {
            // Wallet disconnected
            walletAddressSpan.textContent = '';
            walletNetworkSpan.textContent = '';
            walletInfoDiv.style.display = 'none';
            spendSectionDiv.style.display = 'none';
            tonkeyBalanceSpan.textContent = '-- (Connect to fetch)';
        }
    });

    spendButton.addEventListener('click', async () => {
        const amountString = spendAmountInput.value;
        if (!amountString || parseFloat(amountString) <= 0) {
            tg.showAlert('Please enter a valid amount to spend.');
            return;
        }
        const amount = parseFloat(amountString);

        console.log(`Attempting to spend ${amount} Tonkey tokens`);

        // TODO: Implement actual Tonkey spending transaction
        // This requires constructing a specific transaction payload for Jetton transfer.
        // The message should be sent to the user's Jetton Wallet for Tonkey.
        // The payload typically includes:
        // - op_code (e.g., 0x0f8a7ea5 for transfer)
        // - query_id
        // - jetton_amount (in the smallest units of Tonkey)
        // - destination_address (recipient of Tonkeys)
        // - response_destination_address (often the sender's address)
        // - custom_payload (optional)
        // - forward_ton_amount (for gas to forward the message)

        // Example: A simple TON transfer (NOT Jetton transfer) for demonstration
        const transaction = {
            validUntil: Math.floor(Date.now() / 1000) + 360, // 6 minutes from now
            messages: [
                {
                    address: 'UQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA_Tal', // A dummy address
                    amount: '10000000' // 0.01 TON in nanoTONs
                    // payload: "base64_encoded_payload_for_jetton_transfer" // This would be for actual Jetton transfer
                }
            ]
        };

        try {
            tg.showPopup({
                title: 'Confirm Transaction',
                message: `Are you sure you want to spend ${amount} Tonkey tokens? (This is a mock transaction)`, 
                buttons: [
                    { id: 'confirm', type: 'default', text: 'Confirm' },
                    { id: 'cancel', type: 'destructive', text: 'Cancel' },
                ]
            }, async (buttonId) => {
                if (buttonId === 'confirm') {
                    console.log('User confirmed mock transaction');
                    try {
                         // For actual transaction:
                         // const result = await tonConnectUI.sendTransaction(transaction);
                         // console.log('Transaction result:', result);
                         // tg.showAlert('Transaction sent successfully! BOC: ' + result.boc);
                         
                        tg.showAlert('Mock transaction would be sent now!');
                        tg.HapticFeedback.notificationOccurred('success');
                    } catch (error) {
                        console.error('Transaction error:', error);
                        tg.showAlert('Transaction failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
                        tg.HapticFeedback.notificationOccurred('error');
                    }
                }
            });
        } catch (e) {
            console.error('Error sending transaction or showing popup:', e);
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