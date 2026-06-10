import { Hono } from "hono";
import { cors } from "hono/cors";
import { setCookie, deleteCookie } from "hono/cookie";
import { serve } from "@hono/node-server";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";

import { buildModelsList } from "../../src/app/api/v1/models/route.js";
import {
  getCombos,
  getModelAliases,
  getProviderConnections,
  getProviderNodes,
} from "../../src/models/index.js";
import { getSettings } from "../../src/lib/localDb.js";
import {
  isAnthropicCompatibleProvider,
  isOpenAICompatibleProvider,
} from "../../src/shared/constants/providers.js";

import { POST as chatCompletionsPost } from "../../src/app/api/v1/chat/completions/route.js";
import { POST as responsesPost } from "../../src/app/api/v1/responses/route.js";
import { POST as messagesPost } from "../../src/app/api/v1/messages/route.js";
import { POST as embeddingsPost } from "../../src/app/api/v1/embeddings/route.js";

import { GET as keysGet, POST as keysPost } from "../../src/app/api/keys/route.js";
import { GET as keyGet, PUT as keyPut, DELETE as keyDelete } from "../../src/app/api/keys/[id]/route.js";
import { GET as providerGet, PUT as providerPut, DELETE as providerDelete } from "../../src/app/api/providers/[id]/route.js";
import { POST as providerRefreshTokenPost } from "../../src/app/api/providers/[id]/refresh-token/route.js";
import { POST as providersPost } from "../../src/app/api/providers/route.js";
import { POST as providerValidatePost } from "../../src/app/api/providers/validate/route.js";
import { GET as providerModelsGet } from "../../src/app/api/providers/[id]/models/route.js";
import { POST as providerTestPost } from "../../src/app/api/providers/[id]/test/route.js";
import { POST as providerTestModelPost } from "../../src/app/api/providers/[id]/test-model/route.js";
import { POST as providerTestModelsPost } from "../../src/app/api/providers/[id]/test-models/route.js";
import { GET as mimoUsageGet } from "../../src/app/api/providers/mimo-usage/route.js";
import { GET as suggestedModelsGet } from "../../src/app/api/providers/suggested-models/route.js";
import { GET as availableModelsGet } from "../../src/app/api/keys/available-models/route.js";
import { POST as providerNodesPost } from "../../src/app/api/provider-nodes/route.js";
import { PUT as providerNodePut, DELETE as providerNodeDelete } from "../../src/app/api/provider-nodes/[id]/route.js";
import { POST as providerNodeValidatePost } from "../../src/app/api/provider-nodes/validate/route.js";
import { GET as customModelsGet, POST as customModelsPost, DELETE as customModelsDelete } from "../../src/app/api/models/custom/route.js";
import { GET as disabledModelsGet, POST as disabledModelsPost, DELETE as disabledModelsDelete } from "../../src/app/api/models/disabled/route.js";
import { GET as publicModelsGet, POST as publicModelsPost, PUT as publicModelsPut, DELETE as publicModelsDelete } from "../../src/app/api/models/public/route.js";
import { POST as modelTestPost } from "../../src/app/api/models/test/route.js";
import { PUT as modelAliasPut, DELETE as modelAliasDelete } from "../../src/app/api/models/alias/route.js";
import { POST as combosPost } from "../../src/app/api/combos/route.js";
import { GET as comboGet, PUT as comboPut, DELETE as comboDelete } from "../../src/app/api/combos/[id]/route.js";
import { GET as pricingGet, PATCH as pricingPatch, DELETE as pricingDelete } from "../../src/app/api/pricing/route.js";
import { PATCH as settingsPatch } from "../../src/app/api/settings/route.js";
import { GET as settingsDatabaseGet, POST as settingsDatabasePost } from "../../src/app/api/settings/database/route.js";
import { GET as authFilesGet, POST as authFilesPost } from "../../src/app/api/auth-files/route.js";
import { POST as authFilesRefreshCodexPost } from "../../src/app/api/auth-files/refresh-codex/route.js";

