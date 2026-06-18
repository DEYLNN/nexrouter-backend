/**
 * OAuth Configuration Constants
 */
import { platform, arch } from "os";

/**
 * Get the platform enum value based on the current OS.
 * Matches Antigravity binary's ClientMetadata.Platform enum.
 */
function getOAuthPlatformEnum() {
  const os = platform();
  const architecture = arch();
  if (os === "darwin") return architecture === "arm64" ? 2 : 1;
  if (os === "linux") return architecture === "arm64" ? 4 : 3;
  if (os === "win32") return 5;
  return 0;
}

// Claude OAuth Configuration (Authorization Code Flow with PKCE)
export const CLAUDE_CONFIG = {
  clientId: "9d1c250a-e61b-44d9-88ed-5944d1962f5e",
  authorizeUrl: "https://claude.ai/oauth/authorize",
  tokenUrl: "https://api.anthropic.com/v1/oauth/token",
  scopes: ["org:create_api_key", "user:profile", "user:inference"],
  codeChallengeMethod: "S256",
};

// Codex (OpenAI) OAuth Configuration (Authorization Code Flow with PKCE)
export const CODEX_CONFIG = {
  clientId: "app_EMoamEEZ73f0CkXaXp7hrann",
  authorizeUrl: "https://auth.openai.com/oauth/authorize",
  tokenUrl: "https://auth.openai.com/oauth/token",
  scope: "openid profile email offline_access",
  codeChallengeMethod: "S256",
  // Additional OpenAI-specific params
  extraParams: {
    id_token_add_organizations: "true",
    codex_cli_simplified_flow: "true",
    originator: "codex_cli_rs",
  },
};

const GOOGLE_OAUTH_CLIENT_ID = process.env.GOOGLE_OAUTH_CLIENT_ID || process.env.GOOGLE_CLIENT_ID || "GOOGLE_CLIENT_ID_REPLACE_WITH_ENV";
const GOOGLE_OAUTH_CLIENT_SECRET = process.env.GOOGLE_OAUTH_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET || "GOCSPX_REPLACE_WITH_ENV_SECRET";

// Gemini (Google) OAuth Configuration (Standard OAuth2)
export const GEMINI_CONFIG = {
  clientId: GOOGLE_OAUTH_CLIENT_ID,
  clientSecret: GOOGLE_OAUTH_CLIENT_SECRET,
  authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  userInfoUrl: "https://www.googleapis.com/oauth2/v1/userinfo",
  scopes: [
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
  ],
};

// Nous Portal OAuth Configuration (Device Code Flow)
export const NOUS_CONFIG = {
  clientId: process.env.NOUS_CLIENT_ID || "hermes-cli",
  deviceCodeUrl: "https://portal.nousresearch.com/api/oauth/device/code",
  tokenUrl: "https://portal.nousresearch.com/api/oauth/token",
  agentKeyUrl: "https://portal.nousresearch.com/api/oauth/agent-key",
  inferenceBaseUrl: "https://inference-api.nousresearch.com/v1",
  scope: "inference:invoke",
};

// Qwen OAuth Configuration (Device Code Flow with PKCE)
export const QWEN_CONFIG = {
  clientId: "f0304373b74a44d2b584a3fb70ca9e56",
  deviceCodeUrl: "https://chat.qwen.ai/api/v1/oauth2/device/code",
  tokenUrl: "https://chat.qwen.ai/api/v1/oauth2/token",
  scope: "openid profile email model.completion",
  codeChallengeMethod: "S256",
};

// Qoder OAuth Configuration (Device Token Flow)
export const QODER_CONFIG = {
  openApiBaseUrl: "https://openapi.qoder.sh",
  centerBaseUrl: "https://center.qoder.sh",
  chatBaseUrl: "https://api3.qoder.sh",
  deviceTokenUrl: "https://openapi.qoder.sh/api/v1/deviceToken/poll",
  refreshUrl: "https://center.qoder.sh/algo/api/v3/user/refresh_token",
  userInfoUrl: "https://openapi.qoder.sh/api/v1/userinfo",
  quotaUsageUrl: "https://openapi.qoder.sh/api/v2/quota/usage",
  loginUrl: "https://qoder.com/device/selectAccounts",
};

