import { BaseExecutor } from "./base.js";
import { PROVIDERS } from "../config/providers.js";
import { proxyAwareFetch } from "../utils/proxyFetch.js";

const ALLOWED_MODELS = new Set(["deepseek-v3.2", "deepseek-v3.1", "minimax-m2.7"]);

function str(v) { return String(v || "").trim(); }
function splitGeneralComputeIds(psd = {}) {
  const combined = `${psd.sessionId || psd.session_id || ""} ${psd.organizationId || psd.organization_id || ""}`;
  return {
    sessionId: combined.match(/sess_[A-Za-z0-9]+/)?.[0] || str(psd.sessionId || psd.session_id),
    organizationId: combined.match(/org_[A-Za-z0-9]+/)?.[0] || str(psd.organizationId || psd.organization_id),
  };
}

export class GeneralComputeExecutor extends BaseExecutor {
  constructor() {
    super("general-compute", PROVIDERS["general-compute"]);
  }

  async resolveJwt(credentials) {
    const psd = credentials?.providerSpecificData || {};
    const cookie = str(psd.cookie);
    const { sessionId, organizationId } = splitGeneralComputeIds(psd);
    if (!cookie || !sessionId || !organizationId) {
      throw new Error("General Compute requires cookie, sessionId, and organizationId");
    }

    const res = await fetch(`https://clerk.generalcompute.com/v1/client/sessions/${encodeURIComponent(sessionId)}/tokens`, {
      method: "POST",
      headers: {
        "Accept": "*/*",
        "Content-Type": "application/x-www-form-urlencoded",
        "Cookie": cookie,
        "Origin": "https://app.generalcompute.com",
        "Referer": "https://app.generalcompute.com/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
      },
      body: new URLSearchParams({ organization_id: organizationId }),
    });

    if (!res.ok) {
      throw new Error(`General Compute Clerk token failed HTTP ${res.status}. Re-check cookie/session_id/organization_id.`);
    }
    const data = await res.json();
    if (!data?.jwt) throw new Error("General Compute Clerk token response missing jwt");
    return data.jwt;
  }

  transformRequest(model, body) {
    if (!ALLOWED_MODELS.has(model)) throw new Error(`Unsupported General Compute model: ${model}`);
    return {
      model,
      messages: body.messages || [],
      temperature: body.temperature ?? 0,
      top_p: body.top_p ?? 0,
      presence_penalty: body.presence_penalty ?? 0,
      frequency_penalty: body.frequency_penalty ?? 0,
      stream: true,
      stream_options: { include_usage: true },
    };
  }

  parseError(response, bodyText) {
    let hint = "Upstream rejected the request";
    try {
      const data = JSON.parse(bodyText || "{}");
      hint = data?.error?.message || data?.message || hint;
    } catch {
      if (String(bodyText || "").trim().startsWith("{")) hint = "Invalid upstream JSON error";
      else if (String(bodyText || "").toLowerCase().includes("<!doctype html") || String(bodyText || "").toLowerCase().includes("<html")) hint = "Upstream returned HTML error page";
    }
    return { status: response.status, message: `General Compute HTTP ${response.status}: ${hint}` };
  }

  async execute({ model, body, stream, credentials, signal, log, proxyOptions = null }) {
    const jwt = await this.resolveJwt(credentials);
    const url = this.config.baseUrl;
    const transformedBody = this.transformRequest(model, body, true, credentials);
    const headers = {
      "Content-Type": "application/json",
      "Accept": "text/event-stream",
      "Authorization": `Bearer ${jwt}`,
      ...this.config.headers,
    };

    log?.debug?.("GENERAL_COMPUTE", `POST ${url} model=${model}`);
    const response = await proxyAwareFetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(transformedBody),
      signal,
    }, proxyOptions);

    return { response, url, headers, transformedBody };
  }
}
