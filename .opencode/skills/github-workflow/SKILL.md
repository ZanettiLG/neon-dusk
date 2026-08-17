---
name: github-workflow
description: GitHub-native workflow for Neon Dusk agents — issues as canonical records, comments as handoffs, PRs as deliverable artifacts. No loose files.
license: proprietary
compatibility: opencode
metadata:
  audience: agent
  workflow: development
---

# GitHub Workflow — Neon Dusk

**Filosofia**: GitHub é a fonte única de verdade. Nada de `.handoff/*.md` — todo handoff vive como comentário em issue, corpo de issue atualizado, ou sub-issue linkada.

## Estrutura de Handoff (GitHub-Native)

```
Issue #42 (feature principal)
├── corpo: descrição + critérios de aceitação + pipeline status (atualizado a cada passo)
├── comentário: handoff do design (architect)
├── comentário: handoff da implementação (developer)
├── comentário: handoff dos testes (test-writer)
├── comentário: handoff do code-reviewer
├── PR #43 (linkado à issue)
│   ├── corpo: resumo da implementação (PR template)
│   └── comentários: review do pr-reviewer (QA/DevOps/tech lead)
└── [opcional] sub-issues linkadas: #44 (schema), #45 (UI)
```

**ZERO arquivos `.handoff/`.** O GitHub é o handoff.

## Fluxo Padrão (GitHub-Native)

### Passo 0: Criar Issue

```bash
gh issue create \
  --title "Feature: <descrição>" \
  --body "<template com contexto, critérios, run_id>" \
  --label "feature,in-progress" \
  --assignee "@me"
```

Retorna: `issue_number`, `issue_url`.

O corpo da issue inclui um bloco de status que é atualizado a cada passo:

```markdown
## Pipeline Status
| run_id | passo | status | score | iniciado |
|---|---|---|---|---|
| nd-20260806-091500-auth | issue | created | - | 2026-08-06T09:15 |
```

### Passo 0.5: Criar Branch

```bash
git checkout -b "feat/<issue>-<slug>"
```

### Handoffs como Comentários

Cada agente do pipeline produz seu handoff como comentário na issue principal:

```bash
gh issue comment <issue_number> --body "<handoff_markdown>"
```

Formato do comentário-handoff:

```markdown
## Handoff: <passo> — <agente>
**run_id**: nd-20260806-091500-auth
**timestamp**: 2026-08-06T09:20:00Z

<conteúdo do handoff em markdown>

---
```

### Atualizar Corpo da Issue

Após cada passo, o bloco `Pipeline Status` no corpo da issue é atualizado:

```bash
gh issue edit <issue_number> --body "<corpo_atualizado>"
```

O `github-ops` lê o corpo atual, adiciona a nova linha de status, e reescreve.

### PR: Artefato Final

```bash
gh pr create \
  --title "feat: <título>" \
  --body "<PR template com resumo + link para issue>" \
  --label "feature,needs-review" \
  --base main
```

O corpo do PR referencia a issue e inclui um resumo executivo — não duplica os handoffs (eles já estão nos comentários da issue).

Corpo do PR:

```markdown
## Summary
<resumo 1-parágrafo>

## Related Issue
Closes #42

## Pipeline
- run_id: nd-20260806-091500-auth
- score: 4.7 / 5.0
- cycles: 1

## Changed Files
- `src/auth/login.ts`
- ...

## Review Notes
<notas para o revisor, se houver>
```

### PR Review (pr-reviewer)

O `pr-reviewer` audita o PR como QA/DevOps/tech lead:

1. Lê o diff do PR (`gh pr diff <pr_number>`)
2. Lê os handoffs nos comentários da issue linkada
3. Avalia: código, testes, cobertura de edge cases, segurança, documentação
4. Adiciona comentários inline no PR (`gh pr review --comment`)
5. Se aprovado: aprova o PR (`gh pr review --approve`)
6. Se reprovado: solicita mudanças (`gh pr review --request-changes`)
7. Retorna handoff estruturado para o orquestrador

### Fechamento

Após merge:
```bash
gh issue edit <issue_number> --add-label "completed" --remove-label "in-progress"
gh issue comment <issue_number> --body "## Pipeline Concluído
**score**: 4.7/5.0
**cycles**: 1
**pr**: #43
**merged**: 2026-08-06T10:00:00Z"
```

## Labels e Estados

| Label | Significado |
|---|---|
| `feature`, `bug`, `refactor`, `docs` | Tipo da issue |
| `in-progress` | Pipeline em execução |
| `needs-review` | PR aberto, aguardando pr-reviewer |
| `approved` | PR aprovado pelo pr-reviewer |
| `changes-requested` | PR precisa de correções |
| `completed` | Merged + issue fechada |
| `blocked` | Bloqueado por dependência |

## Sub-Issues (Opcional)

Para features complexas, o orquestrador pode criar sub-issues linkadas:

```bash
gh issue create --title "Schema: <nome>" --body "<descrição>" --label "db"
gh issue edit <main_issue> --body "$(echo -e 'corpo\n\n## Sub-Tasks\n- [ ] #<sub_issue>')"
```

## Pipelines em Paralelo

O orquestrador pode rodar múltiplas features no mesmo working directory. Regras para evitar colisão de branches e perda de trabalho:

- **(a) Fases read-only** (architect, code-reviewer, qa-browser, deep-researcher) podem rodar em paralelo real.
- **(b) Fases que escrevem no workdir** (developer, test-writer, fixer) em branches diferentes devem ser **serializadas** pelo orquestrador — ou usar `git worktree add` para isolar cada branch.
- **(c) Commits sempre via `github-ops` com listas explícitas de arquivos** (`git add <arquivos específicos>`), nunca `git add -A`, para evitar contaminação cruzada entre branches.
- **(d) Troca de branch com mudanças alheias não commitadas**: use `git stash push -m "wip:<branch-dona>"` e registre o stash no handoff (comentário da issue). Nunca descarte nem sobrescreva trabalho alheio.
- **(e) `task_result` vazio/cancelado**: o orquestrador deve **re-executar** o subagente (regra de validação de handoff) antes de considerar a fase falha. A disciplina "não commite; github-ops commita" garante que nada é perdido em re-execução.

## Conventional Commits

```
feat(<scope>): <descrição> (closes #<issue>)
fix(<scope>): <descrição> (fixes #<issue>)
refactor(<scope>): <descrição>
```

## Template de Issue (Feature)

```markdown
## Contexto
<descrição da feature>

## Critérios de Aceitação
- [ ] <critério 1>
- [ ] <critério 2>

## Pipeline Status
| run_id | passo | status | score | timestamp |
|---|---|---|---|---|
| <run_id> | issue | created | - | <ISO timestamp> |

## Notas Técnicas
<detalhes se disponíveis>
```
