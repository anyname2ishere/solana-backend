const express = require("express");
const cors = require("cors");
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

const connection = new Connection(
  "https://api.mainnet-beta.solana.com",
  "confirmed"
);

// ⚠️ demo wallet (replace later)
const payer = Keypair.generate();

// ---- SOL ----
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

    const sig = await connection.sendTransaction(tx, [payer]);
    res.json({ sig });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ---- TOKEN ----
app.post("/send-token", async (req, res) => {
  try {
    const { to, mint, amount } = req.body;

    const mintPk = new PublicKey(mint);
    const receiver = new PublicKey(to);

    const fromATA = await getAssociatedTokenAddress(mintPk, payer.publicKey);
    const toATA = await getAssociatedTokenAddress(mintPk, receiver);

    const tx = new Transaction();

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

    tx.add(
      createTransferInstruction(
        fromATA,
        toATA,
        payer.publicKey,
        amount
      )
    );

    const sig = await connection.sendTransaction(tx, [payer]);
    res.json({ sig });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(5000, () => console.log("running"));
