---
name: react-patterns
description: React 19 frontend patterns for PWA apps. Covers hooks, Zustand 5 stores, React Router v7, Testing Library, and Tailwind CSS conventions. Use when implementing React components, hooks, or stores, or reviewing frontend code.
license: MIT
compatibility: opencode
metadata:
  audience: agents
  domain: frontend
---

# React Patterns — Padrões para Frontend React 19 + PWA

Skill de padrões de código para o frontend do Neon Dusk. React 19, Zustand 5, React Router v7, Tailwind, PWA.

## Quando Carregar
- Implementando componentes React, hooks, stores
- Revisando código frontend
- Carregada por: `developer`, `code-reviewer`

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | React 19 (funcional, hooks) |
| Sintaxe | TSX (TypeScript + JSX) |
| State | Zustand 5 |
| Roteamento | React Router v7 (createBrowserRouter, lazy) |
| Estilo | Tailwind CSS com paleta customizada |
| PWA | vite-plugin-pwa |
| Bundler | Vite |

## Estrutura

```
src/client/
├── components/       # Reutilizáveis (Button, Card, HUD)
├── pages/            # Páginas (LoginPage, DashboardPage)
├── stores/           # Zustand stores (character, gig, crew)
├── hooks/            # Lógica reutilizável (useAuth, useNIL)
├── styles/
│   └── tailwind.css  # Config + paleta
├── App.tsx
└── main.tsx
```

## Paleta de Cores (Tailwind Config)

```js
// tailwind.config.js
colors: {
  'nd-bg': '#0a0a0f',
  'nd-surface': '#12121a',
  'nd-cyan': '#00f0ff',
  'nd-magenta': '#ff00aa',
  'nd-gold': '#ffcc00',
  'nd-purple': '#aa00ff',
  'nd-text': '#e0e0e0',
  'nd-text-secondary': '#888899',
  'nd-green': '#00ff66',
}
```

## Componente Pattern

```tsx
import { useState, useCallback } from 'react'
import { useCharacterStore } from '@/stores/character'

interface Props {
  characterId: string
  onClose: () => void
  onSaved: (id: string) => void
}

export function CharacterCard({ characterId, onClose, onSaved }: Props) {
  const character = useCharacterStore(state => state.characters.get(characterId))
  const [loading, setLoading] = useState(false)

  const handleSave = useCallback(async () => {
    setLoading(true)
    try {
      // ... save logic
      onSaved(characterId)
    } finally {
      setLoading(false)
    }
  }, [characterId, onSaved])

  return (
    <div className="bg-nd-surface border border-nd-cyan/20 rounded-lg p-4">
      <h2 className="font-mono text-nd-cyan text-lg">{character?.name}</h2>
      <div className="text-nd-text-secondary text-sm mt-2">
        Street Cred: <span className="text-nd-gold font-mono">{character?.streetCred}</span>
      </div>
    </div>
  )
}
```

## Zustand Store Pattern

```typescript
// stores/character.ts
import { create } from 'zustand'
import { persist, devtools } from 'zustand/middleware'
import type { Character } from '@/shared/types'

interface CharacterState {
  characters: Map<string, Character>
  currentId: string | null
  current: () => Character | null
  fetchCharacter: (id: string) => Promise<Character>
}

export const useCharacterStore = create<CharacterState>()(
  devtools(
    persist(
      (set, get) => ({
        characters: new Map(),
        currentId: null,
        current: () => {
          const { characters, currentId } = get()
          return currentId ? characters.get(currentId) ?? null : null
        },
        fetchCharacter: async (id: string) => {
          const response = await fetch(`/api/characters/${id}`)
          const data = await response.json()
          set(state => {
            const next = new Map(state.characters)
            next.set(id, data)
            return { characters: next }
          })
          return data
        },
      }),
      { name: 'character-store' }
    )
  )
)
```

**Store testing (outside React):**
```typescript
// Zustand stores can be tested without React wrappers
useCharacterStore.getState().fetchCharacter('id-123')
expect(useCharacterStore.getState().characters.get('id-123')).toBeDefined()
```

## React Router v7 Pattern

```tsx
// routes.tsx
import { createBrowserRouter, Outlet } from 'react-router-dom'
import { lazy } from 'react'

const LoginPage = lazy(() => import('@/pages/LoginPage'))
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const GigPage = lazy(() => import('@/pages/GigPage'))

export const router = createBrowserRouter([
  {
    element: <Layout />,
    children: [
      { index: true, element: <LoginPage /> },
      {
        path: 'dashboard',
        element: <AuthGuard><DashboardPage /></AuthGuard>,
      },
      {
        path: 'gigs',
        element: <AuthGuard><Outlet /></AuthGuard>,
        children: [
          { index: true, lazy: () => import('@/pages/GigListPage') },
          { path: ':gigId', element: <GigPage /> },
        ],
      },
    ],
  },
])
```

```tsx
// AuthGuard.tsx — route guard pattern
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth'

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const token = useAuthStore(state => state.token)
  if (!token) return <Navigate to="/" replace />
  return <>{children}</>
}
```

## Testing Library Pattern

```tsx
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { CharacterCard } from '@/components/CharacterCard'

it('should display character name', async () => {
  render(
    <MemoryRouter>
      <CharacterCard
        characterId="123"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    </MemoryRouter>
  )

  await waitFor(() => {
    expect(screen.getByText('Street Cred:')).toBeInTheDocument()
  })
})
```

## PWA Config

```typescript
// vite.config.ts
import { VitePWA } from 'vite-plugin-pwa'

VitePWA({
  registerType: 'autoUpdate',
  manifest: {
    name: 'Neon Dusk',
    short_name: 'NeonDusk',
    description: 'Build your chrome. Burn your name. Leave a legend.',
    theme_color: '#0a0a0f',
    background_color: '#0a0a0f',
    display: 'standalone',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
    ]
  }
})
```

## Tailwind + React Conventions

- `className` (não `class`) em JSX
- Classes condicionais: `clsx` ou template literal:
  ```tsx
  className={`bg-nd-surface ${isActive ? 'border-nd-cyan' : 'border-transparent'}`}
  ```
- Preferir `clsx` para múltiplas condições:
  ```tsx
  import clsx from 'clsx'
  className={clsx('px-4 py-2 rounded', {
    'bg-nd-cyan text-nd-bg': variant === 'primary',
    'bg-nd-surface text-nd-text': variant === 'secondary',
  })}
  ```

## Responsividade

- Mobile-first: 320px → 768px → 1024px
- Grid: 1 col (mobile) → 2 col (tablet) → 3 col (desktop)
- Touch targets: mínimo 44px
- Nav: bottom bar no mobile, sidebar no desktop

## Anti-Padrões
- ❌ Class components (usar sempre functional + hooks)
- ❌ Props sem tipos explícitos (definir interface/type)
- ❌ Lógica de negócio em componentes (mover para hooks/stores)
- ❌ CSS inline (usar Tailwind)
- ❌ Imports não lazy em rotas
- ❌ Sem manifest PWA ou service worker
- ❌ Cores hardcoded (usar tokens da paleta)
- ❌ Mutação direta de estado Zustand (usar `set` retornando novo estado)
- ❌ `useEffect` para fetch (preferir React Query/TanStack ou custom hook com cleanup)
