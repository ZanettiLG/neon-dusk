---
description: Complete feature development pipeline for Neon Dusk. Design, implement, test, and review a feature using specialized code agents.
agent: build
subtask: false
---

# /dev-feature — Pipeline de Feature

Pipeline completo de desenvolvimento de feature: design → implementação → testes → revisão.

## Uso

```
/dev-feature "descrição da feature"
/dev-feature "Sistema de autenticação JWT com refresh tokens"
/dev-feature "Página de criação de personagem" --frontend-only
/dev-feature "Balanceamento de economia da rodada" --game-logic
```

## Flags

| Flag | Efeito |
|---|---|
| `--frontend-only` | Pula backend e banco |
| `--backend-only` | Pula frontend |
| `--game-logic` | Usa `game-logic-dev` em vez de `developer` |
| `--db-only` | Usa `db-designer` diretamente |
| `--design-only` | Para no passo 1, produz apenas design doc |
| `--skip-tests` | Pula testes (MVP rápido, não recomendado) |
| `--github` | Integração completa com GitHub: cria issue, branch e PR |

## Workflow

```
build agent (entrada fina)
  └── task(dev-orchestrator, $ARGUMENTS)
       ├── [--github] github-ops → criar issue + branch
       ├── architect → design técnico
       ├── developer → implementação
       ├── test-writer → testes
       ├── code-reviewer → qualidade
       ├── [se score < 4.5] → corrigir
       ├── [se score < 5.0] → harness-engineer → refinar
       ├── [--github] github-ops → criar PR
       └── [--github] pr-reviewer → auditar PR (QA/DevOps/Tech Lead)
```

## Regras
- Build agent NUNCA carrega skills ou vê código
- Build agent NUNCA usa `write` ou `edit`
- Contexto do build agent < 200 linhas
