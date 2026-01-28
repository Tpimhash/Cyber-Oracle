import { NextRequest, NextResponse } from "next/server";
import { putMetadata } from "../../../lib/metadata-store";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { metadata?: Record<string, unknown> };
    if (!body?.metadata || typeof body.metadata !== "object") {
      return NextResponse.json(
        { ok: false, error: "metadata is required" },
        { status: 400 }
      );
    }

    const id = putMetadata(body.metadata);
    const baseUrl = new URL(req.url).origin;
    return NextResponse.json({
      ok: true,
      url: `${baseUrl}/api/metadata?id=${encodeURIComponent(id)}`
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
