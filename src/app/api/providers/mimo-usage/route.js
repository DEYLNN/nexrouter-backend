import { NextResponse } from "next/server";
import { getProviderConnectionById } from "@/lib/localDb";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Connection ID required" }, { status: 400 });
    }

    const connection = await getProviderConnectionById(id);
    if (!connection || connection.provider !== "xiaomi-mimo-plan-sgp") {
      return NextResponse.json({ error: "MiMo SGP connection not found" }, { status: 404 });
    }

    const cookie = connection.providerSpecificData?.platformCookie;
    if (!cookie) {
      return NextResponse.json({ error: "No platform cookie stored. Edit this connection to add one." }, { status: 400 });
    }

    const headers = {
      "accept": "*/*",
      "content-type": "application/json",
      "cookie": cookie,
      "referer": "https://platform.xiaomimimo.com/console/plan-manage",
      "user-agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
      "x-timezone": "Asia/Jakarta",
    };

    // Fetch profile + plan detail + usage in parallel
    const [profileRes, planRes, usageRes] = await Promise.all([
      fetch("https://platform.xiaomimimo.com/api/v1/userProfile", { headers }),
      fetch("https://platform.xiaomimimo.com/api/v1/tokenPlan/detail", { headers }),
      fetch("https://platform.xiaomimimo.com/api/v1/tokenPlan/usage", { headers }),
    ]);

    const profile = profileRes.ok ? await profileRes.json() : null;
    const plan = planRes.ok ? await planRes.json() : null;
    const usage = usageRes.ok ? await usageRes.json() : null;

    return NextResponse.json({ profile, plan, usage });
  } catch (error) {
    console.log("Error fetching MiMo usage:", error);
    return NextResponse.json({ error: "Failed to fetch usage" }, { status: 500 });
  }
}
