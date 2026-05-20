import { register } from "../index.js";
import { FORMATS } from "../formats.js";

function extractTextToolCall(text) {
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
}

function pushToolCallChunk(results, state, fcName, fcArgs) {
  const toolCallIndex = state.functionIndex++;
  const toolCall = {
    id: `call_${fcName}_${Date.now()}_${toolCallIndex}`,
    index: toolCallIndex,
    type: "function",
    function: { name: fcName, arguments: fcArgs }
  };
  state.toolCalls.set(toolCallIndex, toolCall);
  results.push({
    id: `chatcmpl-${state.messageId}`,
    object: "chat.completion.chunk",
    created: Math.floor(Date.now() / 1000),
    model: state.model,
    choices: [{ index: 0, delta: { tool_calls: [toolCall] }, finish_reason: null }]
  });
}

// Convert Gemini response chunk to OpenAI format
export function geminiToOpenAIResponse(chunk, state) {
  if (!chunk) {
    if (state?.gemmaTextBuffer) {
      const text = state.gemmaTextBuffer;
      state.gemmaTextBuffer = "";
      return [{
        id: `chatcmpl-${state.messageId || `msg_${Date.now()}`}`,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: state.model || state.requestModel || "gemini",
        choices: [{ index: 0, delta: { content: text }, finish_reason: null }]
      }];
    }
    return null;
  }
  
  // Handle Antigravity wrapper
  const response = chunk.response || chunk;
  if (!response || !response.candidates?.[0]) return null;

  const results = [];
  const candidate = response.candidates[0];
  const content = candidate.content;

  // Initialize state
  if (!state.messageId) {
    state.requestModel = state.model || null;
    state.messageId = response.responseId || `msg_${Date.now()}`;
    state.model = response.modelVersion || state.requestModel || "gemini";
    state.functionIndex = 0;
    results.push({
      id: `chatcmpl-${state.messageId}`,
      object: "chat.completion.chunk",
      created: Math.floor(Date.now() / 1000),
      model: state.model,
      choices: [{
        index: 0,
        delta: { role: "assistant" },
        finish_reason: null
      }]
    });
  }

  // Process parts
  if (content?.parts) {
    for (const part of content.parts) {
      const hasThoughtSig = part.thoughtSignature || part.thought_signature;
      const isThought = part.thought === true;
      
      // Handle thought signature (thinking mode)
      if (hasThoughtSig) {
        const hasTextContent = part.text !== undefined && part.text !== "";
        const hasFunctionCall = !!part.functionCall;
        
        if (hasTextContent) {
          results.push({
            id: `chatcmpl-${state.messageId}`,
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            model: state.model,
            choices: [{
              index: 0,
              delta: isThought 
                ? { reasoning_content: part.text }
                : { content: part.text },
              finish_reason: null
            }]
          });
        }
        
        if (hasFunctionCall) {
          const rawName = part.functionCall.name;
          // Restore original tool name from mapping (AG cloaking)
          const fcName = state.toolNameMap?.get(rawName) || rawName;
          const fcArgs = part.functionCall.args || {};
          const toolCallIndex = state.functionIndex++;
          
          const toolCall = {
            id: `${fcName}-${Date.now()}-${toolCallIndex}`,
            index: toolCallIndex,
            type: "function",
            function: {
              name: fcName,
              arguments: JSON.stringify(fcArgs)
            }
          };
          
          state.toolCalls.set(toolCallIndex, toolCall);
          
          results.push({
            id: `chatcmpl-${state.messageId}`,
            object: "chat.completion.chunk",
            created: Math.floor(Date.now() / 1000),
            model: state.model,
            choices: [{
              index: 0,
              delta: { tool_calls: [toolCall] },
              finish_reason: null
            }]
          });
        }
        continue;
      }

      // Text content (non-thinking)
      if (part.text !== undefined && part.text !== "") {
        const isGemmaToolShim = /^gemma-4-31b-it$/i.test(state.requestModel || state.model || "");
        if (isGemmaToolShim) {
          state.gemmaTextBuffer = (state.gemmaTextBuffer || "") + part.text;
          const textToolCall = extractTextToolCall(state.gemmaTextBuffer);
          if (textToolCall) {
            state.gemmaTextBuffer = "";
            state.gemmaToolCallEmitted = true;
            pushToolCallChunk(results, state, textToolCall.name, textToolCall.arguments);
          }
        } else {
          const textToolCall = extractTextToolCall(part.text);
          if (textToolCall) {
            pushToolCallChunk(results, state, textToolCall.name, textToolCall.arguments);
          } else {
            results.push({
              id: `chatcmpl-${state.messageId}`,
              object: "chat.completion.chunk",
              created: Math.floor(Date.now() / 1000),
              model: state.model,
              choices: [{
                index: 0,
                delta: { content: part.text },
                finish_reason: null
              }]
            });
          }
        }
      }

      // Function call
      if (part.functionCall) {
        const rawName = part.functionCall.name;
        // Restore original tool name from mapping (AG cloaking)
        const fcName = state.toolNameMap?.get(rawName) || rawName;
        const fcArgs = part.functionCall.args || {};
        const toolCallIndex = state.functionIndex++;
        
        const toolCall = {
          id: `${fcName}-${Date.now()}-${toolCallIndex}`,
          index: toolCallIndex,
          type: "function",
          function: {
            name: fcName,
            arguments: JSON.stringify(fcArgs)
          }
        };
        
        state.toolCalls.set(toolCallIndex, toolCall);
        
        results.push({
          id: `chatcmpl-${state.messageId}`,
          object: "chat.completion.chunk",
          created: Math.floor(Date.now() / 1000),
          model: state.model,
          choices: [{
            index: 0,
            delta: { tool_calls: [toolCall] },
            finish_reason: null
          }]
        });
      }

      // Inline data (images)
      const inlineData = part.inlineData || part.inline_data;
      if (inlineData?.data) {
        const mimeType = inlineData.mimeType || inlineData.mime_type || "image/png";
        results.push({
          id: `chatcmpl-${state.messageId}`,
          object: "chat.completion.chunk",
          created: Math.floor(Date.now() / 1000),
          model: state.model,
          choices: [{
            index: 0,
            delta: {
              images: [{
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${inlineData.data}` }
              }]
            },
            finish_reason: null
          }]
        });
      }
    }
  }

  // Usage metadata - extract before finish reason so we can include it
  const usageMeta = response.usageMetadata || chunk.usageMetadata;
  if (usageMeta && typeof usageMeta === "object") {
    const cachedTokens = typeof usageMeta.cachedContentTokenCount === "number" ? usageMeta.cachedContentTokenCount : 0;
    const promptTokenCountRaw = typeof usageMeta.promptTokenCount === "number" ? usageMeta.promptTokenCount : 0;
    const thoughtsTokens = typeof usageMeta.thoughtsTokenCount === "number" ? usageMeta.thoughtsTokenCount : 0;
    let candidatesTokens = typeof usageMeta.candidatesTokenCount === "number" ? usageMeta.candidatesTokenCount : 0;
    const totalTokens = typeof usageMeta.totalTokenCount === "number" ? usageMeta.totalTokenCount : 0;
    
    // prompt_tokens = promptTokenCount (includes cached tokens, matching claude-to-openai.js behavior)
    const promptTokens = promptTokenCountRaw;
    
    // Fallback calculation if candidatesTokenCount is 0 but totalTokenCount exists
    if (candidatesTokens === 0 && totalTokens > 0) {
      candidatesTokens = totalTokens - promptTokenCountRaw - thoughtsTokens;
      if (candidatesTokens < 0) candidatesTokens = 0;
    }
    
    // completion_tokens = candidatesTokenCount + thoughtsTokenCount (match Go code)
    const completionTokens = candidatesTokens + thoughtsTokens;
    
    state.usage = {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens
    };
    
    // Add prompt_tokens_details if cached tokens exist
    if (cachedTokens > 0) {
      state.usage.prompt_tokens_details = {
        cached_tokens: cachedTokens
      };
    }
    
    // Add completion_tokens_details if reasoning tokens exist
    if (thoughtsTokens > 0) {
      state.usage.completion_tokens_details = {
        reasoning_tokens: thoughtsTokens
      };
    }
  }

  // Finish reason - include usage in final chunk
  if (candidate.finishReason) {
    if (state.gemmaTextBuffer && !state.gemmaToolCallEmitted) {
      results.push({
        id: `chatcmpl-${state.messageId}`,
        object: "chat.completion.chunk",
        created: Math.floor(Date.now() / 1000),
        model: state.model,
        choices: [{ index: 0, delta: { content: state.gemmaTextBuffer }, finish_reason: null }]
      });
      state.gemmaTextBuffer = "";
    }
    let finishReason = candidate.finishReason.toLowerCase();
    if (finishReason === "stop" && state.toolCalls.size > 0) {
      finishReason = "tool_calls";
    }
    
    const finalChunk = {
      id: `chatcmpl-${state.messageId}`,
      object: "chat.completion.chunk",
      created: Math.floor(Date.now() / 1000),
      model: state.model,
      choices: [{
        index: 0,
        delta: {},
        finish_reason: finishReason
      }]
    };
    
    // Include usage in final chunk for downstream translators
    if (state.usage) {
      finalChunk.usage = state.usage;
    }
    
    results.push(finalChunk);
    state.finishReason = finishReason;
  }

  return results.length > 0 ? results : null;
}

// Register
register(FORMATS.GEMINI, FORMATS.OPENAI, null, geminiToOpenAIResponse);
register(FORMATS.GEMINI_CLI, FORMATS.OPENAI, null, geminiToOpenAIResponse);
register(FORMATS.ANTIGRAVITY, FORMATS.OPENAI, null, geminiToOpenAIResponse);
register(FORMATS.VERTEX, FORMATS.OPENAI, null, geminiToOpenAIResponse);

