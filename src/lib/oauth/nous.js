const NOUS_PORTAL_URL = process.env.NOUS_PORTAL_URL || "https://portal.nousresearch.com";
export const NOUS_INFERENCE_URL = process.env.NOUS_INFERENCE_URL || "https://inference-api.nousresearch.com/v1";
export const NOUS_CLIENT_ID = process.env.NOUS_CLIENT_ID || "hermes-cli";
export const NOUS_SCOPE = process.env.NOUS_SCOPE || "inference:mint_agent_key";

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
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token || refreshToken,
    expiresIn: data.expires_in || 3600,
    providerSpecificData: data.inference_base_url ? { inferenceBaseUrl: data.inference_base_url } : undefined,
  };
}

export async function mintNousAgentKey(accessToken, minTtlSeconds = 1800) {
  const res = await fetch(`${NOUS_PORTAL_URL}/api/oauth/agent-key`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ min_ttl_seconds: Math.max(60, minTtlSeconds) }),
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(`${data.error || "agent_key_failed"}: ${data.error_description || text || res.status}`);
  return {
    agentKey: data.api_key,
    agentKeyId: data.key_id || "",
    agentKeyObtainedAt: Date.now(),
    agentKeyExpiresIn: data.expires_in || 1800,
    inferenceBaseUrl: data.inference_base_url || undefined,
  };
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
