import { FORMATS } from "../../translator/formats.js";
import { needsTranslation } from "../../translator/index.js";
import { ollamaBodyToOpenAI } from "../../translator/response/ollama-to-openai.js";
import { addBufferToUsage, filterUsageForFormat } from "../../utils/usageTracking.js";
import { createErrorResult } from "../../utils/error.js";
import { HTTP_STATUS } from "../../config/runtimeConfig.js";
import { parseSSEToOpenAIResponse } from "./sseToJsonHandler.js";
import { buildRequestDetail, extractRequestConfig, extractUsageFromResponse, saveUsageStats } from "./requestDetail.js";
import { appendRequestLog, saveRequestDetail } from "@/lib/usageDb.js";
import { decloakToolNames } from "../../utils/claudeCloaking.js";
import { normalizeCompletionPseudoToolCalls } from "../../utils/pseudoToolCallParser.js";


function normalizeOpenAITextToolCall(completion) {
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
  try { parsed = JSON.parse(cleaned); } catch {}
  if (!parsed) { const firstJson = extractFirstJsonObject(cleaned); if (firstJson) { try { parsed = JSON.parse(firstJson); } catch {} } }
  let call = parsed?.tool_call || parsed?.toolCall || parsed?.function_call || parsed?.functionCall;
  let name = call?.name || call?.function?.name;
  let args = call?.arguments ?? call?.args ?? call?.function?.arguments ?? {};
  if (!name) {
    const textCall = cleaned.match(/(?:Requested tool calls?:\s*)?-\s*([A-Za-z_][\w.-]*)\s*\((\{[\s\S]*\})\)\s*$/i) || cleaned.match(/^([A-Za-z_][\w.-]*)\s*\((\{[\s\S]*\})\)\s*$/i);
    if (textCall) { name = textCall[1]; args = textCall[2]; }
  }
  if (!name) {
    const availableTools = [];
    const shellish = cleaned.match(/^(?:`{0,3}(?:bash|sh)?\s*)?((?:ls|find|cat|sed|grep|rg|pwd|tree|git|npm|node|python3?|pm2|du|df|tail|head|ps|kill|pkill|pgrep|curl|wget|echo|sleep|which|whereis|netstat|ss|lsof|systemctl|service|docker|docker-compose|chmod|chown|mkdir|cp|mv|trash|rm)\b[\s\S]{0,1000})`{0,3}\s*$/i);
    if (shellish) {
      name = "terminal";
      args = { command: shellish[1].trim(), timeout: 30 };
    }
  }
  if (!name) return completion;
  msg.content = null;
  msg.tool_calls = [{ id: `call_${name}_${Date.now()}`, type: "function", function: { name, arguments: typeof args === "string" ? args : JSON.stringify(args || {}) } }];
  choice.finish_reason = "tool_calls";
  return completion;
}

/**
 * Translate non-streaming response body from provider format → OpenAI format.
 */
function normalizeAnumaResponsesJson(responseBody) {
  if (responseBody?.choices?.[0]) return responseBody;
  if (responseBody?.object !== "response") return responseBody;
  let text = "";
  for (const item of responseBody.output || []) {
    if (item?.type !== "message") continue;
    for (const block of item.content || []) {
      if (block?.type === "output_text" || block?.type === "text") text += block.text || "";
    }
  }
  return {
    id: `chatcmpl-${responseBody.id || Date.now()}`,
    object: "chat.completion",
    created: responseBody.created_at || Math.floor(Date.now() / 1000),
    model: responseBody.model || "anuma",
    choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }],
    usage: responseBody.usage || null
  };
}

