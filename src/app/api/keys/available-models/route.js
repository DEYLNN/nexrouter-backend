import { NextResponse } from "next/server";
import { getProviderConnections } from "@/lib/localDb";
import { PROVIDER_MODELS, PROVIDER_ID_TO_ALIAS } from "open-sse/config/providerModels.js";
import { AI_PROVIDERS } from "@/shared/constants/providers";

export const dynamic = "force-dynamic";

// GET /api/keys/available-models
// Returns all models available across active provider connections
// Used for API key allowedModels selector
export async function GET() {
  try {
    const connections = await getProviderConnections();
    const activeProviders = new Set(
      connections.filter(c => c.isActive !== false).map(c => c.provider)
    );

    const models = [];
    const seen = new Set();

    for (const providerId of activeProviders) {
      const alias = PROVIDER_ID_TO_ALIAS[providerId] || providerId;
      const providerModels = PROVIDER_MODELS[alias] || [];
      const providerInfo = AI_PROVIDERS[providerId];
      const providerName = providerInfo?.name || providerId;

      for (const m of providerModels) {
        // Only include LLM models (skip embedding, tts, image)
        if (m.type && !["llm", undefined, null].includes(m.type)) continue;
        const modelId = `${alias}/${m.id}`;
        if (seen.has(modelId)) continue;
        seen.add(modelId);
        models.push({
          id: modelId,
          name: m.name || m.id,
          provider: providerId,
          providerName,
          alias,
        });
      }
    }

    // Sort by provider name then model name
    models.sort((a, b) => a.providerName.localeCompare(b.providerName) || a.name.localeCompare(b.name));

    return NextResponse.json({ models });
  } catch (error) {
    console.log("Error fetching available models:", error);
    return NextResponse.json({ error: "Failed to fetch models" }, { status: 500 });
  }
}
