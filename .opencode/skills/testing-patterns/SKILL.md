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
      expect(screen.getByText('Moral:')).toBeInTheDocument()
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

## Anti-Padrões
- ❌ Testar implementação (mock interno) em vez de comportamento (input/output)
- ❌ Testes frágeis com `setTimeout` ou datas hardcoded
- ❌ Dependências externas não mockadas (APIs, Redis) em testes unitários
- ❌ Seeds de teste que poluem dados de desenvolvimento
- ❌ Descrever o que o código faz (`it('calls validateToken')`) em vez do comportamento (`it('should reject expired tokens')`)
- ❌ Verificar import/estrutura de config em artefato compilado (`dist/`, CSS/JS gerado) — **qa-browser/verificadores**: SEMPRE valide no source (`tailwind.config.*`, `tsconfig.*`, `*.ts`). Artefato compilado reflete o build, não o source.
