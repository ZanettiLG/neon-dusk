# Beta Readiness Checklist — Neon Dusk

> Última atualização: 2026-08-06  
> Feature: ND-018 — MVP Integration & Polish

---

## Infrastructure

- [ ] `docker-compose.yml` — dev stack (Postgres + Redis + app) functional
- [ ] `docker-compose.test.yml` — isolated test stack on separate ports
- [ ] `docker-compose.prod.yml` — production-grade config
- [ ] Health check endpoint (`/api/health`) — DB + Redis connectivity verified
- [ ] Lint + typecheck + testes rodando localmente antes do deploy
- [ ] Deploy de produção scriptado (`scripts/deploy-prod.sh`) — extraído do workflow removido
- [ ] Rollback plan — redeploy previous image tag
- [ ] Database backups — automated daily pg_dump

## Tests

- [ ] Unit tests — game logic, services, middleware
- [ ] Integration tests — API endpoints with real DB/Redis
- [ ] E2E player loop — full character lifecycle (register → PvP → reset)
- [ ] Smoke test — every route returns non-5xx
- [ ] Economy integrity — `check:economy` passes all 6 invariants
- [ ] `npx vitest run` — zero failures across all suites
- [ ] `npm run typecheck` — zero errors

## MVP Features

- [ ] Account registration + login (JWT)
- [ ] Character creation (name, origin, banca, 22-point attributes)
- [ ] NIL energy — regen, consume, ampola (Pingado)
- [ ] Trampos — 5-phase loop (meet → legwork → execute → escape → wrap-up)
- [ ] Economy — wallets, vendor purchases, transaction log
- [ ] Cromo — catalog, install, uninstall, humanity drain
- [ ] Moral — leaderboard, thresholds, titles
- [ ] PvP — attack, cooldown, power ranges
- [ ] Saideira Hub — chat (SSE), legends, bonde leaderboard
- [ ] Bondes — creation (Moral ≥ 25, 5k G$), invites, join, leave, chat
- [ ] Round system — 14-day rounds, automated reset, intermission
- [ ] Admin panel — player management, economy dashboard, params, audit log
- [ ] Admin API — x-api-key + JWT admin role, rate limiting

## UX Polish

- [ ] Loading states — all action buttons show spinner & disable on submit
- [ ] Portuguese error messages — all API errors mapped to PT-BR
- [ ] Empty states — friendly messages for empty lists
- [ ] Confirmation dialogs — destructive actions (uninstall cromo, abandon trampo, ban, reset)
- [ ] Mobile responsive — 375px+ working, no horizontal overflow
- [ ] Accessibility — `lang="pt-BR"`, focus-visible outlines, labeled inputs

## Economy

- [ ] Faucets — trampo payouts, PvP rewards, initial balance (500 G$)
- [ ] Sinks — vendor purchases, cromo install, bonde creation
- [ ] Zero inflation — round reset wipes all Grana
- [ ] Transaction log — append-only, check-constrained (after - before == amount)
- [ ] Wallet versioning — optimistic locking prevents race conditions
- [ ] `check:economy` invariants pass

## Round Reset

- [ ] Active trampos wiped
- [ ] Trampo history wiped
- [ ] Installed cromo wiped
- [ ] PvP combat history wiped
- [ ] Heat reset
- [ ] Transaction log wiped
- [ ] Bondes wiped (memberships detached first)
- [ ] Wallets zeroed
- [ ] Characters reset: NIL=100, Moral=0, humanity=100
- [ ] Legends preserved (permanent hall of fame)
- [ ] Auto-trigger works (14-day cron)
- [ ] Manual trigger works (POST /api/round/trigger-reset)

## Security

- [x] Rate limiting — global per-IP (`@fastify/rate-limit`)
- [x] Per-action rate limits — register, login, PvP, chat
- [x] Circuit breaker — 3 failures → 24h ban per character
- [x] Cooldowns — trampo accept (30s), PvP (1h), chat (5s), cromo (60s)
- [x] Audit log — every mutating action recorded with IP, UA, result (UA normalization post-MVP)
- [x] Input validation — Zod schemas on all endpoints
- [x] Admin ban gate — banned characters blocked from login and all actions (`403 BANNED`)
- [ ] JWT — HS256, 15min access, refresh token rotation
- [ ] Admin protection — x-api-key + JWT admin role + admin rate limit
- [ ] CORS — whitelisted origins
- [ ] No secrets in code — all via `env.ts` (Zod-validated)

## Launch

- [ ] Production env config — `NODE_ENV=production`, real JWT secrets
- [ ] Database seeded — admin account, vendors, cromo catalog, trampo templates
- [ ] Admin account — email + password set via `ADMIN_EMAIL`/`ADMIN_PASSWORD` env
- [ ] DNS configured — neondusk.gg or staging subdomain
- [ ] TLS — HTTPS via reverse proxy (nginx/caddy)
- [ ] Community channels — Discord, X/Twitter, landing page
- [ ] Monitoring — Prometheus metrics endpoint, alerting
