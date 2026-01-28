import { NextRequest, NextResponse } from "next/server";
import { mintCnftAndFulfill } from "../../../lib/mint-cnft";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      user: string;
      requestId: string | number;
      promptHash: number[];
      resultUri: string;
      metadataUri: string;
      name?: string;
    };

    const result = await mintCnftAndFulfill(body);

    return NextResponse.json({
      ok: true,
      assetId: result.assetId,
      signature: result.signature
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
