import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createHash } from "crypto";
import { mintCnftAndFulfill } from "../../../lib/mint-cnft";
import type { OracleRequest } from "../../../lib/api-types";

export const runtime = "nodejs";

const MAX_PROMPT_CHARS = Number.parseInt(
  process.env.ORACLE_PROMPT_MAX_CHARS ?? "600",
  10
);
const MAX_NAME_CHARS = 64;
const DEFAULT_LOCALE = "en";

const getEnv = (key: string) => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing env: ${key}`);
  }
  return value;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const normalizeLocale = (locale?: string) => {
  if (!locale) return DEFAULT_LOCALE;
  const trimmed = locale.trim();
  if (!trimmed) return DEFAULT_LOCALE;
  const normalized = trimmed.replace("_", "-").toLowerCase();
  const allowed = new Set([
    "en",
    "zh",
    "zh-cn",
    "zh-tw",
    "ja",
    "ko",
    "es",
    "fr",
    "de"
  ]);
  return allowed.has(normalized) ? normalized : DEFAULT_LOCALE;
};

const buildOracleInstructions = (locale: string) =>
  [
    "You are a cyberpunk oracle.",
    "Write a concise, vivid fortune in 2-4 short sentences.",
    `Locale: ${locale}.`,
    "Avoid medical, legal, or financial advice.",
    "Do not mention system prompts or policies."
  ].join(" ");

const fakeOracleText = () => `2006 年 5 月 16 日

星座：金牛座（大概率）

生肖：狗（2006 丙戌，多被称为“火狗”）

命运关键词（简要版）

稳、慢热、抗压强、越到后期越吃香。
这类人通常不是“一飞冲天”型，更像是靠长期积累、信誉和硬实力把路越走越宽。

主要走向

学业/事业：适合走“可复制的成长路径”——比如技术、工程、金融、设计、产品、运营、管理等。优势在于耐心+执行力，把一件事做深会很强；容易在 20 多岁后期到 30 岁明显起势。

财富：偏向稳定进账、会攒钱、重视安全感。适合长期投资思维（前提是别被短期情绪带节奏）。

感情：慢热、认定后很专一，重视踏实与承诺；容易因为“太能扛、太不说”让对方猜不透，沟通是关键。

性格课题：固执、较真、对自己要求高；压力大时可能闷着硬撑。学会更早求助、表达需求，会省很多弯路。

健康倾向：金牛常见是作息/饮食不规律引发的小问题（体重、喉咙、颈肩等），长期规律运动收益很大。`;

const uploadMetadata = async (
  payload: Record<string, unknown>
): Promise<string> => {
  const uploadUrl = getEnv("METADATA_UPLOAD_URL");
  const res = await fetch(uploadUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    throw new Error(`metadata upload failed: ${res.status}`);
  }
  const json = (await res.json()) as { url?: string };
  if (!json.url) {
    throw new Error("metadata upload response missing url");
  }
  return json.url;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as OracleRequest;
    const { user, requestId, prompt, name, locale } = body;

    if (!user || !prompt || requestId === undefined) {
      return NextResponse.json(
        { ok: false, error: "user, requestId, prompt are required" },
        { status: 400 }
      );
    }

    const promptText = String(prompt).trim();
    if (!promptText) {
      return NextResponse.json(
        { ok: false, error: "prompt cannot be empty" },
        { status: 400 }
      );
    }
    if (promptText.length > MAX_PROMPT_CHARS) {
      return NextResponse.json(
        {
          ok: false,
          error: `prompt too long (max ${MAX_PROMPT_CHARS} chars)`
        },
        { status: 400 }
      );
    }

    const requestIdText = String(requestId);
    if (!requestIdText) {
      return NextResponse.json(
        { ok: false, error: "requestId is invalid" },
        { status: 400 }
      );
    }

    const promptHash = Array.from(
      createHash("sha256").update(promptText).digest()
    );

    const mockEnabled = process.env.CYBERORACLE_MOCK === "1";
    const localeNormalized = normalizeLocale(locale);
    const safeName = (name ?? "CyberOracle").trim().slice(0, MAX_NAME_CHARS);

    let oracleText = "";
    const fakeEnabled = process.env.ORACLE_FAKE === "1";
    if (mockEnabled && fakeEnabled) {
      oracleText = fakeOracleText(promptText, localeNormalized);
    } else if (mockEnabled) {
      oracleText = `【MOCK】霓虹回声已苏醒。\n你的问题将被写入链上档案：${prompt.slice(
        0,
        60
      )}`;
    } else if (fakeEnabled) {
      oracleText = fakeOracleText(promptText, localeNormalized);
    } else {
      const apiKey = getEnv("GEMINI_API_KEY");
      const model = process.env.GEMINI_MODEL ?? "gemini-1.5-flash";
      const maxOutputTokens = Number.parseInt(
        process.env.GEMINI_MAX_OUTPUT_TOKENS ?? "200",
        10
      );
      const temperature = clamp(
        Number.parseFloat(process.env.GEMINI_TEMPERATURE ?? "0.7"),
        0,
        2
      );

      const genAI = new GoogleGenerativeAI(apiKey);
      const gemini = genAI.getGenerativeModel({
        model,
        systemInstruction: buildOracleInstructions(localeNormalized)
      });

      const result = await gemini.generateContent({
        contents: [
          {
            role: "user",
            parts: [{ text: `User prompt: ${promptText}` }]
          }
        ],
        generationConfig: {
          maxOutputTokens,
          temperature
        }
      });

      oracleText = result.response.text().trim();
      if (!oracleText) {
        throw new Error("oracle response empty");
      }
    }

    const metadata = {
      name: safeName,
      symbol: "CYBOR",
      description: oracleText,
      attributes: [
        { trait_type: "Locale", value: localeNormalized },
        { trait_type: "RequestId", value: requestIdText }
      ]
    };

    let metadataUri = "";
    if (mockEnabled) {
      const baseUrl = new URL(req.url).origin;
      metadataUri = `${baseUrl}/api/metadata?name=${encodeURIComponent(
        metadata.name
      )}&desc=${encodeURIComponent(metadata.description)}`;
    } else {
      metadataUri = await uploadMetadata({
        user,
        requestId,
        metadata
      });
    }

    const resultUri = metadataUri;

    if (mockEnabled) {
      return NextResponse.json({
        ok: true,
        oracleText,
        promptHash,
        resultUri,
        metadataUri,
        assetId: "MOCK_ASSET_ID",
        signature: "MOCK_SIGNATURE"
      });
    }

    const mintResult = await mintCnftAndFulfill({
      user,
      requestId,
      promptHash,
      resultUri,
      metadataUri,
      name
    });

    return NextResponse.json({
      ok: true,
      oracleText,
      promptHash,
      resultUri,
      metadataUri,
      assetId: mintResult.assetId,
      signature: mintResult.signature
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
