# Changelog

## [0.4.84] - 2026-06-30

### Added
- Add Cavoti provider (alias `cv`) — OpenAI-compatible, base `https://cavoti.com/v1`, model `gpt-5.5`.

## [0.4.83] - 2026-06-29

### Added
- Add Nabz Clan provider (alias `nzc`) — OpenAI-compatible inference API via lumyx-ai.site.
  - Models: minimax-m3

## [0.4.82] - 2026-06-29
- Fix Unimodel base URL to www.unimodel.ai (non-www returns OpenAI proxy 401).
- Add `um` alias to open-sse config/providers.js for executor routing.

### Added
- Add API key validation and test support for Unimodel provider (alias `um`).

## [0.4.81] - 2026-06-29

### Added
- Add Babel Town provider (alias `bt`) — OpenAI-compatible inference API.
  - Base URL: `https://api.babel.town/v1`
  - Models: `glm-5.2`

## [0.4.78] - 2026-06-22

### Added
- Add Badtheory Labs provider (alias `btl`) with `deepseek-v4-flash` and `deepseek-v4-pro` models.
  - Base URL: `https://api.badtheorylabs.com/v1`

### Fixed
- Add `badtheory-labs` / `btl` case to test key console (`testApiKeyConnection`) so key validation returns proper result instead of "Provider test not supported".

## [0.4.77] - 2026-06-22

### Added
- Add Badtheory Labs provider (alias `btl`) with `deepseek-v4-flash` and `deepseek-v4-pro` models.
  - Base URL: `https://api.badtheorylabs.com/v1`

## [0.4.76] - 2026-06-18

### Added
- Add new OpenCode Go models: `kimi-k2.7-code`, `minimax-m3`, `glm-5.2`, `deepseek-v4-pro`, `deepseek-v4-flash`, `mimo-v2.5`, `mimo-v2.5-pro`.
- Add new Command Code models: `moonshotai/Kimi-K2.7-Code`, `zai-org/GLM-5.2`, `MiniMaxAI/MiniMax-M3`, `xiaomi/mimo-v2.5`, `xiaomi/mimo-v2.5-pro`, `nvidia/nemotron-3-ultra-550b-a55b`.

## [0.4.75] - 2026-06-18

### Added
- Add `minimax-m3` to B.AI static model list.

## [0.4.74] - 2026-06-18

### Removed
- Remove unfinished ZCode OAuth provider integration while captcha verification remains unresolved.

## [0.4.72] - 2026-06-17

### Fixed
- Register ftstoresz in backend dashboard provider constants and API-key validation so adding ftstoresz keys works from the UI.

## [0.4.71] - 2026-06-17

### Added
- Add ftstoresz API-key provider (`ftstoresz`) with OpenAI-compatible endpoint and constant models `qwen3.7-max` and `claude-opus-4.7`.

## [0.4.70] - 2026-06-13

### Added
- Add MiMo Code Free no-auth provider (`mimo-free` / `mmf`) with the upstream MiMo Free executor, `mimo-auto` model registration, provider aliasing, validation/model-list sync, and OpenSSE routing.
- Add Ambient API-key provider validation/model probe wiring and model-list handling.

## [0.4.69] - 2026-06-11

### Added
- Added TokenRouter API-key provider (`tokenrouter` / `tr`) with `MiniMax-M3` model, OpenAI-compatible endpoint, validation/test probe, and downloaded local icon asset.

## [0.4.68] - 2026-06-11

### Fixed
- Include failed request status codes and sanitized upstream error summaries in request logs so provider failures show actionable details instead of a bare ERROR label.

## [0.4.67] - 2026-06-11

### Fixed
- Add Kimchi API-key validation/test probes with Kimchi-compatible chat request headers so the provider test button no longer reports unsupported validation or Cloudflare probe errors.

## [0.4.66] - 2026-06-11

### Fixed
- Embed the FreeBuff/freebuff2api-compatible free-mode flow directly in the backend FreeBuff executor so OAuth FreeBuff connections work without the separate local freebuff2api proxy service.

## [0.4.65] - 2026-06-06

### Fixed
- Allow `/api/auth-files` to scope auth file results by `provider` / `filters.provider` so provider-specific status filters can use backend-filtered data.

## [0.4.64] - 2026-06-04

### Fixed
- Add Morph `morph-dsv4flash` to the FE provider definition (`APIKEY_PROVIDERS.morph.models`) so `/dashboard/providers/morph` can display it as a provider constant model.

## [0.4.63] - 2026-06-03

### Fixed
- Ensure the FE provider models endpoint merges Morph static model `morph-dsv4flash` even when Morph upstream `/v1/models` omits it.

## [0.4.62] - 2026-06-03

### Added
- Add Morph LLM static model `morph-dsv4flash` / Morph DeepSeek V4 Flash to FE/BE model catalogs.

