import { BaseExecutor } from "./base.js";
import { PROVIDERS } from "../config/providers.js";

// Models that use /zen/v1/messages (claude format)
const MESSAGES_MODELS = new Set(["big-pickle"]);

function ensureOpenCodeReasoningContent(body) {
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  for (const message of messages) {
    if (message?.role !== "assistant") continue;
    if (!Array.isArray(message.tool_calls) || message.tool_calls.length === 0) continue;
    if (typeof message.reasoning_content !== "string" || message.reasoning_content.length === 0) {
      message.reasoning_content = " ";
    }
  }
  return body;
}

function debugOpenCodePayload(body, model) {
  if (process.env.DEBUG_OPENCODE_PAYLOAD !== "1") return;
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
  console.log("[OPENCODE DEBUG]", JSON.stringify({
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

export class OpenCodeExecutor extends BaseExecutor {
  constructor() {
    super("opencode", PROVIDERS.opencode);
  }

  buildUrl(model) {
    const base = "https://opencode.ai";
    return MESSAGES_MODELS.has(model)
      ? `${base}/zen/v1/messages`
      : `${base}/zen/v1/chat/completions`;
  }

  buildHeaders() {
    return {
      "Content-Type": "application/json",
      "Authorization": "Bearer public",
      "x-opencode-client": "desktop",
      "Accept": "text/event-stream"
    };
  }

  transformRequest(model, body) {
    const patchedBody = ensureOpenCodeReasoningContent(body);
    debugOpenCodePayload(patchedBody, model);
    return patchedBody;
  }
}
