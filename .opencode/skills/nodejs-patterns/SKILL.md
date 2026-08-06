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
| ORM | Drizzle | latest |
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

### Database Access (Drizzle)
```typescript
// Model definition
import { pgTable, uuid, text, integer, timestamp } from 'drizzle-orm/pg-core'

export const characters = pgTable('characters', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id').notNull().references(() => users.id),
  name: text('name').notNull(),
  body: integer('body').notNull().default(3),
  reflexes: integer('reflexes').notNull().default(3),
  intelligence: integer('intelligence').notNull().default(3),
  technical: integer('technical').notNull().default(3),
  cool: integer('cool').notNull().default(3),
  role: text('role').notNull(),
  streetCred: integer('street_cred').notNull().default(0),
  humanity: integer('humanity').notNull().default(100),
  eddies: integer('eddies').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
})
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
- ❌ N+1 queries (usar JOINs ou Drizzle `with`)
