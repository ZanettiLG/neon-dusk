# @neon-dusk/server

Node.js 22 + TypeScript + Fastify + Knex.js (PostgreSQL) + Redis (ioredis).

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | tsx watch on `src/server.ts` |
| `npm run build` | `tsc` → `dist/` |
| `npm run start` | `node dist/server.js` |
| `npm run typecheck` | `tsc --noEmit` + DB layer (`tsconfig.db.json`: knexfile, migrations, seeds) |
| `npm run db:migrate` | `npx knex --knexfile knexfile.ts migrate:latest` |
| `npm run db:seed` | `npx knex --knexfile knexfile.ts seed:run` |
| `npm run db:migrate:rollback` | Roll back the last migration batch |
| `npm run db:migrate:make` | Scaffold a new migration file |

The app boot (`src/server.ts` → `initDb`) also applies migrations + content
seeds automatically; the CLI commands above are for manual/CI use.

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
