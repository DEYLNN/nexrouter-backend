import { BaseExecutor } from "./base.js";
import { PROVIDERS } from "../config/providers.js";
import { proxyAwareFetch } from "../utils/proxyFetch.js";
import { buildPseudoToolInstructions } from "../utils/pseudoToolCallParser.js";

const ALLOWED_MODELS = new Set(["deepseek-v3.2", "deepseek-v3.1", "minimax-m2.7"]);

function str(v) { return String(v || "").trim(); }
function textContent(value) {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value.map((part) => {
      if (typeof part === "string") return part;
      if (part?.type === "text") return part.text || "";
      return JSON.stringify(part ?? "");
    }).filter(Boolean).join("\n");
  }
  return JSON.stringify(value);
}
function hasRecentToolResult(messages = []) {
  return messages.slice(-10).some((message) => {
    const text = typeof message?.content === "string" ? message.content : JSON.stringify(message?.content || "");
    return message?.role === "tool" || message?.role === "function" || /^\[[^\]]+ result\]/i.test(text.trim());
  });
}
function toolInstructions(tools = [], messages = []) {
  const content = buildPseudoToolInstructions(tools, { hasRecentToolResult: hasRecentToolResult(messages) });
  return content ? { role: "system", content } : null;
}
function normalizeMessages(messages = [], tools = []) {
  const normalized = messages.map((message) => {
    const role = message?.role === "assistant" ? "assistant" : (message?.role === "system" ? "system" : "user");
    let content = textContent(message?.content);
    if (message?.role === "tool" || message?.role === "function") {
      const label = message.name || message.tool_call_id || "tool";
      return { role: "user", content: `[${label} result]\n${content}`.slice(0, 8000) };
    }
    if (Array.isArray(message?.tool_calls) && message.tool_calls.length > 0) {
      const calls = message.tool_calls.map((call) => {
        const name = call?.function?.name || call?.name || call?.id || "tool";
        const args = call?.function?.arguments || call?.arguments || "{}";
        return `- ${name}(${args})`;
      }).join("\n");
      content = `${content || "Requested tool calls:"}\n${calls}`;
    }
    return { role, content: content.slice(0, 12000) };
  }).filter((m) => m.content.trim()).slice(-80);
  const inst = toolInstructions(tools, messages);
  return inst ? [inst, ...normalized] : normalized;
}
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

  transformRequest(model, body, stream = true) {
    if (!ALLOWED_MODELS.has(model)) throw new Error(`Unsupported General Compute model: ${model}`);
    return {
      model,
      messages: normalizeMessages(body.messages || [], body.tools || []),
      temperature: body.temperature ?? 0,
      top_p: body.top_p ?? 0,
      presence_penalty: body.presence_penalty ?? 0,
      frequency_penalty: body.frequency_penalty ?? 0,
      stream,
      ...(stream ? { stream_options: { include_usage: true } } : {}),
    };
  }

  parseError(response, bodyText) {
    let hint = "Upstream rejected the request";
    try {
      const data = JSON.parse(bodyText || "{}");
      hint = data?.error?.message || data?.message || hint;
    } catch {
      if (String(bodyText || "").trim().startsWith("{")) hint = "Invalid upstream JSON error";
      else if (String(bodyText || "").toLowerCase().includes("<!doctype html") || String(bodyText || "").toLowerCase().includes("<html")) {
        hint = response.status === 403
          ? "General Compute session/auth was rejected by upstream (HTML 403). Refresh or replace the General Compute cookie/session; retry after the short account cooldown."
          : "Upstream returned HTML error page";
      }
    }
    return { status: response.status, message: `General Compute HTTP ${response.status}: ${hint}` };
  }

  async execute({ model, body, stream, credentials, signal, log, proxyOptions = null }) {
    const jwt = await this.resolveJwt(credentials);
    const url = this.config.baseUrl;
    const transformedBody = this.transformRequest(model, body, stream);
    const headers = {
      "Content-Type": "application/json",
      "Accept": stream ? "text/event-stream" : "application/json",
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
