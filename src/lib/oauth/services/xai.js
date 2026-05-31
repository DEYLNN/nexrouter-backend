/**
 * xAI (Grok) OAuth Service
 *
 * Ported from upstream decolua/9router.
 *
 * Flow:
 *  1. Discover endpoints from `https://auth.x.ai/.well-known/openid-configuration`
 *  2. Bind loopback server on 127.0.0.1:56121, path /callback
 *  3. PKCE S256 with 96-byte verifier
 *  4. Exchange code with form-urlencoded body
 *  5. id_token email decode (no signature verify, mirrors Go upstream)
 */

import crypto from "crypto";
import { XAI_CONFIG, XAI_PKCE_VERIFIER_BYTES } from "../constants/oauth.js";
import { startLocalServer } from "../utils/server.js";
import { generateCodeVerifier, generateCodeChallenge, generateState } from "../utils/pkce.js";

const BASE64_BLOCK_SIZE = 4;

let cachedDiscovery = null;

export function validateOAuthEndpoint(rawUrl, field) {
  const value = String(rawUrl || "").trim();
  if (!value) throw new Error(`xai discovery ${field} is empty`);
  let parsed;
  try {
    parsed = new URL(value);
  } catch (err) {
    throw new Error(`xai discovery ${field} is invalid: ${err.message}`);
  }
  if (parsed.protocol !== "https:") {
    throw new Error(`xai discovery ${field} must use https: ${value}`);
  }
  const host = parsed.hostname.toLowerCase().trim();
  if (host !== "x.ai" && !host.endsWith(".x.ai")) {
    throw new Error(`xai discovery ${field} host ${host} is not on x.ai`);
  }
  return value;
}

export async function discoverEndpoints() {
  if (cachedDiscovery) return cachedDiscovery;
  try {
    const res = await fetch(XAI_CONFIG.discoveryUrl, {
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      const data = await res.json();
      cachedDiscovery = {
        authorizeUrl: validateOAuthEndpoint(data.authorization_endpoint, "authorization_endpoint"),
        tokenUrl: validateOAuthEndpoint(data.token_endpoint, "token_endpoint"),
      };
      return cachedDiscovery;
    }
  } catch {
    // fall through to static fallback
  }
  cachedDiscovery = {
    authorizeUrl: XAI_CONFIG.authorizeUrl,
    tokenUrl: XAI_CONFIG.tokenUrl,
  };
  return cachedDiscovery;
}

export function decodeIdTokenEmail(idToken) {
  if (!idToken || typeof idToken !== "string") return undefined;
  const parts = idToken.split(".");
  if (parts.length !== 3) return undefined;
  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padding = (BASE64_BLOCK_SIZE - (base64.length % BASE64_BLOCK_SIZE)) % BASE64_BLOCK_SIZE;
    const json = Buffer.from(base64 + "=".repeat(padding), "base64").toString("utf8");
    const payload = JSON.parse(json);
    return payload.email || payload.preferred_username || payload.sub || undefined;
  } catch {
    return undefined;
  }
}

export class XaiService {
  buildXaiAuthUrl(redirectUri, state, codeChallenge, authorizeUrl) {
    const nonce = crypto.randomBytes(16).toString("hex");
    const params = {
      response_type: "code",
      client_id: XAI_CONFIG.clientId,
      redirect_uri: redirectUri,
      scope: XAI_CONFIG.scope,
      code_challenge: codeChallenge,
      code_challenge_method: XAI_CONFIG.codeChallengeMethod,
      state,
      nonce,
      plan: "generic",
      referrer: "9router",
    };
    const qs = Object.entries(params)
      .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
      .join("&");
    return `${authorizeUrl}?${qs}`;
  }

  async exchangeXaiCode({ tokenUrl, code, redirectUri, codeVerifier }) {
    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: XAI_CONFIG.clientId,
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`xAI token exchange failed: ${err}`);
    }
    return await res.json();
  }

  async refreshAccessToken(refreshToken) {
    const { tokenUrl } = await discoverEndpoints();
    const res = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: XAI_CONFIG.clientId,
        refresh_token: refreshToken,
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`xAI token refresh failed: ${err}`);
    }
    return await res.json();
  }

  async connect() {
    const { authorizeUrl, tokenUrl } = await discoverEndpoints();
    let callbackParams = null;
    const { port, close } = await startLocalServer((params) => {
      callbackParams = params;
    }, XAI_CONFIG.loopbackPort);
    const redirectUri = `http://127.0.0.1:${port}${XAI_CONFIG.callbackPath}`;

    const codeVerifier = generateCodeVerifier(XAI_PKCE_VERIFIER_BYTES);
    const codeChallenge = generateCodeChallenge(codeVerifier);
    const state = generateState();
    const authUrl = this.buildXaiAuthUrl(redirectUri, state, codeChallenge, authorizeUrl);

    // Return auth URL + session info for FE to handle
    return {
      authUrl,
      state,
      codeVerifier,
      redirectUri,
      port,
      close,
      tokenUrl,
    };
  }

  async completeAuth({ code, state, expectedState, codeVerifier, redirectUri, tokenUrl, close }) {
    if (close) close();
    if (state !== expectedState) throw new Error("Invalid state parameter");
    if (!code) throw new Error("No authorization code received");

    const tokens = await this.exchangeXaiCode({
      tokenUrl,
      code,
      redirectUri,
      codeVerifier,
    });
    const email = decodeIdTokenEmail(tokens.id_token);
    return { tokens, email };
  }
}
