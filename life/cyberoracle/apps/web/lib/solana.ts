import { PROGRAM_ID, getRequestPda, getStatePda, getUserCounterPda } from "@cyberoracle/sdk";

export const SOLANA_RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
export const CYBERORACLE_PROGRAM_ID = PROGRAM_ID;

export const pda = {
  getStatePda,
  getUserCounterPda,
  getRequestPda
};