// iFlow OAuth Configuration (Authorization Code)
export const IFLOW_CONFIG = {
  clientId: "10009311001",
  clientSecret: "4Z3YjXycVsQvyGF1etiNlIBB4RsqSDtW",
  authorizeUrl: "https://iflow.cn/oauth",
  tokenUrl: "https://iflow.cn/oauth/token",
  userInfoUrl: "https://iflow.cn/api/oauth/getUserInfo",
  extraParams: {
    loginMethod: "phone",
    type: "phone",
  },
};

// Antigravity OAuth Configuration (Standard OAuth2 with Google)
export const ANTIGRAVITY_CONFIG = {
  clientId: process.env.ANTIGRAVITY_OAUTH_CLIENT_ID || GOOGLE_OAUTH_CLIENT_ID,
  clientSecret: process.env.ANTIGRAVITY_OAUTH_CLIENT_SECRET || GOOGLE_OAUTH_CLIENT_SECRET,
  authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenUrl: "https://oauth2.googleapis.com/token",
  userInfoUrl: "https://www.googleapis.com/oauth2/v1/userinfo",
  scopes: [
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/cclog",
    "https://www.googleapis.com/auth/experimentsandconfigs",
  ],
  // Antigravity specific
  apiEndpoint: "https://cloudcode-pa.googleapis.com",
  apiVersion: "v1internal",
  loadCodeAssistEndpoint: "https://cloudcode-pa.googleapis.com/v1internal:loadCodeAssist",
  onboardUserEndpoint: "https://cloudcode-pa.googleapis.com/v1internal:onboardUser",
  loadCodeAssistUserAgent: "google-api-nodejs-client/9.15.1",
  loadCodeAssistApiClient: "google-cloud-sdk vscode_cloudshelleditor/0.1",
  // String enum matches CLIProxyAPI Go source (internal/auth/antigravity/constants.go)
  loadCodeAssistClientMetadata: JSON.stringify({ ideType: "IDE_UNSPECIFIED", platform: "PLATFORM_UNSPECIFIED", pluginType: "GEMINI" }),
};

/**
 * Get client metadata using numeric enum values for API calls.
 * @returns {{ ideType: number, platform: number, pluginType: number }}
 */
export function getOAuthClientMetadata() {
  return { ideType: 9, platform: getOAuthPlatformEnum(), pluginType: 2 };
}

// OpenAI OAuth Configuration (Authorization Code Flow with PKCE)
export const OPENAI_CONFIG = {
  clientId: "app_EMoamEEZ73f0CkXaXp7hrann",
  authorizeUrl: "https://auth.openai.com/oauth/authorize",
  tokenUrl: "https://auth.openai.com/oauth/token",
  scope: "openid profile email offline_access",
  codeChallengeMethod: "S256",
  extraParams: {
    id_token_add_organizations: "true",
    originator: "openai_native",
  },
};

// GitHub Copilot OAuth Configuration (Device Code Flow)
export const GITHUB_CONFIG = {
  clientId: "Iv1.b507a08c87ecfe98",
  deviceCodeUrl: "https://github.com/login/device/code",
  tokenUrl: "https://github.com/login/oauth/access_token",
  userInfoUrl: "https://api.github.com/user",
  scopes: "read:user",
  apiVersion: "2022-11-28", // Updated to supported version
  copilotTokenUrl: "https://api.github.com/copilot_internal/v2/token",
  userAgent: "GitHubCopilotChat/0.26.7",
  editorVersion: "vscode/1.85.0",
  editorPluginVersion: "copilot-chat/0.26.7",
};

