import { NextRequest, NextResponse } from "next/server";
import { getMetadata } from "../../../lib/metadata-store";

const svg = (title: string) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="900" height="900" viewBox="0 0 900 900">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#38f5b4"/>
      <stop offset="60%" stop-color="#6a7bff"/>
      <stop offset="100%" stop-color="#ff3bd4"/>
    </linearGradient>
  </defs>
  <rect width="900" height="900" fill="#0b0b10"/>
  <rect x="60" y="60" width="780" height="780" rx="32" fill="url(#g)" opacity="0.15"/>
  <rect x="90" y="90" width="720" height="720" rx="28" fill="#0f1225" stroke="rgba(255,255,255,0.2)"/>
  <text x="120" y="200" font-family="monospace" font-size="28" fill="#38f5b4">CYBERORACLE</text>
  <text x="120" y="260" font-family="monospace" font-size="20" fill="#b9c0e4">${title}</text>
  <circle cx="690" cy="220" r="70" fill="#38f5b4" opacity="0.15"/>
  <circle cx="690" cy="220" r="40" fill="#ff3bd4" opacity="0.2"/>
</svg>`;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (id) {
    const stored = getMetadata(id);
    if (!stored) {
      return NextResponse.json(
        { ok: false, error: "metadata not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(stored);
  }
  const name = searchParams.get("name") ?? "CyberOracle";
  const desc = searchParams.get("desc") ?? "";

  const image = `data:image/svg+xml;utf8,${encodeURIComponent(svg(name))}`;

  return NextResponse.json({
    name,
    description: desc,
    image
  });
}
