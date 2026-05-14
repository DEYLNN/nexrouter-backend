# ⚠️ DO NOT TOUCH — Core AI Gateway Backend

Zhen instruction — 2026-05-14:

This project is the **core AI Gateway backend for Zhen's agent stack**.

## Project

```txt
/root/.openclaw/workspace/projects/ai-gateway-hono-backend
```

## Runtime

```txt
PM2: ai-gateway-hono-backend
Port: 18323
```

## Critical rules

- Do **not** casually edit, refactor, clean, rebuild, or move this backend.
- Do **not** change runtime env without explicit approval from Zhen.
- Do **not** change `DATA_DIR` away from:

```env
DATA_DIR=/root/.9router
```

- Do **not** delete, overwrite, migrate, compact, or move the production DB:

```txt
/root/.9router/db/data.sqlite
```

- Do **not** touch `/root/.9router/db/` unless Zhen explicitly asks.
- Before any backend change: inspect PM2/env/routes, explain plan, then wait if the action is risky.
- Prefer safe backups before edits.

## Current role

OpenClaw provider `9router` points to this backend:

```txt
http://localhost:18323/v1
```

Treat this backend as production-critical.
