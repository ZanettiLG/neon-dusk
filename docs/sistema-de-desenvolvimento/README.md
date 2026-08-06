# Sistema de Desenvolvimento — Neon Dusk

> **Motor de desenvolvimento**: OpenCode com agentes de código, skills de domínio e pipelines de orquestração
> **Stack alvo**: Node.js + TypeScript + PostgreSQL + Redis + Vue 3 + PWA
> **Referência**: harness do AlphaLessons (agentes, skills, comandos, orquestração)

## Visão Geral

O desenvolvimento do Neon Dusk será orquestrado por um sistema de **agentes de código** no OpenCode, seguindo os mesmos princípios arquiteturais do harness AlphaLessons (3 camadas de contexto, model tiering, delegação obrigatória, ciclo de auto-refinamento), mas adaptado para **desenvolvimento de software** em vez de criação de conteúdo educacional.

### Por que agentes de código?

| Razão | Detalhe |
|---|---|
| **Rapidez** | 1 dev humano + agentes = throughput de time pequeno |
| **Qualidade** | Review automatizado, self-review em cada feature |
| **Consistência** | Skills de domínio injetam conhecimento compartilhado (stack, padrões, cyberpunk) |
| **Documentação viva** | Agentes leem e respeitam os docs de produto; mudanças nos docs alteram comportamento |
| **Baixo custo** | Modelos Flash para volume (escrita de código), Pro para estratégia (arquitetura, review) |

## Estrutura da Documentação

| Arquivo | Conteúdo |
|---|---|
| [01-orquestracao-e-agentes.md](./01-orquestracao-e-agentes.md) | Design de orquestração, catálogo de agentes, model tiering, regras de delegação |
| [02-skills-e-conhecimento.md](./02-skills-e-conhecimento.md) | Catálogo de skills, domínios de conhecimento injetáveis |
| [03-comandos-e-workflows.md](./03-comandos-e-workflows.md) | Comandos CLI, pipelines de desenvolvimento, fluxos de trabalho |
| [04-arquitetura-de-contexto.md](./04-arquitetura-de-contexto.md) | Camadas de contexto, isolamento, handoff, convenções de projeto |

## Princípios do Sistema

1. **Delegação obrigatória** — o orquestrador NUNCA escreve código diretamente; toda produção é delegada a workers especializados
2. **Skills como fonte de verdade** — conhecimento de domínio (stack, padrões, lore cyberpunk) vive em skills, não no prompt do agente
3. **3 camadas de contexto** — Entry (mínimo), Synthesis (limpo), Execution (isolado + skills)
4. **Model tiering** — Pro para decisões estratégicas, Flash para volume de código, modelos menores para tarefas triviais
5. **Auto-refinamento contínuo** — o harness de desenvolvimento se auto-melhora a cada feature entregue
6. **Handoff por arquivo** — outputs grandes (>500 linhas) vão para `.handoff/` com namespace por execução