// Kiro OAuth Configuration
// Supports multiple auth methods:
// 1. AWS Builder ID (Device Code Flow)
// 2. AWS IAM Identity Center/IDC (Device Code Flow with custom startUrl/region)
// 3. Google/GitHub Social Login (Authorization Code Flow - manual callback)
// 4. Import Token (paste refresh token from Kiro IDE)
export const KIRO_CONFIG = {
  // AWS SSO OIDC endpoints for Builder ID/IDC (Device Code Flow)
  ssoOidcEndpoint: "https://oidc.us-east-1.amazonaws.com",
  registerClientUrl: "https://oidc.us-east-1.amazonaws.com/client/register",
  deviceAuthUrl: "https://oidc.us-east-1.amazonaws.com/device_authorization",
  tokenUrl: "https://oidc.us-east-1.amazonaws.com/token",
  // AWS Builder ID default start URL
  startUrl: "https://view.awsapps.com/start",
  // Client registration params
  clientName: "kiro-oauth-client",
  clientType: "public",
  scopes: ["codewhisperer:completions", "codewhisperer:analysis", "codewhisperer:conversations"],
  grantTypes: ["urn:ietf:params:oauth:grant-type:device_code", "refresh_token"],
  issuerUrl: "https://identitycenter.amazonaws.com/ssoins-722374e8c3c8e6c6",
  // Social auth endpoints (Google/GitHub via AWS Cognito)
  socialAuthEndpoint: "https://prod.us-east-1.auth.desktop.kiro.dev",
  socialLoginUrl: "https://prod.us-east-1.auth.desktop.kiro.dev/login",
  socialTokenUrl: "https://prod.us-east-1.auth.desktop.kiro.dev/oauth/token",
  socialRefreshUrl: "https://prod.us-east-1.auth.desktop.kiro.dev/refreshToken",
  // Auth methods
  authMethods: ["builder-id", "idc", "google", "github", "import"],
};

// Cursor OAuth Configuration (Import Token from Cursor IDE)
// Cursor stores credentials in SQLite database: state.vscdb
// Keys: cursorAuth/accessToken, storage.serviceMachineId
export const CURSOR_CONFIG = {
  // API endpoints
  apiEndpoint: "https://api2.cursor.sh",
  chatEndpoint: "/aiserver.v1.ChatService/StreamUnifiedChatWithTools",
  modelsEndpoint: "/aiserver.v1.AiService/GetDefaultModelNudgeData",
  // Additional endpoints
  api3Endpoint: "https://api3.cursor.sh", // Telemetry
  agentEndpoint: "https://agent.api5.cursor.sh", // Privacy mode
  agentNonPrivacyEndpoint: "https://agentn.api5.cursor.sh", // Non-privacy mode
  // Client metadata
  clientVersion: "3.1.0",
  clientType: "ide",
  // Token storage locations (for user reference)
  tokenStoragePaths: {
    linux: "~/.config/Cursor/User/globalStorage/state.vscdb",
    macos: "/Users/<user>/Library/Application Support/Cursor/User/globalStorage/state.vscdb",
    windows: "%APPDATA%\\Cursor\\User\\globalStorage\\state.vscdb",
  },
  // Database keys
  dbKeys: {
    accessToken: "cursorAuth/accessToken",
    machineId: "storage.serviceMachineId",
  },
};

// Kimi Coding OAuth Configuration (Device Code Flow)
export const KIMI_CODING_CONFIG = {
  clientId: process.env.KIMI_CODING_OAUTH_CLIENT_ID || "17e5f671-d194-4dfb-9706-5516cb48c098",
  deviceCodeUrl: "https://auth.kimi.com/api/oauth/device_authorization",
  tokenUrl: "https://auth.kimi.com/api/oauth/token",
};

// KiloCode OAuth Configuration (Custom Device Auth Flow)
export const KILOCODE_CONFIG = {
  apiBaseUrl: "https://api.kilo.ai",
  initiateUrl: "https://api.kilo.ai/api/device-auth/codes",
  pollUrlBase: "https://api.kilo.ai/api/device-auth/codes",
};

// Cline OAuth Configuration (Local Callback Flow via app.cline.bot)
export const CLINE_CONFIG = {
  appBaseUrl: "https://app.cline.bot",
  apiBaseUrl: "https://api.cline.bot",
  authorizeUrl: "https://api.cline.bot/api/v1/auth/authorize",
  tokenExchangeUrl: "https://api.cline.bot/api/v1/auth/token",
  refreshUrl: "https://api.cline.bot/api/v1/auth/refresh",
};

// GitLab Duo OAuth Configuration (Authorization Code Flow with PKCE)
// Supports both OAuth (PKCE) and Personal Access Token (PAT) modes
export const GITLAB_CONFIG = {
  defaultBaseUrl: "https://gitlab.com",
  authorizeUrlPath: "/oauth/authorize",
  tokenUrlPath: "/oauth/token",
  userInfoUrlPath: "/api/v4/user",
  scope: "api read_user",
  codeChallengeMethod: "S256",
};

