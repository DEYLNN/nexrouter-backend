import { NextResponse } from "next/server";
import { jwtVerify } from "jose";
import { getConsistentMachineId } from "@/shared/utils/machineId";

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "9router-default-secret-change-me"
);

const CLI_TOKEN_HEADER = "x-9r-cli-token";
const CLI_TOKEN_SALT = "9r-cli-auth";

let cachedCliToken = null;
async function getCliToken() {
  if (!cachedCliToken) cachedCliToken = await getConsistentMachineId(CLI_TOKEN_SALT);
  return cachedCliToken;
}

async function hasValidCliToken(request) {
  const token = request.headers.get(CLI_TOKEN_HEADER);
  if (!token) return false;
  return token === await getCliToken();
}

// Always require JWT token regardless of requireLogin setting
const ALWAYS_PROTECTED = [
  "/api/shutdown",
  "/api/settings/database",
];

// Require auth, but allow through if requireLogin is disabled
const PROTECTED_API_PATHS = [
  "/api/settings",
  "/api/keys",
  "/api/providers/client",
  "/api/provider-nodes/validate",
];

async function hasValidToken(request) {
  const token = request.cookies.get("auth_token")?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, SECRET);
    return true;
  } catch {
    return false;
  }
}

const backendBaseUrl = (process.env.BACKEND_BASE_URL || "").replace(/\/$/, "");
const hasRemoteBackend = Boolean(backendBaseUrl);

// Read settings from the remote Hono backend when BACKEND_BASE_URL is configured
// (Vercel/Next-only UI mode). Fall back to local DB only in standalone/local mode.
async function loadSettings(request = null) {
  try {
    if (hasRemoteBackend) {
      const headers = {};
      const cookie = request?.headers.get("cookie");
      if (cookie) headers.cookie = cookie;
      const res = await fetch(`${backendBaseUrl}/api/settings`, {
        headers,
        cache: "no-store",
      });
      if (!res.ok) return null;
      return await res.json();
    }

    const { getSettings } = await import("@/lib/localDb");
    return await getSettings();
  } catch {
    return null;
  }
}


function backendProxyResponse(request) {
  if (!backendBaseUrl) return null;

  const url = request.nextUrl.clone();
  url.href = `${backendBaseUrl}${request.nextUrl.pathname}${request.nextUrl.search}`;
  return NextResponse.rewrite(url);
}

async function isAuthenticated(request) {
  if (await hasValidToken(request)) return true;
  const settings = await loadSettings(request);
  if (settings && settings.requireLogin === false) return true;
  return false;
}

export async function proxy(request) {
  const { pathname } = request.nextUrl;

  const shouldUseBackend =
    pathname === "/api/health" ||
    pathname === "/api/init" ||
    pathname === "/api/auth/login" ||
    pathname === "/api/auth/logout" ||
    pathname === "/api/locale" ||
    pathname === "/api/tags" ||
    pathname === "/api/models" ||
    pathname.startsWith("/api/models/") ||
    pathname === "/api/settings" ||
    pathname.startsWith("/api/settings/") ||
    pathname === "/api/keys" ||
    pathname.startsWith("/api/keys/") ||
    pathname === "/api/providers" ||
    pathname.startsWith("/api/providers/") ||
    pathname === "/api/provider-nodes" ||
    pathname.startsWith("/api/provider-nodes/") ||
    pathname === "/api/models/alias" ||
    pathname === "/api/models/custom" ||
    pathname === "/api/models/disabled" ||
    pathname === "/api/models/test" ||
    pathname === "/api/combos" ||
    pathname.startsWith("/api/combos/") ||
    pathname === "/api/pricing" ||
    pathname === "/api/usage" ||
    pathname.startsWith("/api/usage/") ||
    pathname.startsWith("/api/oauth/") ||
    pathname.startsWith("/api/translator/") ||
    pathname.startsWith("/api/v1") ||
    pathname === "/v1" ||
    pathname.startsWith("/v1/") ||
    pathname.startsWith("/codex/");

  if (shouldUseBackend) {
    const proxied = backendProxyResponse(request);
    if (proxied) return proxied;
  }

  // Always protected - require valid JWT or local CLI token (machineId-based)
  if (ALWAYS_PROTECTED.some((p) => pathname.startsWith(p))) {
    if (await hasValidCliToken(request) || await hasValidToken(request))
      return NextResponse.next();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Protect sensitive API endpoints (allow CLI token, JWT, or requireLogin=false)
  if (PROTECTED_API_PATHS.some((p) => pathname.startsWith(p))) {
    if (pathname === "/api/settings/require-login") return NextResponse.next();
    if (await hasValidCliToken(request) || await isAuthenticated(request))
      return NextResponse.next();
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Protect all dashboard routes
  if (pathname.startsWith("/dashboard")) {
    let requireLogin = true;
    let tunnelDashboardAccess = true;

    try {
      const settings = await loadSettings(request);
      if (settings) {
        requireLogin = settings.requireLogin !== false;
        tunnelDashboardAccess = settings.tunnelDashboardAccess === true;

        // Block tunnel/tailscale access if disabled (redirect to login)
        if (!tunnelDashboardAccess) {
          const host = (request.headers.get("host") || "").split(":")[0].toLowerCase();
          const tunnelHost = settings.tunnelUrl ? new URL(settings.tunnelUrl).hostname.toLowerCase() : "";
          const tailscaleHost = settings.tailscaleUrl ? new URL(settings.tailscaleUrl).hostname.toLowerCase() : "";
          if ((tunnelHost && host === tunnelHost) || (tailscaleHost && host === tailscaleHost)) {
            return NextResponse.redirect(new URL("/login", request.url));
          }
        }
      }
    } catch {
      // On error, keep defaults (require login, block tunnel)
    }

    // If login not required, allow through
    if (!requireLogin) return NextResponse.next();

    // Verify JWT token
    const token = request.cookies.get("auth_token")?.value;
    if (token) {
      try {
        await jwtVerify(token, SECRET);
        return NextResponse.next();
      } catch {
        return NextResponse.redirect(new URL("/login", request.url));
      }
    }

    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Redirect / to /dashboard if logged in, or /dashboard if it's the root
  if (pathname === "/") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/dashboard/:path*"],
};