import { GET as usageConnectionGet } from "../../src/app/api/usage/[connectionId]/route.js";
import { GET as usageChartGet } from "../../src/app/api/usage/chart/route.js";
import { POST as usageClearPost } from "../../src/app/api/usage/clear/route.js";
import { GET as usageHistoryGet } from "../../src/app/api/usage/history/route.js";
import { GET as usageLogsGet } from "../../src/app/api/usage/logs/route.js";
import { GET as usageProvidersGet } from "../../src/app/api/usage/providers/route.js";
import { GET as usageRequestDetailsGet } from "../../src/app/api/usage/request-details/route.js";
import { GET as usageRequestLogsGet } from "../../src/app/api/usage/request-logs/route.js";
import { GET as usageStatsGet } from "../../src/app/api/usage/stats/route.js";
import { GET as usageStreamGet } from "../../src/app/api/usage/stream/route.js";

import { GET as requireLoginGet } from "../../src/app/api/settings/require-login/route.js";
import { GET as tagsGet } from "../../src/app/api/tags/route.js";
import { POST as localePost } from "../../src/app/api/locale/route.js";
import { GET as modelsGet, PUT as modelsPut } from "../../src/app/api/models/route.js";
import { GET as modelAvailabilityGet, POST as modelAvailabilityPost } from "../../src/app/api/models/availability/route.js";
import { GET as initGet } from "../../src/app/api/init/route.js";
import { GET as oauthGet, POST as oauthPost } from "../../src/app/api/oauth/[provider]/[action]/route.js";
import { POST as kiroImportPost } from "../../src/app/api/oauth/kiro/import/route.js";
import { GET as kiroAutoImportGet } from "../../src/app/api/oauth/kiro/auto-import/route.js";
import { GET as consoleLogsGet, DELETE as consoleLogsDelete } from "../../src/app/api/translator/console-logs/route.js";
import { GET as consoleLogsStreamGet } from "../../src/app/api/translator/console-logs/stream/route.js";

const app = new Hono();
const port = Number(process.env.PORT || process.env.HONO_PORT || 8323);

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "9router-default-secret-change-me");


function decodeJwtExp(token) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1].replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));
    return typeof payload.exp === "number" ? payload.exp : null;
  } catch {
    return null;
  }
}

function isTunnelRequestHono(c, settings) {
  const host = (c.req.header("host") || "").split(":")[0].toLowerCase();
  const tunnelHost = settings.tunnelUrl ? new URL(settings.tunnelUrl).hostname.toLowerCase() : "";
  const tailscaleHost = settings.tailscaleUrl ? new URL(settings.tailscaleUrl).hostname.toLowerCase() : "";
  return (tunnelHost && host === tunnelHost) || (tailscaleHost && host === tailscaleHost);
}


async function nextRouteHandler(c, handler, params = {}) {
  try {
    return await handler(c.req.raw, { params });
  } catch (error) {
    console.error("[hono] next route handler error", error);
    return c.json({ error: { message: error?.message || "Request failed", type: "server_error" } }, 500);
  }
}

async function nextRoutePostHandler(c, handler) {
  try {
    const response = await handler(c.req.raw);
    return response;
  } catch (error) {
    console.error("[hono] next route handler error", error);
    return c.json({ error: { message: error?.message || "Request failed", type: "server_error" } }, 500);
  }
}

function corsOptions(c) {
  return c.body(null, 204, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "*",
  });
}

