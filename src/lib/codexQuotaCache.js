import { getUsageForProvider } from "open-sse/services/usage.js";

const CACHE_TTL_MS = 60_000;
const cache = new Map();

function isLimitReached(usage) {
  if (!usage || usage.error) return false;
  if (usage.limitReached === true) return true;
  const session = usage.quotas?.session;
  if (session && Number(session.remaining) <= 0) return true;
  return false;
}

export async function isCodexConnectionQuotaAvailable(connection, { force = false } = {}) {
  if (!connection || connection.provider !== "codex" || !connection.accessToken) return true;
  const key = connection.id;
  const cached = cache.get(key);
  if (!force && cached && Date.now() - cached.checkedAt < CACHE_TTL_MS) {
    return cached.available;
  }

  try {
    const usage = await getUsageForProvider(connection, { strictProxy: false });
    const available = !isLimitReached(usage);
    cache.set(key, { checkedAt: Date.now(), available, usage });
    return available;
  } catch {
    // Fail-open: don't block routing if quota API itself fails.
    cache.set(key, { checkedAt: Date.now(), available: true, usage: null });
    return true;
  }
}
