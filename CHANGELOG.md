# Changelog

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
