# AI Gateway Hono Backend

Backend-only Hono runtime extracted from 9Router.

## Critical data rule

Do **not** change this path unless Zhen explicitly approves:

```env
DATA_DIR=/root/.9router
```

Active DB:

```txt
/root/.9router/db/data.sqlite
```

Never commit DB files or secrets.

## Env

```bash
cp .env.example .env
```

Local/VPS HTTP test:

```env
HONO_PORT=18323
DATA_DIR=/root/.9router
JWT_SECRET=change-me-same-as-frontend
AUTH_COOKIE_SECURE=false
INITIAL_PASSWORD=change-me
```

HTTPS/domain deployment:

```env
AUTH_COOKIE_SECURE=true
```

## Run

```bash
npm install
DATA_DIR=/root/.9router HONO_PORT=18323 npm run gateway:hono
```

PM2 example:

```bash
DATA_DIR=/root/.9router \
HONO_PORT=18323 \
JWT_SECRET=change-me-same-as-frontend \
AUTH_COOKIE_SECURE=false \
pm2 start "bun apps/gateway-hono/server.js" --name ai-gateway-hono-test
```
