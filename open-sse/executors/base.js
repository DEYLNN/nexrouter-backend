import { HTTP_STATUS, RETRY_CONFIG, DEFAULT_RETRY_CONFIG, resolveRetryEntry } from "../config/runtimeConfig.js";
import { proxyAwareFetch } from "../utils/proxyFetch.js";

/**
 * BaseExecutor - Base class for provider executors
 */
function repairBtlAgenticPayload(body) {
  if (!Array.isArray(body?.messages)) return body;

  // BTL's upstream DeepSeek route rejects historical tool-role messages even
  // when they look paired. Keep top-level tools enabled for the current turn,
  // but flatten prior tool history to plain user context and strip old
  // assistant.tool_calls. This makes BTL agentic-lite instead of full replay.
  body.messages = body.messages.map((message) => {
    if (!message) return message;
    if (message.role === "tool") {
      const content = typeof message.content === "string" ? message.content : JSON.stringify(message.content || "");
      return {
        role: "user",
        content: `[Tool result${message.tool_call_id ? ` ${message.tool_call_id}` : ""}]\n${content}`,
      };
    }
    if (message.role === "assistant" && Array.isArray(message.tool_calls) && message.tool_calls.length > 0) {
      const { tool_calls, ...withoutToolCalls } = message;
      if (!withoutToolCalls.content && withoutToolCalls.reasoning_content) withoutToolCalls.content = "[Assistant used a tool]";
      return withoutToolCalls;
    }
    return message;
  }).filter((message) => message && message.content !== "");

  // BTL completes but tends to stop early with very large agent histories
  // (~90k-130k input). Keep system/developer prompts plus recent context.
  const keepHead = body.messages.filter((message) => message.role === "system" || message.role === "developer");
  const keepTail = body.messages.filter((message) => message.role !== "system" && message.role !== "developer").slice(-96);
  body.messages = [...keepHead, ...keepTail];

  if (body.max_tokens === undefined && body.max_completion_tokens === undefined) {
    body.max_tokens = 2048;
  }

  return body;
}

function debugProviderPayload(provider, body, model) {
  const envMap = {
    btl: "DEBUG_BTL_PAYLOAD",
    "badtheory-labs": "DEBUG_BTL_PAYLOAD",
  };
  const envName = envMap[provider];
  if (!envName || process.env[envName] !== "1") return;

  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const summary = messages.map((message, index) => ({
    index,
    role: message?.role,
    contentShape: Array.isArray(message?.content) ? "array" : typeof message?.content,
    hasReasoningContent: typeof message?.reasoning_content === "string",
    reasoningLength: typeof message?.reasoning_content === "string" ? message.reasoning_content.length : 0,
    hasToolCalls: Array.isArray(message?.tool_calls) && message.tool_calls.length > 0,
    toolCallCount: Array.isArray(message?.tool_calls) ? message.tool_calls.length : 0,
    toolCallId: message?.tool_call_id || undefined,
  }));

  console.log(`[${provider.toUpperCase()} DEBUG]`, JSON.stringify({
    provider,
    model,
    topKeys: Object.keys(body || {}).filter((key) => !/key|token|auth|secret|password/i.test(key)),
    hasReasoningEffort: !!body?.reasoning_effort,
    hasReasoning: !!body?.reasoning,
    hasTools: Array.isArray(body?.tools) && body.tools.length > 0,
    toolCount: Array.isArray(body?.tools) ? body.tools.length : 0,
    messageCount: messages.length,
    summary: summary.slice(-60),
  }));
}

export class BaseExecutor {
  constructor(provider, config) {
    this.provider = provider;
    this.config = config;
    this.noAuth = config?.noAuth || false;
  }

  getProvider() {
    return this.provider;
  }

  getBaseUrls() {
    return this.config.baseUrls || (this.config.baseUrl ? [this.config.baseUrl] : []);
  }

  getFallbackCount() {
    return this.getBaseUrls().length || 1;
  }

  buildUrl(model, stream, urlIndex = 0, credentials = null) {
    if (this.provider?.startsWith?.("openai-compatible-")) {
      const baseUrl = credentials?.providerSpecificData?.baseUrl || "https://api.openai.com/v1";
      const normalized = baseUrl.replace(/\/$/, "");
      const path = this.provider.includes("responses") ? "/responses" : "/chat/completions";
      return `${normalized}${path}`;
    }
    if (this.provider?.startsWith?.("anthropic-compatible-")) {
      const baseUrl = credentials?.providerSpecificData?.baseUrl || "https://api.anthropic.com/v1";
      const normalized = baseUrl.replace(/\/$/, "");
      return `${normalized}/messages`;
    }
    const baseUrls = this.getBaseUrls();
    return baseUrls[urlIndex] || baseUrls[0] || this.config.baseUrl;
  }

