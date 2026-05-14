export const CODEX_FREE_BLOCKED_MODELS = new Set();

export function normalizeCodexPlan(plan) {
  const value = String(plan || "").trim().toLowerCase();
  if (!value) return "unknown";
  return value === "free" ? "free" : "paid";
}

export function parseModelList(value) {
  if (Array.isArray(value)) return value.map(String).map(v => v.trim()).filter(Boolean);
  if (typeof value === "string") return value.split(/[\n,]/).map(v => v.trim()).filter(Boolean);
  return [];
}

export function getBlockedCodexModels(connection) {
  const psd = connection?.providerSpecificData || {};
  const customBlocked = parseModelList(psd.blockedModels);
  const plan = normalizeCodexPlan(psd.codexPlan || psd.chatgptPlanType);
  const defaults = plan === "free" ? [...CODEX_FREE_BLOCKED_MODELS] : [];
  return [...new Set([...defaults, ...customBlocked])];
}

export function isCodexConnectionEligibleForModel(connection, model) {
  if (!model || connection?.provider !== "codex") return true;
  return !getBlockedCodexModels(connection).includes(model);
}
