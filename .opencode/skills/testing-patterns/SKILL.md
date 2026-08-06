---
name: testing-patterns
description: Testing strategies for Neon Dusk. Covers Vitest, Supertest, Playwright, Testing Library (React), and pg-mem patterns. Use when writing automated tests or reviewing test coverage.
license: MIT
compatibility: opencode
metadata:
  audience: agents
  domain: testing
---

# Testing Patterns — Estratégias de Teste

Skill de padrões de teste para Neon Dusk. Vitest, Supertest, Playwright, pg-mem.

## Quando Carregar
- Escrevendo testes automatizados
- Revisando cobertura de testes
- Carregada por: `test-writer`, `code-reviewer`

## Stack

| Tipo | Ferramenta |
|---|---|
| Test Runner | Vitest |
| API Testing | Supertest |
| E2E | Playwright |
| DB Testing | pg-mem (unit), testcontainers (integration) |

## Estrutura

```
tests/
├── unit/
│   ├── services/
│   └── game-logic/
├── integration/
│   └── api/
├── e2e/
│   └── flows/
└── fixtures/
    └── seed.ts
```

## Unit Test Pattern

```typescript
// tests/unit/game-logic/gig-success.test.ts
import { describe, it, expect } from 'vitest'
import { calculateGigSuccess } from '@/server/game-logic/gig-success'

describe('calculateGigSuccess', () => {
  it('should return 50% when stats equal difficulty', () => {
    const result = calculateGigSuccess({
      body: 5, reflexes: 5, chromePower: 0
    }, 10)
    expect(result).toBeCloseTo(0.5, 2)
  })

  it('should return 100% when stats double difficulty', () => {
    const result = calculateGigSuccess({
      body: 10, reflexes: 10, chromePower: 0
    }, 10)
    expect(result).toBe(1)
  })

  it('should cap at 95% max (never guaranteed)', () => {
    const result = calculateGigSuccess({
      body: 20, reflexes: 20, chromePower: 50
    }, 5)
    expect(result).toBe(0.95)
  })

  it('should throw on negative difficulty', () => {
    expect(() => calculateGigSuccess({
      body: 5, reflexes: 5, chromePower: 0
    }, -1)).toThrow('Difficulty must be positive')
  })
})
```

## Integration Test Pattern

```typescript
// tests/integration/api/gigs.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import supertest from 'supertest'
import { buildApp } from '@/server/index'

describe('POST /gigs', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let authToken: string

  beforeAll(async () => {
    app = await buildApp({ testing: true })
    const res = await supertest(app.server)
      .post('/auth/login')
      .send({ email: 'test@neondusk.com', password: 'test123' })
    authToken = res.body.token
  })

  afterAll(async () => {
    await app.close()
  })

  it('should create a gig with valid data', async () => {
    const res = await supertest(app.server)
      .post('/gigs')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        type: 'extraction',
        tier: 1,
        district: '550e8400-e29b-41d4-a716-446655440000'
      })
    
    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('id')
    expect(res.body.type).toBe('extraction')
  })

  it('should return 400 for invalid gig type', async () => {
    const res = await supertest(app.server)
      .post('/gigs')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        type: 'invalid_type',
        tier: 1,
        district: '550e8400-e29b-41d4-a716-446655440000'
      })
    
    expect(res.status).toBe(400)
    expect(res.body.error).toBe('VALIDATION_ERROR')
  })

  it('should return 401 without auth', async () => {
    const res = await supertest(app.server)
      .post('/gigs')
      .send({ type: 'extraction', tier: 1, district: 'uuid' })
    
    expect(res.status).toBe(401)
  })
})
```

## Test Naming Convention

```
describe('Unit/Feature', () => {
  it('should [expected behavior] when [condition]', () => {})
})
```

Exemplos:
- `it('should return 400 when name is empty')`
- `it('should apply diminishing returns after 10 uses')`
- `it('should prevent PvP when attacker level differs by >10')`

## React Component Testing

```typescript
// tests/unit/components/CharacterCard.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { CharacterCard } from '@/components/CharacterCard'

describe('CharacterCard', () => {
  it('should display character name after fetch', async () => {
    render(
      <MemoryRouter>
        <CharacterCard
          characterId="char-1"
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Street Cred:')).toBeInTheDocument()
    })
  })
})
```

### Vitest + React Config

```typescript
// vitest.setup.ts
import '@testing-library/jest-dom/vitest'
```

```typescript
// vitest.config.ts — frontend test environment
{
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
  }
}
```

### Zustand Store Testing

Zustand stores can be tested without React wrappers — use `getState()`/`setState()`:

```typescript
import { useCharacterStore } from '@/stores/character'

it('should add character to store', () => {
  useCharacterStore.setState({ characters: new Map() })
  expect(useCharacterStore.getState().characters.size).toBe(0)
})
```

### React Router Testing

Wrap components with `<MemoryRouter>` for route-aware components:
```tsx
render(<MemoryRouter initialEntries={['/gigs/42']}><GigPage /></MemoryRouter>)
```

## Known Issues

### Supertest incompatível com Fastify 5 + `@fastify/rate-limit`
`supertest(app.server)` quebra dentro do hook runner interno do Fastify (`Cannot read properties of undefined (reading 'length')`) e trava. **Workaround**: `app.listen({ port: 0 })` + `fetch` nativo (mesma semântica HTTP real). `app.inject()` também funciona. Revisitar quando rate-limit mudar ou Supertest corrigir.

## Coverage Targets

| Área | Alvo |
|---|---|
| Game logic (fórmulas) | 80%+ |
| Services (business logic) | 70%+ |
| Routes (API handlers) | 60%+ |
| UI components | 40%+ |

