const NOUS_PORTAL_URL = process.env.NOUS_PORTAL_URL || "https://portal.nousresearch.com";
export const NOUS_INFERENCE_URL = process.env.NOUS_INFERENCE_URL || "https://inference-api.nousresearch.com/v1";
export const NOUS_CLIENT_ID = process.env.NOUS_CLIENT_ID || "hermes-cli";
export const NOUS_SCOPE = process.env.NOUS_SCOPE || "inference:invoke";

const ACCESS_TOKEN_REFRESH_SKEW_MS = 120_000;
const AGENT_KEY_REFRESH_SKEW_MS = 60_000;

async function postForm(url, params) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams(params),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`${data.error || "nous_error"}: ${data.error_description || text || res.status}`);
  return data;
}

export async function requestNousDeviceCode() {
  return await postForm(`${NOUS_PORTAL_URL}/api/oauth/device/code`, {
    client_id: NOUS_CLIENT_ID,
    scope: NOUS_SCOPE,
  });
}

export async function pollNousToken(deviceCode) {
  return await postForm(`${NOUS_PORTAL_URL}/api/oauth/token`, {
    grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    client_id: NOUS_CLIENT_ID,
    device_code: deviceCode,
  });
}

export async function refreshNousAccessToken(refreshToken) {
  const data = await postForm(`${NOUS_PORTAL_URL}/api/oauth/token`, {
    grant_type: "refresh_token",
    client_id: NOUS_CLIENT_ID,
    refresh_token: refreshToken,
  });
  const expiresIn = data.expires_in || 900;
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresIn,
    providerSpecificData: buildNousInvokeJwtData(data.access_token, expiresIn, data.inference_base_url),
  };
}

function decodeJwtPayload(token) {
  try {
    const payload = String(token || "").split(".")[1];
    if (!payload) return null;
    const json = Buffer.from(payload.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
    return JSON.parse(json);
  } catch {
    return null;
  }
}

function accessTokenTtlSeconds(accessToken, fallbackExpiresIn = 900) {
  const exp = Number(decodeJwtPayload(accessToken)?.exp || 0);
  if (!exp) return Number(fallbackExpiresIn || 900);
  return Math.max(0, Math.floor(exp - Date.now() / 1000));
}

export function buildNousInvokeJwtData(accessToken, expiresIn = 900, inferenceBaseUrl) {
  return {
    agentKey: accessToken,
    agentKeyId: "invoke_jwt",
    agentKeyObtainedAt: Date.now(),
    agentKeyExpiresIn: accessTokenTtlSeconds(accessToken, expiresIn),
    inferenceBaseUrl: inferenceBaseUrl || NOUS_INFERENCE_URL,
    authPath: "invoke_jwt",
  };
}

export async function mintNousAgentKey(accessToken, minTtlSeconds = 1800) {
  // Nous/Hermes upstream changed: free OAuth no longer mints a separate
  // /api/oauth/agent-key. The access JWT with inference:invoke is the runtime
  // inference credential (Hermes Agent calls this auth path "invoke_jwt").
  return buildNousInvokeJwtData(accessToken, minTtlSeconds);
}

export function isNousAgentKeyValid(providerSpecificData = {}) {
  const obtainedAt = Number(providerSpecificData.agentKeyObtainedAt || 0);
  const expiresIn = Number(providerSpecificData.agentKeyExpiresIn || 0);
  return Boolean(providerSpecificData.agentKey && obtainedAt && expiresIn)
    && Date.now() < obtainedAt + expiresIn * 1000 - AGENT_KEY_REFRESH_SKEW_MS;
}

export function shouldRefreshNousAccessToken(expiresAt) {
  if (!expiresAt) return false;
  return new Date(expiresAt).getTime() - Date.now() < ACCESS_TOKEN_REFRESH_SKEW_MS;
}
