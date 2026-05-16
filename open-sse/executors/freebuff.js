import { randomUUID } from "crypto";
import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { BaseExecutor } from "./base.js";

const API_BASE_URL = process.env.FREEBUFF_API_BASE_URL || "https://www.codebuff.com";
const CREDENTIALS_PATH = process.env.FREEBUFF_CREDENTIALS_PATH || join(homedir(), ".config", "manicode", "credentials.json");
const REQUEST_TIMEOUT_MS = Number(process.env.FREEBUFF_TIMEOUT_MS || 120000);
const AGENT_ID = process.env.FREEBUFF_AGENT_ID || "base2-free";
const COST_MODE = process.env.FREEBUFF_COST_MODE || "free";
const FREEBUFF_WAIT_TIMEOUT_MS = Number(process.env.FREEBUFF_WAIT_TIMEOUT_MS || 25000);
const FREEBUFF_WAIT_POLL_MS = Number(process.env.FREEBUFF_WAIT_POLL_MS || 2000);
const FREEBUFF_MAX_MESSAGES = Number(process.env.FREEBUFF_MAX_MESSAGES || 32);
const FREEBUFF_MAX_MESSAGE_CHARS = Number(process.env.FREEBUFF_MAX_MESSAGE_CHARS || 16000);
const FREEBUFF_MAX_TOOL_CHARS = Number(process.env.FREEBUFF_MAX_TOOL_CHARS || 8000);

const MODEL_MAP = {
  "deepseek-v4-flash": "deepseek/deepseek-v4-flash",
  "fb/deepseek-v4-flash": "deepseek/deepseek-v4-flash",
  "freebuff/deepseek-v4-flash": "deepseek/deepseek-v4-flash",
  "deepseek-v4-pro": "deepseek/deepseek-v4-pro",
  "fb/deepseek-v4-pro": "deepseek/deepseek-v4-pro",
  "freebuff/deepseek-v4-pro": "deepseek/deepseek-v4-pro",
  "kimi-k2.6": "moonshotai/kimi-k2.6",
  "fb/kimi-k2.6": "moonshotai/kimi-k2.6",
  "freebuff/kimi-k2.6": "moonshotai/kimi-k2.6",
  "minimax-m2.7": "minimax/minimax-m2.7",
  "fb/minimax-m2.7": "minimax/minimax-m2.7",
  "freebuff/minimax-m2.7": "minimax/minimax-m2.7",
};

const sessions = new Map();

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

