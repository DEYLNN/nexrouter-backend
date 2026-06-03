import { FORMATS } from "../../translator/formats.js";
import { needsTranslation } from "../../translator/index.js";
import { createSSETransformStreamWithLogger, createPassthroughStreamWithLogger } from "../../utils/stream.js";
import { pipeWithDisconnect } from "../../utils/streamHandler.js";
import { buildRequestDetail, extractRequestConfig, saveUsageStats } from "./requestDetail.js";
import { saveRequestDetail } from "@/lib/usageDb.js";

const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  "Connection": "keep-alive",
  "X-Accel-Buffering": "no",
  "Access-Control-Allow-Origin": "*"
};

const SSE_KEEPALIVE_MS = Number(process.env.SSE_KEEPALIVE_MS || 10000);

function fakeOpenAIStreamFromCompletion(completion) {
  const encoder = new TextEncoder();
  const id = completion?.id || `chatcmpl-${Date.now()}`;
  const created = completion?.created || Math.floor(Date.now() / 1000);
  const model = completion?.model || "unknown";
  const content = completion?.choices?.[0]?.message?.content || "";
  const usage = completion?.usage || null;

  const chunk = (delta, finishReason = null, includeUsage = false) => {
    const payload = { id, object: "chat.completion.chunk", created, model, choices: [{ index: 0, delta, finish_reason: finishReason }] };
    if (includeUsage && usage) payload.usage = usage;
    return `data: ${JSON.stringify(payload)}

`;
  };

  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(chunk({ role: "assistant" })));
      if (content) {
        const size = Number(process.env.FAKE_STREAM_CHUNK_SIZE || 96);
        for (let i = 0; i < content.length; i += size) {
          controller.enqueue(encoder.encode(chunk({ content: content.slice(i, i + size) })));
        }
      }
      controller.enqueue(encoder.encode(chunk({}, "stop", true)));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    }
  });
}

export async function handleFakeStreamingFromJson({ providerResponse, provider, model, requestStartTime, connectionId, apiKey, clientRawRequest, body, translatedBody, finalBody, onRequestSuccess, trackDone, appendLog }) {
  trackDone();
  let responseBody;
  try {
    responseBody = await providerResponse.json();
  } catch (err) {
    appendLog({ status: `FAILED 502` });
    return { success: false, response: new Response(JSON.stringify({ error: { message: `Invalid JSON response from ${provider}` } }), { status: 502, headers: { "Content-Type": "application/json" } }) };
  }
  if (provider === "anuma") {
    const choice = responseBody?.choices?.[0];
    const msg = choice?.message;
    const content = typeof msg?.content === "string" ? msg.content.trim() : "";
    const hasToolCalls = Array.isArray(msg?.tool_calls) && msg.tool_calls.length > 0;
    if (!content && !hasToolCalls && choice?.finish_reason !== "length") {
      appendLog({ status: `FAILED 502` });
      return { success: false, response: new Response(JSON.stringify({ error: { message: "Anuma returned empty assistant content; retry with another Anuma model or inspect upstream response." } }), { status: 502, headers: { "Content-Type": "application/json" } }) };
    }
  }

  if (onRequestSuccess) await onRequestSuccess();
  const usage = responseBody?.usage || { prompt_tokens: 0, completion_tokens: 0 };
  appendLog({ tokens: usage, status: "200 OK" });
  saveUsageStats({ provider, model, tokens: usage, connectionId, apiKey, endpoint: clientRawRequest?.endpoint, label: "FAKE STREAM USAGE" });

  saveRequestDetail(buildRequestDetail({
    provider, model, connectionId,
    latency: { ttft: Date.now() - requestStartTime, total: Date.now() - requestStartTime },
    tokens: usage,
    request: extractRequestConfig(body, true),
    providerRequest: finalBody || translatedBody || null,
    providerResponse: responseBody || null,
    response: { content: responseBody?.choices?.[0]?.message?.content || null, thinking: null, type: "fake-streaming" },
    status: "success"
  }, { endpoint: clientRawRequest?.endpoint || null })).catch(() => {});

  return { success: true, response: new Response(fakeOpenAIStreamFromCompletion(responseBody), { headers: SSE_HEADERS }) };
}

function withSSEKeepAlive(readable, intervalMs = SSE_KEEPALIVE_MS) {
  if (!intervalMs || intervalMs <= 0) return readable;
  const encoder = new TextEncoder();
  const reader = readable.getReader();
  let timer = null;
  let closed = false;

  return new ReadableStream({
    start(controller) {
      timer = setInterval(() => {
        if (!closed) {
          try { controller.enqueue(encoder.encode(`: keepalive ${Date.now()}\n\n`)); } catch { }
        }
      }, intervalMs);
    },
    async pull(controller) {
      try {
        const { done, value } = await reader.read();
        if (done) {
          closed = true;
          if (timer) clearInterval(timer);
          controller.close();
          return;
        }
        controller.enqueue(value);
      } catch (err) {
        closed = true;
        if (timer) clearInterval(timer);
        controller.error(err);
      }
    },
    cancel(reason) {
      closed = true;
      if (timer) clearInterval(timer);
      return reader.cancel(reason);
    }
  });
}

