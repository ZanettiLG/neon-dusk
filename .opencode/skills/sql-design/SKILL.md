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

## Migrations (Drizzle)

```typescript
// db/migrations/0000_create_characters.ts
import { pgTable, uuid, text, integer, timestamp, pgEnum } from 'drizzle-orm/pg-core'

export const roleEnum = pgEnum('role', ['solo', 'netrunner', 'tech', 'fixer', 'nomad'])

export const characters = pgTable('characters', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull().unique(),
  body: integer('body').notNull().default(3),
  reflexes: integer('reflexes').notNull().default(3),
  intelligence: integer('intelligence').notNull().default(3),
  technical: integer('technical').notNull().default(3),
  cool: integer('cool').notNull().default(3),
  role: roleEnum('role').notNull(),
  streetCred: integer('street_cred').notNull().default(0),
  humanity: integer('humanity').notNull().default(100),
  eddies: integer('eddies').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
})
```

## Constraints & Integridade

### Regras para Economia
```sql
-- Eddies nunca negativos
ALTER TABLE characters ADD CONSTRAINT eddies_non_negative CHECK (eddies >= 0);

-- Humanidade entre 0 e 100
ALTER TABLE characters ADD CONSTRAINT humanity_range CHECK (humanity >= 0 AND humanity <= 100);

-- Street Cred entre 0 e 100
ALTER TABLE characters ADD CONSTRAINT street_cred_range CHECK (street_cred >= 0 AND street_cred <= 100);

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
-- Não pode deletar fixer se tem gigs pendentes

ALTER TABLE characters ADD CONSTRAINT fk_user 
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
-- Se usuário for deletado, personagem também
```

## Índices

```sql
-- Leaderboard (query mais comum do jogo)
CREATE INDEX idx_characters_street_cred ON characters(street_cred DESC);

-- Busca por distrito
CREATE INDEX idx_gigs_district ON gigs(district);

-- Busca por fixer + tier
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