app.use("*", cors({ origin: "*", allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"], allowHeaders: ["*"] }));

app.get("/health", (c) => c.json({ ok: true, runtime: "hono-bun", port }));
app.get("/api/health", (c) => c.json({ ok: true, runtime: "hono-bun", port }));


app.post("/api/auth/login", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const password = body?.password || "";
    const settings = await getSettings();

    if (isTunnelRequestHono(c, settings) && settings.tunnelDashboardAccess !== true) {
      return c.json({ error: "Dashboard access via tunnel is disabled" }, 403);
    }

    const storedHash = settings.password;
    const isValid = storedHash
      ? await bcrypt.compare(password, storedHash)
      : password === (process.env.INITIAL_PASSWORD || "123456");

    if (!isValid) {
      return c.json({ error: "Invalid password" }, 401);
    }

    const token = await new SignJWT({ authenticated: true })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("24h")
      .sign(JWT_SECRET);

    const forceSecureCookie = process.env.AUTH_COOKIE_SECURE === "true";
    const forwardedProto = c.req.header("x-forwarded-proto");
    const useSecureCookie = forceSecureCookie || forwardedProto === "https";
    setCookie(c, "auth_token", token, {
      httpOnly: true,
      secure: useSecureCookie,
      sameSite: "Lax",
      path: "/",
    });

    return c.json({ success: true });
  } catch (error) {
    console.error("[hono] login error", error);
    return c.json({ error: error?.message || "Login failed" }, 500);
  }
});

app.post("/api/auth/logout", (c) => {
  deleteCookie(c, "auth_token", { path: "/" });
  return c.json({ success: true });
});


app.get("/v1", (c) => c.json({ ok: true, runtime: "hono-bun", endpoints: ["/v1/models"] }));
app.get("/api/v1", (c) => c.json({ ok: true, runtime: "hono-bun", endpoints: ["/api/v1/models"] }));

async function modelsHandler(c) {
  try {
    const data = await buildModelsList(["llm"], { publicOnly: true });
    return c.json({ object: "list", data });
  } catch (error) {
    console.error("[hono] models error", error);
    return c.json({ error: { message: error?.message || "Failed to fetch models", type: "server_error" } }, 500);
  }
}

app.get("/v1/models", modelsHandler);
app.get("/api/v1/models", modelsHandler);

async function providersHandler(c) {
  try {
    const connections = await getProviderConnections();
    let nodeNameMap = {};
    try {
      const nodes = await getProviderNodes();
      for (const node of nodes) {
        if (node.id && node.name) nodeNameMap[node.id] = node.name;
      }
    } catch {}

    const safeConnections = connections.map((conn) => {
      const isCompatible = isOpenAICompatibleProvider(conn.provider) || isAnthropicCompatibleProvider(conn.provider);
      const name = isCompatible
        ? (nodeNameMap[conn.provider] || conn.providerSpecificData?.nodeName || conn.provider)
        : conn.name;
      const jwtExp = decodeJwtExp(conn.accessToken);
      const jwtExpiresAt = jwtExp ? new Date(jwtExp * 1000).toISOString() : null;
      const storedExpiresAt = conn.expiresAt || conn.tokenExpiresAt || null;
      const effectiveExpiresAt = jwtExpiresAt || storedExpiresAt;
      const expiresMs = effectiveExpiresAt ? new Date(effectiveExpiresAt).getTime() : null;
      return {
        ...conn,
        name,
        hasRefreshToken: !!conn.refreshToken,
        accessTokenExpiresAt: effectiveExpiresAt,
        accessTokenExpired: typeof expiresMs === "number" && Number.isFinite(expiresMs) ? expiresMs <= Date.now() : false,
        apiKey: undefined,
        accessToken: undefined,
        refreshToken: undefined,
        idToken: undefined,
      };
    });

    return c.json({ connections: safeConnections });
  } catch (error) {
    console.error("[hono] providers error", error);
    return c.json({ error: "Failed to fetch providers" }, 500);
  }
}

app.get("/api/providers", providersHandler);
app.get("/api/providers/client", providersHandler);

app.get("/api/auth-files", (c) => nextRouteHandler(c, authFilesGet));
app.post("/api/auth-files", (c) => nextRoutePostHandler(c, authFilesPost));
app.post("/api/auth-files/refresh-codex", (c) => nextRoutePostHandler(c, authFilesRefreshCodexPost));

app.get("/api/translator/console-logs", (c) => nextRouteHandler(c, consoleLogsGet));
app.delete("/api/translator/console-logs", (c) => nextRouteHandler(c, consoleLogsDelete));
app.get("/api/translator/console-logs/stream", (c) => nextRouteHandler(c, consoleLogsStreamGet));

app.options("/v1/chat/completions", corsOptions);
app.options("/api/v1/chat/completions", corsOptions);
app.post("/v1/chat/completions", (c) => nextRoutePostHandler(c, chatCompletionsPost));
app.post("/api/v1/chat/completions", (c) => nextRoutePostHandler(c, chatCompletionsPost));

app.options("/v1/responses", corsOptions);
app.options("/api/v1/responses", corsOptions);
app.post("/v1/responses", (c) => nextRoutePostHandler(c, responsesPost));
app.post("/api/v1/responses", (c) => nextRoutePostHandler(c, responsesPost));

app.options("/v1/messages", corsOptions);
app.options("/api/v1/messages", corsOptions);
app.post("/v1/messages", (c) => nextRoutePostHandler(c, messagesPost));
app.post("/api/v1/messages", (c) => nextRoutePostHandler(c, messagesPost));

app.options("/v1/embeddings", corsOptions);
app.options("/api/v1/embeddings", corsOptions);
app.post("/v1/embeddings", (c) => nextRoutePostHandler(c, embeddingsPost));
app.post("/api/v1/embeddings", (c) => nextRoutePostHandler(c, embeddingsPost));

app.get("/api/settings", async (c) => {
  try {
    const settings = await getSettings();
    const { password, ...safeSettings } = settings;
    return c.json({
      ...safeSettings,
      enableRequestLogs: process.env.ENABLE_REQUEST_LOGS === "true",
      enableTranslator: process.env.ENABLE_TRANSLATOR === "true",
      hasPassword: !!password,
    }, 200, { "Cache-Control": "no-store" });
  } catch (error) {
    console.error("[hono] settings error", error);
    return c.json({ error: error?.message || "Failed to fetch settings" }, 500);
  }
});

app.get("/api/combos", async (c) => {
  try {
    const combos = await getCombos();
    return c.json({ combos });
  } catch (error) {
    console.error("[hono] combos error", error);
    return c.json({ error: "Failed to fetch combos" }, 500);
  }
});

app.get("/api/provider-nodes", async (c) => {
  try {
    const nodes = await getProviderNodes();
    return c.json({ nodes });
  } catch (error) {
    console.error("[hono] provider nodes error", error);
    return c.json({ error: "Failed to fetch provider nodes" }, 500);
  }
});




// Optional Vercel-dashboard support endpoints
app.post("/api/auth/login", async (c) => {
  try {
    const { password } = await c.req.json();
    const settings = await getSettings();
    if (isTunnelRequestHono(c, settings) && settings.tunnelDashboardAccess !== true) {
      return c.json({ error: "Dashboard access via tunnel is disabled" }, 403);
    }
    const storedHash = settings.password;
    const isValid = storedHash
      ? await bcrypt.compare(password || "", storedHash)
      : password === (process.env.INITIAL_PASSWORD || "123456");
    if (!isValid) return c.json({ error: "Invalid password" }, 401);
    const token = await new SignJWT({ authenticated: true })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("24h")
      .sign(JWT_SECRET);
    const secure = process.env.AUTH_COOKIE_SECURE === "true" || c.req.header("x-forwarded-proto") === "https";
    setCookie(c, "auth_token", token, { httpOnly: true, secure, sameSite: "Lax", path: "/" });
    return c.json({ success: true });
  } catch (error) {
    return c.json({ error: error?.message || "Login failed" }, 500);
  }
});
app.post("/api/auth/logout", (c) => {
  deleteCookie(c, "auth_token", { path: "/" });
  return c.json({ success: true });
});
app.get("/api/settings/require-login", (c) => nextRouteHandler(c, requireLoginGet));
app.get("/api/tags", (c) => nextRouteHandler(c, tagsGet));
app.post("/api/locale", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const locale = body?.locale;
    const supported = new Set(["en", "zh-CN", "zh-TW", "ja", "ko", "fr", "de", "es", "ru", "pt", "it", "id"]);
    if (!locale || !supported.has(locale)) {
      return c.json({ error: "Invalid locale" }, 400);
    }
    setCookie(c, "NEXT_LOCALE", locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "Lax",
    });
    return c.json({ success: true, locale });
  } catch (error) {
    console.error("[hono] locale error", error);
    return c.json({ error: "Failed to set locale" }, 500);
  }
});
app.get("/api/models", (c) => nextRouteHandler(c, modelsGet));
app.put("/api/models", (c) => nextRouteHandler(c, modelsPut));
app.get("/api/models/availability", (c) => nextRouteHandler(c, modelAvailabilityGet));
app.post("/api/models/availability", (c) => nextRouteHandler(c, modelAvailabilityPost));
app.get("/api/init", (c) => nextRouteHandler(c, initGet));

