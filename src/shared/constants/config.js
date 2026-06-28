import pkg from "../../../package.json" with { type: "json" };

// App configuration
export const APP_CONFIG = {
  name: "NexRouter Proxy",
  description: "AI Infrastructure Management",
  version: pkg.version,
};

// GitHub configuration
export const GITHUB_CONFIG = {
  changelogUrl: "https://raw.githubusercontent.com/decolua/9router/refs/heads/master/CHANGELOG.md",
};

// Updater configuration
export const UPDATER_CONFIG = {
  npmPackageName: "9router",
  installCmd: "npm i -g 9router",
  installCmdLatest: "npm i -g 9router@latest --prefer-online",
  shutdownCountdownSec: 3,
  exitDelayMs: 500,
  statusPort: 20129,
  statusPollIntervalMs: 1000,
  statusLogTailLines: 8,
  installRetries: 3,
  installRetryDelayMs: 5000,
  lingerAfterDoneMs: 30000,
  waitForExitMinMs: 5000,
  waitForExitMaxMs: 20000,
  waitForExitCheckMs: 500,
  appPort: 20128,
};

// Theme configuration
export const THEME_CONFIG = {
  storageKey: "theme",
  defaultTheme: "system", // "light" | "dark" | "system"
};

// Subscription
export const SUBSCRIPTION_CONFIG = {
  price: 1.0,
  currency: "USD",
  interval: "month",
  planName: "Pro Plan",
};

// API endpoints
export const API_ENDPOINTS = {
  users: "/api/users",
  providers: "/api/providers",
  payments: "/api/payments",
  auth: "/api/auth",
};

export const CONSOLE_LOG_CONFIG = {
  // Runtime console buffer shown in Console Log page.
  // Keeps UI/SSE light; PM2 file logs are rotated separately.
  maxLines: Number(process.env.CONSOLE_LOG_MAX_LINES || 1000),
  initialLines: Number(process.env.CONSOLE_LOG_INITIAL_LINES || 1000),
  usageInitialLines: Number(process.env.CONSOLE_USAGE_INITIAL_LINES || 120),
  pollIntervalMs: 1000,
};

// Client-side store TTL: how long fetched data stays fresh before re-fetching
export const CLIENT_STORE_TTL_MS = 60000;

// Provider API endpoints (for display only)
export const PROVIDER_ENDPOINTS = {
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  "freemodel-dev": "https://api.freemodel.dev/v1/chat/completions",
  fmd: "https://api.freemodel.dev/v1/chat/completions",
  am: "https://aimux.id/v1/chat/completions",
  aimux: "https://aimux.id/v1/chat/completions",
  bai: "https://api.b.ai/v1/chat/completions",
  openmodal: "https://api.openmodel.ai/v1/messages",
  om: "https://api.openmodel.ai/v1/messages",
  tokenrouter: "https://api.tokenrouter.com/v1/chat/completions",
  zerog: "https://router-api.0g.ai/v1/chat/completions",
  "0g": "https://router-api.0g.ai/v1/chat/completions",
  zyloo: "https://api.zyloo.io/v1/chat/completions",
  longcat: "https://api.longcat.chat/openai/v1/chat/completions",
  "naraya-ai": "https://router.bynara.id/v1/chat/completions",
  tr: "https://api.tokenrouter.com/v1/chat/completions",
  qiniu: "https://api.qnaigc.com/v1/chat/completions",
  morph: "https://api.morphllm.com/v1/chat/completions",
  gmi: "https://api.gmi-serving.com/v1/chat/completions",
  husada: "https://husada.net/v1/chat/completions",
  zenmux: "https://zenmux.ai/api/v1/chat/completions",
  ocenza: "https://ocenza.com/v1/chat/completions",
  vikey: "https://api.vikey.ai/v1/chat/completions",
  "babel-town": "https://api.babel.town/v1/chat/completions",
  bt: "https://api.babel.town/v1/chat/completions",
  "qwen-cloud": "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
  "gmi-cloud": "https://api.gmi-serving.com/v1/chat/completions",
  gitlawb: "https://opengateway.gitlawb.com/v1/chat/completions",
  glb: "https://opengateway.gitlawb.com/v1/chat/completions",
  "gitlawb-mimo": "https://opengateway.gitlawb.com/v1/xiaomi-mimo/chat/completions",
  "glb-mimo": "https://opengateway.gitlawb.com/v1/xiaomi-mimo/chat/completions",
  "cline-apikey": "https://api.cline.bot/api/v1/chat/completions",
  glm: "https://api.z.ai/api/anthropic/v1/messages",
  "glm-cn": "https://open.bigmodel.cn/api/coding/paas/v4/chat/completions",
  kimi: "https://api.kimi.com/coding/v1/messages",
  minimax: "https://api.minimax.io/anthropic/v1/messages",
  "minimax-cn": "https://api.minimaxi.com/anthropic/v1/messages",
  alicode: "https://coding.dashscope.aliyuncs.com/v1/chat/completions",
  "alicode-intl": "https://coding-intl.dashscope.aliyuncs.com/v1/chat/completions",
  "alibaba-studio": "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
  "volcengine-ark": "https://ark.cn-beijing.volces.com/api/coding/v3/chat/completions",
  byteplus: "https://ark.ap-southeast.bytepluses.com/api/coding/v3/chat/completions",
  openai: "https://api.openai.com/v1/chat/completions",
  anthropic: "https://api.anthropic.com/v1/messages",
  gemini: "https://generativelanguage.googleapis.com/v1beta/models",
  ollama: "https://ollama.com/api/chat",
  "ollama-local": "http://localhost:11434/api/chat",
};

// Re-export from providers.js for backward compatibility
export {
  FREE_PROVIDERS,
  OAUTH_PROVIDERS,
  APIKEY_PROVIDERS,
  WEB_COOKIE_PROVIDERS,
  AI_PROVIDERS,
  AUTH_METHODS,
} from "./providers.js";

// Re-export from models.js for backward compatibility
export {
  PROVIDER_MODELS,
  AI_MODELS,
} from "./models.js";
