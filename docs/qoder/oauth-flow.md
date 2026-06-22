# Qoder OAuth Flow — NexRouter

Logic flow OAuth Qoder dari user click sampe token tersimpan di SQLite. Buat agent/project lain yang gak punya konteks NexRouter tapi perlu integrasi/investigate Qoder.

Endpoint semua di NexRouter Backend (BE local path `projects/ai-gateway-hono-backend`, repo https://github.com/DEYLNN/nexrouter-backend). Mirror struktur sama di FE (Next.js) untuk UI modal.

---

## High-level flow

```
[FE: OAuthModal.js]                                                  https://github.com/DEYLNN/nexrouter-frontend
   └─ user click "Add Qoder"
        │
        ▼
GET  /api/oauth/qoder/start                                          src/app/api/oauth/[provider]/[action]/route.js
   • provider="qoder" → flowType=device_code
   • requestDeviceCode() called tanpa codeChallenge
     (noPkceDeviceProviders: github, kiro, kimi-coding, kilocode, codebuddy, qoder)
        │
        ▼
src/lib/oauth/providers.js  →  qoder.requestDeviceCode(config)       https://github.com/DEYLNN/nexrouter-backend/blob/main/src/lib/oauth/providers.js#L522
   • QoderService().initiateDeviceFlow()
       - PKCE S256 pair (tetap dibikin walau gak dipakai di /start):
           verifier = base64url(crypto.randomBytes(32))
           challenge = base64url(sha256(verifier))
       - nonce     = uuidv4()
       - machineId = uuidv4()
   • balikin ke route.js + FE:
       device_code               = nonce
       user_code                 = nonce.slice(0,8).toUpperCase()
       verification_uri          = https://qoder.com/device/selectAccounts
       verification_uri_complete = …/selectAccounts?challenge=…&challenge_method=S256&machine_id=…&nonce=…
       expires_in = 300     (5 menit)
       interval   = 2       (detik)
       codeVerifier, _qoderNonce, _qoderMachineId
        │
        ▼
[FE: OAuthModal.startPolling()]                                      https://github.com/DEYLNN/nexrouter-frontend/blob/main/src/shared/components/OAuthModal.js#L160
   • window.open(verification_uri_complete)
   • setInterval(every `interval`s, POST /api/oauth/qoder/poll)
   • extraData = { _qoderNonce, _qoderMachineId, _qoderVerifier=codeVerifier }
        │
        ▼
POST /api/oauth/qoder/poll                                           src/app/api/oauth/[provider]/[action]/route.js (POST branch "poll")
   └─ src/lib/oauth/providers.js → qoder.pollToken()
        │
        ▼
src/lib/oauth/services/qoder.js → QoderService.pollDeviceToken      https://github.com/DEYLNN/nexrouter-backend/blob/main/src/lib/oauth/services/qoder.js
   GET https://openapi.qoder.sh/api/v1/deviceToken/poll
       ?nonce=…&verifier=…&challenge_method=S256
   • 202 / 404 → { status:"pending" }    → keep polling
   • 200 + body.token → { status:"ok", accessToken, refreshToken, userId, expireTime }
   • HTTP non-OK / JSON invalid → throw
        │
        ▼
   QoderService.fetchUserInfo(accessToken)
   GET https://openapi.qoder.sh/api/v1/userinfo                      → { name, email, organizationId, … }
        │
        ▼
   pollToken balikin { ok:true, data:{
     access_token, refresh_token,
     expires_in = max(24h, sisa),
     _qoderUserId, _qoderMachineId,
     _qoderName, _qoderEmail, _qoderOrganizationId
   }}
        │
        ▼
[FE: OAuthModal]  on ok → POST /api/oauth/qoder/exchange            route.js POST branch "exchange"
   └─ createProviderConnection({
        provider:"qoder", authType:"oauth", tokens,
        mapTokens() → {
          accessToken, refreshToken,
          expiresAt = parseExpiry,
          displayName = name || "qoder-user-<userId>",
          providerSpecificData: {
            authMethod: "device",
            userId, machineId, organizationId
          },
          testStatus: "active"
        }
      })
        │
        ▼
SQLite /root/.9router/db/data.sqlite
   table providerConnections WHERE provider='qoder'
   • accessToken   = dt-…         (device token, ~30 hari)
   • refreshToken  = drt-…
   • expiresAt     = ISO date
   • isActive      = 1 selama expiresAt > now
```

---

## Token lifecycle

- Token lifetime ~30 hari (parse dari `body.expires_at` atau `expires_in`).
- **Refresh endpoint `https://center.qoder.sh/algo/api/v3/user/refresh_token` balas 403 untuk device flow** → user harus re-login manual.
- Quota check terpisah: `GET https://openapi.qoder.sh/api/v2/quota/usage` pakai token yang sama.
- `providerConnections.testStatus` di-mark `"active"` setelah save. `lastUsedAt` di-update tiap chat request.

## PKCE note

- NexRouter **tetap generate PKCE pair di `initiateDeviceFlow()`** (matches qodercli/Veria reference), tapi di `/start` server-side **gak kirim `codeChallenge` ke upstream** karena Qoder di-tag `noPkceDeviceProviders`.
- `challenge_method=S256` + `verifier` tetap dipakai di polling URL (`deviceToken/poll?…&challenge_method=S256&verifier=…`).
- `machine_id` di URL authorize → Qoder bind token ke device UUID. `machineId` yang sama juga dipakai untuk Cosy header signing di inference nanti.

---

## Saat user chat model `qd/<model>`

```
src/lib/oauth/providers.js                  (connection lookup by provider)
        │
        ▼
open-sse/executors/qoder.js                 https://github.com/DEYLNN/nexrouter-backend/blob/main/open-sse/executors/qoder.js
   • getQoderModelConfig(credentials, qoderKey)
        — open-sse/services/qoderModels.js (live catalog fetch + 5min cache)
   • buildCosyHeaders({ credentials, userId, machineId })
        — src/lib/qoder/cosy.js      (RSA+AES+MD5 signing, ~17 Cosy-* headers)
   • qoderEncodeBody(plaintext)
        — src/lib/qoder/encoding.js  (WAF-bypass scheme)
   • POST https://api3.qoder.sh/algo/api/v2/service/pro/sse/agent_chat_generation
       ?FetchKeys=llm_model_result&AgentId=agent_common&Encode=1
        — body shape: chat_context + business block + system hoisted
   • unwrap SSE envelope {statusCodeValue, body} → OpenAI stream chunks
```

---

## Status snapshot — 2026-06-20

| Endpoint | Status |
|---|---|
| `openapi.qoder.sh/api/v1/userinfo` | ✅ 200 OK |
| `openapi.qoder.sh/api/v1/deviceToken/poll` | ✅ OK (login flow) |
| `openapi.qoder.sh/api/v2/quota/usage` | ✅ OK |
| `center.qoder.sh/.../refresh_token` | ❌ 403 (device flow no refresh) |
| `api3.qoder.sh/algo/api/v2/model/list` | ✅ OK |
| `api3.qoder.sh/.../agent_chat_generation` (chat) | ❌ ECONNRESET / hang |

Kesimpulan: **OAuth login + model list OK**, tapi **inference chat protocol Qoder update dibutuhkan** sebelum `qd/<model>` work lagi.

Static model list `QODER_MODEL_MAP` (di `src/lib/qoder/constants.js`) udah disederhanakan jadi cuma `qmodel_latest` (Qwen3.7-Max). Mirror di FE `open-sse/config/providerModels.js` ikut update.

Build status:
- FE push `01bcd41 Update Qoder supported model catalog`
- BE push `6f02e3e Update Qoder supported model catalog`
- PM2 `ai-gateway-hono-backend` restarted

---

## File map

BE (`projects/ai-gateway-hono-backend`):
- `src/lib/oauth/services/qoder.js` — QoderService: initiateDeviceFlow, pollDeviceToken, fetchUserInfo, parseExpiry
- `src/lib/oauth/providers.js` (line ~522+) — requestDeviceCode & pollToken config
- `src/app/api/oauth/[provider]/[action]/route.js` — `/start`, `/poll`, `/exchange`
- `src/lib/qoder/constants.js` — QODER_* URLs + IDE constants + RSA pubkey
- `src/lib/qoder/cosy.js` — Cosy-* header builder (signing)
- `src/lib/qoder/encoding.js` — WAF-bypass body encoder
- `open-sse/executors/qoder.js` — chat layer
- `open-sse/services/qoderModels.js` — model catalog + cache
- `open-sse/config/providerModels.js` — static `qd` alias list

FE (`projects/ai-gateway-next-frontend`, mirror):
- `src/shared/components/OAuthModal.js` — UI modal + startPolling loop
- `src/lib/oauth/services/qoder.js` (mirror BE)
- `src/lib/qoder/cosy.js`, `encoding.js`, `constants.js` (mirror BE)
- `open-sse/config/providerModels.js` (mirror BE)

Repos:
- BE: https://github.com/DEYLNN/nexrouter-backend
- FE: https://github.com/DEYLNN/nexrouter-frontend
