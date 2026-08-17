# Beta Readiness Checklist — Neon Dusk

> Última atualização: 2026-08-06  
> Feature: ND-018 — MVP Integration & Polish

---

## Infrastructure

- [ ] `docker-compose.yml` — dev stack (Postgres + Redis + app) functional
- [ ] `docker-compose.test.yml` — isolated test stack on separate ports
- [ ] `docker-compose.prod.yml` — production-grade config
- [ ] Health check endpoint (`/api/health`) — DB + Redis connectivity verified
- [ ] CI/CD pipeline — GitHub Actions workflows passing
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
- [ ] NIL energy — regen, consume, stim (syn-café)
- [ ] Gigs — 5-phase loop (meet → legwork → execute → escape → wrap-up)
- [ ] Economy — wallets, vendor purchases, transaction log
- [ ] Chrome — catalog, install, uninstall, humanity drain
- [ ] Moral — leaderboard, thresholds, titles
- [ ] PvP — attack, cooldown, power ranges
- [ ] Saideira Hub — chat (SSE), legends, crew leaderboard
- [ ] Crews — creation (Moral ≥ 25, 5k G$), invites, join, leave, chat
- [ ] Round system — 14-day rounds, automated reset, intermission
- [ ] Admin panel — player management, economy dashboard, params, audit log
- [ ] Admin API — x-api-key + JWT admin role, rate limiting

## UX Polish

- [ ] Loading states — all action buttons show spinner & disable on submit
- [ ] Portuguese error messages — all API errors mapped to PT-BR
- [ ] Empty states — friendly messages for empty lists
- [ ] Confirmation dialogs — destructive actions (uninstall chrome, abandon gig, ban, reset)
- [ ] Mobile responsive — 375px+ working, no horizontal overflow
- [ ] Accessibility — `lang="pt-BR"`, focus-visible outlines, labeled inputs

## Economy

- [ ] Faucets — gig payouts, PvP rewards, initial balance (500 G$)
- [ ] Sinks — vendor purchases, chrome install, crew creation
- [ ] Zero inflation — round reset wipes all Grana
- [ ] Transaction log — append-only, check-constrained (after - before == amount)
- [ ] Wallet versioning — optimistic locking prevents race conditions
- [ ] `check:economy` invariants pass

## Round Reset

- [ ] Active gigs wiped
- [ ] Gig history wiped
- [ ] Installed chrome wiped
- [ ] PvP combat history wiped
- [ ] Heat reset
- [ ] Transaction log wiped
- [ ] Crews wiped (memberships detached first)
- [ ] Wallets zeroed
- [ ] Characters reset: NIL=100, Moral=0, humanity=100
- [ ] Legends preserved (permanent hall of fame)
- [ ] Auto-trigger works (14-day cron)
- [ ] Manual trigger works (POST /api/round/trigger-reset)

## Security

- [ ] Rate limiting — global per-IP (`@fastify/rate-limit`)
- [ ] Per-action rate limits — register, login, PvP, chat
- [ ] Circuit breaker — 3 failures → 24h ban per character
- [ ] Cooldowns — gig accept (30s), PvP (1h), chat (5s), chrome (60s)
- [ ] JWT — HS256, 15min access, refresh token rotation
- [ ] Admin protection — x-api-key + JWT admin role + admin rate limit
- [ ] Audit log — every mutating action recorded with IP, UA, result
- [ ] Input validation — Zod schemas on all endpoints
- [ ] CORS — whitelisted origins
- [ ] No secrets in code — all via `env.ts` (Zod-validated)

## Launch

- [ ] Production env config — `NODE_ENV=production`, real JWT secrets
- [ ] Database seeded — admin account, vendors, chrome catalog, gig templates
- [ ] Admin account — email + password set via `ADMIN_EMAIL`/`ADMIN_PASSWORD` env
- [ ] DNS configured — neondusk.gg or staging subdomain
- [ ] TLS — HTTPS via reverse proxy (nginx/caddy)
- [ ] Community channels — Discord, X/Twitter, landing page
- [ ] Monitoring — Prometheus metrics endpoint, alerting
