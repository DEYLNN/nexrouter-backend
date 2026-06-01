# Changelog

## [0.4.31] - 2026-06-01

### Chore
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
