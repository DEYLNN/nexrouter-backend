import { platform, arch } from "os";

// === OS/Arch helpers ===
function mapStainlessOs() {
  switch (platform()) {
    case "darwin": return "MacOS";
    case "win32": return "Windows";
    case "linux": return "Linux";
    case "freebsd": return "FreeBSD";
    default: return `Other::${platform()}`;
  }
}

function mapStainlessArch() {
  switch (arch()) {
    case "x64": return "x64";
    case "arm64": return "arm64";
    case "ia32": return "x86";
    default: return `other::${arch()}`;
  }
}

// Shared Claude-compatible API headers (reused across claude-format providers)
const CLAUDE_API_HEADERS = {
  "Anthropic-Version": "2023-06-01",
  "Anthropic-Beta": "claude-code-20250219,interleaved-thinking-2025-05-14"
};

// Shared baseUrls
const KIMI_CODING_BASE_URL = "https://api.kimi.com/coding/v1/messages";

const GOOGLE_OAUTH_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || "GOOGLE_CLIENT_ID_REPLACE_WITH_ENV";
const GOOGLE_OAUTH_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || "GOCSPX_REPLACE_WITH_ENV_SECRET";

export const PROVIDERS = {
  claude: {
    baseUrl: "https://api.anthropic.com/v1/messages",
    format: "claude",
    headers: {
      "Anthropic-Version": "2023-06-01",
      "Anthropic-Beta": "claude-code-20250219,oauth-2025-04-20,interleaved-thinking-2025-05-14,context-management-2025-06-27,prompt-caching-scope-2026-01-05,advanced-tool-use-2025-11-20,effort-2025-11-24,structured-outputs-2025-12-15,fast-mode-2026-02-01,redact-thinking-2026-02-12,token-efficient-tools-2026-03-28",
      "Anthropic-Dangerous-Direct-Browser-Access": "true",
      "User-Agent": "claude-cli/2.1.92 (external, sdk-cli)",
      "X-App": "cli",
      "X-Stainless-Helper-Method": "stream",
      "X-Stainless-Retry-Count": "0",
      "X-Stainless-Runtime-Version": "v24.14.0",
      "X-Stainless-Package-Version": "0.80.0",
      "X-Stainless-Runtime": "node",
      "X-Stainless-Lang": "js",
      "X-Stainless-Arch": mapStainlessArch(),
      "X-Stainless-Os": mapStainlessOs(),
      "X-Stainless-Timeout": "600"
    },
    clientId: "9d1c250a-e61b-44d9-88ed-5944d1962f5e",
    tokenUrl: "https://api.anthropic.com/v1/oauth/token"
  },
  gemini: {
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/models",
    format: "gemini",
    clientId: GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: GOOGLE_OAUTH_CLIENT_SECRET
  },
  "gemini-cli": {
    baseUrl: "https://cloudcode-pa.googleapis.com/v1internal",
    format: "gemini-cli",
    clientId: GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: GOOGLE_OAUTH_CLIENT_SECRET
  },
  codex: {
    baseUrl: "https://chatgpt.com/backend-api/codex/responses",
    format: "openai-responses",
    headers: {
      "originator": "codex-cli",
      "User-Agent": "codex-cli/1.0.18 (macOS; arm64)"
    },
    clientId: "app_EMoamEEZ73f0CkXaXp7hrann",
    tokenUrl: "https://auth.openai.com/oauth/token"
  },
  "nous-portal": {
    baseUrl: "https://inference-api.nousresearch.com/v1/chat/completions",
    format: "openai",
    headers: { "User-Agent": "HermesAgent/0.10.0 (hermes-agent; Node.js)" },
    clientId: "hermes-cli",
    tokenUrl: "https://portal.nousresearch.com/api/oauth/token"
  },
  qwen: {
    baseUrl: "https://portal.qwen.ai/v1/chat/completions",
    format: "openai",
    clientId: "f0304373b74a44d2b584a3fb70ca9e56",
    tokenUrl: "https://chat.qwen.ai/api/v1/oauth2/token",
    authUrl: "https://chat.qwen.ai/api/v1/oauth2/device/code"
  },
  iflow: {
    baseUrl: "https://apis.iflow.cn/v1/chat/completions",
    format: "openai",
    headers: { "User-Agent": "iFlow-Cli" },
    clientId: "10009311001",
    clientSecret: "4Z3YjXycVsQvyGF1etiNlIBB4RsqSDtW",
    tokenUrl: "https://iflow.cn/oauth/token",
    authUrl: "https://iflow.cn/oauth"
  },
  qoder: {
    baseUrl: "https://api3.qoder.sh/algo/api/v2/service/pro/sse/agent_chat_generation",
    format: "openai",
    headers: {},
  },
  "general-compute": {
    baseUrl: "https://api.generalcompute.com/dashboard/playground/chat/completions",
    format: "openai",
    headers: {
      "Accept": "text/event-stream",
      "Origin": "https://app.generalcompute.com",
      "Referer": "https://app.generalcompute.com/",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36"
    },
  },
  antigravity: {
    baseUrls: [
      "https://daily-cloudcode-pa.googleapis.com",
      "https://daily-cloudcode-pa.sandbox.googleapis.com",
    ],
    format: "antigravity",
    headers: { "User-Agent": `antigravity/1.107.0 ${platform()}/${arch()}` },
    clientId: process.env.ANTIGRAVITY_OAUTH_CLIENT_ID || GOOGLE_OAUTH_CLIENT_ID,
    clientSecret: process.env.ANTIGRAVITY_OAUTH_CLIENT_SECRET || GOOGLE_OAUTH_CLIENT_SECRET
  },
  canopywave: {
    baseUrl: "https://inference.canopywave.io/v1/chat/completions",
    format: "openai"
  },
  openmodal: {
    baseUrl: "https://api.openmodel.ai/v1/messages",
    format: "claude",
    headers: { ...CLAUDE_API_HEADERS }
  },
  om: {
    baseUrl: "https://api.openmodel.ai/v1/messages",
    format: "claude",
    headers: { ...CLAUDE_API_HEADERS }
  },
  ftstoresz: {
    baseUrl: "https://api-ai.ftstoresz.com/v1/chat/completions",
    format: "openai"
  },
  "badtheory-labs": {
    baseUrl: "https://api.badtheorylabs.com/v1/chat/completions",
    format: "openai"
  },
  btl: {
    baseUrl: "https://api.badtheorylabs.com/v1/chat/completions",
    format: "openai"
  },
  zyloo: {
    baseUrl: "https://api.zyloo.io/v1/chat/completions",
    format: "openai"
  },
  swiftrouter: {
    baseUrl: "https://api.swiftrouter.com/v1/chat/completions",
    format: "openai"
  },
  gmi: {
    baseUrl: "https://api.gmi-serving.com/v1/chat/completions",
    format: "openai"
  },
  "gmi-cloud": {
    baseUrl: "https://api.gmi-serving.com/v1/chat/completions",
    format: "openai"
  },
  husada: {
    baseUrl: "https://husada.net/v1/chat/completions",
    format: "openai",
    headers: {}
  },
  zenmux: {
    baseUrl: "https://zenmux.ai/api/v1/chat/completions",
    format: "openai"
  },
  ocenza: {
    baseUrl: "https://ocenza.com/v1/chat/completions",
    format: "openai"
  },
  anuma: {
    baseUrl: "https://portal.anuma.ai/api/v1/chat/completions",
    format: "openai"
  },
  routeway: {
    baseUrl: "https://api.routeway.ai/v1/chat/completions",
    format: "openai"
  },
  am: {
    baseUrl: "https://aimux.id/v1/chat/completions",
    format: "openai"
  },
  aimux: {
    baseUrl: "https://aimux.id/v1/chat/completions",
    format: "openai"
  },
  openrouter: {
    baseUrl: "https://openrouter.ai/api/v1/chat/completions",
    format: "openai",
    headers: {
      "HTTP-Referer": "https://endpoint-proxy.local",
      "X-Title": "Endpoint Proxy"
    }
  },
  fmd: {
    baseUrl: "https://api.freemodel.dev/v1/chat/completions",
    format: "openai"
  },
  "freemodel-dev": {
    baseUrl: "https://api.freemodel.dev/v1/chat/completions",
    format: "openai"
  },
  freebuff: {
    baseUrl: "https://www.codebuff.com/api/v1/chat/completions",
    format: "openai",
    noAuth: true
  },
  fb: {
    baseUrl: "https://www.codebuff.com/api/v1/chat/completions",
    format: "openai",
    noAuth: true
  },
  "mimo-free": {
    baseUrl: "https://api.xiaomimimo.com/api/free-ai/openai/chat",
    format: "openai",
    noAuth: true
  },
  mmf: {
    baseUrl: "https://api.xiaomimimo.com/api/free-ai/openai/chat",
    format: "openai",
    noAuth: true
  },
  kimchi: {
    baseUrl: "https://llm.kimchi.dev/openai/v1/chat/completions",
    format: "openai"
  },
  bai: {
    baseUrl: "https://api.b.ai/v1/chat/completions",
    format: "openai"
  },
  tokenrouter: {
    baseUrl: "https://api.tokenrouter.com/v1/chat/completions",
    format: "openai"
  },
  zerog: {
    baseUrl: "https://router-api.0g.ai/v1/chat/completions",
    format: "openai"
  },
  "0g": {
    baseUrl: "https://router-api.0g.ai/v1/chat/completions",
    format: "openai"
  },
  tr: {
    baseUrl: "https://api.tokenrouter.com/v1/chat/completions",
    format: "openai"
  },
  qiniu: {
    baseUrl: "https://api.qnaigc.com/v1/chat/completions",
    format: "openai"
  },
  morph: {
    baseUrl: "https://api.morphllm.com/v1/chat/completions",
    format: "openai"
  },
  openai: {
    baseUrl: "https://api.openai.com/v1/chat/completions",
    format: "openai"
  },
  glm: {
    baseUrl: "https://api.z.ai/api/anthropic/v1/messages",
    format: "claude",
    headers: { ...CLAUDE_API_HEADERS }
  },
  "glm-cn": {
    baseUrl: "https://open.bigmodel.cn/api/coding/paas/v4/chat/completions",
    format: "openai",
    headers: {}
  },
  kimi: {
    baseUrl: KIMI_CODING_BASE_URL,
    format: "claude",
    headers: { ...CLAUDE_API_HEADERS }
  },
  minimax: {
    baseUrl: "https://api.minimax.io/anthropic/v1/messages",
    format: "claude",
    headers: { ...CLAUDE_API_HEADERS }
  },
  "minimax-cn": {
    baseUrl: "https://api.minimaxi.com/anthropic/v1/messages",
    format: "claude",
    headers: { ...CLAUDE_API_HEADERS }
  },
  alicode: {
    baseUrl: "https://coding.dashscope.aliyuncs.com/v1/chat/completions",
    format: "openai",
    headers: {}
  },
  "alicode-intl": {
    baseUrl: "https://coding-intl.dashscope.aliyuncs.com/v1/chat/completions",
    format: "openai",
    headers: {}
  },
  "alibaba-studio": {
    baseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions",
    format: "openai",
    headers: {}
  },
  "volcengine-ark": {
    baseUrl: "https://ark.cn-beijing.volces.com/api/coding/v3/chat/completions",
    format: "openai",
    headers: {}
  },
  byteplus: {
    baseUrl: "https://ark.ap-southeast.bytepluses.com/api/coding/v3/chat/completions",
    format: "openai",
    headers: {}
  },
  github: {
    baseUrl: "https://api.githubcopilot.com/chat/completions",
    responsesUrl: "https://api.githubcopilot.com/responses",
    format: "openai",
    headers: {
      "copilot-integration-id": "vscode-chat",
      "editor-version": "vscode/1.110.0",
      "editor-plugin-version": "copilot-chat/0.38.0",
      "user-agent": "GitHubCopilotChat/0.38.0",
      "openai-intent": "conversation-panel",
      "x-github-api-version": "2025-04-01",
      "x-vscode-user-agent-library-version": "electron-fetch",
      "X-Initiator": "user",
      "Accept": "application/json",
      "Content-Type": "application/json"
    },
    clientId: "Iv1.b507a08c87ecfe98"
  },
  kiro: {
    baseUrl: "https://codewhisperer.us-east-1.amazonaws.com/generateAssistantResponse",
    format: "kiro",
    retry: { 429: 2 },
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/vnd.amazon.eventstream",
      "X-Amz-Target": "AmazonCodeWhispererStreamingService.GenerateAssistantResponse",
      "User-Agent": "AWS-SDK-JS/3.0.0 kiro-ide/1.0.0",
      "X-Amz-User-Agent": "aws-sdk-js/3.0.0 kiro-ide/1.0.0"
    },
    tokenUrl: "https://prod.us-east-1.auth.desktop.kiro.dev/refreshToken",
    authUrl: "https://prod.us-east-1.auth.desktop.kiro.dev"
  },
  cursor: {
    baseUrl: "https://api2.cursor.sh",
    chatPath: "/aiserver.v1.ChatService/StreamUnifiedChatWithTools",
    format: "cursor",
    headers: {
      "connect-accept-encoding": "gzip",
      "connect-protocol-version": "1",
      "Content-Type": "application/connect+proto",
      "User-Agent": "connect-es/1.6.1"
    },
    clientVersion: "3.1.0"
  },
  "kimi-coding": {
    baseUrl: KIMI_CODING_BASE_URL,
    format: "claude",
    headers: { ...CLAUDE_API_HEADERS },
    clientId: "17e5f671-d194-4dfb-9706-5516cb48c098",
    tokenUrl: "https://auth.kimi.com/api/oauth/token",
    refreshUrl: "https://auth.kimi.com/api/oauth/token"
  },
  kilocode: {
    baseUrl: "https://api.kilo.ai/api/openrouter/chat/completions",
    format: "openai",
    headers: {}
  },
  opencode: {
    baseUrl: "http://localhost:4096/v1/chat/completions",
    format: "openai",
    headers: {}
  },
  cline: {
    baseUrl: "https://api.cline.bot/api/v1/chat/completions",
    format: "openai",
    headers: {
      "HTTP-Referer": "https://cline.bot",
      "X-Title": "Cline"
    },
    tokenUrl: "https://api.cline.bot/api/v1/auth/token",
    refreshUrl: "https://api.cline.bot/api/v1/auth/refresh"
  },
  "cline-apikey": {
    baseUrl: "https://api.cline.bot/api/v1/chat/completions",
    format: "openai",
    headers: {
      "HTTP-Referer": "https://cline.bot",
      "X-Title": "Cline"
    }
  },
  nvidia: {
    baseUrl: "https://integrate.api.nvidia.com/v1/chat/completions",
    format: "openai"
  },
  anthropic: {
    baseUrl: "https://api.anthropic.com/v1/messages",
    format: "claude",
    headers: { ...CLAUDE_API_HEADERS }
  },
  deepseek: {
    baseUrl: "https://api.deepseek.com/chat/completions",
    format: "openai"
  },
  commandcode: {
    baseUrl: "https://api.commandcode.ai/alpha/generate",
    format: "commandcode",
    headers: {
      "x-command-code-version": "0.25.7",
      "x-cli-environment": "cli"
    }
  },
  groq: {
    baseUrl: "https://api.groq.com/openai/v1/chat/completions",
    format: "openai"
  },
  sambanova: {
    baseUrl: "https://api.sambanova.ai/v1/chat/completions",
    format: "openai"
  },
  xai: {
    baseUrl: "https://api.x.ai/v1/chat/completions",
    format: "openai"
  },
  "xai-apikey": {
    baseUrl: "https://api.x.ai/v1/chat/completions",
    format: "openai"
  },
  mistral: {
    baseUrl: "https://api.mistral.ai/v1/chat/completions",
    format: "openai"
  },
  pollinations: {
    baseUrl: "https://text.pollinations.ai/openai/v1/chat/completions",
    format: "openai",
    noAuth: true
  },
  llm7: {
    baseUrl: "https://api.llm7.io/v1/chat/completions",
    format: "openai"
  },
  perplexity: {
    baseUrl: "https://api.perplexity.ai/chat/completions",
    format: "openai"
  },
  together: {
    baseUrl: "https://api.together.xyz/v1/chat/completions",
    format: "openai"
  },
  fireworks: {
    baseUrl: "https://api.fireworks.ai/inference/v1/chat/completions",
    format: "openai"
  },
  cerebras: {
    baseUrl: "https://api.cerebras.ai/v1/chat/completions",
    format: "openai"
  },
  cohere: {
    baseUrl: "https://api.cohere.ai/v1/chat/completions",
    format: "openai"
  },
  nebius: {
    baseUrl: "https://api.studio.nebius.ai/v1/chat/completions",
    format: "openai"
  },
  siliconflow: {
    baseUrl: "https://api.siliconflow.cn/v1/chat/completions",
    format: "openai"
  },
  hyperbolic: {
    baseUrl: "https://api.hyperbolic.xyz/v1/chat/completions",
    format: "openai"
  },
  deepgram: {
    baseUrl: "https://api.deepgram.com/v1/listen",
    format: "openai"
  },
  assemblyai: {
    baseUrl: "https://api.assemblyai.com/v1/audio/transcriptions",
    format: "openai"
  },
  nanobanana: {
    baseUrl: "https://api.nanobananaapi.ai/v1/chat/completions",
    format: "openai"
  },
  chutes: {
    baseUrl: "https://llm.chutes.ai/v1/chat/completions",
    format: "openai"
  },
  ollama: {
    baseUrl: "https://ollama.com/api/chat",
    format: "ollama"
  },
  "ollama-local": {
    baseUrl: "http://localhost:11434/api/chat",
    format: "ollama"
  },
  // Vertex AI - Gemini models via Service Account JSON
  // baseUrl is not used; VertexExecutor.buildUrl() constructs it dynamically
  vertex: {
    baseUrl: "https://aiplatform.googleapis.com",
    format: "vertex"
  },
  // Vertex AI - Partner models (Claude, Llama, Mistral, GLM) via SA JSON
  // Uses OpenAI-compatible global endpoint (or rawPredict for Anthropic)
  "vertex-partner": {
    baseUrl: "https://aiplatform.googleapis.com",
    format: "openai"
  },
  // GitLab Duo - OpenAI-compatible chat endpoint
  gitlab: {
    baseUrl: "https://gitlab.com/api/v4/chat/completions",
    format: "openai",
  },
  // CodeBuddy (Tencent) - uses device_code polling auth, no chat completions baseUrl needed
  codebuddy: {
    baseUrl: "https://copilot.tencent.com/v1/chat/completions",
    format: "openai",
  },
  opencode: {
    baseUrl: "https://opencode.ai",
    format: "openai",
    headers: { "x-opencode-client": "desktop" },
    noAuth: true
  },
  glb: {
    baseUrl: "https://opengateway.gitlawb.com/v1/chat/completions",
    format: "openai",
    headers: { "Accept-Encoding": "identity" }
  },
  gitlawb: {
    baseUrl: "https://opengateway.gitlawb.com/v1/chat/completions",
    format: "openai",
    headers: { "Accept-Encoding": "identity" }
  },
  "gitlawb-mimo": {
    baseUrl: "https://opengateway.gitlawb.com/v1/xiaomi-mimo/chat/completions",
    format: "openai",
    headers: { "Accept-Encoding": "identity" }
  },
  "opencode-go": {
    baseUrl: "https://opencode.ai/zen/go/v1/chat/completions",
    format: "openai",
    headers: {}
  },
  "grok-web": {
    baseUrl: "https://grok.com/rest/app-chat/conversations/new",
    format: "grok-web",
    authType: "cookie"
  },
  "perplexity-web": {
    baseUrl: "https://www.perplexity.ai/rest/sse/perplexity_ask",
    format: "perplexity-web",
    authType: "cookie"
  },
  azure: {
    baseUrl: "",
    format: "openai",
    headers: {}
  },
  // Cloudflare Workers AI - {accountId} resolved from credentials.providerSpecificData.accountId
  "cloudflare-ai": {
    baseUrl: "https://api.cloudflare.com/client/v4/accounts/{accountId}/ai/v1/chat/completions",
    format: "openai"
  },
  "xiaomi-mimo": {
    baseUrl: "https://api.xiaomimimo.com/v1/chat/completions",
    format: "openai"
  },
  ambient: {
    baseUrl: "https://api.ambient.xyz/v1/chat/completions",
    format: "openai"
  },
  "xiaomi-mimo-plan-sgp": {
    baseUrl: "https://token-plan-sgp.xiaomimimo.com/v1/chat/completions",
    format: "openai"
  },
};

export const OLLAMA_LOCAL_DEFAULT_HOST = "http://localhost:11434";

export function resolveOllamaLocalHost(credentials) {
  const raw = credentials?.providerSpecificData?.baseUrl?.trim();
  return (raw || OLLAMA_LOCAL_DEFAULT_HOST).replace(/\/$/, "");
}