function openAISseResponseFromUpstream(upstream, requestedModel) {
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const stream = new ReadableStream({
    async start(controller) {
      const reader = upstream.body.getReader();
      let buf = "";
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() || "";
          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (!data) continue;
            if (data === "[DONE]") {
              controller.enqueue(encoder.encode("data: [DONE]\n\n"));
              continue;
            }
            try {
              const chunk = JSON.parse(data);
              chunk.model = requestedModel;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`));
            } catch {
              controller.enqueue(encoder.encode(`data: ${data}\n\n`));
            }
          }
        }
        if (buf.includes("[DONE]")) controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (error) {
        controller.error(error);
      } finally {
        try { await reader.cancel(); } catch {}
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function sseResponseFromOpenAI(payload) {
  const choice = payload?.choices?.[0] || {};
  const content = choice?.message?.content || "";
  const chunk = {
    id: payload?.id || `chatcmpl-freebuff-${Date.now()}`,
    object: "chat.completion.chunk",
    created: payload?.created || Math.floor(Date.now() / 1000),
    model: payload?.model || "freebuff",
    choices: [{ index: 0, delta: { role: "assistant", content }, finish_reason: null }],
  };
  const done = {
    id: chunk.id,
    object: "chat.completion.chunk",
    created: chunk.created,
    model: chunk.model,
    choices: [{ index: 0, delta: {}, finish_reason: choice.finish_reason || "stop" }],
    usage: payload?.usage,
  };
  return new Response(`data: ${JSON.stringify(chunk)}\n\ndata: ${JSON.stringify(done)}\n\ndata: [DONE]\n\n`, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function openAIError(message, status = 500, code = "freebuff_error") {
  return jsonResponse({ error: { message, type: "server_error", code } }, status);
}

function backendModelFor(model) {
  return MODEL_MAP[model] || MODEL_MAP[`fb/${model}`] || null;
}

function loadCredentials() {
  const raw = readFileSync(CREDENTIALS_PATH, "utf8");
  const parsed = JSON.parse(raw);
  const account = parsed.default || parsed.accounts?.find((item) => item?.authToken);
  if (!account?.authToken) throw new Error("FreeBuff credentials missing authToken");
  return account;
}

async function fetchRaw(pathname, token, body, extraHeaders = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(`${API_BASE_URL}${pathname}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${token}`,
        "x-codebuff-api-key": token,
        ...extraHeaders,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJson(pathname, token, body, extraHeaders = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${API_BASE_URL}${pathname}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${token}`,
        "x-codebuff-api-key": token,
        ...extraHeaders,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { text }; }
    return { ok: response.ok, status: response.status, data, text };
  } finally {
    clearTimeout(timeout);
  }
}

function createSession(key, backendModel) {
  return {
    key,
    clientId: randomUUID(),
    runId: null,
    freebuffInstanceId: null,
    costMode: COST_MODE,
    agentId: AGENT_ID,
    backendModel,
    n: 1,
    createdAt: new Date().toISOString(),
  };
}

function metadata(session) {
  const data = {
    client_id: session.clientId,
    run_id: session.runId,
    cost_mode: session.costMode,
    n: session.n,
  };
  if (session.costMode === "free" && session.freebuffInstanceId) {
    data.freebuff_instance_id = session.freebuffInstanceId;
  }
  return data;
}

async function ensureRun(token, session) {
  if (session.runId) return;
  const response = await fetchJson("/api/v1/agent-runs", token, {
    action: "START",
    agentId: session.agentId,
    ancestorRunIds: [],
  });
  if (!response.ok || !response.data?.runId) {
    throw Object.assign(new Error(response.data?.error || response.data?.message || "Failed to start FreeBuff agent run"), { statusCode: response.status, body: response.data });
  }
  session.runId = response.data.runId;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function getFreeSession(token, instanceId) {
  const response = await fetchJson("/api/v1/freebuff/session", token, undefined, {
    "x-freebuff-instance-id": instanceId,
  });
  if (!response.ok) throw Object.assign(new Error(response.data?.error || response.data?.message || "Failed to get FreeBuff session"), { statusCode: response.status, body: response.data });
  return response.data;
}

async function waitForFreeSessionActive(token, session) {
  const started = Date.now();
  while (session.freebuffInstanceId && Date.now() - started < FREEBUFF_WAIT_TIMEOUT_MS) {
    const state = await getFreeSession(token, session.freebuffInstanceId);
    session.freebuffSessionState = state?.status || null;
    session.freebuffSessionUpdatedAt = new Date().toISOString();
    if (state?.status === "active") return;
    if (["ended", "superseded", "none"].includes(state?.status)) {
      session.freebuffInstanceId = null;
      break;
    }
    await sleep(FREEBUFF_WAIT_POLL_MS);
  }
}

async function ensureFreeSession(token, session) {
  if (session.costMode !== "free") return;
  if (session.freebuffInstanceId) {
    try {
      await waitForFreeSessionActive(token, session);
      if (session.freebuffSessionState === "active") return;
    } catch {
      session.freebuffInstanceId = null;
    }
  }
  if (!session.freebuffInstanceId) {
    const response = await fetchJson("/api/v1/freebuff/session", token, {});
    if (!response.ok || !response.data?.instanceId) {
      throw Object.assign(new Error(response.data?.error || response.data?.message || "Failed to create FreeBuff session"), { statusCode: response.status, body: response.data });
    }
    session.freebuffInstanceId = response.data.instanceId;
    session.freebuffSessionState = response.data.status || "queued";
    session.freebuffSessionCreatedAt = new Date().toISOString();
    session.freebuffSessionUpdatedAt = session.freebuffSessionCreatedAt;
    await waitForFreeSessionActive(token, session);
  }
}


function truncateText(text, maxChars) {
  const value = String(text || "");
  if (value.length <= maxChars) return value;
  return `${value.slice(0, maxChars)}\n...[truncated ${value.length - maxChars} chars]`;
}

function normalizeMessageContent(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part?.type === "text") return part.text || "";
        if (part?.text) return part.text;
        if (part?.type === "image_url") return "[image omitted]";
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  if (content == null) return "";
  return String(content);
}

function toolResultToText(message) {
  const name = message.name || message.tool_call_id || "tool";
  const content = truncateText(normalizeMessageContent(message.content), FREEBUFF_MAX_TOOL_CHARS);
  return `[tool result: ${name}]\n${content}`;
}

function sanitizeToolCalls(toolCalls) {
  if (!Array.isArray(toolCalls)) return undefined;
  const cleaned = toolCalls
    .map((call) => {
      if (!call) return null;
      const id = call.id || `call_${Math.random().toString(36).slice(2, 10)}`;
      const fnName = call.function?.name || call.name;
      if (!fnName) return null;
      const args = call.function?.arguments ?? call.arguments ?? "";
      return {
        id,
        type: "function",
        function: {
          name: String(fnName).slice(0, 96),
          arguments: typeof args === "string" ? truncateText(args, 6000) : truncateText(JSON.stringify(args ?? {}), 6000),
        },
      };
    })
    .filter(Boolean);
  return cleaned.length ? cleaned : undefined;
}

function sanitizeMessages(messages = []) {
  const systemLike = [];
  const conversational = [];

  for (const message of messages) {
    if (!message) continue;
    const role = message.role || "user";
    let clean = null;

    if (role === "tool") {
      const content = truncateText(normalizeMessageContent(message.content), FREEBUFF_MAX_TOOL_CHARS);
      clean = {
        role: "tool",
        content,
        tool_call_id: message.tool_call_id || message.id || undefined,
        name: message.name,
      };
    } else if (role === "assistant") {
      const content = normalizeMessageContent(message.content);
      const toolCalls = sanitizeToolCalls(message.tool_calls);
      if (!content && !toolCalls) continue;
      clean = {
        role: "assistant",
        content: content ? truncateText(content, FREEBUFF_MAX_MESSAGE_CHARS) : undefined,
      };
      if (toolCalls) clean.tool_calls = toolCalls;
    } else {
      const content = normalizeMessageContent(message.content);
      if (!content) continue;
      clean = {
        role: role === "developer" ? "system" : role,
        content: truncateText(content, FREEBUFF_MAX_MESSAGE_CHARS),
      };
    }

    if (clean.role === "system") systemLike.push(clean);
    else conversational.push(clean);
  }

  const keptConversation = conversational.slice(-FREEBUFF_MAX_MESSAGES);
  const trimmed = [...systemLike.slice(0, 3), ...keptConversation];
  if (trimmed.length === 0) return [{ role: "user", content: "Continue." }];
  return trimmed;
}

function isInvalidRun(response) {
  const msg = response?.data?.message || response?.data?.error || response?.text || "";
  return typeof msg === "string" && (msg.includes("runId Not Found") || msg.includes("runId Not Running"));
}

function isRecoverableFreeSession(response) {
  return [409, 410, 426, 428, 429].includes(response?.status);
}

function normalizeOpenAIResponse(data, requestedModel) {
  if (data?.choices?.[0]?.message) {
    return { ...data, model: requestedModel };
  }
  const content = data?.content?.[0]?.text || data?.text || data?.message || "";
  return {
    id: data?.id || `chatcmpl-freebuff-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: requestedModel,
    choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }],
    usage: data?.usage ? {
      prompt_tokens: data.usage.prompt_tokens || data.usage.input_tokens || 0,
      completion_tokens: data.usage.completion_tokens || data.usage.output_tokens || 0,
      total_tokens: data.usage.total_tokens || ((data.usage.prompt_tokens || data.usage.input_tokens || 0) + (data.usage.completion_tokens || data.usage.output_tokens || 0)),
    } : undefined,
  };
}

export class FreeBuffExecutor extends BaseExecutor {
  constructor() {
    super("freebuff", { format: "openai" });
  }

  async execute({ model, body }) {
    const backendModel = backendModelFor(model);
    if (!backendModel) {
      return { response: openAIError(`Unknown FreeBuff model: ${model}`, 400, "model_not_found") };
    }

    let account;
    try {
      account = loadCredentials();
    } catch (error) {
      return { response: openAIError(error.message, 401, "missing_credentials") };
    }

    const sessionKey = `${account.accountId || "default"}:${AGENT_ID}:${backendModel}`;
    let session = sessions.get(sessionKey);
    if (!session) {
      session = createSession(sessionKey, backendModel);
      sessions.set(sessionKey, session);
    }

    const wantsStream = body?.stream === true;
    const upstreamBody = {
      ...body,
      stream: wantsStream,
      model: backendModel,
      messages: sanitizeMessages(body.messages || []),
      provider: { data_collection: "deny", ...(body.provider || {}) },
    };
    if (wantsStream) {
      upstreamBody.stream_options = body.stream_options || { include_usage: true };
    } else {
      delete upstreamBody.stream_options;
    }
    // Keep tools so agentic clients (Hermes/Codex-style) can drive real tool-call loops.
    if (Array.isArray(body.tools)) {
      upstreamBody.tools = body.tools;
      if (body.tool_choice) upstreamBody.tool_choice = body.tool_choice;
      if (body.parallel_tool_calls !== undefined) upstreamBody.parallel_tool_calls = body.parallel_tool_calls;
    } else {
      delete upstreamBody.tools;
      delete upstreamBody.tool_choice;
      delete upstreamBody.parallel_tool_calls;
    }
    delete upstreamBody.response_format;
    delete upstreamBody.reasoning_effort;
    delete upstreamBody.reasoning;

    try {
      await ensureRun(account.authToken, session);
      await ensureFreeSession(account.authToken, session);

      if (wantsStream) {
        const makeBody = () => ({ ...upstreamBody, codebuff_metadata: metadata(session) });
        let upstream = await fetchRaw("/api/v1/chat/completions", account.authToken, makeBody());
        if (!upstream.ok) {
          const text = await upstream.text();
          let data = null;
          try { data = text ? JSON.parse(text) : null; } catch { data = { text }; }
          const errorResponse = { ok: false, status: upstream.status, data, text };
          if (isInvalidRun(errorResponse)) {
            session.runId = null;
            await ensureRun(account.authToken, session);
            upstream = await fetchRaw("/api/v1/chat/completions", account.authToken, makeBody());
          } else if (isRecoverableFreeSession(errorResponse)) {
            session.freebuffInstanceId = null;
            await ensureFreeSession(account.authToken, session);
            upstream = await fetchRaw("/api/v1/chat/completions", account.authToken, makeBody());
          } else {
            const rawDetail = data?.error || data?.message || data || text || "FreeBuff stream request failed";
            const detail = typeof rawDetail === "string" ? rawDetail : JSON.stringify(rawDetail);
            return { response: openAIError(detail, upstream.status || 502, data?.code || "freebuff_upstream_error") };
          }
        }
        if (!upstream.ok) {
          const text = await upstream.text();
          let data = null;
          try { data = text ? JSON.parse(text) : null; } catch { data = { text }; }
          const rawDetail = data?.error || data?.message || data || text || "FreeBuff stream request failed";
          const detail = typeof rawDetail === "string" ? rawDetail : JSON.stringify(rawDetail);
          return { response: openAIError(detail, upstream.status || 502, data?.code || "freebuff_upstream_error") };
        }
        return { response: openAISseResponseFromUpstream(upstream, model) };
      }

      let response = await fetchJson("/api/v1/chat/completions", account.authToken, {
        ...upstreamBody,
        codebuff_metadata: metadata(session),
      });

      if (!response.ok && isInvalidRun(response)) {
        session.runId = null;
        await ensureRun(account.authToken, session);
        response = await fetchJson("/api/v1/chat/completions", account.authToken, {
          ...upstreamBody,
          codebuff_metadata: metadata(session),
        });
      }

      if (!response.ok && isRecoverableFreeSession(response)) {
        session.freebuffInstanceId = null;
        await ensureFreeSession(account.authToken, session);
        response = await fetchJson("/api/v1/chat/completions", account.authToken, {
          ...upstreamBody,
          codebuff_metadata: metadata(session),
        });
      }

      if (!response.ok) {
        const rawDetail = response.data?.error || response.data?.message || response.data || response.text || "FreeBuff request failed";
        const detail = typeof rawDetail === "string" ? rawDetail : JSON.stringify(rawDetail);
        return { response: openAIError(detail, response.status || 502, response.data?.code || "freebuff_upstream_error") };
      }

      const normalized = normalizeOpenAIResponse(response.data, model);
      return { response: wantsStream ? sseResponseFromOpenAI(normalized) : jsonResponse(normalized) };
    } catch (error) {
      return { response: openAIError(error.message || "FreeBuff request failed", error.statusCode || 502, "freebuff_exception") };
    }
  }
}

export default FreeBuffExecutor;
