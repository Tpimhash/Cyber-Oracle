"use client";

import { useEffect, useMemo, useState } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  Connection,
  LAMPORTS_PER_SOL,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction
} from "@solana/web3.js";
import {
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
  createInitializeMint2Instruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction
} from "@solana/spl-token";
import { Coins, Sparkles } from "lucide-react";
import { CYBERORACLE_PROGRAM_ID, SOLANA_RPC_URL, pda } from "../lib/solana";
import type { OracleResponse } from "../lib/api-types";

type OracleState = {
  authority: string;
  treasury: string;
  priceLamports: number;
};

type SubmitResult = {
  requestSignature: string;
  requestId: string;
  oracleText?: string;
  resultUri?: string;
  assetId?: string;
  mintSignature?: string;
};

type NftPreview = {
  name?: string;
  description?: string;
  image?: string;
};

type MintResult = {
  mint: string;
  signature: string;
};

export default function Page() {
  const [mounted, setMounted] = useState(false);
  const [bazi, setBazi] = useState("");
  const [loading, setLoading] = useState(false);
  const [oracleState, setOracleState] = useState<OracleState | null>(null);
  const [walletBalanceLamports, setWalletBalanceLamports] = useState<
    number | null
  >(null);
  const [oracleError, setOracleError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitResult, setSubmitResult] = useState<SubmitResult | null>(null);
  const [nftPreview, setNftPreview] = useState<NftPreview | null>(null);
  const [minting, setMinting] = useState(false);
  const [mintError, setMintError] = useState<string | null>(null);
  const [mintResult, setMintResult] = useState<MintResult | null>(null);

  const { publicKey, sendTransaction } = useWallet();

  const connection = useMemo(() => new Connection(SOLANA_RPC_URL), []);

  const decodeOracleState = (data: Uint8Array) => {
    if (data.length < 8 + 32 + 32 + 8 + 1) {
      throw new Error("Oracle state account data too short");
    }
    const authority = new PublicKey(data.slice(8, 40));
    const treasury = new PublicKey(data.slice(40, 72));
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const priceLamports = Number(view.getBigUint64(72, true));
    return { authority, treasury, priceLamports };
  };

  const decodeUserCounter = (data: Uint8Array) => {
    if (data.length < 8 + 32 + 8 + 1) {
      throw new Error("Counter account data too short");
    }
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    const nextRequestId = view.getBigUint64(40, true);
    return { nextRequestId };
  };

  const buildRequestOracleIx = async (
    payer: PublicKey,
    state: PublicKey,
    counter: PublicKey,
    request: PublicKey,
    treasury: PublicKey,
    promptHash: Uint8Array
  ) => {
    const discriminatorInput = new TextEncoder().encode(
      "global:request_oracle"
    );
    const discriminatorHash = await crypto.subtle.digest(
      "SHA-256",
      discriminatorInput
    );
    const discriminator = new Uint8Array(discriminatorHash).slice(0, 8);
    const data = new Uint8Array(8 + 32);
    data.set(discriminator, 0);
    data.set(promptHash, 8);
    return new TransactionInstruction({
      programId: CYBERORACLE_PROGRAM_ID,
      keys: [
        { pubkey: state, isSigner: false, isWritable: false },
        { pubkey: counter, isSigner: false, isWritable: true },
        { pubkey: request, isSigner: false, isWritable: true },
        { pubkey: payer, isSigner: true, isWritable: true },
        { pubkey: treasury, isSigner: false, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false }
      ],
      data
    });
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchOracleState = async () => {
      try {
        setOracleError(null);
        const [statePda] = pda.getStatePda();
        const accountInfo = await connection.getAccountInfo(statePda);
        if (!accountInfo) {
          throw new Error("Oracle state account not found");
        }
        const data = accountInfo.data;
        if (data.length < 8 + 32 + 32 + 8 + 1) {
          throw new Error("Oracle state account data too short");
        }
        const authority = new PublicKey(data.slice(8, 40));
        const treasury = new PublicKey(data.slice(40, 72));
        const priceLamports = Number(data.readBigUInt64LE(72));
        if (!cancelled) {
          setOracleState({
            authority: authority.toBase58(),
            treasury: treasury.toBase58(),
            priceLamports
          });
        }
      } catch (error) {
        if (!cancelled) {
          setOracleError(
            error instanceof Error ? error.message : "failed to load oracle state"
          );
        }
      }
    };

    fetchOracleState();
    const interval = setInterval(fetchOracleState, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [connection]);

  useEffect(() => {
    let cancelled = false;
    if (!publicKey) {
      setWalletBalanceLamports(null);
      return;
    }
    const fetchBalance = async () => {
      try {
        const lamports = await connection.getBalance(publicKey);
        if (!cancelled) {
          setWalletBalanceLamports(lamports);
        }
      } catch {
        if (!cancelled) {
          setWalletBalanceLamports(null);
        }
      }
    };
    fetchBalance();
    const interval = setInterval(fetchBalance, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [connection, publicKey]);

  useEffect(() => {
    let cancelled = false;
    const loadMetadata = async () => {
      if (!submitResult?.resultUri) {
        setNftPreview(null);
        return;
      }
      try {
        const res = await fetch(submitResult.resultUri);
        if (!res.ok) {
          throw new Error("metadata fetch failed");
        }
        const json = (await res.json()) as NftPreview;
        if (!cancelled) {
          setNftPreview(json);
        }
      } catch {
        if (!cancelled) {
          setNftPreview(null);
        }
      }
    };
    loadMetadata();
    return () => {
      cancelled = true;
    };
  }, [submitResult?.resultUri]);

  const handleSubmit = async () => {
    if (!bazi || loading || !publicKey) return;
    try {
      setLoading(true);
      setSubmitError(null);
      setSubmitResult(null);
      const promptText = bazi.trim();
      if (!promptText) {
        throw new Error("请输入有效内容");
      }
      const [statePda] = pda.getStatePda();
      const stateInfo = await connection.getAccountInfo(statePda);
      if (!stateInfo) {
        throw new Error("Oracle state account not found");
      }
      const state = decodeOracleState(stateInfo.data);
      const [counterPda] = pda.getUserCounterPda(publicKey);
      const counterInfo = await connection.getAccountInfo(counterPda);
      const nextRequestId = counterInfo
        ? decodeUserCounter(counterInfo.data).nextRequestId
        : 0n;
      const [requestPda] = pda.getRequestPda(publicKey, nextRequestId);
      const promptBytes = new TextEncoder().encode(promptText);
      const promptHash = new Uint8Array(
        await crypto.subtle.digest("SHA-256", promptBytes)
      );

      const ix = await buildRequestOracleIx(
        publicKey,
        statePda,
        counterPda,
        requestPda,
        state.treasury,
        promptHash
      );
      const tx = new Transaction().add(ix);
      const signature = await sendTransaction(tx, connection);
      await connection.confirmTransaction(signature, "confirmed");

      setSubmitResult({
        requestSignature: signature,
        requestId: nextRequestId.toString()
      });

      const oracleRes = await fetch("/api/oracle", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          user: publicKey.toBase58(),
          requestId: nextRequestId.toString(),
          prompt: promptText,
          name: "CyberOracle",
          locale: "zh"
        })
      });
      const oracleJson = (await oracleRes.json()) as OracleResponse;
      if (!oracleJson.ok) {
        throw new Error(oracleJson.error ?? "生成失败");
      }

      setSubmitResult({
        requestSignature: signature,
        requestId: nextRequestId.toString(),
        oracleText: oracleJson.oracleText,
        resultUri: oracleJson.resultUri,
        assetId: oracleJson.assetId,
        mintSignature: oracleJson.signature
      });
      setBazi("");
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "请求失败");
    } finally {
      setLoading(false);
    }
  };

  const handleMintNft = async () => {
    if (!publicKey || minting) return;
    try {
      setMinting(true);
      setMintError(null);
      setMintResult(null);

      const name = submitResult?.oracleText
        ? "CyberOracle — Fortune"
        : "CyberOracle";
      const description =
        submitResult?.oracleText ?? "CyberOracle on-chain fortune";
      const baseUrl =
        typeof window !== "undefined" ? window.location.origin : "";
      const metadataUri =
        submitResult?.resultUri ??
        `${baseUrl}/api/metadata?name=${encodeURIComponent(
          name
        )}&desc=${encodeURIComponent(description)}`;

      const mintAccount = Keypair.generate();
      const lamports = await connection.getMinimumBalanceForRentExemption(
        MINT_SIZE
      );
      const ata = getAssociatedTokenAddressSync(
        mintAccount.publicKey,
        publicKey
      );

      const tx = new Transaction();
      tx.add(
        SystemProgram.createAccount({
          fromPubkey: publicKey,
          newAccountPubkey: mintAccount.publicKey,
          space: MINT_SIZE,
          lamports,
          programId: TOKEN_PROGRAM_ID
        }),
        createInitializeMint2Instruction(
          mintAccount.publicKey,
          0,
          publicKey,
          publicKey,
          TOKEN_PROGRAM_ID
        ),
        createAssociatedTokenAccountInstruction(
          publicKey,
          ata,
          publicKey,
          mintAccount.publicKey,
          TOKEN_PROGRAM_ID,
          ASSOCIATED_TOKEN_PROGRAM_ID
        ),
        createMintToInstruction(
          mintAccount.publicKey,
          ata,
          publicKey,
          1,
          [],
          TOKEN_PROGRAM_ID
        )
      );

      const signature = await sendTransaction(tx, connection, {
        signers: [mintAccount]
      });
      await connection.confirmTransaction(signature, "confirmed");

      setMintResult({ mint: mintAccount.publicKey.toBase58(), signature });
      setSubmitResult((prev) =>
        prev
          ? {
              ...prev,
              assetId: mintAccount.publicKey.toBase58(),
              mintSignature: signature,
              resultUri: metadataUri
            }
          : {
              requestSignature: signature,
              requestId: "0",
              assetId: mintAccount.publicKey.toBase58(),
              mintSignature: signature,
              resultUri: metadataUri
            }
      );

      const previewRes = await fetch(metadataUri);
      if (previewRes.ok) {
        const json = (await previewRes.json()) as NftPreview;
        setNftPreview(json);
      }
    } catch (error) {
      setMintError(error instanceof Error ? error.message : "Mint failed");
    } finally {
      setMinting(false);
    }
  };

  const shortAddress = (value?: string) => {
    if (!value) return "---";
    if (value.length <= 8) return value;
    return `${value.slice(0, 4)}...${value.slice(-4)}`;
  };

  const oraclePriceSol =
    oracleState?.priceLamports !== undefined
      ? (oracleState.priceLamports / LAMPORTS_PER_SOL).toFixed(6)
      : "---";

  const walletSol =
    walletBalanceLamports !== null
      ? (walletBalanceLamports / LAMPORTS_PER_SOL).toFixed(4)
      : "---";

  return (
    <div className="min-h-screen w-full bg-[#111] text-gray-100 flex flex-col items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md bg-[#1a1a1a] border border-gray-800 rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-6 border-b border-gray-800 flex justify-between items-center bg-[#222]">
          <div>
            <h1 className="text-lg font-bold text-white">Cyber Oracle</h1>
            <p className="text-xs text-gray-500">链上命运预测</p>
          </div>
          {mounted ? (
            <WalletMultiButton />
          ) : (
            <div className="text-xs text-gray-400 px-4 py-2">Connecting...</div>
          )}
        </div>

        <div className="p-8 text-center bg-gradient-to-b from-[#1a1a1a] to-[#151515]">
          <p className="text-gray-500 text-sm mb-2 flex items-center justify-center gap-2">
            <Coins size={14} /> 我的余额 (SOL)
          </p>
          <div className="text-4xl font-bold tracking-tight text-white">
            {walletSol}
          </div>
          <p className="text-xs text-gray-600 mt-2">
            预测费用: {oraclePriceSol} SOL
          </p>
          <div className="mt-4 space-y-1 text-xs text-gray-500">
            <div>管理员: {shortAddress(oracleState?.authority)}</div>
          </div>
          {oracleError && (
            <p className="mt-2 text-xs text-red-400">{oracleError}</p>
          )}
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2 ml-1">
              请输入生辰八字 / 愿望
            </label>
            <textarea
              value={bazi}
              onChange={(e) => setBazi(e.target.value)}
              placeholder="例如：1998年 甲寅月..."
              rows={3}
              className="w-full bg-[#111] border border-gray-700 rounded-xl p-4 text-white placeholder-gray-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all resize-none text-base"
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || !bazi || !publicKey}
            className={`w-full py-3.5 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
              bazi && !loading && publicKey
                ? "bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20"
                : "bg-gray-800 text-gray-500 cursor-not-allowed"
            }`}
          >
            {loading ? (
              <span>提交中...</span>
            ) : (
              <>
                <Sparkles size={18} /> 提交预测请求
              </>
            )}
          </button>
          {!publicKey && (
            <p className="text-xs text-gray-500">请先连接钱包再提交。</p>
          )}
          {submitError && <p className="text-xs text-red-400">{submitError}</p>}
          {submitResult && (
            <div className="text-xs text-gray-300 rounded-lg border border-gray-800 bg-[#111] p-3 space-y-1">
              <div className="text-gray-500 mb-1">链上请求已提交并生成结果</div>
              <div>Request ID: {submitResult.requestId}</div>
              <div className="text-gray-500">
                请求 Tx: {submitResult.requestSignature.slice(0, 8)}...
              </div>
              {submitResult.mintSignature && (
                <div className="text-gray-500">
                  Mint Tx: {submitResult.mintSignature.slice(0, 8)}...
                </div>
              )}
              {submitResult.oracleText && (
                <div className="mt-2 whitespace-pre-wrap text-gray-200">
                  {submitResult.oracleText}
                </div>
              )}
              {submitResult.resultUri && (
                <div className="mt-2 text-gray-500">
                  URI: {submitResult.resultUri.slice(0, 32)}...
                </div>
              )}
            </div>
          )}
          <div className="text-xs text-gray-300 rounded-lg border border-gray-800 bg-[#111] p-3 space-y-2">
            <div className="text-gray-500">NFT 预览</div>
            {nftPreview?.image ? (
              <img
                src={nftPreview.image}
                alt={nftPreview.name ?? "NFT"}
                className="w-full rounded-md border border-gray-800"
              />
            ) : (
              <div className="rounded-md border border-gray-800 bg-[#0b0b0b] p-6 text-center text-gray-500">
                暂无 NFT
              </div>
            )}
          <div className="text-gray-200">
            {nftPreview?.name ?? "CyberOracle NFT"}
          </div>
          {nftPreview?.description && (
            <div className="text-gray-400 whitespace-pre-wrap">
              {nftPreview.description}
            </div>
          )}
          <button
            onClick={handleMintNft}
            disabled={!publicKey || minting}
            className={`w-full mt-2 py-2 rounded-lg text-sm font-semibold transition-all ${
              publicKey && !minting
                ? "bg-white text-black hover:bg-zinc-100"
                : "bg-gray-800 text-gray-500 cursor-not-allowed"
            }`}
          >
            {minting ? "Minting..." : "Mint NFT"}
          </button>
          {mintResult && (
            <div className="text-gray-500">
              Mint: {mintResult.mint.slice(0, 8)}... | Tx:{" "}
              {mintResult.signature.slice(0, 8)}...
            </div>
          )}
          {mintError && <div className="text-red-400">{mintError}</div>}
        </div>
        </div>
      </div>

      <p className="mt-8 text-xs text-gray-600">Powered by Solana Blockchain</p>
    </div>
  );
}
