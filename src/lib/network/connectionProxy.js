function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export async function resolveConnectionProxyConfig() {
  return {
    connectionProxyEnabled: false,
    connectionProxyUrl: "",
    connectionNoProxy: "",
    strictProxy: false,
    source: "none",
  };
}

export function buildProxyOptions(config = {}) {
  return {
    proxyUrl: normalizeString(config.proxyUrl),
    noProxy: normalizeString(config.noProxy),
    strictProxy: config.strictProxy === true,
  };
}
