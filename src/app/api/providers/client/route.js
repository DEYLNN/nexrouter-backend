import { NextResponse } from "next/server";
import { getProviderConnections } from "@/lib/localDb";
import { backfillCodexEmails } from "@/lib/oauth/providers";

function decodeJwtExp(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

// GET /api/providers/client - List all connections for client (includes sensitive fields for sync)
export async function GET() {
  try {
    await backfillCodexEmails();
    const connections = await getProviderConnections();
    
    // Include sensitive fields for sync to cloud (only accessible from same origin)
    const clientConnections = connections.map(c => {
      const jwtExp = decodeJwtExp(c.accessToken);
      const jwtExpiresAt = jwtExp ? new Date(jwtExp * 1000).toISOString() : null;
      const storedExpiresAt = c.expiresAt || c.tokenExpiresAt || null;
      const effectiveExpiresAt = jwtExpiresAt || storedExpiresAt;
      const expiresMs = effectiveExpiresAt ? new Date(effectiveExpiresAt).getTime() : null;

      return {
        ...c,
        hasRefreshToken: !!c.refreshToken,
        accessTokenExpiresAt: effectiveExpiresAt,
        accessTokenExpired: typeof expiresMs === "number" && Number.isFinite(expiresMs)
          ? expiresMs <= Date.now()
          : false,
        // Keep this route same-origin only; UI uses hasRefreshToken so it does not
        // depend on reading raw refresh tokens in client state.
      };
    });

    return NextResponse.json({ connections: clientConnections });
  } catch (error) {
    console.log("Error fetching providers for client:", error);
    return NextResponse.json({ error: "Failed to fetch providers" }, { status: 500 });
  }
}
