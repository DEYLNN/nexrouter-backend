import { NextResponse } from "next/server";
import { getPublicModelIds, setPublicModelIds, enablePublicModels, disablePublicModels } from "@/lib/publicModelsDb";
import { buildModelsList } from "@/app/api/v1/models/route";

export const dynamic = "force-dynamic";

async function allLlmModels() {
  return await buildModelsList(["llm"], { publicOnly: false });
}

export async function GET() {
  try {
    const [enabledIds, allModels] = await Promise.all([
      getPublicModelIds(),
      allLlmModels(),
    ]);
    return NextResponse.json({
      enabledIds,
      models: allModels.map((model) => ({
        ...model,
        publicEnabled: enabledIds.includes(model.id),
      })),
    });
  } catch (error) {
    console.log("Error fetching public models:", error);
    return NextResponse.json({ error: "Failed to fetch public models" }, { status: 500 });
  }
}

// PUT /api/models/public body: { enabledIds: [...] }
export async function PUT(request) {
  try {
    const { enabledIds } = await request.json();
    if (!Array.isArray(enabledIds)) {
      return NextResponse.json({ error: "enabledIds[] required" }, { status: 400 });
    }
    const next = await setPublicModelIds(enabledIds);
    return NextResponse.json({ success: true, enabledIds: next });
  } catch (error) {
    console.log("Error saving public models:", error);
    return NextResponse.json({ error: "Failed to save public models" }, { status: 500 });
  }
}

// POST /api/models/public body: { ids: [...] }
export async function POST(request) {
  try {
    const { ids } = await request.json();
    if (!Array.isArray(ids)) {
      return NextResponse.json({ error: "ids[] required" }, { status: 400 });
    }
    const next = await enablePublicModels(ids);
    return NextResponse.json({ success: true, enabledIds: next });
  } catch (error) {
    console.log("Error enabling public models:", error);
    return NextResponse.json({ error: "Failed to enable public models" }, { status: 500 });
  }
}

// DELETE /api/models/public?id=xxx or body: { ids: [...] }
export async function DELETE(request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    let ids = id ? [id] : [];
    if (!id) {
      const body = await request.json().catch(() => ({}));
      ids = Array.isArray(body?.ids) ? body.ids : [];
    }
    const next = await disablePublicModels(ids);
    return NextResponse.json({ success: true, enabledIds: next });
  } catch (error) {
    console.log("Error disabling public models:", error);
    return NextResponse.json({ error: "Failed to disable public models" }, { status: 500 });
  }
}
