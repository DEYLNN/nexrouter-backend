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

function normalizeAnumaResponsesJson(completion) {
  if (completion?.choices?.[0]) return completion;
  if (completion?.object !== "response") return completion;
  let text = "";
  for (const item of completion.output || []) {
    if (item?.type !== "message") continue;
    for (const block of item.content || []) {
      if (block?.type === "output_text" || block?.type === "text") text += block.text || "";
    }
  }
  return {
    id: `chatcmpl-${completion.id || Date.now()}`,
    object: "chat.completion",
    created: completion.created_at || Math.floor(Date.now() / 1000),
    model: completion.model || "anuma",
    choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }],
    usage: completion.usage || null
  };
}

function normalizeAnumaTextToolCall(completion) {
  const choice = completion?.choices?.[0];
  const msg = choice?.message;
  const content = typeof msg?.content === "string" ? msg.content.trim() : "";
  if (!content || msg?.tool_calls?.length) return completion;
  const cleaned = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const extractFirstJsonObject = (text) => {
    const start = text.indexOf("{");
    if (start < 0) return null;
    let depth = 0, inString = false, escape = false;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (escape) { escape = false; continue; }
      if (ch === "\\") { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === "{") depth++;
      if (ch === "}") depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
    return null;
  };
  let parsed = null;
  try { parsed = JSON.parse(cleaned); } catch { }
  if (!parsed) {
    const firstJson = extractFirstJsonObject(cleaned);
    if (firstJson) {
      try { parsed = JSON.parse(firstJson); } catch { }
    }
  }
  let call = parsed?.tool_call || parsed?.toolCall || parsed?.function_call || parsed?.functionCall;
  let name = call?.name || call?.function?.name;
  let args = call?.arguments ?? call?.args ?? call?.function?.arguments ?? {};

  if (!name) {
    const textCall = cleaned.match(/(?:Requested tool calls?:\s*)?-\s*([A-Za-z_][\w.-]*)\s*\((\{[\s\S]*\})\)\s*$/i)
      || cleaned.match(/^([A-Za-z_][\w.-]*)\s*\((\{[\s\S]*\})\)\s*$/i);
    if (textCall) {
      name = textCall[1];
      args = textCall[2];
    }
  }

  if (!name) {
    const shellish = cleaned.match(/^(?:`{0,3}(?:bash|sh)?\s*)?((?:ls|find|cat|sed|grep|rg|pwd|tree|git|npm|node|python3?|pm2|du|df|tail|head|ps|kill|pkill|pgrep|curl|wget|echo|sleep|which|whereis|netstat|ss|lsof|systemctl|service|docker|docker-compose|chmod|chown|mkdir|cp|mv|trash|rm)\b[\s\S]{0,1000})`{0,3}\s*$/i);
    if (shellish) {
      name = "terminal";
      args = { command: shellish[1].trim(), timeout: 30 };
    }
  }
  if (!name) return completion;
  msg.content = null;
  msg.tool_calls = [{
    id: `call_${name}_${Date.now()}`,
    type: "function",
    function: { name, arguments: typeof args === "string" ? args : JSON.stringify(args || {}) }
  }];
  choice.finish_reason = "tool_calls";
  return completion;
}

function fakeOpenAIStreamFromCompletion(completion) {
  const encoder = new TextEncoder();
  const id = completion?.id || `chatcmpl-${Date.now()}`;
  const created = completion?.created || Math.floor(Date.now() / 1000);
  const model = completion?.model || "unknown";
  const message = completion?.choices?.[0]?.message || {};
  const content = message.content || "";
  const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
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
      if (toolCalls.length > 0) {
        for (let i = 0; i < toolCalls.length; i++) {
          const call = toolCalls[i];
          controller.enqueue(encoder.encode(chunk({ tool_calls: [{ index: i, id: call.id, type: call.type || "function", function: { name: call.function?.name || call.name, arguments: call.function?.arguments || call.arguments || "{}" } }] })));
        }
        controller.enqueue(encoder.encode(chunk({}, "tool_calls", true)));
      } else {
        if (content) {
          const size = Number(process.env.FAKE_STREAM_CHUNK_SIZE || 96);
          for (let i = 0; i < content.length; i += size) {
            controller.enqueue(encoder.encode(chunk({ content: content.slice(i, i + size) })));
          }
        }
        controller.enqueue(encoder.encode(chunk({}, "stop", true)));
      }
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
  if (provider === "anuma" || provider === "general-compute") {
    responseBody = normalizeAnumaTextToolCall(provider === "anuma" ? normalizeAnumaResponsesJson(responseBody) : responseBody);
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
function extractAnumaResponsesText(obj) {
  const type = String(obj?.type || "");
  if (type.includes("reasoning")) return "";
  const delta = obj?.delta;
  if (typeof delta === "string") return delta;
  if (delta && typeof delta === "object") return delta.OfString || delta.text || delta.content || "";
  if (obj?.type === "response.output_text.delta") return obj.delta || "";
  return obj?.text || obj?.content || "";
}

function parseAnumaToolCallText(text) {
  const completion = normalizeAnumaTextToolCall({ choices: [{ message: { role: "assistant", content: text }, finish_reason: "stop" }] });
  return completion?.choices?.[0]?.message?.tool_calls || [];
}

export function handleAnumaResponsesStreaming({ providerResponse, provider, model, requestStartTime, connectionId, apiKey, clientRawRequest, body, finalBody, translatedBody, onRequestSuccess, trackDone, appendLog, streamController }) {
  if (onRequestSuccess) onRequestSuccess();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const id = `chatcmpl-${Date.now()}`;
  let buffer = "";
  let textBuffer = "";
  let sawTool = false;
  const hasRecentToolResult = (body?.messages || []).slice(-8).some((message) => {
    const text = typeof message?.content === "string" ? message.content : JSON.stringify(message?.content || "");
    return message?.role === "tool" || message?.role === "function" || /^\[[^\]]+ result\]/i.test(text.trim());
  });
  const expectsTool = Array.isArray(body?.tools) && body.tools.length > 0 && !hasRecentToolResult;
  const stripAnumaThinking = (text) => String(text || "").replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/^[\s\S]*?<\/think>\s*/i, "");
  const send = (controller, delta, finish_reason = null, usage = null) => {
    const payload = { id, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model, choices: [{ index: 0, delta, finish_reason }] };
    if (usage) payload.usage = usage;
    controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
  };
  const readable = new ReadableStream({
    async start(controller) {
      trackDone();
      send(controller, { role: "assistant" });
      const reader = providerResponse.body.getReader();
      let usage = null;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let idx;
          while ((idx = buffer.indexOf("\n")) >= 0) {
            const line = buffer.slice(0, idx).trimEnd();
            buffer = buffer.slice(idx + 1);
            if (!line.startsWith("data:")) continue;
            const data = line.slice(5).trim();
            if (!data || data === "[DONE]") continue;
            let obj;
            try { obj = JSON.parse(data); } catch { continue; }
            if (obj?.usage) usage = obj.usage;
            if (obj?.response?.usage) usage = obj.response.usage;
            const text = extractAnumaResponsesText(obj);
            if (!text) continue;
            textBuffer += text;
            const toolCalls = parseAnumaToolCallText(textBuffer);
            if (toolCalls.length) {
              sawTool = true;
              for (let i = 0; i < toolCalls.length; i++) {
                const call = toolCalls[i];
                send(controller, { tool_calls: [{ index: i, id: call.id, type: call.type || "function", function: { name: call.function?.name || call.name, arguments: call.function?.arguments || call.arguments || "{}" } }] });
              }
              textBuffer = "";
              continue;
            }
            const maybeToolJson = /^(\s|`)*(\{|```json action|<function_calls>|Requested tool calls?:)/i.test(textBuffer.trimStart()) || /"?(tool_call|toolCall|function_call|functionCall)"?\s*:/i.test(textBuffer);
            if (!expectsTool && !maybeToolJson) {
              if (/<think>/i.test(textBuffer) && !/<\/think>/i.test(textBuffer)) continue;
              const hadThinkClose = /<\/think>/i.test(textBuffer);
              const cleanText = hadThinkClose ? stripAnumaThinking(textBuffer) : text;
              if (cleanText) send(controller, { content: cleanText });
              textBuffer = "";
            }
          }
        }
        if (textBuffer && !sawTool) {
          const finalText = stripAnumaThinking(textBuffer).trim();
          if (finalText) send(controller, { content: finalText });
        }
        send(controller, {}, sawTool ? "tool_calls" : "stop", usage);
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        appendLog({ tokens: usage || { prompt_tokens: 0, completion_tokens: 0 }, status: "200 OK" });
        saveUsageStats({ provider, model, tokens: usage || { prompt_tokens: 0, completion_tokens: 0 }, connectionId, apiKey, endpoint: clientRawRequest?.endpoint, label: provider === "general-compute" ? "GENERAL-COMPUTE STREAM USAGE" : "ANUMA STREAM USAGE" });
        controller.close();
      } catch (err) {
        streamController?.handleError?.(err);
        controller.error(err);
      }
    }
  });
  return { success: true, response: new Response(withSSEKeepAlive(readable), { headers: SSE_HEADERS }) };
}

export function handleStreamingResponse({ providerResponse, provider, model, sourceFormat, targetFormat, userAgent, body, stream, translatedBody, finalBody, requestStartTime, connectionId, apiKey, clientRawRequest, onRequestSuccess, reqLogger, toolNameMap, streamController, onStreamComplete }) {
  if (provider === "anuma" || provider === "general-compute") {
    return handleAnumaResponsesStreaming({ providerResponse, provider, model, requestStartTime, connectionId, apiKey, clientRawRequest, body, translatedBody, finalBody, onRequestSuccess, trackDone: () => {}, appendLog: () => {}, streamController });
  }
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