// OAuth endpoints (needed when Next/Vercel UI proxies dashboard API calls to Hono)
// Specific Kiro import routes must be mounted before the dynamic provider/action route.
app.get("/api/oauth/kiro/auto-import", (c) => nextRouteHandler(c, kiroAutoImportGet));
app.post("/api/oauth/kiro/import", (c) => nextRouteHandler(c, kiroImportPost));
app.get("/api/oauth/:provider/:action", (c) => nextRouteHandler(c, oauthGet, {
  provider: c.req.param("provider"),
  action: c.req.param("action"),
}));
app.post("/api/oauth/:provider/:action", (c) => nextRouteHandler(c, oauthPost, {
  provider: c.req.param("provider"),
  action: c.req.param("action"),
}));

// P2 usage/observability endpoints
app.get("/api/usage/chart", (c) => nextRouteHandler(c, usageChartGet));
app.post("/api/usage/clear", (c) => nextRouteHandler(c, usageClearPost));
app.get("/api/usage/history", (c) => nextRouteHandler(c, usageHistoryGet));
app.get("/api/usage/logs", (c) => nextRouteHandler(c, usageLogsGet));
app.get("/api/usage/providers", (c) => nextRouteHandler(c, usageProvidersGet));
app.get("/api/usage/request-details", (c) => nextRouteHandler(c, usageRequestDetailsGet));
app.get("/api/usage/request-logs", (c) => nextRouteHandler(c, usageRequestLogsGet));
app.get("/api/usage/stats", (c) => nextRouteHandler(c, usageStatsGet));
app.get("/api/usage/stream", (c) => nextRouteHandler(c, usageStreamGet));
app.get("/api/usage/:connectionId", (c) => nextRouteHandler(c, usageConnectionGet, { connectionId: c.req.param("connectionId") }));

