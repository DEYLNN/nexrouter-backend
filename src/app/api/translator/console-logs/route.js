import { NextResponse } from "next/server";
import { clearConsoleLogs, getConsoleLogs, initConsoleLogCapture } from "@/lib/consoleLogBuffer";
import { getRecentLogs } from "@/lib/usageDb";

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

export async function GET() {
  try {
    const usageLogs = (await getRecentLogs(120)).reverse().map(formatUsageLine);
    const logs = dedupeLines([...usageLogs, ...getConsoleLogs()]).slice(-300);
    return NextResponse.json({ success: true, logs, dataStore: "sqlite" });
  } catch (error) {
    console.error("Error getting console logs:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE() {
  try {
    clearConsoleLogs();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error clearing console logs:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
