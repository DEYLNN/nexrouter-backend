const SHELL_COMMAND_RE = /^(?:`{0,3}(?:bash|sh)?\s*)?((?:ls|find|cat|sed|grep|rg|pwd|tree|git|npm|node|python3?|pm2|du|df|tail|head|ps|kill|pkill|pgrep|curl|wget|echo|sleep|which|whereis|netstat|ss|lsof|systemctl|service|docker|docker-compose|chmod|chown|mkdir|cp|mv|trash|rm)\b[\s\S]{0,1600})`{0,3}\s*$/i;

function stripFences(text) {
  return String(text || "").trim().replace(/^```(?:json|javascript|js|bash|sh)?\s*/i, "").replace(/\s*```$/i, "").trim();
}

function extractFirstJsonObject(text) {
  const start = String(text || "").indexOf("{");
  if (start < 0) return null;
  let depth = 0;
  let inString = false;
  let escape = false;
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
}

function tryJson(text) {
  try { return JSON.parse(text); } catch { return null; }
}

function normalizeArgs(args) {
  if (typeof args === "string") return args;
  return JSON.stringify(args || {});
}

function parseJsonToolCall(cleaned) {
  let parsed = tryJson(cleaned);
  if (!parsed) {
    const json = extractFirstJsonObject(cleaned);
    if (json) parsed = tryJson(json);
  }
  const call = parsed?.tool_call || parsed?.toolCall || parsed?.function_call || parsed?.functionCall;
  const name = call?.name || call?.function?.name;
  const args = call?.arguments ?? call?.args ?? call?.function?.arguments ?? {};
  return name ? { name, arguments: normalizeArgs(args) } : null;
}

function parseTextToolCall(cleaned) {
  const patterns = [
    /(?:Requested tool calls?:\s*)?-\s*([A-Za-z_][\w.-]*)\s*\((\{[\s\S]*\})\)\s*$/i,
    /^([A-Za-z_][\w.-]*)\s*\((\{[\s\S]*\})\)\s*$/i,
    /^💻\s*([A-Za-z_][\w.-]*):\s*["“]([\s\S]*?)["”]\s*$/i,
  ];
  for (const re of patterns) {
    const m = cleaned.match(re);
    if (!m) continue;
    if (m[2]?.trim().startsWith("{")) return { name: m[1], arguments: m[2] };
    return { name: m[1], arguments: JSON.stringify({ command: m[2].trim(), timeout: 30 }) };
  }
  return null;
}

function parseShellCommand(cleaned, preferredTool = "terminal") {
  const m = cleaned.match(SHELL_COMMAND_RE);
  if (!m) return null;
  return { name: preferredTool, arguments: JSON.stringify({ command: m[1].trim(), timeout: 30 }) };
}

function toolExists(name, tools = []) {
  if (!Array.isArray(tools) || tools.length === 0) return true;
  return tools.some((tool) => {
    const fn = tool?.function || tool;
    return (fn?.name || tool?.name) === name;
  });
}

function pickTerminalTool(tools = []) {
  const names = (Array.isArray(tools) ? tools : []).map((tool) => (tool?.function || tool)?.name || tool?.name).filter(Boolean);
  return names.find((n) => /^(terminal|shell|bash|exec|command)$/i.test(n)) || "terminal";
}

export function extractPseudoToolCall(text, tools = []) {
  const cleaned = stripFences(text);
  if (!cleaned) return null;
  const terminalTool = pickTerminalTool(tools);
  const candidates = [
    parseJsonToolCall(cleaned),
    parseTextToolCall(cleaned),
    parseShellCommand(cleaned, terminalTool),
  ].filter(Boolean);
  for (const c of candidates) {
    if (toolExists(c.name, tools)) return c;
    if (c.name === "terminal" && terminalTool !== "terminal" && toolExists(terminalTool, tools)) return { ...c, name: terminalTool };
  }
  return null;
}

export function normalizeCompletionPseudoToolCalls(completion, { provider = "unknown", tools = [] } = {}) {
  const choice = completion?.choices?.[0];
  const msg = choice?.message;
  const content = typeof msg?.content === "string" ? msg.content.trim() : "";
  if (!content || msg?.tool_calls?.length) return completion;
  const call = extractPseudoToolCall(content, tools);
  if (!call) return completion;
  msg.content = null;
  msg.tool_calls = [{
    id: `call_${call.name}_${Date.now()}`,
    type: "function",
    function: { name: call.name, arguments: call.arguments },
  }];
  choice.finish_reason = "tool_calls";
  completion._pseudoToolCall = { provider, name: call.name };
  return completion;
}

export function buildPseudoToolInstructions(tools = [], { hasRecentToolResult = false } = {}) {
  if (hasRecentToolResult) {
    return "A tool result is already present in the recent conversation. Do NOT call tools again unless the user explicitly asks for another action. Use the tool result to provide the final answer now.";
  }
  if (!Array.isArray(tools) || tools.length === 0) return null;
  const lines = tools.map((tool) => {
    const fn = tool?.function || tool;
    const name = fn?.name || tool?.name || "unknown_tool";
    const desc = fn?.description || tool?.description || "";
    const schema = fn?.parameters || tool?.input_schema || tool?.schema || {};
    return `- ${name}: ${desc}\n  parameters: ${JSON.stringify(schema)}`;
  }).join("\n");
  return `You are behind an OpenAI-compatible API for an agentic client. This upstream model cannot call tools natively, so you must emulate tool calls exactly.

Critical rules:
1. NEVER ask the user to run commands, paste command output, browse files, fetch URLs, or provide paths if a tool can do it.
2. For read-only follow-up diagnostics/fetching (curl, web fetch, grep, list files, inspect logs), DO NOT ask permission; call the tool directly.
3. Ask permission only for destructive/public/external-write actions, not for read-only analysis.
4. If you need to inspect files, run shell, list workspace, read config/logs, fetch URLs, browse, or perform an action, respond ONLY with JSON: {"tool_call":{"name":"tool_name","arguments":{...}}}.
5. Do not wrap JSON in markdown. No explanation before/after JSON.
6. Prefer the terminal/shell-like tool for shell commands.
7. After tool result appears, answer normally with the final result. If the result is incomplete and a known read-only fallback exists, call the fallback tool instead of asking the user.
8. Final answers should preserve the agent/persona style from the conversation: natural, concise, helpful, not a dry machine log. Summarize tool output in human language, mention only important details, then offer the next useful action if appropriate.

Examples:
User: cek workspace
Assistant: {"tool_call":{"name":"terminal","arguments":{"command":"pwd && ls -la","timeout":30}}}
User: baca SOUL
Assistant: {"tool_call":{"name":"terminal","arguments":{"command":"find ~ -maxdepth 4 -iname 'SOUL*' -o -iname 'soul*' | head -20","timeout":30}}}
User: analyze X tweet https://x.com/i/status/123
Assistant: {"tool_call":{"name":"terminal","arguments":{"command":"webclaw -f llm 'https://x.com/i/status/123' || curl -L -sS 'https://api.vxtwitter.com/i/status/123'","timeout":30}}}
User: shutdown process X
Assistant: {"tool_call":{"name":"terminal","arguments":{"command":"ps aux | grep X | grep -v grep","timeout":30}}}
Tool result: process stopped successfully
Assistant final: Done — process X udah mati. Gue cek juga, portnya udah free.

Available tools:
${lines}`.slice(0, 24000);
}
