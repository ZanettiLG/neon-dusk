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
| `--skip-tests` | Pula testes automatizados (MVP rápido, não recomendado) |
| `--skip-qa` | Pula QA browser E2E (feature urgente, não recomendado) |
| `--local` | Pipeline local, sem GitHub (sem issue, branch, PR) |

## Workflow

``` 
build agent (entrada fina)
  └── task(dev-orchestrator, $ARGUMENTS)
       ├── [passo -1] capability check (skills, agentes, deps)
       ├── [passo 0]  github-ops → verificar gh auth + criar issue + branch
       ├── [passo 1]  architect → design técnico
       ├── [passo 2]  developer → implementação
       ├── [passo 2.5] github-ops → commit + push
       ├── [passo 3]  test-writer → testes automatizados
       ├── [passo 3.5] qa-browser → testes E2E no browser
       ├── [passo 4]  code-reviewer → qualidade
       ├── [se score < 4.5] → corrigir
       ├── [se score < 5.0] → harness-engineer → refinar
       ├── [passo 7]  github-ops → criar PR
       ├── [passo 8]  pr-reviewer → auditar PR (QA/DevOps/Tech Lead)
       └── [passo 9]  github-ops → fechamento com labels
       
  Passos 0, 2.5, 7, 8, 9 pulados com --local.
```

## Regras
- Build agent NUNCA carrega skills ou vê código
- Build agent NUNCA usa `write` ou `edit`
- Contexto do build agent < 200 linhas
