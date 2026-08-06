# Pesquisa de Mercado — Cyber RPG

> **Objetivo**: Pesquisa de produto exaustiva sobre jogos browser RPG multiplayer com mecânicas simples, alta taxa de retenção e alto fator replay. A pesquisa começa pelo jogo The Crims e expande para jogos similares de sucesso no gênero PBBG (Persistent Browser-Based Game).

## Estrutura da Pesquisa

| Arquivo | Conteúdo |
|---|---|
| [01-the-crims.md](./01-the-crims.md) | Análise completa do The Crims: história, mecânicas, game loop, PRD implícito |
| [02-jogos-similares.md](./02-jogos-similares.md) | Análise de 15+ jogos similares (Torn, OGame, Travian, KoL, etc.) |
| [03-padroes-e-recomendacoes.md](./03-padroes-e-recomendacoes.md) | Padrões de retenção, psicologia, recomendações estratégicas e MVP |

## Sumário Executivo

O gênero de browser games persistentes (PBBG) tem 28 anos de história comprovada. **The Crims** é um caso emblemático de longevidade (~22 anos, ~18 milhões de contas) operando com mecânicas extremamente baratas de manter: texto, menus, timers e PvP por comparação de números. O benchmark do gênero hoje é **Torn** (100k DAU em 2026, sem reset em 22 anos, economia 100% player-driven). 

**Principais insights**:
1. **Energia com regeneração** é a mecânica nº1 — cria o ritmo de 2-3 sessões/dia e a base da monetização
2. **Perda evitável com teto** (não punição) gera ansiedade dosada que traz o jogador de volta
3. **Clãs/gangues** são o multiplicador de retenção — prendem quando a mecânica cansa
4. **Reset com prestígio** (KoL Ascensão) é o motor de replay mais poderoso: reset total + bônus permanente
5. **MVP é barato**: ~10 crimes, 1 barra de energia, 1 prédio passivo, chat + clãs, rodada com reset
6. **Monetize conveniência, NUNCA poder** — P2W é a causa de morte documentada de múltiplos jogos

**Decisão crítica de produto**: Torn (sem reset, 100k DAU, economia player-driven) vs Mafia Wars (morto, 45M MAU no pico, P2W agressivo) — a decisão de monetização e a posse do canal de distribuição separam os sobreviventes de décadas dos fogos de artifício.

## Fontes

~80 fontes consultadas (sites oficiais, Wikipedia, Wayback Machine, Reddit via PullPush, entrevistas com fundadores, wikis comunitárias). Ver arquivo `03-padroes-e-recomendacoes.md` para a tabela completa de fontes e níveis de confiança.