// CodeBuddy (Tencent) OAuth Configuration (Browser OAuth Polling Flow)
// Step 1: POST /v2/plugin/auth/state?platform=CLI → get { state, authUrl }
// Step 2: Open authUrl in browser
// Step 3: Poll POST /v2/plugin/auth/token with state until success
export const CODEBUDDY_CONFIG = {
  baseUrl: "https://copilot.tencent.com",
  stateUrl: "https://copilot.tencent.com/v2/plugin/auth/state",
  tokenUrl: "https://copilot.tencent.com/v2/plugin/auth/token",
  refreshUrl: "https://copilot.tencent.com/v2/plugin/auth/token/refresh",
  userAgent: "CLI/2.63.2 CodeBuddy/2.63.2",
  platform: "CLI",
  pollInterval: 5000,
};

// OAuth timeout (5 minutes)
export const OAUTH_TIMEOUT = 300000;

// Provider list
export const PROVIDERS = {
  CLAUDE: "claude",
  CODEX: "codex",
  GEMINI: "gemini-cli",
  QWEN: "qwen",
  QODER: "qoder",
  IFLOW: "iflow",
  ANTIGRAVITY: "antigravity",
  OPENAI: "openai",
  GITHUB: "github",
  KIRO: "kiro",
  CURSOR: "cursor",
  KIMI_CODING: "kimi-coding",
  KILOCODE: "kilocode",
  CLINE: "cline",
  GITLAB: "gitlab",
  CODEBUDDY: "codebuddy",
};

// FreeBuff (Codebuff) CLI Auth Configuration (custom device-code-style flow)
export const FREEBUFF_CONFIG = {
  loginBaseUrl: process.env.FREEBUFF_AUTH_BASE_URL || "https://www.codebuff.com",
  cliCodeUrl: process.env.FREEBUFF_CLI_CODE_URL || "https://www.codebuff.com/api/auth/cli/code",
  cliStatusUrl: process.env.FREEBUFF_CLI_STATUS_URL || "https://www.codebuff.com/api/auth/cli/status",
  pollInterval: 4000,
};

// xAI (Grok) OAuth Configuration (PKCE Authorization Code Flow)
export const XAI_CLIENT_ID = "b1a00492-073a-47ea-816f-4c329264a828";
export const XAI_ISSUER = "https://auth.x.ai";
export const XAI_AUTH_ENDPOINT_PATH = "/oauth2/authorize";
export const XAI_TOKEN_ENDPOINT_PATH = "/oauth2/token";
export const XAI_DISCOVERY_PATH = "/.well-known/openid-configuration";
export const XAI_SCOPE = "openid profile email offline_access grok-cli:access api:access";
export const XAI_API_BASE = "https://api.x.ai/v1";
export const XAI_LOOPBACK_PORT = 56121;
export const XAI_CALLBACK_PATH = "/callback";
export const XAI_REDIRECT_URI = `http://127.0.0.1:${XAI_LOOPBACK_PORT}${XAI_CALLBACK_PATH}`;
export const XAI_PKCE_VERIFIER_BYTES = 96;
export const XAI_REFRESH_LEAD_SECONDS = 5 * 60;
export const XAI_USER_AGENT = "grok-cli/9router";

export const XAI_CONFIG = {
  clientId: XAI_CLIENT_ID,
  issuer: XAI_ISSUER,
  authEndpointPath: XAI_AUTH_ENDPOINT_PATH,
  tokenEndpointPath: XAI_TOKEN_ENDPOINT_PATH,
  discoveryPath: XAI_DISCOVERY_PATH,
  authorizeUrl: `${XAI_ISSUER}${XAI_AUTH_ENDPOINT_PATH}`,
  tokenUrl: `${XAI_ISSUER}${XAI_TOKEN_ENDPOINT_PATH}`,
  discoveryUrl: `${XAI_ISSUER}${XAI_DISCOVERY_PATH}`,
  scope: XAI_SCOPE,
  apiBaseUrl: XAI_API_BASE,
  redirectUri: XAI_REDIRECT_URI,
  loopbackPort: XAI_LOOPBACK_PORT,
  callbackPath: XAI_CALLBACK_PATH,
  pkceVerifierBytes: XAI_PKCE_VERIFIER_BYTES,
  refreshLeadSeconds: XAI_REFRESH_LEAD_SECONDS,
  userAgent: XAI_USER_AGENT,
  codeChallengeMethod: "S256",
};
