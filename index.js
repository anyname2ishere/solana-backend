const express = require("express");
const cors = require("cors");
const bs58 = require("bs58");

const {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  Keypair
} = require("@solana/web3.js");

const {
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAccount
} = require("@solana/spl-token");

const app = express();
app.use(cors());
app.use(express.json());

// Solana connection
const connection = new Connection(
  "https://api.mainnet-beta.solana.com",
  "confirmed"
);

// Load backend wallet from Railway
const payer = Keypair.fromSecretKey(
  bs58.decode(process.env.PRIVATE_KEY)
);

console.log("Backend Wallet:", payer.publicKey.toString());


// ======================
// SEND SOL
// ======================
app.post("/send-sol", async (req, res) => {
  try {
    const { to, amount } = req.body;

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: payer.publicKey,
        toPubkey: new PublicKey(to),
        lamports: amount
      })
    );

    // ✅ FIX: required for Solana
    tx.feePayer = payer.publicKey;

    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;

    const sig = await connection.sendTransaction(tx, [payer]);

    res.json({ success: true, sig });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// ======================
// SEND TOKEN (MEMECOIN)
// ======================
app.post("/send-token", async (req, res) => {
  try {
    const { to, mint, amount } = req.body;

    const mintPk = new PublicKey(mint);
    const receiver = new PublicKey(to);

    const fromATA = await getAssociatedTokenAddress(
      mintPk,
      payer.publicKey
    );

    const toATA = await getAssociatedTokenAddress(
      mintPk,
      receiver
    );

    const tx = new Transaction();

    // Create ATA if it doesn't exist (idempotent)
    try {
      await getAccount(connection, toATA);
    } catch {
      tx.add(
        createAssociatedTokenAccountInstruction(
          payer.publicKey,
          toATA,
          receiver,
          mintPk
        )
      );
    }

    // Transfer token
    tx.add(
      createTransferInstruction(
        fromATA,
        toATA,
        payer.publicKey,
        amount
      )
    );

    // ✅ FIX: required for Solana
    tx.feePayer = payer.publicKey;

    const { blockhash } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;

    const sig = await connection.sendTransaction(tx, [payer]);

    res.json({ success: true, sig });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// START SERVER
app.listen(5000, () => console.log("Server running"));
