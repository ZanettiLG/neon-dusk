# Neon Dusk

Build your chrome. Burn your name. Leave a legend.

A cyberpunk RPG PWA, AI-orchestrated via OpenCode agents.

## Stack

- **Backend**: Node.js 22 + TypeScript + Fastify + PostgreSQL (Drizzle) + Redis (ioredis)
- **Frontend**: Vue 3 + Pinia + Tailwind CSS + PWA (Vite)
- **Infra**: Docker Compose (PostgreSQL 16 + Redis 7), npm workspaces monorepo

## Getting Started

```bash
# 1. Start PostgreSQL + Redis
docker compose up -d

# 2. Install all workspaces (server, app, packages/shared)
npm install

# 3. Copy env templates
cp .env.example .env
cp server/.env.example server/.env
cp app/.env.example app/.env

# 4. Apply database migrations
npm run db:migrate

# 5. Run server (:3000) + app (:5173)
npm run dev
```

Verify: `curl http://localhost:3000/api/health` returns `{"status":"ok",...}`.

## Commands

| Command                          | Purpose                          |
| -------------------------------- | -------------------------------- |
| `npm run dev`                    | Server + app in parallel         |
| `npm run dev:server` / `dev:app` | Individual dev servers           |
| `npm run build`                  | Type-check + build both packages |
| `npm run typecheck`              | `tsc --noEmit` for server + app  |
| `npm run lint`                   | ESLint 9 (flat config)           |
| `npm run format`                 | Prettier write                   |
| `npm run db:generate`            | Generate Drizzle migration       |
| `npm run db:migrate`             | Apply migrations                 |
| `npm run db:studio`              | Drizzle Studio                   |

## Structure

```
├── server/            # Fastify API (@neon-dusk/server)
├── app/               # Vue 3 PWA (@neon-dusk/app)
└── packages/shared/   # Shared types scaffold (@neon-dusk/shared)
```

## Documentation

- Product definitions: `docs/definicoes-de-produto/`
- Market research: `docs/pesquisa-de-mercado/`
- Development system: `docs/sistema-de-desenvolvimento/`
- Agent instructions: `AGENTS.md`

## Agent Commands

| Command               | Purpose                    |
| --------------------- | -------------------------- |
| `/dev-feature`        | Full feature pipeline      |
| `/dev-review`         | Code review                |
| `/dev-refactor`       | Refactor code              |
| `/dev-debug`          | Debug issue                |
| `/dev-research`       | Research topic             |
| `/dev-lore`           | Generate lore              |
| `/dev-schema`         | Schema design              |
| `/refine-dev-harness` | Refine development harness |
