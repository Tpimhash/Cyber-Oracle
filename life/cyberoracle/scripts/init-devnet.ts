import path from "path";
import os from "os";
import * as anchor from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";

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

const idl = {
  version: "0.1.0",
  name: "cyberoracle",
  instructions: [
    {
      name: "initialize",
      accounts: [
        { name: "state", isMut: true, isSigner: false },
        { name: "authority", isMut: true, isSigner: true },
        { name: "treasury", isMut: false, isSigner: false },
        { name: "systemProgram", isMut: false, isSigner: false }
      ],
      args: [{ name: "priceLamports", type: "u64" }]
    }
  ]
} as const;

const main = async () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = new anchor.Program(idl as anchor.Idl, PROGRAM_ID, provider);
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

  await program.methods
    .initialize(new anchor.BN(priceLamports.toString()))
    .accounts({
      state: statePda,
      authority: provider.wallet.publicKey,
      treasury: treasuryKey,
      systemProgram: anchor.web3.SystemProgram.programId
    })
    .rpc();

  console.log("Initialized oracle state:", statePda.toBase58());
  console.log("Treasury:", treasuryKey.toBase58());
  console.log("Price (lamports):", priceLamports.toString());
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
