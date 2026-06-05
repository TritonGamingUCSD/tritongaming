import { NextResponse } from "next/server";

// In-memory store — acceptable for single-deployment event usage.
// Resets on cold start; use Vercel KV or similar for persistence.
let rebellionCount = 0;

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ count: rebellionCount });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name =
      typeof body?.name === "string" ? body.name.trim().slice(0, 120) : "";
    if (name) {
      rebellionCount++;
    }
    return NextResponse.json({ count: rebellionCount, ok: true });
  } catch {
    return NextResponse.json(
      { count: rebellionCount, ok: false },
      { status: 400 },
    );
  }
}
