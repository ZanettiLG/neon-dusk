# Neon Dusk — Definições de Produto

> **Gênero**: Browser RPG multiplayer persistente (PBBG) — temática Cyberpunk
> **Inspiração mecânica**: The Crims, Torn, Kingdom of Loathing
> **Inspiração temática**: Neuromancer, Cyberpunk 2077, Blade Runner, Ghost in the Shell

## O Jogo em Uma Frase

**Neon Dusk** é um browser RPG multiplayer onde você constrói sua lenda nas ruas de uma metrópole cyberpunk — realize trampos, instale cromo, gerencie sua humanidade e suba do anonimato ao drink nomeado no bar das lendas.

## Estrutura da Documentação

| Arquivo | Conteúdo |
|---|---|
| [01-visao-e-marca.md](./01-visao-e-marca.md) | Visão, nome, marca, tom, estilo visual e identidade |
| [02-mundo-e-universo.md](./02-mundo-e-universo.md) | Setting, distritos, corporações, gangues e despachantes |
| [03-mecanicas-core.md](./03-mecanicas-core.md) | Sistemas core: energia, trampos, combate, hacking |
| [04-sistemas-e-progressao.md](./04-sistemas-e-progressao.md) | Atributos, bancas, cromo, Moral, economia |
| [05-roadmap-e-mvp.md](./05-roadmap-e-mvp.md) | MVP, fases de desenvolvimento, stack, métricas |

## Pilares de Design

1. **Sessões de 2-3 minutos, 2-3 vezes ao dia** — o loop do gênero PBBG que gera retenção por décadas
2. **Alta retenção via perda evitável + dívida social** — padrão comprovado em Torn, OGame, Travian
3. **Prestígio permanente via sistema de Lendas** — adaptação direta do modelo Ascensão de Kingdom of Loathing
4. **Monetização de conveniência, nunca de poder** — lição dos sobreviventes de 20+ anos
5. **MVP barato de construir e escalar** — texto + timers + CRUD, sem gráficos 3D, sem app nativo

## Decisões Críticas de Design

| Decisão | Escolha | Justificativa |
|---|---|---|
| Reset ou não? | **Rodadas com prestígio** (modelo KoL) | Fair start + progresso permanente que sobrevive ao reset |
| PvP destrutivo? | **Sim, com teto** (modelo OGame) | Drama gera retenção; teto evita churn de novatos |
| Trade player↔player? | **Não no MVP** (modelo The Crims) | Mercado vazio é pior que nenhum; abrir com população |
| App nativo? | **PWA apenas** | Cobertura de 95% dos casos; custo zero extra |
| Combate em tempo real? | **Não — comparação de stats + timers** | Padrão do gênero; barato de implementar |
