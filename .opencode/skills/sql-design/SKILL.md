---
name: sql-design
description: Database design patterns for PostgreSQL. Covers schema design, migrations, indexes, and constraints. Use when creating or modifying migrations, designing schemas for new features, or reviewing queries.
license: MIT
compatibility: opencode
metadata:
  audience: agents
  domain: database-design
---

# SQL Design — Padrões de Banco para PostgreSQL

Skill de design de banco de dados. Schema, migrations, índices, constraints.

## Quando Carregar
- Criando ou modificando migrations
- Desenhando schema para novas features
- Revisando queries
- Carregada por: `architect`, `db-designer`, `developer`

## Nomeação

| Elemento | Convenção | Exemplo |
|---|---|---|
| Tabelas | plural, snake_case | `characters`, `street_crews` |
| Colunas | singular, snake_case | `street_cred`, `trauma_team_tier` |
| PK | `id` (UUID) | `id UUID DEFAULT gen_random_uuid() PRIMARY KEY` |
| FK | `table_singular_id` | `user_id`, `crew_id` |
| Índices | `idx_table_column` | `idx_characters_street_cred` |
| Enums | UPPER_SNAKE_CASE | `GIG_TYPE`, `CREW_ROLE` |
| Timestamps | `created_at`, `updated_at` | Em TODA tabela |

## Migrations (Knex)

### Migration File Pattern

**Regra: UMA entidade por migration** — cada migration cria/altera UMA tabela (ou entidade fortemente acoplada). Nunca edite uma migration já aplicada; schema novo sempre entra em migration nova (arquivo sequencial + `up`/`down`).

```typescript
// db/migrations/0002_create_characters.ts
import { Knex } from 'knex'

export function up(knex: Knex): Promise<void> {
  return knex.schema.createTable('characters', table => {
      table.uuid('id').primary().notNullable()
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('cascade')
      table.text('name').notNullable().unique()
      table.integer('body').notNullable().defaultTo(3)
      table.integer('reflexes').notNullable().defaultTo(3)
      table.integer('intelligence').notNullable().defaultTo(3)
      table.integer('technical').notNullable().defaultTo(3)
      table.integer('cool').notNullable().defaultTo(3)
      table.specificType('role', 'role_type').notNullable() // enum via .raw() + .createType()
      table.integer('moral').notNullable().defaultTo(0)
      table.integer('humanity').notNullable().defaultTo(100)
      table.integer('grana').notNullable().defaultTo(0)
      table.jsonb('inventory').defaultTo('[]')
      table.jsonb('perks').defaultTo('{}')
      table.specificType('created_at', 'timestamptz').notNullable().defaultTo(knex.fn.now())
      table.specificType('updated_at', 'timestamptz').notNullable().defaultTo(knex.fn.now())
    })
}

export function down(knex: Knex): Promise<void> {
  return knex.schema.dropTable('characters')
}
```

### Native Postgres Enums

```typescript
export function up(knex: Knex): Promise<void> {
  return knex.schema.raw(`
    CREATE TYPE role_type AS ENUM ('bicho', 'vulto', 'gambiarrista', 'despachante', 'estradeiro', 'socorrista')
  `)
}

export function down(knex: Knex): Promise<void> {
  return knex.schema.raw(`DROP TYPE IF EXISTS role_type`)
}
```

### Raw SQL for Complex Operations

```typescript
// For triggers, views, or complex DDL not covered by schema builder
export function up(knex: Knex): Promise<void> {
  return knex.schema.raw(`
    CREATE OR REPLACE FUNCTION update_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = NOW();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER characters_updated_at
      BEFORE UPDATE ON characters
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  `)
}
```

### Seed Pattern

**Regra: seeds idempotentes** — use upsert (`onConflict`/`merge`). Nunca `del()` + insert em produção (destrói FKs com ON DELETE RESTRICT e não re-roda com segurança). Um seed por entidade.

```typescript
// db/seeds/02_characters.ts
import { Knex } from 'knex'

export async function seed(knex: Knex): Promise<void> {
  await knex('characters')
    .insert([
      { id: '550e8400-e29b-41d4-a716-446655440000', name: 'Vex', body: 5, reflexes: 8 }
    ])
    .onConflict('id')
    .ignore() // re-run safe: skips rows that already exist
}
```

### Key Schema Builder Methods

