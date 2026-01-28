const path = require("path");
const os = require("os");
const anchor = require("@coral-xyz/anchor");
const { PublicKey } = require("@solana/web3.js");
const crypto = require("crypto");

const RPC_URL =
  process.env.ANCHOR_PROVIDER_URL ?? "https://api.devnet.solana.com";
const WALLET_PATH =
  process.env.ANCHOR_WALLET ?? path.join(os.homedir(), ".config/solana/id.json");

process.env.ANCHOR_PROVIDER_URL = RPC_URL;
process.env.ANCHOR_WALLET = WALLET_PATH;

const priceLamports = BigInt(process.env.CYBERORACLE_PRICE_LAMPORTS ?? "10000000");
const treasury = process.env.CYBERORACLE_TREASURY;

const PROGRAM_ID = new PublicKey(
  "862LYnc3jZJ6bFmjyMjE9NMwehJaAe2Do5UbbEV1kbJU"
);

const initializeDiscriminator = crypto
  .createHash("sha256")
  .update("global:initialize")
  .digest()
  .slice(0, 8);

async function main() {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const [statePda] = PublicKey.findProgramAddressSync(
    [Buffer.from("state")],
    PROGRAM_ID
  );

  const existing = await provider.connection.getAccountInfo(statePda);
  if (existing) {
    console.log("Oracle state already initialized:", statePda.toBase58());
    return;
  }

  const treasuryKey = new PublicKey(
    treasury ?? provider.wallet.publicKey.toBase58()
  );

  const data = Buffer.alloc(16);
  initializeDiscriminator.copy(data, 0);
  data.writeBigUInt64LE(priceLamports, 8);

  const ix = new anchor.web3.TransactionInstruction({
    programId: PROGRAM_ID,
    keys: [
      { pubkey: statePda, isSigner: false, isWritable: true },
      { pubkey: provider.wallet.publicKey, isSigner: true, isWritable: true },
      { pubkey: treasuryKey, isSigner: false, isWritable: false },
      {
        pubkey: anchor.web3.SystemProgram.programId,
        isSigner: false,
        isWritable: false
      }
    ],
    data
  });

  const tx = new anchor.web3.Transaction().add(ix);
  await provider.sendAndConfirm(tx, []);

  console.log("Initialized oracle state:", statePda.toBase58());
  console.log("Treasury:", treasuryKey.toBase58());
  console.log("Price (lamports):", priceLamports.toString());
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
