---
name: nodejs-patterns
description: Node.js TypeScript backend patterns. Covers project structure, conventions, and anti-patterns. Use when implementing backend code (routes, services, models) or reviewing backend code.
license: MIT
compatibility: opencode
metadata:
  audience: agents
  domain: backend
---

# Node.js Patterns — Padrões para Backend TypeScript

Skill de padrões de código para o backend do Neon Dusk. Convenções, estrutura e anti-padrões.

## Quando Carregar
- Implementando código backend (routes, services, models)
- Revisando código backend
- Carregada por: `architect`, `developer`, `code-reviewer`

## Estrutura de Projeto

```
src/server/
├── models/          # Tipos TypeScript e validação Zod
├── services/        # Lógica de negócio
├── routes/          # Handlers Fastify
├── middleware/       # Auth, rate-limit, error handler
├── utils/           # Helpers puros
└── index.ts         # Entry point do servidor
```

## Stack Específica

| Camada | Tecnologia | Versão |
|---|---|---|
| Runtime | Node.js | 22 LTS |
| Linguagem | TypeScript | 5.x strict |
| Framework HTTP | Fastify | 5.x |
| Validação | Zod | 3.x |
| Query Builder | Knex.js | latest |
| Cache | ioredis (Redis) | 5.x |
| Logging | Pino | latest |
| Config | env.ts com Zod | — |

## Convenções

### Nomeação
- Arquivos: kebab-case (`gig-service.ts`, `auth-middleware.ts`)
- Funções: camelCase (`calculateGigSuccess`, `validateToken`)
- Tipos/Interfaces: PascalCase (`Gig`, `Character`, `ApiResponse<T>`)
- Constantes: UPPER_SNAKE_CASE (`MAX_NIL`, `STREET_CRED_THRESHOLDS`)
- SQL: snake_case (tabelas e colunas — `street_cred`, `trauma_team`)

### Fastify Patterns
```typescript
// Route handler pattern
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { z } from 'zod'

const createGigSchema = z.object({
  type: z.enum(['extraction', 'sabotage', 'infiltration', 'wetwork', 'delivery', 'netrun', 'negotiation']),
  tier: z.number().min(1).max(5),
  district: z.string().uuid()
})

export async function gigRoutes(app: FastifyInstance) {
  app.post('/gigs', {
    preHandler: [app.authenticate],
    schema: { body: createGigSchema }
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const body = createGigSchema.parse(request.body)
    const gig = await gigService.createGig(request.user.id, body)
    return reply.status(201).send(gig)
  })
}
```

### Error Handling
```typescript
// AppError class
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string
  ) {
    super(message)
  }
}

// Error middleware
app.setErrorHandler((error, request, reply) => {
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: error.code,
      message: error.message
    })
  }
  
  // Zod validation error
  if (error instanceof z.ZodError) {
    return reply.status(400).send({
      error: 'VALIDATION_ERROR',
      message: 'Invalid request data',
      details: error.errors
    })
  }
  
  // Unexpected error
  request.log.error(error)
  return reply.status(500).send({
    error: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred'
  })
})
```

### Database Access (Knex)

```typescript
// Connection setup — src/server/db/connection.ts
import knex, { Knex } from 'knex'
import { env } from '@/server/env'

export const db: Knex = knex({
  client: 'pg',
  connection: env.DATABASE_URL,
  pool: { min: 0, max: 20 },
  migrations: { directory: './db/migrations', extension: 'ts' },
  seeds: { directory: './db/seeds' }
})
```

#### Query Builder Patterns

```typescript
// Type definition
interface Character {
  id: string
  user_id: string
  name: string
  body: number
  role: 'solo' | 'netrunner' | 'tech' | 'fixer' | 'nomad'
  street_cred: number
  eddies: number
}

// SELECT with type inference
const chars = await db<Character>('characters')
  .select('id', 'name', 'street_cred')
  .where('street_cred', '>', 50)
  .orderBy('street_cred', 'desc')

// INSERT returning
const [char] = await db<Character>('characters')
  .insert({ name: 'Vex', user_id: userId, body: 5, role: 'solo' })
  .returning('*')

// UPDATE with returning
const [updated] = await db<Character>('characters')
  .where({ id })
  .update({ street_cred: db.raw('street_cred + ?', [10]) })
  .returning('*')

// JOIN
const results = await db('gigs')
  .join('characters', 'gigs.fixer_id', 'characters.id')
  .select('gigs.*', 'characters.name as fixer_name')
  .where('gigs.district', districtId)
```

#### Transaction Patterns

```typescript
// Atomic debit
await db.transaction(async trx => {
  const [account] = await db('characters')
    .where({ id })
    .where('eddies', '>=', amount) // optimistic lock
    .transacting(trx)
    .forUpdate()
    .decrement('eddies', amount)
    .returning('eddies')

  if (!account) throw new AppError(400, 'INSUFFICIENT_FUNDS', 'Not enough eddies')

  await db('transaction_log')
    .insert({ character_id: id, amount: -amount, reason })
    .transacting(trx)
})
```

#### Raw Queries

```typescript
// For complex queries the query builder can't express cleanly
const result = await db.raw('SELECT * FROM leaderboard(?, ?)', [district, limit])
```

### Redis Caching
```typescript
// Cache pattern: always set TTL
await redis.set(`leaderboard:${district}`, JSON.stringify(data), 'EX', 300) // 5 min TTL
const cached = await redis.get(`leaderboard:${district}`)
```

## Anti-Padrões
- ❌ `any` (usar `unknown` e type narrowing)
- ❌ SQL com template literals (`SELECT * FROM users WHERE id = ${id}`)
- ❌ `console.log` (usar `request.log` ou `logger`)
- ❌ Secrets hardcoded (sempre `process.env` via `env.ts`)
- ❌ Callbacks ou `.then()` chains (sempre async/await)
- ❌ Rotas sem validação de input (sempre Zod)
- ❌ Transactions longas (manter <500ms)
- ❌ `SELECT *` (listar colunas explicitamente)
- ❌ N+1 queries (usar JOINs ou Knex eager-loading)