### Changed
- Use `morph-dsv4flash` for Morph provider validation/test requests.

## [0.4.61] - 2026-06-03

### Fixed
- Clear Anuma text stream buffer after each emitted content chunk to prevent trailing-overlap duplicates in follow-up answers.

## [0.4.60] - 2026-06-03

### Fixed
- Avoid duplicated text after stripping Anuma `<think>` sections in streamed follow-up answers.

## [0.4.59] - 2026-06-03

### Fixed
- After an Anuma tool result, stop forcing JSON tool-call mode and stream the follow-up answer normally; suppress `<think>` chunks while streaming.

## [0.4.58] - 2026-06-03

### Fixed
- When Anuma requests include tools, buffer streamed text until a tool-call can be parsed or final text is known; also strip `<think>` blocks from Anuma streamed output.

## [0.4.57] - 2026-06-03

### Fixed
- Parse the first complete Anuma streamed JSON tool-call object and ignore duplicated trailing JSON fragments, preventing malformed tool JSON from leaking as content.

## [0.4.56] - 2026-06-03

### Fixed
- Make Anuma compatibility compaction more aggressive for Hermes/OpenClaw long transcripts: fewer tools, fewer history messages, shorter text blocks, and smaller max output.

## [0.4.55] - 2026-06-03

### Fixed
- Compact Anuma agent payloads: trim long transcripts, cap output tokens, and send compact tool schemas to reduce upstream 400/402 failures on Hermes/OpenClaw long tasks.

## [0.4.54] - 2026-06-03

### Fixed
- Treat any streamed Anuma response beginning with `{` as potential structured tool JSON and buffer it until parsed, avoiding partial JSON-token leakage before tool_calls.

## [0.4.53] - 2026-06-03

### Fixed
- Buffer streamed Anuma JSON tool-call text until it is parseable, preventing partial `{"tool_call":...}` text from leaking to agent clients.

## [0.4.52] - 2026-06-03

### Fixed
- Filter Anuma `reasoning_summary` SSE events by event type before converting `/responses` stream output to OpenAI chat chunks.

## [0.4.51] - 2026-06-03

### Fixed
- Stop forwarding Anuma reasoning-summary SSE deltas as user-visible content; only output text deltas are streamed to clients.

## [0.4.50] - 2026-06-03

### Fixed
- Add true streaming support for Anuma `/responses` upstream instead of waiting for full JSON and fake-streaming, improving long task reliability and TTFT.
- Parse Anuma Responses SSE `OfString` deltas into OpenAI chat completion chunks while preserving streamed tool-call detection.

## [0.4.49] - 2026-06-03

### Changed
- Switch Anuma provider dispatch from `/chat/completions` shim to the Anuma `/responses` API style used by the reference AnumaAI gateway.
- Convert OpenAI chat messages into Responses `input[]` blocks and normalize Responses JSON back into OpenAI chat completion output for NexRouter clients.

## [0.4.48] - 2026-06-03

### Fixed
- Teach Anuma agent prompt that terminal/shell/exec tools are valid for browser automation and screenshots, avoiding false `No browser/screenshot tool` replies.

## [0.4.47] - 2026-06-03

### Fixed
- Strengthen Anuma agent tool-use prompting so browser/file/command/screenshot tasks prefer tool calls instead of plain-text refusal.

## [0.4.46] - 2026-06-03

### Fixed
- Parse Anuma textual tool-call transcripts like `Requested tool calls:
- terminal({ ... })` back into streamed OpenAI `tool_calls` for Hermes/OpenClaw.

## [0.4.45] - 2026-06-03

### Fixed
- Add Anuma JSON tool-call shim: expose tools in prompt text, parse `{"tool_call": ...}` assistant JSON back into OpenAI `tool_calls`, and stream tool-call SSE deltas to Hermes/OpenClaw.

## [0.4.44] - 2026-06-03

### Fixed
- Force Anuma upstream requests to `stream:false` when using NexRouter fake-streaming, preventing Hermes/OpenClaw streaming requests from being misread as JSON and reset.

## [0.4.43] - 2026-06-03

### Fixed
- Improve Anuma agentic compatibility for Hermes/OpenClaw by removing native `tools[]` from upstream requests and preserving tool calls/results as transcript text.
- Add an Anuma-only agent system preface so coding-agent tool-result continuations produce non-empty normal text replies.

## [0.4.42] - 2026-06-03

### Fixed
- Flip Anuma credential mapping: frontend/API-key field stores the EVM User ID/address, while the server injects fixed `X-API-KEY` from `ANUMA_X_API_KEY`.
- Keep Anuma header handling isolated so other API-key providers continue using their normal Bearer/OpenAI-compatible flow.

## [0.4.41] - 2026-06-03

