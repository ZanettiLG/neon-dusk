---
description: Standalone end-to-end QA testing for already-implemented Neon Dusk features. Spawns qa-browser agent to test user-facing flows in the browser.
agent: build
subtask: false
---

# /dev-qa — QA Browser Standalone

Executa testes E2E no browser para features já implementadas, sem passar pelo pipeline completo de desenvolvimento.

## Uso

```
/dev-qa "descrição da feature a testar"
/dev-qa "Sistema de gigs — fluxo completo de 5 fases"
/dev-qa --smoke
/dev-qa --regression
/dev-qa "criação de personagem"
/dev-qa --regression
/dev-qa --smoke --local
```

## Modos

| Modo | Gatilho | Escopo |
|---|---|---|
| **Feature QA** | default (com descrição) | Teste completo de uma feature: happy paths, error paths, edge cases |
| **Smoke Test** | `--smoke` | Fluxos críticos: login, personagem, gig básico, navegação |
| **Regression** | `--regression` | Todas as features implementadas, cross-feature interactions |

## Flags

| Flag | Efeito |
|---|---|
| `--smoke` | Smoke test rápido (<5 min, fluxos críticos apenas) |
| `--regression` | Suíte completa de regressão (todas as features) |
| `--local` | Não posta relatório no GitHub (default: posta como comentário na issue) |

## Workflow

```
build agent
  └── task(qa-browser, { feature: $ARGUMENTS, mode: "feature|smoke|regression" })
       ├── ANALYZE: lê código + design docs
       ├── PLAN: gera test plan com cenários estruturados
       ├── EXECUTE: navega no browser, clica, preenche, verifica
       ├── ASSERT: UI, network, console, storage
       └── REPORT: relatório JSON + evidências
```

## Exemplos

```bash
# QA de uma feature específica
/dev-qa "board de gigs do Cupim — aceitar, executar e concluir"

# Smoke test pós-deploy
/dev-qa --smoke

# Regressão completa antes de release
/dev-qa --regression --local
```

## Regras
- QA browser NUNCA modifica código (read-only)
- Se o servidor não estiver rodando, reporta como `blocked`
- Evidências salvas em `.qa/screenshots/` e `.qa/logs/`