  buildHeaders(credentials, stream = true) {
    const headers = {
      "Content-Type": "application/json",
      ...this.config.headers
    };

    if (this.provider?.startsWith?.("anthropic-compatible-")) {
      // Anthropic-compatible providers use x-api-key header
      if (credentials.apiKey) {
        headers["x-api-key"] = credentials.apiKey;
      } else if (credentials.accessToken) {
        headers["Authorization"] = `Bearer ${credentials.accessToken}`;
      }
      if (!headers["anthropic-version"]) {
        headers["anthropic-version"] = "2023-06-01";
      }
    } else {
      // Standard Bearer token auth for other providers
      if (credentials.accessToken) {
        headers["Authorization"] = `Bearer ${credentials.accessToken}`;
      } else if (credentials.apiKey) {
        headers["Authorization"] = `Bearer ${credentials.apiKey}`;
      }
    }

    if (stream) {
      headers["Accept"] = "text/event-stream";
    }

    return headers;
  }

  // Override in subclass for provider-specific transformations
  transformRequest(model, body, stream, credentials) {
    return body;
  }

  shouldRetry(status, urlIndex) {
    return status === HTTP_STATUS.RATE_LIMITED && urlIndex + 1 < this.getFallbackCount();
  }

  // Override in subclass for provider-specific refresh
  async refreshCredentials(credentials, log, proxyOptions = null) {
    return null;
  }

  needsRefresh(credentials) {
    if (!credentials.expiresAt) return false;
    const expiresAtMs = new Date(credentials.expiresAt).getTime();
    return expiresAtMs - Date.now() < 5 * 60 * 1000;
  }

  parseError(response, bodyText) {
    return { status: response.status, message: bodyText || `HTTP ${response.status}` };
  }

  async execute({ model, body, stream, credentials, signal, log, proxyOptions = null }) {
    const fallbackCount = this.getFallbackCount();
    let lastError = null;
    let lastStatus = 0;
    const retryAttemptsByUrl = {};

    // Merge default retry config with provider-specific config
    const retryConfig = { ...DEFAULT_RETRY_CONFIG, ...this.config.retry };

    // Schedule retry via retryConfig[statusKey]. Returns true when caller should `urlIndex--; continue`
    const tryRetry = async (urlIndex, statusKey, reason) => {
      const { attempts, delayMs } = resolveRetryEntry(retryConfig[statusKey]);
      if (attempts <= 0 || retryAttemptsByUrl[urlIndex] >= attempts) return false;
      retryAttemptsByUrl[urlIndex]++;
      log?.debug?.("RETRY", `${reason} retry ${retryAttemptsByUrl[urlIndex]}/${attempts} after ${delayMs / 1000}s`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return true;
    };

    for (let urlIndex = 0; urlIndex < fallbackCount; urlIndex++) {
      const url = this.buildUrl(model, stream, urlIndex, credentials);
      let transformedBody = this.transformRequest(model, body, stream, credentials);
      if (this.provider === "btl" || this.provider === "badtheory-labs") {
        transformedBody = repairBtlAgenticPayload(transformedBody);
      }
      debugProviderPayload(this.provider, transformedBody, model);
      const headers = this.buildHeaders(credentials, stream);

      if (!retryAttemptsByUrl[urlIndex]) retryAttemptsByUrl[urlIndex] = 0;

      try {
        const response = await proxyAwareFetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(transformedBody),
          signal
        }, proxyOptions);

        if (await tryRetry(urlIndex, response.status, `status ${response.status}`)) { urlIndex--; continue; }

        if (this.shouldRetry(response.status, urlIndex)) {
          log?.debug?.("RETRY", `${response.status} on ${url}, trying fallback ${urlIndex + 1}`);
          lastStatus = response.status;
          continue;
        }

        return { response, url, headers, transformedBody };
      } catch (error) {
        lastError = error;
        if (error.name === "AbortError") throw error;

        // Map network/fetch exceptions to 502 retry config
        if (await tryRetry(urlIndex, HTTP_STATUS.BAD_GATEWAY, `network "${error.message}"`)) { urlIndex--; continue; }

        if (urlIndex + 1 < fallbackCount) {
          log?.debug?.("RETRY", `Error on ${url}, trying fallback ${urlIndex + 1}`);
          continue;
        }
        throw error;
      }
    }

    throw lastError || new Error(`All ${fallbackCount} URLs failed with status ${lastStatus}`);
  }
}

export default BaseExecutor;
