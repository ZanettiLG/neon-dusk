---
name: continual-harness-dev
description: Reference knowledge for the development harness self-improvement cycle. Adapts the continual-harness pattern for software context. Use when refining agents, skills, or commands, analyzing post-review error patterns, or running the ACT → OBSERVE → REFINE cycle.
license: MIT
compatibility: opencode
metadata:
  audience: agents
  domain: harness
---

# Continual Harness Dev — Auto-Refinamento do Harness de Desenvolvimento

Skill do ciclo de auto-melhoria do harness de desenvolvimento. Adaptação do `continual-harness` do AlphaLessons para contexto de software.

## Quando Carregar
- Refinando agents, skills ou comandos de desenvolvimento
- Analisando padrões de erro pós-review
- Carregada por: `dev-orchestrator`, `harness-engineer`

## Ciclo ACT → OBSERVE → REFINE

```
Feature implementada → code-reviewer avalia (score) → feedback
  └── harness-engineer analisa padrões de falha
       └── aplica melhoria cirúrgica em agent/skill
            └── próxima feature usa padrão melhorado
```

## Gatilhos de Refinamento

| Severidade | Gatilho | Ação |
|---|---|---|
| **N1 (leve)** | Mesmo check falha em 3+ features seguidas | Adicionar ao self-review do developer |
| **N2 (médio)** | Score médio das últimas 5 features < 4.0 | Revisar skill, ajustar prompt do agente |
| **N3 (estrutural)** | Score < 3.5 persistente, nova stack necessária | Requer aprovação humana |

## Níveis de Mudança

### N1 — Ajuste Automático
- Adicionar item a checklist de self-review
- Atualizar exemplo em skill
- Ajustar temperatura de agente
- **Sempre automático. Sempre aplicado.**

### N2 — Refatoração (auto se score < 4.0)
- Reestruturar skill (nova seção)
- Adicionar novo check ao reviewer
- Modificar fluxo de um agente
- **Automático apenas com score baixo. Caso contrário, requer aprovação.**

### N3 — Estrutural (sempre requer humano)
- Criar novo agente especializado
- Alterar stack tecnológica
- Redesenhar pipeline
- **NUNCA automático.**

## Métricas de Evolução

O harness-engineer rastreia:

| Métrica | Como medir |
|---|---|
| Score médio (5 features) | Tendência: subindo, estável, caindo |
| Check mais falhado | Qual critério do reviewer falha consistentemente? |
| Tempo de correção | Quantos ciclos até score ≥ 4.5? |
| Falsos positivos | Reviewer apontou problema que não existia? |

## Limite de Segurança

- **3 ciclos de refinamento sem melhoria** → parar e reportar ao humano
- **5 features com score médio estagnado** → revisão estrutural necessária
- **Nunca** alterar o gate de qualidade (score mínimo) sem aprovação humana

## Registro de Mudanças

Toda mudança no harness é registrada em:
- `docs/cyber-rpg/.opencode/agents-changelog.md` — mudanças em agentes
- `docs/cyber-rpg/.opencode/changelog.md` — mudanças estruturais (skills, comandos, config)

Formato:
```markdown
## 2026-08-05
### Trigger
3 features consecutivas com falha no check "Validação de input"

### Change
Adicionado check #5 ao self-review do developer: "Validação de input (Zod schema)"

### Impact
Score médio subiu de 4.5 para 4.8 nas 3 features seguintes
```
