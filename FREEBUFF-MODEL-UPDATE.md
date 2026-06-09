# FreeBuff Model Update Guide

Use this note when Codebuff adds/renames FreeBuff models or base2 agents.

## Source of truth

Check Codebuff upstream first:

- Model constants: `common/src/constants/freebuff-models.ts`
- Free agent tests: `common/src/__tests__/free-agents.test.ts`
- Base2 agents: `agents/base2/*.ts`

Example upstream paths:

```text
agents/base2/base2-free.ts
agents/base2/base2-free-deepseek.ts
agents/base2/base2-free-deepseek-flash.ts
agents/base2/base2-free-kimi.ts
agents/base2/base2-free-mimo.ts
agents/base2/base2-free-mimo-pro.ts
agents/base2/base2-free-minimax-m3.ts
```

## Backend files to update

### 1. FreeBuff executor

File:

```text
open-sse/executors/freebuff.js
```

Update these sections:

1. `MODEL_MAP`
   - Add user-facing aliases (`fb/<id>`, `freebuff/<id>`, short id).
   - Map them to the exact Codebuff backend model ID.

2. `FREEBUFF_AGENT_BY_MODEL`
   - Map each backend model ID to its matching Codebuff base2 agent id.
   - Do not guess. Read `agents/base2/*.ts` upstream.

Current known mapping:

```js
{
  "deepseek/deepseek-v4-flash": "base2-free-deepseek-flash",
  "deepseek/deepseek-v4-pro": "base2-free-deepseek",
  "moonshotai/kimi-k2.6": "base2-free-kimi",
  "minimax/minimax-m2.7": "base2-free",
  "minimax/minimax-m3": "base2-free-minimax-m3",
  "mimo/mimo-v2.5": "base2-free-mimo",
  "mimo/mimo-v2.5-pro": "base2-free-mimo-pro",
}
```

3. Waiting-room session handling
   - Create/switch session with `POST /api/v1/freebuff/session`.
   - Must send header:

```http
x-freebuff-model: <backendModel>
```

   - Do **not** use GET to create/switch sessions. GET only probes existing state.
   - If an existing active session is bound to a different model, DELETE that session, then POST the requested model.

4. Codebuff version headers
   - Do **not** add `codebuff-version`/CLI-version headers unless verified against latest Codebuff behavior.
   - A stale/incorrect version header can trigger `426 freebuff_update_required`.

### 2. Static model catalog

File:

```text
open-sse/config/providerModels.js
```

Update `PROVIDER_MODELS.fb` with user-facing model IDs.

Example:

```js
fb: [
  { id: "minimax-m2.7", name: "MiniMax M2.7" },
  { id: "minimax-m3", name: "MiniMax M3" },
  { id: "mimo-v2.5", name: "MiMo V2.5" },
  { id: "mimo-v2.5-pro", name: "MiMo V2.5 Pro" },
  { id: "kimi-k2.6", name: "Kimi K2.6" },
  { id: "deepseek-v4-pro", name: "DeepSeek V4 Pro" },
  { id: "deepseek-v4-flash", name: "DeepSeek V4 Flash" },
]
```

## Runtime DB visibility

`/v1/models` is public-model filtered. After adding models, make sure public/disabled DB state allows them:

- Public allowlist must include `fb/<model>`.
- Disabled list for `fb` must not hide them.

Safe helper pattern:

```js
import { getPublicModelIds, setPublicModelIds } from './src/lib/publicModelsDb.js'
import { enableModels } from './src/lib/disabledModelsDb.js'

const addPublic = [
  'fb/minimax-m2.7',
  'fb/minimax-m3',
  'fb/mimo-v2.5',
  'fb/mimo-v2.5-pro',
  'fb/kimi-k2.6',
  'fb/deepseek-v4-pro',
  'fb/deepseek-v4-flash',
]

const current = await getPublicModelIds()
await setPublicModelIds([...new Set([...current, ...addPublic])])
await enableModels('fb', addPublic.map((id) => id.slice('fb/'.length)))
```

## Test checklist

Run syntax check:

```bash
node --check open-sse/executors/freebuff.js
node --check open-sse/config/providerModels.js
```

Restart backend:

```bash
pm2 restart ai-gateway-hono-backend --update-env
```

Check model list:

```bash
curl -sS http://127.0.0.1:18323/v1/models | jq '.data[] | select(.id|startswith("fb/")) | .id'
```

Smoke test every FreeBuff model via `/v1/chat/completions`.

Expected current statuses:

```text
fb/deepseek-v4-flash 200
fb/deepseek-v4-pro   200
fb/kimi-k2.6         200
fb/minimax-m2.7      200
fb/minimax-m3        200
fb/mimo-v2.5         200
fb/mimo-v2.5-pro     200
```

## Common failures

### `426 freebuff_update_required`

Likely causes:

- Incorrect/stale `codebuff-version` header.
- Session was created with GET instead of POST.
- Session was not created with `x-freebuff-model`.
- Account has an old active FreeBuff session bound to another model and it was not deleted before switching.

### `409 session_model_mismatch` or model locked

Cause:

- Current `freebuff_instance_id` belongs to another model.

Fix:

- DELETE `/api/v1/freebuff/session` with `x-freebuff-instance-id`, then POST new session with `x-freebuff-model`.

## Commit/deploy flow

```bash
git add open-sse/executors/freebuff.js open-sse/config/providerModels.js FREEBUFF-MODEL-UPDATE.md
git commit -m "feat(freebuff): update Codebuff model queues"
git push origin main
pm2 restart ai-gateway-hono-backend --update-env
```

Do not change `DATA_DIR`; production DB path must stay `/root/.9router`.