// P1 dashboard config CRUD migrated through Hono (reusing existing route handlers)
app.get("/api/keys", (c) => nextRouteHandler(c, keysGet));
app.post("/api/keys", (c) => nextRouteHandler(c, keysPost));
app.get("/api/keys/available-models", (c) => nextRouteHandler(c, availableModelsGet));
app.get("/api/keys/:id", (c) => nextRouteHandler(c, keyGet, { id: c.req.param("id") }));
app.put("/api/keys/:id", (c) => nextRouteHandler(c, keyPut, { id: c.req.param("id") }));
app.delete("/api/keys/:id", (c) => nextRouteHandler(c, keyDelete, { id: c.req.param("id") }));

app.patch("/api/settings", (c) => nextRouteHandler(c, settingsPatch));
app.get("/api/settings/database", (c) => nextRouteHandler(c, settingsDatabaseGet));
app.post("/api/settings/database", (c) => nextRouteHandler(c, settingsDatabasePost));

app.post("/api/providers", (c) => nextRouteHandler(c, providersPost));
app.get("/api/providers/mimo-usage", (c) => nextRouteHandler(c, mimoUsageGet));
app.get("/api/providers/suggested-models", (c) => nextRouteHandler(c, suggestedModelsGet));
app.get("/api/providers/:id", (c) => nextRouteHandler(c, providerGet, { id: c.req.param("id") }));
app.put("/api/providers/:id", (c) => nextRouteHandler(c, providerPut, { id: c.req.param("id") }));
app.delete("/api/providers/:id", (c) => nextRouteHandler(c, providerDelete, { id: c.req.param("id") }));
app.post("/api/providers/validate", (c) => nextRouteHandler(c, providerValidatePost));
app.post("/api/providers/:id/refresh-token", (c) => nextRouteHandler(c, providerRefreshTokenPost, { id: c.req.param("id") }));
app.get("/api/providers/:id/models", (c) => nextRouteHandler(c, providerModelsGet, { id: c.req.param("id") }));
app.post("/api/providers/:id/test", (c) => nextRouteHandler(c, providerTestPost, { id: c.req.param("id") }));
app.post("/api/providers/:id/test-model", (c) => nextRouteHandler(c, providerTestModelPost, { id: c.req.param("id") }));
app.post("/api/providers/:id/test-models", (c) => nextRouteHandler(c, providerTestModelsPost, { id: c.req.param("id") }));

