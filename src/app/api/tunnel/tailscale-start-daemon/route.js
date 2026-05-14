"use server";

import { NextResponse } from "next/server";
import { startDaemonWithPassword } from "@/lib/tunnel/tailscale";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    // Use provided password when available
    const password = body.sudoPassword || "";
    await startDaemonWithPassword(password);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Tailscale start daemon error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
