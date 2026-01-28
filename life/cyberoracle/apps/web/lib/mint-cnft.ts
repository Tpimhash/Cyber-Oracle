import { PublicKey, Connection, Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { AnchorProvider, Program, Wallet } from "@coral-xyz/anchor";
import { createUmi } from "@metaplex-foundation/umi-bundle-defaults";
import {
  createSignerFromKeypair,
  keypairIdentity,
  percentAmount,
  publicKey
} from "@metaplex-foundation/umi";
import {
  mplBubblegum,
  mintToCollectionV1,
  findLeafAssetIdPda
} from "@metaplex-foundation/mpl-bubblegum";
import { mplTokenMetadata } from "@metaplex-foundation/mpl-token-metadata";
import { getRequestPda, getStatePda, PROGRAM_ID } from "@cyberoracle/sdk";
import { cyberoracleIdl } from "./cyberoracle-idl";
import type { MintCnftRequest } from "./api-types";

export type MintCnftResult = {
  assetId: string;
  signature: string;
};

const getEnv = (key: string) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing env: ${key}`);
  }
  return value;
};

const getEnvOrDefault = (key: string, fallback: string) => {
  const value = process.env[key];
  return value ?? fallback;
};

const parseKeypair = (value: string) => {
  if (value.startsWith("[")) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(value)));
  }
  return Keypair.fromSecretKey(bs58.decode(value));
};

class KeypairWallet implements Wallet {
  constructor(readonly payer: Keypair) {}
  get publicKey() {
    return this.payer.publicKey;
  }
  async signTransaction(tx: any) {
    tx.partialSign(this.payer);
    return tx;
  }
  async signAllTransactions(txs: any[]) {
    return txs.map((tx) => {
      tx.partialSign(this.payer);
      return tx;
    });
  }
}

export const mintCnftAndFulfill = async (
  req: MintCnftRequest
): Promise<MintCnftResult> => {
  const user = new PublicKey(req.user);
  const requestId = BigInt(req.requestId);

  if (!Array.isArray(req.promptHash) || req.promptHash.length !== 32) {
    throw new Error("promptHash must be 32 bytes");
  }
  if (!req.resultUri || !req.metadataUri) {
    throw new Error("resultUri and metadataUri are required");
  }

  const rpcUrl = getEnvOrDefault("SOLANA_RPC_URL", "https://api.devnet.solana.com");
  const authoritySecret = getEnv("CYBERORACLE_AUTHORITY_SECRET");
  const treeAddress = getEnv("BUBBLEGUM_TREE_ADDRESS");
  const collectionMintAddress = getEnv("BUBBLEGUM_COLLECTION_MINT");

  const authorityKeypair = parseKeypair(authoritySecret);
  const connection = new Connection(rpcUrl, "confirmed");

  const umi = createUmi(rpcUrl).use(mplBubblegum()).use(mplTokenMetadata());
  const umiKeypair = umi.eddsa.createKeypairFromSecretKey(
    authorityKeypair.secretKey
  );
  const umiSigner = createSignerFromKeypair(umi, umiKeypair);
  umi.use(keypairIdentity(umiSigner));

  const merkleTree = publicKey(treeAddress);
  const collectionMint = publicKey(collectionMintAddress);

  const mintBuilder = mintToCollectionV1(umi, {
    leafOwner: publicKey(user.toBase58()),
    leafDelegate: publicKey(user.toBase58()),
    merkleTree,
    collectionMint,
    collectionAuthority: umi.identity,
    metadata: {
      name: req.name ?? "CyberOracle",
      uri: req.metadataUri,
      sellerFeeBasisPoints: percentAmount(5.5),
      collection: { key: collectionMint, verified: false },
      creators: [
        {
          address: umi.identity.publicKey,
          verified: true,
          share: 100
        }
      ]
    }
  });

  const mintResult = (await mintBuilder.sendAndConfirm(umi, {
    send: { skipPreflight: false }
  })) as unknown as { leafIndex: number; signature: string };

  const assetIdPda = findLeafAssetIdPda(umi, {
    merkleTree,
    leafIndex: mintResult.leafIndex
  });
  const assetId = assetIdPda[0].toString();

  const provider = new AnchorProvider(
    connection,
    new KeypairWallet(authorityKeypair),
    { commitment: "confirmed" }
  );
  const program = new Program(cyberoracleIdl as any, PROGRAM_ID, provider);

  const [statePda] = getStatePda(PROGRAM_ID);
  const [requestPda] = getRequestPda(user, requestId, PROGRAM_ID);

  await program.methods
    .fulfillOracle(
      req.resultUri,
      new PublicKey(assetId),
      new PublicKey(collectionMintAddress)
    )
    .accounts({
      state: statePda,
      request: requestPda,
      authority: authorityKeypair.publicKey
    })
    .rpc();

  return {
    assetId,
    signature: mintResult.signature
  };
};
