# Beta Readiness Checklist — Neon Dusk

> Última atualização: 2026-09-02
> Feature: ND-018 — MVP Integration & Polish

---

## Infrastructure

- [x] `docker-compose.yml` — dev stack (Postgres + Redis + app) functional
- [x] `docker-compose.test.yml` — isolated test stack on separate ports
- [x] `docker-compose.prod.yml` — production-grade config
- [x] Health check endpoint (`/api/health`) — DB + Redis connectivity verified
- [x] Lint + typecheck + testes rodando localmente antes do deploy
- [x] Deploy de produção scriptado (`scripts/deploy-prod.sh`) — extraído do workflow removido
- [x] Rollback plan — redeploy previous image tag (`docs/ops/rollback.md`)
- [x] Database backups — automated daily pg_dump (`scripts/backup-db.sh` + cron)

## Tests

- [x] Unit tests — game logic, services, middleware
- [x] Integration tests — API endpoints with real DB/Redis
- [x] E2E player loop — full character lifecycle (register → PvP → reset)
- [x] Smoke test — every route returns non-5xx
- [x] Economy integrity — `check:economy` passes all 6 invariants
- [x] `npx vitest run` — zero failures across all suites
- [x] `npm run typecheck` — zero errors

## MVP Features

- [x] Account registration + login (JWT)
- [x] Character creation (name, origin, banca, 22-point attributes)
- [x] NIL energy — regen, consume, ampola (Pingado)
- [x] Trampos — 5-phase loop (meet → legwork → execute → escape → wrap-up)
- [x] Economy — wallets, vendor purchases, transaction log
- [x] Cromo — catalog, install, uninstall, humanity drain
- [x] Moral — leaderboard, thresholds, titles
- [x] PvP — attack, cooldown, power ranges
- [x] Saideira Hub — chat (SSE), legends, bonde leaderboard
- [x] Bondes — creation (Moral ≥ 25, 5k G$), invites, join, leave, chat
- [x] Round system — 14-day rounds, automated reset, intermission
- [x] Admin panel — player management, economy dashboard, params, audit log
- [x] Admin API — x-api-key + JWT admin role, rate limiting

## UX Polish

- [x] Loading states — all action buttons show spinner & disable on submit
- [x] Portuguese error messages — all API errors mapped to PT-BR
- [x] Empty states — friendly messages for empty lists
- [x] Confirmation dialogs — destructive actions (uninstall cromo 2-step, abandon trampo, ban, reset)
- [x] Mobile responsive — 375px+ working, no horizontal overflow
- [x] Accessibility — `lang="pt-BR"`, focus-visible outlines, labeled inputs

## Economy

- [x] Faucets — trampo payouts, PvP rewards, initial balance (500 G$)
- [x] Sinks — vendor purchases, cromo install, bonde creation
- [x] Zero inflation — round reset wipes all Grana
- [x] Transaction log — append-only, check-constrained (after - before == amount)
- [x] Wallet versioning — optimistic locking prevents race conditions
- [x] `check:economy` invariants pass

## Round Reset

- [x] Active trampos wiped
- [x] Trampo history wiped
- [x] Installed cromo wiped
- [x] PvP combat history wiped
- [x] Heat reset
- [x] Transaction log wiped
- [x] Bondes wiped (memberships detached first)
- [x] Wallets zeroed
- [x] Characters reset: NIL=100, Moral=0, humanity=100
- [x] Legends preserved (permanent hall of fame)
- [x] Auto-trigger works (14-day cron)
- [x] Manual trigger works (POST /api/round/trigger-reset)

## Security

- [x] Rate limiting — global per-IP (`@fastify/rate-limit`)
- [x] Per-action rate limits — register, login, PvP, chat
- [x] Circuit breaker — 3 failures → 24h ban per character
- [x] Cooldowns — chat (500ms), convite (500ms), PvP (500ms), trampos (5s–24h por tier), terapia (500ms), consumíveis (sem cooldown), Pingado (sem cooldown), habilidades (4–24h)
- [x] Audit log — every mutating action recorded with IP, UA, result (UA normalization post-MVP)
- [x] Input validation — Zod schemas on all endpoints
- [x] Admin ban gate — banned characters blocked from login and all actions (`403 BANNED`)
- [x] JWT — HS256, 15min access, refresh token rotation
- [x] Admin protection — x-api-key + JWT admin role + admin rate limit
- [x] CORS — whitelisted origins (multi-origin `CORS_ORIGIN`)
- [x] No secrets in code — all via `env.ts` (Zod-validated)

## Launch

- [x] Production env config — `NODE_ENV=production`, real JWT secrets
- [x] Database seeded — admin account, vendors, cromo catalog, trampo templates
- [x] Admin account — email + password set via `ADMIN_EMAIL`/`ADMIN_PASSWORD` env
- [ ] DNS configured — neondusk.gg or staging subdomain (OPS — blocked: infra externa)
- [ ] TLS — HTTPS via reverse proxy (nginx/caddy) (OPS — blocked: infra externa)
- [ ] Community channels — Discord, X/Twitter, landing page (OPS — blocked: infra externa)
- [x] Monitoring — Prometheus metrics endpoint, alerting (`prometheus/alerts.yml`)

---

## Notas ND-018 (2026-09-02)

- **BUILD-1** backups diários: `scripts/backup-db.sh` + `docs/ops/backup.md`.
- **BUILD-2** alerting: `prometheus/alerts.yml` + métrica `neondusk_http_requests_total`
  adicionada (`server/src/telemetry/metrics.ts` + middleware) — nomes verificados contra o código.
- **BUILD-3** rollback: `docs/ops/rollback.md` (auto-rollback real do deploy-prod.sh).
- **BUILD-4** CORS multi-origin: `CORS_ORIGIN` comma-separated → `corsOrigins` (env.ts) +
  `sseCorsHeaders` ecoando a origin da request (saideira + chat de bonde SSE).
- **BUILD-5** uninstall de cromo 2-step: 1º clique arma, 2º confirma, reset em 3s.
- **BUILD-6** calibração: `scripts/calibration-report.ts` + `npm run calibration:report` +
  `docs/ops/calibration*.md`.
- `check:economy` reescrito (drizzle-orm não era dependência e o draft importava
  schema inexistente) — 6 invariantes passam com Knex real e escopo `econ-check`.