export function translateNonStreamingResponse(responseBody, targetFormat, sourceFormat) {
  if (targetFormat === sourceFormat || targetFormat === FORMATS.OPENAI) return responseBody;

  // Gemini / Antigravity
  if (targetFormat === FORMATS.GEMINI || targetFormat === FORMATS.ANTIGRAVITY || targetFormat === FORMATS.GEMINI_CLI || targetFormat === FORMATS.VERTEX) {
    const response = responseBody.response || responseBody;
    if (!response?.candidates?.[0]) return responseBody;

    const candidate = response.candidates[0];
    const content = candidate.content;
    const usage = response.usageMetadata || responseBody.usageMetadata;
    let textContent = "", reasoningContent = "";
    const toolCalls = [];

    const extractTextToolCall = (text) => {
      if (!text || typeof text !== "string") return null;
      let trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
      const marker = trimmed.match(/\{\s*"(?:tool_call|toolCall|function_call|functionCall)"\s*:/);
      if (marker?.index > 0) trimmed = trimmed.slice(marker.index);
      const tryParse = (s) => { try { return JSON.parse(s); } catch { return null; } };
      let parsed = tryParse(trimmed);
      if (!parsed && marker) {
        for (let end = trimmed.length; end > marker.index; end--) {
          const candidate = tryParse(trimmed.slice(0, end));
          if (candidate) { parsed = candidate; break; }
        }
      }
      const call = parsed?.tool_call || parsed?.toolCall || parsed?.function_call || parsed?.functionCall;
      const name = call?.name || call?.function?.name;
      const args = call?.arguments ?? call?.args ?? call?.function?.arguments ?? {};
      if (!name) return null;
      return { name, arguments: typeof args === "string" ? args : JSON.stringify(args || {}) };
    };

    if (content?.parts) {
      for (const part of content.parts) {
        if (part.thought === true && part.text) reasoningContent += part.text;
        else if (part.text !== undefined) {
          const textToolCall = extractTextToolCall(part.text);
          if (textToolCall) {
            toolCalls.push({
              id: `call_${textToolCall.name}_${Date.now()}_${toolCalls.length}`,
              type: "function",
              function: { name: textToolCall.name, arguments: textToolCall.arguments }
            });
          } else {
            textContent += part.text;
          }
        }
        if (part.functionCall) {
          toolCalls.push({
            id: `call_${part.functionCall.name}_${Date.now()}_${toolCalls.length}`,
            type: "function",
            function: { name: part.functionCall.name, arguments: JSON.stringify(part.functionCall.args || {}) }
          });
        }
      }
    }

    const message = { role: "assistant" };
    if (textContent) message.content = textContent;
    if (reasoningContent) message.reasoning_content = reasoningContent;
    if (toolCalls.length > 0) message.tool_calls = toolCalls;
    if (!message.content && !message.tool_calls) message.content = "";

    let finishReason = (candidate.finishReason || "stop").toLowerCase();
    if (finishReason === "stop" && toolCalls.length > 0) finishReason = "tool_calls";

    const result = {
      id: `chatcmpl-${response.responseId || Date.now()}`,
      object: "chat.completion",
      created: Math.floor(new Date(response.createTime || Date.now()).getTime() / 1000),
      model: response.modelVersion || "gemini",
      choices: [{ index: 0, message, finish_reason: finishReason }]
    };

    if (usage) {
      result.usage = {
        prompt_tokens: (usage.promptTokenCount || 0) + (usage.thoughtsTokenCount || 0),
        completion_tokens: usage.candidatesTokenCount || 0,
        total_tokens: usage.totalTokenCount || 0
      };
      if (usage.thoughtsTokenCount > 0) {
        result.usage.completion_tokens_details = { reasoning_tokens: usage.thoughtsTokenCount };
      }
    }
    return result;
  }

  // Claude
  if (targetFormat === FORMATS.CLAUDE) {
    if (!responseBody.content) return responseBody;

    let textContent = "", thinkingContent = "";
    const toolCalls = [];

    for (const block of responseBody.content) {
      if (block.type === "text") {
        // Strip markdown code block markers (e.g. kimi wraps JSON in ```json...```)
        const raw = block.text ?? "";
        const text = raw.replace(/^\s*```\s*json\s*\n?/i, "").replace(/\n?\s*```\s*$/i, "");
        textContent += text;
      } else if (block.type === "thinking") thinkingContent += block.thinking || "";
      else if (block.type === "tool_use") {
        toolCalls.push({ id: block.id, type: "function", function: { name: block.name, arguments: JSON.stringify(block.input || {}) } });
      }
    }

    const message = { role: "assistant" };
    if (textContent) message.content = textContent;
    if (thinkingContent) message.reasoning_content = thinkingContent;
    if (toolCalls.length > 0) message.tool_calls = toolCalls;
    if (!message.content && !message.tool_calls) message.content = "";

    let finishReason = responseBody.stop_reason || "stop";
    if (finishReason === "end_turn") finishReason = "stop";
    if (finishReason === "tool_use") finishReason = "tool_calls";

    const result = {
      id: `chatcmpl-${responseBody.id || Date.now()}`,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: responseBody.model || "claude",
      choices: [{ index: 0, message, finish_reason: finishReason }]
    };

    if (responseBody.usage) {
      result.usage = {
        prompt_tokens: responseBody.usage.input_tokens || 0,
        completion_tokens: responseBody.usage.output_tokens || 0,
        total_tokens: (responseBody.usage.input_tokens || 0) + (responseBody.usage.output_tokens || 0)
      };
    }
    return result;
  }

  // Ollama
  if (targetFormat === FORMATS.OLLAMA) {
    return ollamaBodyToOpenAI(responseBody);
  }

  return responseBody;
}

/**
 * Handle non-streaming response from provider.
 */
export async function handleNonStreamingResponse({ providerResponse, provider, model, sourceFormat, targetFormat, body, stream, translatedBody, finalBody, requestStartTime, connectionId, apiKey, clientRawRequest, onRequestSuccess, reqLogger, toolNameMap, trackDone, appendLog }) {
  trackDone();
  const contentType = providerResponse.headers.get("content-type") || "";
  let responseBody;

  if (contentType.includes("text/event-stream")) {
    const sseText = await providerResponse.text();
    const trimmed = sseText.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        responseBody = JSON.parse(trimmed);
      } catch (err) {
        appendLog({ status: `FAILED ${HTTP_STATUS.BAD_GATEWAY}` });
        console.error(`[ChatCore] Failed to parse JSON-looking SSE from ${provider}:`, err.message);
        return createErrorResult(HTTP_STATUS.BAD_GATEWAY, `Invalid JSON response from ${provider}`);
      }
    } else {
      const parsed = parseSSEToOpenAIResponse(sseText, model);
      if (!parsed) {
        appendLog({ status: `FAILED ${HTTP_STATUS.BAD_GATEWAY}` });
        return createErrorResult(HTTP_STATUS.BAD_GATEWAY, "Invalid SSE response for non-streaming request");
      }
      responseBody = parsed;
    }
  } else {
    try {
      responseBody = await providerResponse.json();
    } catch (err) {
      appendLog({ status: `FAILED ${HTTP_STATUS.BAD_GATEWAY}` });
      console.error(`[ChatCore] Failed to parse JSON from ${provider}:`, err.message);
      return createErrorResult(HTTP_STATUS.BAD_GATEWAY, `Invalid JSON response from ${provider}`);
    }
  }

  if ((provider === "cline" || provider === "cline-apikey") && responseBody?.data?.choices) {
    responseBody = responseBody.data;
  }
  if (provider === "anuma") responseBody = normalizeAnumaResponsesJson(responseBody);

  reqLogger.logProviderResponse(providerResponse.status, providerResponse.statusText, providerResponse.headers, responseBody);
  if (onRequestSuccess) await onRequestSuccess();

  // Decloak tool_use names once on raw Claude body, before any translation (INPUT side)
  responseBody = decloakToolNames(responseBody, toolNameMap);

  const usage = extractUsageFromResponse(responseBody);
  appendLog({ tokens: usage, status: "200 OK" });
  saveUsageStats({ provider, model, tokens: usage, connectionId, apiKey, endpoint: clientRawRequest?.endpoint });

  const translatedResponse = needsTranslation(targetFormat, sourceFormat)
    ? translateNonStreamingResponse(responseBody, targetFormat, sourceFormat)
    : responseBody;

  // Parse pseudo-tool calls for providers without native tool support
  if ((provider === "badtheory-labs" || provider === "btl") && translatedResponse?.choices?.[0]) {
    const tools = (translatedBody?.tools || body?.tools || []);
    normalizeCompletionPseudoToolCalls(translatedResponse, { provider, tools });
  }

  // Fix finish_reason for tool_calls: some providers return non-standard values (e.g. "other")
  if (translatedResponse?.choices?.[0]) {
    const choice = translatedResponse.choices[0];
    const msg = choice.message;
    const hasToolCalls = Array.isArray(msg?.tool_calls) && msg.tool_calls.length > 0;
    if (hasToolCalls && choice.finish_reason !== "tool_calls") {
      choice.finish_reason = "tool_calls";
    }

    if (provider === "anuma") {
      const content = typeof msg?.content === "string" ? msg.content.trim() : "";
      const finish = choice.finish_reason || "stop";
      if (!content && !hasToolCalls && finish !== "length") {
        appendLog({ status: `FAILED ${HTTP_STATUS.BAD_GATEWAY}` });
        return createErrorResult(HTTP_STATUS.BAD_GATEWAY, "Anuma returned empty assistant content; retry with another Anuma model or inspect upstream response.");
      }
    }
  }

  // Ensure OpenAI-required fields
  if (!translatedResponse.object) translatedResponse.object = "chat.completion";
  if (!translatedResponse.created) translatedResponse.created = Math.floor(Date.now() / 1000);

  // Strip Azure-specific fields
  delete translatedResponse.prompt_filter_results;
  if (translatedResponse?.choices) {
    for (const choice of translatedResponse.choices) delete choice.content_filter_results;
  }

  if (translatedResponse?.usage) {
    translatedResponse.usage = filterUsageForFormat(addBufferToUsage(translatedResponse.usage), sourceFormat);
  }

  // Strip reasoning_content — some clients (e.g. Firecrawl AI SDK) have JSON parsers that
  // break on this non-standard field, even though OpenAI allows it in extensions.
  if (translatedResponse?.choices) {
    for (const choice of translatedResponse.choices) {
      if (choice?.message) delete choice.message.reasoning_content;
    }
  }

  reqLogger.logConvertedResponse(translatedResponse);

  const totalLatency = Date.now() - requestStartTime;
  saveRequestDetail(buildRequestDetail({
    provider, model, connectionId,
    latency: { ttft: totalLatency, total: totalLatency },
    tokens: usage || { prompt_tokens: 0, completion_tokens: 0 },
    request: extractRequestConfig(body, stream),
    providerRequest: finalBody || translatedBody || null,
    providerResponse: responseBody || null,
    response: {
      content: translatedResponse?.choices?.[0]?.message?.content || translatedResponse?.content || null,
      thinking: translatedResponse?.choices?.[0]?.message?.reasoning_content || translatedResponse?.reasoning_content || null,
      finish_reason: translatedResponse?.choices?.[0]?.finish_reason || "unknown"
    },
    status: "success"
  }, { endpoint: clientRawRequest?.endpoint || null })).catch(err => {
    console.error("[RequestDetail] Failed to save:", err.message);
  });

  return {
    success: true,
    response: new Response(JSON.stringify(translatedResponse), {
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    })
  };
}
