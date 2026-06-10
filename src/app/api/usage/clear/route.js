import { NextResponse } from "next/server";
import { clearUsageData } from "@/lib/usageDb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    if (body?.confirm !== "CLEAR_USAGE_DATA") {
      return NextResponse.json({ ok: false, error: "Confirmation token required" }, { status: 400 });
    }
    const result = await clearUsageData({
      scope: body?.scope || "all",
      vacuum: body?.vacuum !== false,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[api/usage/clear] failed:", error);
    return NextResponse.json({ ok: false, error: error.message || "Failed to clear usage data" }, { status: 500 });
  }
}
