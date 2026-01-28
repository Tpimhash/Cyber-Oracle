import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const workspace = anchor.workspace as any;

const PROGRAM_ID = new anchor.web3.PublicKey(
  "862LYnc3jZJ6bFmjyMjE9NMwehJaAe2Do5UbbEV1kbJU"
);

describe("cyberoracle", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = workspace.Cyberoracle as Program;
  const authority = provider.wallet;
  const treasury = anchor.web3.Keypair.generate().publicKey;

  it("initializes and supports multiple requests per user", async () => {
    const [statePda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("state")],
      PROGRAM_ID
    );

    await program.methods
      .initialize(new anchor.BN(1000))
      .accounts({
        state: statePda,
        authority: authority.publicKey,
        treasury,
        systemProgram: anchor.web3.SystemProgram.programId
      })
      .rpc();

    const [counterPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("counter"), authority.publicKey.toBuffer()],
      PROGRAM_ID
    );

    const promptHash1 = Array.from(Buffer.alloc(32, 1));
    const [requestPda1] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("request"),
        authority.publicKey.toBuffer(),
        new anchor.BN(0).toArrayLike(Buffer, "le", 8)
      ],
      PROGRAM_ID
    );

    await program.methods
      .requestOracle(promptHash1)
      .accounts({
        state: statePda,
        counter: counterPda,
        request: requestPda1,
        payer: authority.publicKey,
        treasury,
        systemProgram: anchor.web3.SystemProgram.programId
      })
      .rpc();

    const counterAccount1 = await program.account.userCounter.fetch(counterPda);
    if (!counterAccount1.nextRequestId.eq(new anchor.BN(1))) {
      throw new Error("counter not incremented after first request");
    }

    const promptHash2 = Array.from(Buffer.alloc(32, 2));
    const [requestPda2] = anchor.web3.PublicKey.findProgramAddressSync(
      [
        Buffer.from("request"),
        authority.publicKey.toBuffer(),
        new anchor.BN(1).toArrayLike(Buffer, "le", 8)
      ],
      PROGRAM_ID
    );

    await program.methods
      .requestOracle(promptHash2)
      .accounts({
        state: statePda,
        counter: counterPda,
        request: requestPda2,
        payer: authority.publicKey,
        treasury,
        systemProgram: anchor.web3.SystemProgram.programId
      })
      .rpc();

    const requestAccount1 = await program.account.oracleRequest.fetch(requestPda1);
    const requestAccount2 = await program.account.oracleRequest.fetch(requestPda2);

    if (!requestAccount1.requestId.eq(new anchor.BN(0))) {
      throw new Error("first request id incorrect");
    }
    if (!requestAccount2.requestId.eq(new anchor.BN(1))) {
      throw new Error("second request id incorrect");
    }

    const assetId = anchor.web3.Keypair.generate().publicKey;
    const collectionMint = anchor.web3.Keypair.generate().publicKey;
    const resultUri = "https://example.com/result/1.json";

    await program.methods
      .fulfillOracle(resultUri, assetId, collectionMint)
      .accounts({
        state: statePda,
        request: requestPda1,
        authority: authority.publicKey
      })
      .rpc();

    const fulfilledRequest = await program.account.oracleRequest.fetch(requestPda1);
    if (!fulfilledRequest.fulfilled) {
      throw new Error("request not marked fulfilled");
    }
    if (!fulfilledRequest.assetId.equals(assetId)) {
      throw new Error("asset id not stored");
    }
    if (!fulfilledRequest.collectionMint.equals(collectionMint)) {
      throw new Error("collection mint not stored");
    }
  });
});