/**
 * Determine which SSE transform stream to use based on provider/format.
 */
function buildTransformStream({ provider, sourceFormat, targetFormat, userAgent, reqLogger, toolNameMap, model, connectionId, body, onStreamComplete, apiKey }) {
  const isDroidCLI = userAgent?.toLowerCase().includes("droid") || userAgent?.toLowerCase().includes("codex-cli");
  const needsCodexTranslation = provider === "codex" && targetFormat === FORMATS.OPENAI_RESPONSES && !isDroidCLI;

  if (needsCodexTranslation) {
    // Codex returns Responses API SSE → translate to client format
    let codexTarget;
    if (sourceFormat === FORMATS.OPENAI_RESPONSES) codexTarget = FORMATS.OPENAI_RESPONSES;
    else if (sourceFormat === FORMATS.CLAUDE) codexTarget = FORMATS.CLAUDE;
    else if (sourceFormat === FORMATS.ANTIGRAVITY || sourceFormat === FORMATS.GEMINI || sourceFormat === FORMATS.GEMINI_CLI) codexTarget = FORMATS.ANTIGRAVITY;
    else codexTarget = FORMATS.OPENAI;
    return createSSETransformStreamWithLogger(FORMATS.OPENAI_RESPONSES, codexTarget, provider, reqLogger, toolNameMap, model, connectionId, body, onStreamComplete, apiKey);
  }

  if (needsTranslation(targetFormat, sourceFormat)) {
    return createSSETransformStreamWithLogger(targetFormat, sourceFormat, provider, reqLogger, toolNameMap, model, connectionId, body, onStreamComplete, apiKey);
  }

  return createPassthroughStreamWithLogger(provider, reqLogger, model, connectionId, body, onStreamComplete, apiKey);
}

/**
 * Handle streaming response — pipe provider SSE through transform stream to client.
 */
export function handleStreamingResponse({ providerResponse, provider, model, sourceFormat, targetFormat, userAgent, body, stream, translatedBody, finalBody, requestStartTime, connectionId, apiKey, clientRawRequest, onRequestSuccess, reqLogger, toolNameMap, streamController, onStreamComplete }) {
  if (onRequestSuccess) onRequestSuccess();

  const transformStream = buildTransformStream({ provider, sourceFormat, targetFormat, userAgent, reqLogger, toolNameMap, model, connectionId, body, onStreamComplete, apiKey });
  const transformedBody = withSSEKeepAlive(pipeWithDisconnect(providerResponse, transformStream, streamController));

  const streamDetailId = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
  saveRequestDetail(buildRequestDetail({
    provider, model, connectionId,
    latency: { ttft: 0, total: Date.now() - requestStartTime },
    tokens: { prompt_tokens: 0, completion_tokens: 0 },
    request: extractRequestConfig(body, stream),
    providerRequest: finalBody || translatedBody || null,
    providerResponse: "[Streaming - raw response not captured]",
    response: { content: "[Streaming in progress...]", thinking: null, type: "streaming" },
    status: "success"
  }, { id: streamDetailId })).catch(err => {
    console.error("[RequestDetail] Failed to save streaming request:", err.message);
  });

  return {
    success: true,
    response: new Response(transformedBody, { headers: SSE_HEADERS })
  };
}

/**
 * Build onStreamComplete callback for streaming usage tracking.
 */
export function buildOnStreamComplete({ provider, model, connectionId, apiKey, requestStartTime, body, stream, finalBody, translatedBody, clientRawRequest }) {
  const streamDetailId = `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;

  const onStreamComplete = (contentObj, usage, ttftAt) => {
    const latency = {
      ttft: ttftAt ? ttftAt - requestStartTime : Date.now() - requestStartTime,
      total: Date.now() - requestStartTime
    };
    const safeContent = contentObj?.content || "[Empty streaming response]";
    const safeThinking = contentObj?.thinking || null;

    saveRequestDetail(buildRequestDetail({
      provider, model, connectionId,
      latency,
      tokens: usage || { prompt_tokens: 0, completion_tokens: 0 },
      request: extractRequestConfig(body, stream),
      providerRequest: finalBody || translatedBody || null,
      providerResponse: safeContent,
      response: { content: safeContent, thinking: safeThinking, type: "streaming" },
      status: "success"
    }, { id: streamDetailId })).catch(err => {
      console.error("[RequestDetail] Failed to update streaming content:", err.message);
    });

    saveUsageStats({ provider, model, tokens: usage, connectionId, apiKey, endpoint: clientRawRequest?.endpoint, label: "STREAM USAGE" });
  };

  return { onStreamComplete, streamDetailId };
}
