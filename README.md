# Neon Dusk

Monta teu cromo. Queima teu nome. Vira lenda.

A cyberpunk RPG PWA, AI-orchestrated via OpenCode agents.

## Stack

- **Backend**: Node.js 22 + TypeScript + Fastify + PostgreSQL (Knex.js) + Redis (ioredis)
- **Frontend**: React 19 + Zustand + Tailwind CSS + PWA (Vite)
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

## ⚠️ Upgrade de ambiente existente (one-shot)

A refatoração #158 (camada de repository) dividiu a migration consolidada
`0001_initial_schema` em 25 migrations por tabela. Bancos criados ANTES dessa
refatoração têm `0001_initial_schema` gravado em `knex_migrations`, mas o
arquivo não existe mais — `migrate:latest` aborta nesses ambientes.

Como o DDL novo é byte-equivalente ao antigo e os dados de dev/staging são
descartáveis, o upgrade é um reset one-shot antes do primeiro boot:

```bash
# Opção A — recriar os volumes do compose (apaga o banco do container)
docker compose down -v

# Opção B — limpar o schema mantendo o container de pé (via psql)
docker compose exec -T postgres psql -U neondusk -d neondusk \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
```

Depois do reset, o próximo boot (ou `npm run db:migrate`) recria o schema a
partir das novas migrations. NÃO rode isso em banco com dados que importam.

## Commands

| Command                          | Purpose                          |
| -------------------------------- | -------------------------------- |
| `npm run dev`                    | Server + app in parallel         |
| `npm run dev:server` / `dev:app` | Individual dev servers           |
| `npm run build`                  | Type-check + build both packages |
| `npm run typecheck`              | `tsc --noEmit` for server + app  |
| `npm run lint`                   | ESLint 9 (flat config)           |
| `npm run format`                 | Prettier write                   |
| `npm run db:migrate`             | Apply migrations (Knex)         |
| `npm run db:seed -w server`      | Seed content (Knex)             |

## Deploy de produção

O deploy roda **na VPS** (`/opt/neon-dusk`), não no laptop:

```bash
ssh vps && cd /opt/neon-dusk && git pull && ./scripts/deploy-prod.sh
```

O script puxa imagens, roda migrations, sobe a stack, smoke-testa (`/` e
`/api/health`) e faz rollback automático se algo falhar. As imagens GHCR
atualizam apenas via build manual (o job `build-and-push` foi removido) —
use `DRY_RUN=1` para simular o fluxo sem executar.

## Structure

```
├── server/            # Fastify API (@neon-dusk/server)
├── app/               # React 19 PWA (@neon-dusk/app)
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
