# Kimchi Checkpoint Before Kimi 2.6 Tuning — 2026-06-09

Status: Kimchi provider registered; tuning NOT started yet.

## User request
Zhen tested Kimchi `kimi-k2.6` through another agent. It works, but:
- response is very slow
- stream may appear idle for many minutes
- not agentic enough for coding-agent loop
- likely loads/handles huge input (100k token style) before useful output

Zhen asked to save this checkpoint before adding Kimchi tuning for Kimi 2.6.

## Current Kimchi registration state
Backend files changed:
- `open-sse/config/providers.js`
  - added `kimchi` with base URL `https://llm.kimchi.dev/openai/v1/chat/completions`
  - format: `openai`
- `open-sse/config/providerModels.js`
  - added static models:
    - `kimi-k2.6`
    - `kimi-k2.5`
    - `minimax-m2.7`
    - `nemotron-3-super-fp4`
- `src/shared/constants/providers.js`
  - added API key provider `kimchi`
  - icon `/providers/kimchi.jpg`
- `public/providers/kimchi.jpg`
  - copied from X/Twitter avatar URL

Frontend files changed and pushed:
- repo: `DEYLNN/nexrouter-frontend`
- commit: `985fbb8 Add Kimchi provider`
- Vercel trigger expected via push

## Current backend runtime
- PM2 service: `ai-gateway-hono-backend`
- restarted after provider registration
- health OK: `{"ok":true,"runtime":"hono-bun","port":18323}`
- `pm2 save` was run after restart during Kimchi registration.

## API tests already done
Direct Kimchi endpoint:
- `GET https://llm.kimchi.dev/openai/v1/models` with bearer key returned 200 and models.
- `POST /openai/v1/chat/completions` works for listed models.

Observed raw response quirks:
- `kimi-k2.6`
  - returns content like `" OK"`
  - includes `reasoning_content` and `provider_specific_fields.reasoning`
- `kimi-k2.5`
  - with small `max_tokens`, can return `message.content: null` and spend tokens in `reasoning_content`
- `minimax-m2.7`
  - content works, but leaks `<think>...</think>`
- `nemotron-3-super-fp4`
  - content works, may start with newlines and include reasoning fields

## Hypothesis for Kimi 2.6 latency / weak agentic behavior
Kimchi Kimi 2.6 is raw OpenAI-compatible chat, no provider-specific agentic profile yet.
Likely issues:
1. hidden/explicit reasoning consumes time before useful content
2. long context prefill causes long first-token delay
3. streaming may have no useful visible chunks while upstream is reasoning
4. default OpenSSE executor has no Kimchi response normalizer
5. no Kimchi-specific coding-agent prompt wrapper

## Planned tuning — not yet applied
Potential BE tuning items:
1. Add specialized `KimchiExecutor` or Kimchi-specific normalization path.
2. Normalize response:
   - strip `reasoning_content`
   - strip `provider_specific_fields.reasoning`
   - if `message.content === null`, set `content = ""` or retry with higher `max_tokens`
   - strip `<think>[\s\S]*?</think>` from `content`
   - trim leading whitespace/newlines
3. Add Kimi 2.6 agentic profile:
   - concise coding-agent backend behavior
   - no hidden reasoning in visible output
   - valid tool calls only
   - preserve user/tool context but avoid huge generic prompt bloat
4. Streaming mitigation:
   - fake-stream after full response if upstream chunks are delayed, or add heartbeat-compatible handling if client supports it
5. Test direct NexRouter chat against `kimchi/kimi-k2.6` after adding an active provider connection.

## Safety / constraints
- Do not change `/root/.9router` data path.
- Preserve unrelated backend diffs unless explicitly cleaning them.
- Do not reroute Kimchi identity to another provider.
- Do not leak API keys into commits or skill docs.
- Restart backend only after syntax validation.
