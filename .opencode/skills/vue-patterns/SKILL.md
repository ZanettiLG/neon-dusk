---
name: vue-patterns
description: Vue 3 frontend patterns for PWA apps. Covers Composition API, Pinia stores, Tailwind CSS, and PWA configuration. Use when implementing Vue components, views, or stores, or reviewing frontend code.
license: MIT
compatibility: opencode
metadata:
  audience: agents
  domain: frontend
---

# Vue Patterns — Padrões para Frontend Vue 3 + PWA

Skill de padrões de código para o frontend do Neon Dusk. Vue 3 Composition API, Pinia, Tailwind, PWA.

## Quando Carregar
- Implementando componentes Vue, views, stores
- Revisando código frontend
- Carregada por: `developer`, `code-reviewer`

## Stack

| Camada | Tecnologia |
|---|---|
| Framework | Vue 3 (Composition API) |
| Sintaxe | `<script setup lang="ts">` |
| State | Pinia |
| Roteamento | Vue Router (lazy loading) |
| Estilo | Tailwind CSS com paleta customizada |
| PWA | vite-plugin-pwa |
| Bundler | Vite |

## Estrutura

```
src/client/
├── components/       # Reutilizáveis (Button, Card, HUD)
├── views/            # Páginas (LoginView, DashboardView)
├── stores/           # Pinia stores (character, gig, crew)
├── composables/      # Lógica reutilizável (useAuth, useNIL)
├── styles/
│   └── tailwind.css  # Config + paleta
└── App.vue
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

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useCharacterStore } from '@/stores/character'

const props = defineProps<{
  characterId: string
}>()

const emit = defineEmits<{
  close: []
  saved: [id: string]
}>()

const store = useCharacterStore()
const loading = ref(false)

const character = computed(() => store.characters.get(props.characterId))
</script>

<template>
  <div class="bg-nd-surface border border-nd-cyan/20 rounded-lg p-4">
    <h2 class="font-mono text-nd-cyan text-lg">{{ character?.name }}</h2>
    <div class="text-nd-text-secondary text-sm mt-2">
      Street Cred: <span class="text-nd-gold font-mono">{{ character?.streetCred }}</span>
    </div>
  </div>
</template>
```

## Pinia Store Pattern

```typescript
// stores/character.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { Character } from '@/shared/types'

export const useCharacterStore = defineStore('character', () => {
  const characters = ref<Map<string, Character>>(new Map())
  const currentId = ref<string | null>(null)

  const current = computed(() => 
    currentId.value ? characters.value.get(currentId.value) : null
  )

  async function fetchCharacter(id: string) {
    const response = await fetch(`/api/characters/${id}`)
    const data = await response.json()
    characters.value.set(id, data)
    return data
  }

  return { characters, currentId, current, fetchCharacter }
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

## Responsividade

- Mobile-first: 320px → 768px → 1024px
- Grid: 1 col (mobile) → 2 col (tablet) → 3 col (desktop)
- Touch targets: mínimo 44px
- Nav: bottom bar no mobile, sidebar no desktop

## Anti-Padrões
- ❌ Options API (usar sempre Composition API)
- ❌ `<script>` sem `setup` (usar `<script setup>`)
- ❌ Props sem tipos explícitos
- ❌ Lógica de negócio em componentes (mover para composables/stores)
- ❌ CSS inline (usar Tailwind)
- ❌ Imports não lazy em rotas
- ❌ Sem manifest PWA ou service worker
- ❌ Cores hardcoded (usar tokens da paleta)
