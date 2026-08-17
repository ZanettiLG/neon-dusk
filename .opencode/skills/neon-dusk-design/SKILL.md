---
name: neon-dusk-design
description: Complete Neon Dusk product documentation. Injects the full game design docs including vision, mechanics, systems, world, and roadmap. Use when implementing, reviewing, or designing any Neon Dusk feature to ensure consistency with the game's design.
license: MIT
compatibility: opencode
metadata:
  audience: agents
  domain: product-design
---

# Neon Dusk — Documentação de Produto

Skill que injeta a documentação completa de produto do Neon Dusk. Carregada por todos os agentes de desenvolvimento para garantir consistência com a visão, mecânicas e sistemas do jogo.

## Quando Carregar
- **Sempre** que for implementar, revisar ou desenhar qualquer feature do Neon Dusk
- Carregada por: `dev-orchestrator`, `architect`, `developer`, `game-logic-dev`, `code-reviewer`

## Conteúdo
A documentação completa está em `docs/definicoes-de-produto/`. Consulte os arquivos conforme a necessidade:

| Dúvida | Arquivo |
|---|---|
| "Qual a paleta de cores?" | `01-visao-e-marca.md` → Identidade Visual |
| "Qual o tom do jogo?" | `01-visao-e-marca.md` → Tom e Voz |
| "Como funciona São Paulo?" | `02-mundo-e-universo.md` → Setting |
| "Quais os distritos? (A Paraíso, O Fervo, O Fluxo, A Quebrada, Babilônia, As Mortas, O Ponto)" | `02-mundo-e-universo.md` → Distritos |
| "Como funciona energia?" | `03-mecanicas-core.md` → NIL (seção 1) |
| "Como funcionam trampos?" | `03-mecanicas-core.md` → Trampos (seção 2) |
| "Como funciona hacking?" | `03-mecanicas-core.md` → Hacking (seção 4) |
| "Quais os atributos?" | `04-sistemas-e-progressao.md` → Atributos (seção 1) |
| "Quais as bancas?" | `04-sistemas-e-progressao.md` → Banca (seção 2) |
| "Como funciona cromo?" | `04-sistemas-e-progressao.md` → Cromo (seção 3) |
| "Como funciona Moral?" | `04-sistemas-e-progressao.md` → Moral (seção 5) |
| "Como funciona Humanidade?" | `04-sistemas-e-progressao.md` → Humanidade (seção 4) |
| "O que está no MVP?" | `05-roadmap-e-mvp.md` → Fase 1 |

## Regra de Ouro
> Antes de implementar QUALQUER feature, verifique se ela está documentada nos docs de produto. Features não documentadas = escopo creep.
