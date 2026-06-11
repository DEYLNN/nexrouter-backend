import { getConsoleLogs, getConsoleEmitter, initConsoleLogCapture } from "@/lib/consoleLogBuffer";
import { getRecentLogs } from "@/lib/usageDb";
import { CONSOLE_LOG_CONFIG } from "@/shared/constants/config.js";

export const dynamic = "force-dynamic";

initConsoleLogCapture();

function formatUsageLine(line) {
  if (typeof line === "string") return line;
  const [ts = "", model = "", provider = "", account = "", input = "0", output = "0", status = "ok"] = line || [];
  const displayTs = ts ? new Date(ts).toLocaleString() : "";
  return `[USAGE] ${displayTs} | ${provider} | ${model} | account=${account} | in=${input} | out=${output} | ${status}`;
}

function getDedupeKey(line) {
  const value = String(line);
  const parts = value.split(" | ");
  if (parts.length >= 7 && /^\d{4}-\d{2}-\d{2}T/.test(parts[0])) {
    const second = parts[0].replace(/\.\d{3}Z$/, "Z");
    return [second, ...parts.slice(1, 7)].join(" | ");
  }
  return value;
}

function dedupeLines(lines) {
  const seen = new Set();
  return lines.filter((line) => {
    const key = getDedupeKey(line);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function getInitialConsoleLogs() {
  const runtimeLogs = getConsoleLogs();
  let usageLogs = [];
  try {
    const usageLimit = CONSOLE_LOG_CONFIG.usageInitialLines || 120;
    usageLogs = (await getRecentLogs(usageLimit)).reverse().map(formatUsageLine);
  } catch (error) {
    usageLogs = [`[WARN] Failed to load SQLite usage logs: ${error.message}`];
  }
  const maxLines = CONSOLE_LOG_CONFIG.initialLines || CONSOLE_LOG_CONFIG.maxLines || 2000;
  return dedupeLines([...usageLogs, ...runtimeLogs]).slice(-maxLines);
}

export async function GET(request) {
  const encoder = new TextEncoder();
  const emitter = getConsoleEmitter();
  const state = { closed: false, send: null, sendClear: null, keepalive: null };

  // Idempotent: safe to call from request.signal abort, cancel(), or enqueue failure.
  const cleanup = () => {
    if (state.closed) return;
    state.closed = true;
    if (state.send) emitter.off("line", state.send);
    if (state.sendClear) emitter.off("clear", state.sendClear);
    if (state.keepalive) clearInterval(state.keepalive);
  };

  // request.signal fires reliably on client disconnect; ReadableStream.cancel()
  // is not always invoked in Next.js, which caused listeners to accumulate.
  request.signal.addEventListener("abort", cleanup, { once: true });

  const stream = new ReadableStream({
    start(controller) {
      // Send SQLite usage history + buffered runtime logs immediately on connect.
      getInitialConsoleLogs().then((buffered) => {
        if (state.closed || buffered.length === 0) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "init", logs: buffered })}\n\n`));
        } catch {
          cleanup();
        }
      });

      // Push new lines as they arrive
      state.send = (line) => {
        if (state.closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "line", line })}\n\n`));
        } catch {
          cleanup();
        }
      };

      // Notify client when cleared
      state.sendClear = () => {
        if (state.closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "clear" })}\n\n`));
        } catch {
          cleanup();
        }
      };

      emitter.on("line", state.send);
      emitter.on("clear", state.sendClear);

      // Keepalive ping every 25s
      state.keepalive = setInterval(() => {
        if (state.closed) { clearInterval(state.keepalive); return; }
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          cleanup();
        }
      }, 25000);
    },

    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}
