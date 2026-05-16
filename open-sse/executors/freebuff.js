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

const MODEL_MAP = {
  "deepseek-v4-flash": "deepseek/deepseek-v4-flash",
  "fb/deepseek-v4-flash": "deepseek/deepseek-v4-flash",
  "freebuff/deepseek-v4-flash": "deepseek/deepseek-v4-flash",
};

const sessions = new Map();

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
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

async function ensureFreeSession(token, session) {
  if (session.costMode !== "free") return;
  if (session.freebuffInstanceId) return;
  const response = await fetchJson("/api/v1/freebuff/session", token, {});
  if (!response.ok || !response.data?.instanceId) {
    throw Object.assign(new Error(response.data?.error || response.data?.message || "Failed to create FreeBuff session"), { statusCode: response.status, body: response.data });
  }
  session.freebuffInstanceId = response.data.instanceId;
}


function normalizeMessageContent(content) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part?.type === "text") return part.text || "";
        if (part?.text) return part.text;
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  if (content == null) return "";
  return String(content);
}

function sanitizeMessages(messages = []) {
  return messages
    .filter((message) => message && message.role !== "tool")
    .map((message) => {
      const clean = { role: message.role || "user", content: normalizeMessageContent(message.content) };
      // Assistant messages that only contained tool calls become empty after stripping;
      // keep prior text messages only to avoid upstream schema errors.
      if (clean.role === "assistant" && !clean.content.trim()) return null;
      return clean;
    })
    .filter(Boolean);
}

function isInvalidRun(response) {
  const msg = response?.data?.message || response?.data?.error || response?.text || "";
  return typeof msg === "string" && (msg.includes("runId Not Found") || msg.includes("runId Not Running"));
}

function isRecoverableFreeSession(response) {
  return [409, 410, 426].includes(response?.status);
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
      stream: false,
      model: backendModel,
      messages: sanitizeMessages(body.messages || []),
      provider: { data_collection: "deny", ...(body.provider || {}) },
    };
    // MVP FreeBuff route is chat-only. Tool schemas from agentic clients can trigger
    // upstream 400s, so strip them until native tool bridge is implemented.
    delete upstreamBody.tools;
    delete upstreamBody.tool_choice;
    delete upstreamBody.parallel_tool_calls;
    delete upstreamBody.response_format;
    delete upstreamBody.reasoning_effort;
    delete upstreamBody.reasoning;

    try {
      await ensureRun(account.authToken, session);
      await ensureFreeSession(account.authToken, session);

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