app.post("/api/provider-nodes", (c) => nextRouteHandler(c, providerNodesPost));
app.put("/api/provider-nodes/:id", (c) => nextRouteHandler(c, providerNodePut, { id: c.req.param("id") }));
app.delete("/api/provider-nodes/:id", (c) => nextRouteHandler(c, providerNodeDelete, { id: c.req.param("id") }));
app.post("/api/provider-nodes/validate", (c) => nextRouteHandler(c, providerNodeValidatePost));

app.get("/api/models/custom", (c) => nextRouteHandler(c, customModelsGet));
app.post("/api/models/custom", (c) => nextRouteHandler(c, customModelsPost));
app.delete("/api/models/custom", (c) => nextRouteHandler(c, customModelsDelete));
app.get("/api/models/disabled", (c) => nextRouteHandler(c, disabledModelsGet));
app.post("/api/models/disabled", (c) => nextRouteHandler(c, disabledModelsPost));
app.delete("/api/models/disabled", (c) => nextRouteHandler(c, disabledModelsDelete));
app.get("/api/models/public", (c) => nextRouteHandler(c, publicModelsGet));
app.post("/api/models/public", (c) => nextRouteHandler(c, publicModelsPost));
app.put("/api/models/public", (c) => nextRouteHandler(c, publicModelsPut));
app.delete("/api/models/public", (c) => nextRouteHandler(c, publicModelsDelete));
app.post("/api/models/test", (c) => nextRouteHandler(c, modelTestPost));
app.put("/api/models/alias", (c) => nextRouteHandler(c, modelAliasPut));
app.delete("/api/models/alias", (c) => nextRouteHandler(c, modelAliasDelete));

app.post("/api/combos", (c) => nextRouteHandler(c, combosPost));
app.get("/api/combos/:id", (c) => nextRouteHandler(c, comboGet, { id: c.req.param("id") }));
app.put("/api/combos/:id", (c) => nextRouteHandler(c, comboPut, { id: c.req.param("id") }));
app.delete("/api/combos/:id", (c) => nextRouteHandler(c, comboDelete, { id: c.req.param("id") }));

app.get("/api/pricing", (c) => nextRouteHandler(c, pricingGet));
app.patch("/api/pricing", (c) => nextRouteHandler(c, pricingPatch));
app.delete("/api/pricing", (c) => nextRouteHandler(c, pricingDelete));

app.get("/api/models/alias", async (c) => {
  try {
    const aliases = await getModelAliases();
    return c.json({ aliases });
  } catch (error) {
    console.error("[hono] model aliases error", error);
    return c.json({ error: "Failed to fetch aliases" }, 500);
  }
});

app.notFound((c) => c.json({ error: "Not found", runtime: "hono-bun" }, 404));

console.log(`[hono-gateway] listening on http://0.0.0.0:${port}`);
serve({ fetch: app.fetch, port, hostname: "0.0.0.0" });