| Method | Use |
|---|---|
| `table.uuid('id')` | UUID column (use `.defaultTo(knex.raw('gen_random_uuid()'))` if not app-generated) |
| `table.specificType('col', 'timestamptz')` | Native PostgreSQL types |
| `table.jsonb('data')` | JSONB with default `'{}'` or `'[]'` |
| `table.enu('col', [...], { useNative: true, enumName: 'type' })` | Native PG enum (alternative to raw CREATE TYPE) |
| `table.increments('id')` | Auto-increment serial (avoid — use UUIDs) |
| `knex.schema.raw('SQL')` | Raw DDL for triggers, views, complex types |

## Constraints & Integridade

### Regras para Economia
```sql
-- Grana nunca negativa
ALTER TABLE characters ADD CONSTRAINT grana_non_negative CHECK (grana >= 0);

-- Humanidade entre 0 e 100
ALTER TABLE characters ADD CONSTRAINT humanity_range CHECK (humanity >= 0 AND humanity <= 100);

-- Moral entre 0 e 100
ALTER TABLE characters ADD CONSTRAINT moral_range CHECK (moral >= 0 AND moral <= 100);

-- Atributos entre 1 e 20
ALTER TABLE characters ADD CONSTRAINT body_range CHECK (body >= 1 AND body <= 20);
```

### Foreign Keys
```sql
-- ON DELETE: escolher com base na semântica
ALTER TABLE crew_members ADD CONSTRAINT fk_crew 
  FOREIGN KEY (crew_id) REFERENCES crews(id) ON DELETE CASCADE;
-- Se a crew for deletada, membros perdem associação

ALTER TABLE gigs ADD CONSTRAINT fk_fixer 
  FOREIGN KEY (fixer_id) REFERENCES fixers(id) ON DELETE RESTRICT;
-- Não pode deletar despachante se tem gigs pendentes

ALTER TABLE characters ADD CONSTRAINT fk_user 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
-- Se usuário for deletado, personagem também
```

## Índices

```sql
-- Leaderboard (query mais comum do jogo)
CREATE INDEX idx_characters_moral ON characters(moral DESC);

-- Busca por distrito
CREATE INDEX idx_gigs_district ON gigs(district);

-- Busca por despachante + tier
CREATE INDEX idx_gigs_fixer_tier ON gigs(fixer_id, tier);

-- FKs sempre indexadas
CREATE INDEX idx_crew_members_crew ON crew_members(crew_id);
CREATE INDEX idx_crew_members_character ON crew_members(character_id);

-- Partial index para soft deletes
CREATE INDEX idx_characters_active ON characters(street_cred) WHERE deleted_at IS NULL;
```

## JSONB para Dados Semi-Estruturados

```sql
-- Inventário do jogador: array de itens com quantidades
ALTER TABLE characters ADD COLUMN inventory JSONB DEFAULT '[]'::jsonb;

-- Perks do jogador: objeto chave-valor
ALTER TABLE characters ADD COLUMN perks JSONB DEFAULT '{}'::jsonb;

-- Query: jogadores com item específico
SELECT * FROM characters WHERE inventory @> '[{"item_id": "uuid"}]';
```

## Anti-Padrões
- ❌ Serial/Integer para PKs (UUIDs evitam colisões e expõem menos info)
- ❌ Sem constraints de integridade (o banco é a última linha de defesa)
- ❌ `SELECT *` em queries de produção
- ❌ Missing indexes em colunas usadas em WHERE/JOIN/ORDER BY
- ❌ Transactions abertas longas (bloqueiam linhas)
- ❌ N+1 queries (um SELECT por linha em loop)
- ❌ Soft delete sem partial index
- ❌ Migrations sem down migration
- ❌ Migration consolidada (todas as tabelas num arquivo só) — uma entidade por migration
- ❌ Editar migration já aplicada — schema novo sempre em migration nova
- ❌ Seed destrutivo (`del()` + insert) — seeds devem ser idempotentes (upsert/onConflict)
- ❌ Lógica de seed duplicada — a mesma entidade semeada em 2+ lugares
- ❌ Imports diretos de `db` em rotas — queries pertencem a services (repository layer quando existir)
- ❌ Scripts customizados de migrate/seed quando o knex nativo resolve (`knex migrate:latest` / `knex seed:run`)
