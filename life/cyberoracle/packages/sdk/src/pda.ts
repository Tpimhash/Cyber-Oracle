import { PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey(
  "862LYnc3jZJ6bFmjyMjE9NMwehJaAe2Do5UbbEV1kbJU"
);

const toLeBytesU64 = (value: bigint | number): Uint8Array => {
  const bn = typeof value === "bigint" ? value : BigInt(value);
  const out = new Uint8Array(8);
  let x = bn;
  for (let i = 0; i < 8; i += 1) {
    out[i] = Number(x & 0xffn);
    x >>= 8n;
  }
  return out;
};

export const getStatePda = (programId: PublicKey = PROGRAM_ID) =>
  PublicKey.findProgramAddressSync([Buffer.from("state")], programId);

export const getUserCounterPda = (
  user: PublicKey,
  programId: PublicKey = PROGRAM_ID
) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("counter"), user.toBuffer()],
    programId
  );

export const getRequestPda = (
  user: PublicKey,
  requestId: bigint | number,
  programId: PublicKey = PROGRAM_ID
) =>
  PublicKey.findProgramAddressSync(
    [Buffer.from("request"), user.toBuffer(), toLeBytesU64(requestId)],
    programId
  );