### Fixed
- Tune Anuma for agentic clients by normalizing prior tool-call/tool-result messages into text transcript form.
- Force Anuma streaming clients through validated fake-streaming from a non-stream upstream response to avoid empty SSE completions.
- Return a clear 502 if Anuma returns empty assistant content instead of passing an empty successful response to Hermes/OpenClaw.

## [0.4.40] - 2026-06-03

### Fixed
- Fix the provider connection “Test Key” button for Anuma by using the provider-specific `X-API-KEY` and `X-User-ID` headers instead of Bearer auth.

## [0.4.39] - 2026-06-03

### Added
- Add Anuma API-key provider using `https://portal.anuma.ai/api/v1/chat/completions`.
- Inject Anuma-required `X-API-KEY` and fixed EVM-format `X-User-ID` headers for chat and validation requests.
- Register Anuma static models: ChatGPT 5.4, Claude Sonnet 4.6, Gemini 3.1 Pro, Gemini 3.5 Flash, Grok 4.3, Qwen 3.6 Max Preview, Kimi 2.6, Kimi 2.5, Qwen 3.6 Plus, MiniMax 2.7.

## [0.4.38] - 2026-06-02

### Fixed
- Add Ocenza to per-key test button validation via `/v1/models`.

### Changed
- Restore Ocenza static models to `gpt-oss-120b` and `step-3.5-flash-2603`.

## [0.4.37] - 2026-06-02

### Fixed
- Validate Ocenza API keys via `/v1/models` and update static models to the key-exposed model list.

## [0.4.36] - 2026-06-02

### Added
- Add Ocenza provider with constant models `gpt-oss-120b` and `step-3.5-flash-2603`.

## [0.4.35] - 2026-06-02

### Features
- Register Zenmux OpenAI-compatible provider at `https://zenmux.ai/api/v1/chat/completions`
- Add constant Zenmux models: `z-ai/glm-4.7-flash-free`, `z-ai/glm-4.6v-flash-free`

## [0.4.34] - 2026-06-02

### Features
- Enable per-model live chat probe endpoint for Husada API-key connections
- Reuse `/api/providers/:id/test-model` for supported live-test providers beyond Kiro

## [0.4.33] - 2026-06-02

### Fixes
- Restrict Gitlawb MiMo provider models to upstream-supported `xiaomi/mimo-*` chat models
- Remove non-MiMo catalog entries from the static Gitlawb MiMo list because `/v1/xiaomi-mimo/chat/completions` rejects them

## [0.4.32] - 2026-06-02

### Features
- Add separate Gitlawb MiMo API-key provider using the `/v1/xiaomi-mimo/chat/completions` OpenGateway route
- Register 343 Gitlawb MiMo catalog models from `/v1/xiaomi-mimo/models`, including `minimax/minimax-m3`
- Keep existing global Gitlawb provider endpoint unchanged

## [0.4.31] - 2026-06-01

### Chore
- Tighten project rules: every change must bump package version and CHANGELOG.md together
- Add repository rule requiring CHANGELOG.md updates for every future backend change
- Add changelog generation helper script and npm script
- Rebrand backend metadata/docs from AI Gateway/9Router to NexRouter

## [0.4.30] - 2026-05-30

### Chore
- Sync xAI models from upstream 9router

## [0.4.29] - 2026-05-18

### Features
- Add `xai-apikey` alias for dual xAI auth modes (OAuth + API Key)

## [0.4.28] - 2026-05-16

### Features
- Add xAI (Grok) OAuth PKCE flow with manual-code exchange

## [0.4.27] - 2026-05-15

### Improvements
- Normalize Qoder zero quota display
- Add Qoder quota usage API
- Align Qoder OAuth flow with upstream
- Fix Qoder device token polling
- Fix Qoder connect account device flow
- Add Qoder provider integration

### Fixes
- Finalize AIMux provider validation

## [0.4.26] - 2026-05-12

### Fixes
- Fix Mimo provider test button
- Fix Nous provider test button

### Features
- Add Nous StepFun 3.7 flash model
- Update Nous OAuth to invoke JWT flow

### Cleanup
- Remove duplicate GitHub Models and Kilo Gateway providers

## [0.4.25] - 2026-05-11

### Fixes
- Restore Morph and Groq provider icons
- Use SambaNova provider icon asset path

### Improvements
- Move Pollinations into free providers

## [0.4.24] - 2026-05-10

### Features
- Add LLM7 model probe and fetched catalog
- Require API key for LLM7 provider
- Allow no-auth providers outside free provider group
- Add FreeLLMAPI-derived free providers and models

## [0.4.23] - 2026-05-09

### Features
- Use Gemma 4 native tool-call text protocol
- Stream normal Gemma text while buffering tool JSON
- Improve Gemma follow-up after tool results
- Flush buffered Gemma stream text
- Buffer Gemma text tool calls across stream chunks
- Loosen Gemma text tool-call extraction
- Convert Gemma text tool protocol to OpenAI tool calls
- Add text tool protocol for Gemma agent clients
