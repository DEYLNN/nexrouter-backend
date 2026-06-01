import { NextResponse } from "next/server";
import { getProviderConnectionById, getApiKeys } from "@/lib/localDb";
import { getProviderModels, PROVIDER_ID_TO_ALIAS } from "open-sse/config/providerModels.js";

async function getInternalApiKey() {
  const keys = await getApiKeys();
  return keys.find((k) => k.isActive !== false)?.key || null;
}

function getAllowedModelIds(providerId) {
  const alias = PROVIDER_ID_TO_ALIAS[providerId] || providerId;
  return new Set(getProviderModels(alias).filter((m) => !m.type || m.type === "llm").map((m) => m.id));
}

export async function POST(request, { params }) {
  try {
    const { id } = await params;
    const connection = await getProviderConnectionById(id);
    if (!connection) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }
    if (connection.provider !== "kiro") {
      return NextResponse.json({ error: "Model probe is only enabled for Kiro connections" }, { status: 400 });
    }

    const { model } = await request.json();
    const modelId = String(model || "").trim();
    if (!modelId) return NextResponse.json({ error: "Missing model" }, { status: 400 });

    const allowedModels = getAllowedModelIds(connection.provider);
    if (!allowedModels.has(modelId)) {
      return NextResponse.json({ error: `Unknown Kiro model: ${modelId}` }, { status: 400 });
    }

    const alias = PROVIDER_ID_TO_ALIAS[connection.provider] || connection.provider;
    const apiKey = await getInternalApiKey();
    const headers = {
      "Content-Type": "application/json",
      "x-connection-id": id,
    };
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

    const start = Date.now();
    const origin = new URL(request.url).origin;
    const res = await fetch(`${origin}/api/v1/chat/completions`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: `${alias}/${modelId}`,
        max_tokens: 64,
        stream: false,
        messages: [{ role: "user", content: "Reply with exactly: ok" }],
      }),
      signal: AbortSignal.timeout(45000),
    });
    const latencyMs = Date.now() - start;
    const text = await res.text().catch(() => "");
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { /* keep raw */ }

    const content = data?.choices?.[0]?.message?.content || data?.content?.[0]?.text || "";
    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      model: modelId,
      latencyMs,
      content: String(content || "").slice(0, 300),
      error: res.ok ? null : (data?.error?.message || data?.error || text.slice(0, 500) || `HTTP ${res.status}`),
    }, { status: res.ok ? 200 : 200 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error.message || "Test failed" }, { status: 500 });
  }
}
