import { Connection, Keypair, PublicKey, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { Token, ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from '@solana/spl-token';
import fs from 'fs';
import path from 'path';
import { createObjectCsvWriter } from 'csv-writer';

// Setup connection and payer
const connection = new Connection('https://api.devnet.solana.com', 'confirmed'); // Ganti dengan URL endpoint yang sesuai

const secretKey = JSON.parse(fs.readFileSync('../../solana/twannew.json', 'utf8'));
const payer = Keypair.fromSecretKey(Uint8Array.from(secretKey));

// Functions for token number conversion
const convertToTokenUnits = (amount: number, decimals: number): number => {
    return amount * Math.pow(10, decimals);
};

// Create a CSV writer
const csvWriter = createObjectCsvWriter({
    path: 'signatures.csv',
    header: [
        { id: 'address', title: 'Address' },
        { id: 'amount', title: 'Amount' },
        { id: 'signature', title: 'Signature' },
        { id: 'status', title: 'Status' }
    ]
});

const transferTokens = async () => {
    const tokenMintAddress = 'DZNHpMUuV65GS3WxSMxX9umMvhUEbT8vNHH8mb5BUrVH'; // Ganti dengan mint address token yang akan ditransfer
    const senderTokenAccount = '7uQ4xzaYNPjWk7yAhHu2TAdfLovv3c21JdCxHXUC67iy'; // Ganti dengan token account pengirim
    const decimals = 9; // Ganti dengan jumlah desimal token Anda

    // Reading JSON
    const filePath = path.join(__dirname, 'recipients.json');
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const recipients = JSON.parse(fileContent);

    const token = new Token(connection, new PublicKey(tokenMintAddress), TOKEN_PROGRAM_ID, payer);
    const senderTokenAccountPublicKey = new PublicKey(senderTokenAccount);
    const records = []

    for (const recipient of recipients) {
        const recipientPublicKey = new PublicKey(recipient.address);
        const amountInUnits = convertToTokenUnits(recipient.amount, decimals);

        // Create recipient token account if it doesn't exist
        let recipientTokenAccount = await Token.getAssociatedTokenAddress(
            ASSOCIATED_TOKEN_PROGRAM_ID,
            TOKEN_PROGRAM_ID,
            new PublicKey(tokenMintAddress),
            recipientPublicKey
        );

        const recipientTokenAccountInfo = await connection.getAccountInfo(recipientTokenAccount);
        if (!recipientTokenAccountInfo) {
            const createAccountIx = Token.createAssociatedTokenAccountInstruction(
                ASSOCIATED_TOKEN_PROGRAM_ID,
                TOKEN_PROGRAM_ID,
                new PublicKey(tokenMintAddress),
                recipientTokenAccount,
                recipientPublicKey,
                payer.publicKey
            );

            const transaction = new Transaction().add(createAccountIx);
            const txHash = await sendAndConfirmTransaction(connection, transaction, [payer]);
            console.log(`Created associated token account. Transaction hash: ${txHash}`);
        }

        const transferIx = Token.createTransferInstruction(
            TOKEN_PROGRAM_ID,
            senderTokenAccountPublicKey,
            recipientTokenAccount,
            payer.publicKey,
            [],
            amountInUnits
        );

        try {
            const transaction = new Transaction().add(transferIx);
            const signature = await sendAndConfirmTransaction(connection, transaction, [payer]);
            console.log(`Sent ${recipient.address}: ${recipient.amount} | ${signature}`);
            records.push({ address: recipient.address, amount: recipient.amount, signature, status: 'Success' });
            console.log('');
        } catch (error) {
            console.error(`Failed to send transaction to ${recipient.address}: ${error}`);
            records.push({ address: recipient.address, amount: recipient.amount, signature: '', status: 'Failed' });
        }

        // Write records to CSV file
        await csvWriter.writeRecords(records);
        
    }
    console.log('Signatures saved to signatures.csv');
};

transferTokens().catch(err => {
    console.error(err);
});
