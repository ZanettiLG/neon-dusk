---
description: Generate narrative content for Neon Dusk. Produces district descriptions, stim flavor text, fixer dialogue, and other diegetic text following the cyberpunk tone.
agent: build
subtask: false
---

# /dev-lore — Gerar Conteúdo Narrativo

Gera texto diegético seguindo o tom cyberpunk do jogo.

## Uso

```
/dev-lore "Descrição do distrito Babilônia para a UI"
/dev-lore "3 frases de sabor para o stim AdrenaStim"
/dev-lore "Diálogo de apresentação do fixer Cupim para novos jogadores"
/dev-lore "Mensagem de erro diegética para 'NIL insuficiente'"
```

## Workflow

```
build agent → task(developer, "gerar lore: $ARGUMENTS")
  └── developer carrega cyberpunk-lore skill
```

## Regras
- Tom: noir sujo, irônico, estilo Gibson
- Sempre em português (Brasil)
- Sempre verificar contra `01-visao-e-marca.md` (Tom e Voz)
