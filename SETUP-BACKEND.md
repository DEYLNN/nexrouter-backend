# NexRouter Backend — VPS / Hugging Face Setup

Repo: `https://github.com/DEYLNN/nexrouter-backend`

This repo runs the Hono backend/API gateway. The frontend can run on Vercel and point to this backend.

## Required Runtime

Recommended:

- Linux VPS
- Node.js 20+ or 22+
- Bun 1.1+
- PM2 for VPS process management

The main backend command is:

```bash
bun apps/gateway-hono/server.js
```

## Environment Variables

Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

Minimum config:

```env
HONO_PORT=18323
DATA_DIR=/root/.9router
JWT_SECRET=change-this-to-the-same-value-as-frontend
AUTH_COOKIE_SECURE=true
INITIAL_PASSWORD=change-me
```

Notes:

- `DATA_DIR` stores runtime DB/state.
- `JWT_SECRET` must match frontend `JWT_SECRET`.
- Use `AUTH_COOKIE_SECURE=true` behind HTTPS.
- Use `AUTH_COOKIE_SECURE=false` only for local HTTP/IP testing.
- Do not commit `.env`.

## VPS Setup

### 1. Clone

```bash
git clone https://github.com/DEYLNN/nexrouter-backend.git
cd nexrouter-backend
```

### 2. Install Dependencies

```bash
npm install
```

Install Bun if needed:

```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc
bun --version
```

Install PM2 if needed:

```bash
npm install -g pm2
```

### 3. Configure Env

```bash
cp .env.example .env
nano .env
```

Example production-ish VPS config:

```env
HONO_PORT=18323
DATA_DIR=/root/.9router
JWT_SECRET=replace-with-long-random-secret
AUTH_COOKIE_SECURE=true
INITIAL_PASSWORD=replace-with-first-login-password
```

Create data dir:

```bash
mkdir -p /root/.9router
```

### 4. Start With PM2

```bash
pm2 start bun --name ai-gateway-hono-backend -- apps/gateway-hono/server.js
```

Optional if you want PM2 to restore after reboot:

```bash
pm2 save
pm2 startup
```

### 5. Health Check

```bash
curl http://127.0.0.1:18323/api/health
```

Expected:

```json
{"ok":true,"runtime":"hono-bun","port":18323}
```

### 6. Reverse Proxy

Put it behind HTTPS using Nginx/Caddy/Cloudflare Tunnel.

Example public backend URL:

```text
https://api.your-domain.com
```

Frontend env should point to this:

```env
BACKEND_BASE_URL=https://api.your-domain.com
NEXT_PUBLIC_BACKEND_BASE_URL=https://api.your-domain.com
JWT_SECRET=same-as-backend
```

## Hugging Face Space Setup

Hugging Face Spaces can run this backend as a Docker Space. Use this if you do not want a VPS.

### 1. Create Space

- SDK: **Docker**
- Visibility: private recommended
- Hardware: start small, upgrade if needed

### 2. Add Dockerfile

If the repo does not already include a Dockerfile, create one like:

```Dockerfile
FROM oven/bun:1.2

WORKDIR /app
COPY package*.json ./
RUN bun install
COPY . .

ENV HONO_PORT=7860
ENV DATA_DIR=/data/.9router
EXPOSE 7860

CMD ["bun", "apps/gateway-hono/server.js"]
```

Hugging Face expects the app to listen on port `7860`, so set:

```env
HONO_PORT=7860
```

### 3. Space Variables / Secrets

In HF Space Settings → Variables and Secrets:

```env
HONO_PORT=7860
DATA_DIR=/data/.9router
JWT_SECRET=change-this-to-the-same-value-as-frontend
AUTH_COOKIE_SECURE=true
INITIAL_PASSWORD=change-me
```

Use **Secrets** for sensitive values.

### 4. Persistent Data Warning

HF Spaces may reset ephemeral filesystem unless persistent storage is enabled.

For production, prefer VPS. If using HF:

- Enable persistent storage if available.
- Set `DATA_DIR=/data/.9router`.
- Back up DB regularly.

## Backup / DB Maintenance

Runtime DB lives under `DATA_DIR`, usually:

```text
/root/.9router/db/data.sqlite
```

Backup:

```bash
mkdir -p backups
cp -a /root/.9router/db/data.sqlite backups/data.sqlite.$(date +%Y%m%d-%H%M%S).bak
```

Check DB from Node/Python if needed. If SQLite index corruption happens, back up first, then reindex:

```bash
cp -a /root/.9router/db/data.sqlite /root/.9router/db/data.sqlite.corrupt-$(date +%Y%m%d-%H%M%S).bak
python3 - <<'PY'
import sqlite3
p='/root/.9router/db/data.sqlite'
con=sqlite3.connect(p)
print(con.execute('PRAGMA integrity_check').fetchall())
con.execute('REINDEX')
con.commit()
print(con.execute('PRAGMA integrity_check').fetchall())
PY
```

## Security Checklist Before Sharing

Run before making repo public or sharing widely:

```bash
git status --short
grep -RInE 'ghp_|hf_|sk-[A-Za-z0-9_-]{20,}|api-platform_serviceToken|BEGIN (RSA|OPENSSH|EC|PRIVATE)|private[_-]?key|mnemonic|seed phrase' . \
  --exclude-dir=.git \
  --exclude-dir=node_modules \
  --exclude=package-lock.json
```

Rules:

- Never commit `.env`.
- Never commit runtime DB files.
- Never commit provider API keys, OAuth refresh tokens, cookies, service account JSON, wallet private keys, seed phrases, or user data.
- Keep `JWT_SECRET` private.
- Rotate any secret that was committed historically.

## Common Commands

Restart:

```bash
pm2 restart ai-gateway-hono-backend --update-env
```

Logs:

```bash
pm2 logs ai-gateway-hono-backend
```

Status:

```bash
pm2 status ai-gateway-hono-backend
```

Health:

```bash
curl http://127.0.0.1:18323/api/health
```