## Game Testing

Padrões específicos para testar mecânicas de jogo: RNG determinístico, timers, integridade de economia, concorrência.

### RNG Seed Control

Toda função de game logic que usa randomização deve receber `rng: () => number` como parâmetro. Nos testes, injetar seed RNG para outputs determinísticos.

```typescript
// src/server/game-logic/utils/rng.ts — seedable RNG (mulberry32)
export function mulberry32(seed: number): () => number {
  return () => {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

// tests/unit/game-logic/loot-roll.test.ts
import { describe, it, expect } from 'vitest'
import { rollLoot } from '@/server/game-logic/loot-roll'
import { mulberry32 } from '@/server/game-logic/utils/rng'

describe('rollLoot', () => {
  it('should produce deterministic output with seeded RNG', () => {
    const rng = mulberry32(42)
    const result1 = rollLoot(/* params */, rng)
    const result2 = rollLoot(/* params */, mulberry32(42)) // mesma seed
    expect(result1).toEqual(result2)
  })

  it('should produce different outputs with different seeds', () => {
    const result1 = rollLoot(/* params */, mulberry32(1))
    const result2 = rollLoot(/* params */, mulberry32(2))
    expect(result1).not.toEqual(result2)
  })
})
```

### Timer Mocking

Game loops, cooldowns, NIL regen e durations devem usar `vi.useFakeTimers()` + `vi.advanceTimersByTime()`.

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('nilRegen', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('should regenerate NIL every tick', () => {
    const state = createInitialState()
    state.nil = 50
    startNilRegen(state, { tickMs: 1000, regenPerTick: 5 })

    vi.advanceTimersByTime(3000)
    expect(state.nil).toBe(65) // 3 ticks × 5

    vi.advanceTimersByTime(500) // meia tick
    expect(state.nil).toBe(65) // sem mudança
  })

  it('should respect cooldown before next activation', () => {
    const skill = createSkill({ cooldownMs: 5000 })
    activateSkill(skill)
    expect(skill.canActivate).toBe(false)

    vi.advanceTimersByTime(4000)
    expect(skill.canActivate).toBe(false)

    vi.advanceTimersByTime(1000)
    expect(skill.canActivate).toBe(true)
  })
})
```

### Economy Integrity

Toda operação de economia (transações, loot, crafting) deve preservar money conservation: a soma de todas as mudanças de saldo no escopo da operação deve ser zero (ou igual a faucet/sink esperado).

```typescript
describe('transferCredits', () => {
  it('should conserve total money (Σdeltas = 0)', async () => {
    const [alice, bob] = await seedTwoPlayers({ alice: 1000, bob: 500 })

    await transferCredits(alice.id, bob.id, 300)

    const [a, b] = await getBalances([alice.id, bob.id])
    // Alice: 1000 - 300 = 700; Bob: 500 + 300 = 800
    expect(a.balance).toBe(700)
    expect(b.balance).toBe(800)
    // Conservation check
    expect(a.balance + b.balance).toBe(1500) // = alice(1000) + bob(500) inicial
    expect((a.balance - 1000) + (b.balance - 500)).toBe(0) // Σdeltas = 0
  })

  it('should never create or destroy money in gig payout', async () => {
    const { player, corpVault } = await seedGigEconomy()
    const snapshot = await getTotalMoneyInSystem()

    await completeGig(player.id, gigId)

    const newTotal = await getTotalMoneyInSystem()
    // Gig payout é faucet — dinheiro do sistema, não de outro player
    expect(newTotal - snapshot).toBe(gigReward) // apenas o faucet esperado
  })
})
```

### Concurrency

Testes de concorrência devem verificar que o mecanismo de locking funciona — não apenas que chamadas paralelas não quebram.

```typescript
describe('concurrent balance updates', () => {
  it('should serialize updates via optimistic locking', async () => {
    const player = await seedPlayer({ balance: 1000 })

    // 10 tentativas concorrentes de debitar 200 (só pode debitar 1000 total → 5 devem vencer)
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => debitWithRetry(player.id, 200))
    )

    const succeeded = results.filter(r => r.status === 'fulfilled').length
    const failed = results.filter(r => r.status === 'rejected').length

    expect(succeeded).toBe(5)
    expect(failed).toBe(5)

    const { balance } = await getPlayer(player.id)
    expect(balance).toBe(0) // 1000 - (5 × 200) = 0
  })
})

// Helper: optimistic locking com retry
async function debitWithRetry(playerId: string, amount: number, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    const { balance } = await getPlayer(playerId)
    if (balance < amount) throw new Error('Insufficient balance')

    const result = await db.query(
      `UPDATE players SET balance = balance - $1
       WHERE id = $2 AND balance = $3
       RETURNING balance`,
      [amount, playerId, balance]
    )
    if (result.rowCount === 1) return result.rows[0]
    // Lost update — retry após backoff
    await new Promise(r => setTimeout(r, 10 * Math.pow(2, i)))
  }
  throw new Error('Max retries exceeded')
}
```

**NÃO use `pg_advisory_lock` para locking de linha** — use optimistic locking (`WHERE balance = $oldBalance`) com retry. Advisory locks são para coordenação de aplicação (ex: evitar que 2 workers processem a mesma gig), não para proteger dados.
- ❌ Testar implementação (mock interno) em vez de comportamento (input/output)
- ❌ Testes frágeis com `setTimeout` ou datas hardcoded
- ❌ Dependências externas não mockadas (APIs, Redis) em testes unitários
- ❌ Seeds de teste que poluem dados de desenvolvimento
- ❌ Descrever o que o código faz (`it('calls validateToken')`) em vez do comportamento (`it('should reject expired tokens')`)
