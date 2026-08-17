# Changelog — Harness Neon Dusk

Histórico de mudanças estruturais no harness de desenvolvimento.

## 2026-08-17 — N1: Guard de terminologia com probe self-check e cobertura de arquivos soltos (issue #148)

### Trigger
Entrada Cortex+ do BANNED ficou inerte (regex case-sensitive testado contra linha lowercased) e só o review pegou; README.md e docs/BETA_CHECKLIST.md estavam fora dos ROOTS — varridos manualmente, sem rede de segurança.

### Change
- Probe self-check: 52 probes sintéticas (uma por entrada do BANNED, incluindo as pré-existentes do #147); o guard falha (exit 1) se alguma entrada não disparar no próprio probe.
- ROOTS: suporte a arquivos .md individuais via constante FILES — README.md e docs/BETA_CHECKLIST.md incluídos, ambos com zero violações (sem falsos positivos; nenhuma anotação #145 necessária).

### Impact
Regressão de terminologia em prosa e em arquivos soltos de produto passa a falhar no CI; o guard auto-verifica a própria eficácia a cada execução. Nota: o self-check revelou que a entrada syn-café (`é` + `\b`) só disparava no plural/átono — corrigido no mesmo dia (fix da regex + probe na forma singular acentuada).

## 2026-08-17 — N2: Adaptação total da lore cyberpunk para PT-BR (issue #148)

### Trigger
Sobravam 8 termos de lore em inglês nos docs de produto e skills (flatline, stim, ICE, Grid, Deep Net, Burnout, Blackout e a lista de stims), mantidos como "Casos de Borda" no doc 06 — inconsistentes com a marca própria "São Paulo 2087" e com o world doc, que já chamava o evento de 2075 de "O Apagão". A tagline do README continha "chrome", termo banido pela regra 4.

### Change
- 06-terminologia-e-ip.md: seção "Casos de Borda Mantidos" substituída por substituições canônicas (apagar, ampola, trava, O Fundo, ressaca, O Apagão).
- cyberpunk-lore + game-economy: glossário e Lista de Ampolas reescritos com 7 nomes próprios novos (Pingado, Tranco, Porrada, Ligado, Sumiço, Brilho, Renda Preta); Pancadão mantido.
- check-terminologia.mjs: 16 novas entradas no BANNED (caseSensitive + lookaheads para Reflex/Ghost/ICE/Cortex+) + skip de frontmatter YAML.
- Docs 02–05, BETA_CHECKLIST, design/ e sistema-de-desenvolvimento varridos.
- README: tagline traduzida para PT-BR.

### Impact
Guarda de consistência cobre o resíduo de lore em inglês; doc 06 volta a ser a única fonte de verdade dos nomes de marca. Zero mudança de código/schema (renames são follow-up #145). Nomes aprovados pelo humano (precedente #147).

## 2026-08-16 — N2: Pipelines em paralelo + verificação de config no source

### Trigger
Dois pipelines de feature rodando em paralelo (issues #133 e #136) no mesmo working directory. Padrões observados (ACT→OBSERVE):
1. **Race de branches** — test-writer e fixer precisaram fazer stash/pop de arquivos do pipeline alheio (2 colisões). Risco real de perda de trabalho.
2. **Retornos vazios de subagente** — 2 execuções de developer retornaram `task_result` vazio/cancelado; re-execução pelo orquestrador recuperou sem perda.
3. **Falso positivo de QA** — qa-browser reportou "tailwind.config não importa tokens.ts" inspecionando CSS compilado (`dist/`), quando o source importava corretamente.
4. Saldo positivo: listas explícitas de arquivos por commit evitaram contaminação cruzada nos 4 commits de 2 branches (scores 5.0 e 4.5).

### Change
- **`github-workflow` skill**: nova seção "Pipelines em paralelo" — (a) fases read-only em paralelo real; (b) fases que escrevem no workdir em branches diferentes devem ser serializadas (ou `git worktree add`); (c) commits via github-ops com listas explícitas de arquivos; (d) `git stash push -m "wip:<branch-dona>"` ao trocar de branch com mudanças alheias, registrando no handoff; (e) regra de re-execução quando `task_result` vazio.
- **`testing-patterns` skill**: anti-padrão adicionado — verificar import/estrutura de config SEMPRE no source, nunca em artefato compilado (`dist/`).

### Impact
Esperado: eliminar colisões de branches e perda de trabalho em pipelines paralelos; reduzir falso-positivos de QA que inspecionam build em vez de source; formalizar a re-execução de subagentes com retorno vazio.

## 2026-08-08 — N3: Pipeline GitHub-Native Default + Capability Gate + Commit Step

### Trigger
Análise do orquestrador revelou 10 problemas estruturais no workflow:
1. **Sem capability gate**: agentes spawnados sem verificar se tinham as skills necessárias para a task — erros só apareciam 3 ciclos depois no review
2. **GitHub opt-in (`--github`)**: flag quase nunca passada → zero rastreabilidade, alterações anônimas, sem histórico
3. **Sem step de commit**: developer escrevia código mas ninguém commita → drift entre working tree e git, PRs vazios
4. **Orquestrador não passava contexto GitHub para subagentes** — developer/architect não sabiam número da issue ou branch
5. **`dev-refactor` e `dev-debug` ignoravam GitHub** — zero integração, alterações diretas em `main`
6. **`gh auth status` nunca verificado** — pipeline quebrava silenciosamente
7. **`dev-qa` standalone ainda usava `--github`** — inconsistente com pipeline principal
8. **QA browser referência defasada a `--github`**
9. **Handoffs em `.handoff/` ainda eram fallback padrão**
10. **Branch enforcement inexistente** — developer podia trabalhar em branch errada

### Changes

#### dev-orchestrator (refatorado)
- **Flag invertida**: `--github` removido. GitHub é o default. `--local` desabilita GitHub (pipeline local).
- **Passo -1: Capability Gate** — verifica skills, agentes e `gh auth status` antes de iniciar pipeline. Mapeamento feature→skills para detectar gaps automaticamente. Se capacidade ausente, spawna `harness-engineer` para construir antes de prosseguir.
- **Passo 0: GitHub Setup** — sempre executa (pular com `--local`). Inclui `gh auth status` check. Passa `issue_number` e `branch` como contexto para todos os subagentes.
- **Passo 2.5: Commit** — novo step entre Implement e Test. Commita código após implementação com conventional commits (`closes #<issue>`). Verifica branch antes de commitar.
- **Handoffs**: GitHub é o registro canônico por padrão. `--local` usa handoffs inline.
- **Todos os passos 0-9**: GitHub-native por default, pular com `--local`.

#### dev-feature (atualizado)
- `--github` → `--local`
- Workflow atualizado com novo pipeline de 10 passos (incluindo capability gate e commit step)

#### dev-qa (atualizado)
- `--github` → `--local`
- Exemplos atualizados

#### github-workflow skill (atualizado)
- "Fluxo Completo (com `--github`)" → "Fluxo Padrão (GitHub-Native)"

#### github-ops (atualizado)
- Nova operação: `check-auth` — verifica `gh auth status` antes de qualquer operação

#### qa-browser (atualizado)
- Referência defasada a flag `--github` removida

#### dev-refactor (atualizado)
- Pipeline completo GitHub-native: issue + branch `refactor/` + commit + PR + pr-reviewer
- Flag `--local` para pular GitHub

#### dev-debug (atualizado)
- Pipeline completo GitHub-native: issue (label: bug) + branch `fix/` + commit + PR + pr-reviewer
- Flag `--local` para pular GitHub
- Commit segue `fix(<scope>): <descrição> (fixes #<issue>)`

#### AGENTS.md raiz
- Princípio #4 atualizado: "GitHub-native by default" substitui menção antiga a `--github`

### Rationale
O pipeline deve ser completo por padrão — issue, branch, commit, PR. Pular etapas é exceção justificada (`--local` para MVPs rápidos, `--skip-tests` para urgências). O capability gate elimina ciclos de correção causados por agentes sem as skills necessárias. O commit step fecha o gap entre implementação e revisão.

### Impact
Pipeline 100% rastreável. Toda alteração tem issue, branch dedicada, commits com referência e PR auditável. Zero alterações anônimas. Zero drift entre working tree e git. Agentes só executam tasks para as quais têm capacidades verificadas.

--- 2026-08-07 — N2: Comando /dev-qa standalone + QA integrado ao pipeline

### Trigger
QA suite completa executada (14 test issues, 21 bugs, 9 enhancements) revelou que o qa-browser nunca era chamado — era opcional com flag `--qa` que ninguém passava. O bug mais crítico (fase "execute" do trampo sem renderização) escapou porque o teste parou em snapshots em vez de simular a jornada completa do usuário.

### Changes
- **Novo comando**: `/dev-qa` — QA browser standalone com 3 modos (feature/smoke/regression)
- **dev-orchestrator.md**: QA movido de `--qa` opcional para default, pular com `--skip-qa`
- **dev-feature.md**: Pipeline atualizado com qa-browser como passo 3.5 padrão
- **dev-feature.md**: Flag `--skip-qa` documentada

### Rationale
QA interativo no browser é a única camada que verifica a jornada real do jogador (clique por clique, fase por fase). Testes unitários e de API são necessários mas não suficientes. O padrão deve ser "sempre testar no browser" — pular é exceção justificada.

## 2026-08-07 — N3: QA Browser Agent (E2E Testing)

### Trigger
Pipeline de desenvolvimento cobria testes unitários, integração e revisão de código, mas não tinha verificação E2E no browser. Features podiam ter regressões visuais, bugs de UX ou side-effects não detectados (console errors, storage corruption, API call failures).

### Changes
- **Novo agente `qa-browser`**: QA E2E no browser usando agent-browser MCP. 5 fases: ANALYZE → PLAN → EXECUTE → ASSERT → REPORT. Três modos: feature QA (completo), smoke test (<5min pós-deploy), regression (cross-feature antes de release).
- **`dev-orchestrator`**: Novo flag `--qa` ativa Passo 3.5 (QA Browser) entre Test e Review. Labels GitHub `qa-failed` / `qa-passed`.
- **`AGENTS.md`**: Spawn rules para qa-browser.
- **Evidências**: Screenshots, console logs, network traces, storage snapshots salvos em `.qa/`.

### Architecture Decisions
- Modelo Pro (deepseek-v4-pro) com thinking 16K — precisa de raciocínio analítico para decompor features em cenários de teste e avaliar side-effects
- Permissão `edit: deny, bash: deny` — agente é read-only para código fonte, interage apenas via browser MCP
- Integração GitHub-native: reporta resultados como comentário na issue, labels de estado
- Ferramentas MCP `agent_browser_*` para interação direta com browser (snapshot a11y tree, screenshots, eval JS, network inspection)
- Sem dependência de Playwright ou Selenium — usa o MCP server já configurado no harness

### Impact
Camada adicional de qualidade no pipeline: QA E2E automatizado fecha o gap entre testes unitários/integração e a experiência real do usuário no browser. Previne regressões visuais, bugs de UX e side-effects que escapam de code review e testes automatizados tradicionais.

---

## 2026-08-07 — N2 Proposals: PvP Auto-Refinement (ND-014)

### Trigger
Auto-refinamento N1 aplicado (checks #24, #25 no developer). Patterns N2 identificados requerem confirmação humana antes da aplicação.

### N2 Proposal 1: Code-reviewer — N+1 Query Detection Rule ✅ RESOLVIDO

**Problema**: `getAttackableTargets` gera 40+ queries para 20 targets. N+1 é um anti-padrão recorrente (mencionado no `nodejs-patterns` como anti-padrão, mas o code-reviewer só tem uma menção genérica "N+1 queries?" no critério #3).

**Solução aplicada**: Expandido o critério #3 (Performance) do code-reviewer com sub-checks explícitos:
- **Redis batch operations**: `.map()` ou loop com chamadas Redis individuais → usar `mget`/`mset`/`pipeline`. Threshold: > 2 chamadas sequenciais single-key no mesmo codepath = violação.
- Ver `agents-changelog.md` 2026-08-07 — N1: Admin Panel Post-Mortem.

**Impacto**: Detecção sistemática de N+1 Redis em revisões. Complementa o check genérico "N+1 queries?" com padrão concreto para Redis.

### N2 Proposal 2: Documentar padrão "constants live in game-logic/, not duplicated in service/"

**Problema**: `IMMUNITY_DAYS` definido em `src/server/game-logic/` e `IMMUNITY_MS` duplicado em `src/server/services/pvp.service.ts`. Serviço usa constante diferente da camada de jogo — bug silencioso quando as duas divergem.

**Solução proposta**: Adicionar ao `nodejs-patterns` skill uma nova seção "Game Constants" documentando:
```
Constantes de domínio (IMMUNITY_DAYS, MAX_NIL, STREET_CRED_THRESHOLDS) 
vivem em src/server/game-logic/constants.ts e são IMPORTADAS pelo service layer. 
NUNCA redefinir constante de jogo no service/.
```

**Alternativa**: Adicionar como check #26 no developer self-review.

**Impacto esperado**: Elimina duplicação de constantes entre camadas, previne bugs de divergência.

**Riscos**: Nenhum — é reforço de padrão existente (DRY interno já é check #19).

### Status
⏳ Aguardando confirmação humana para aplicar N2.

---

## 2026-08-06
### N3: Frontend Migration Vue 3 → React 19
- Epic #5: Complete frontend rewrite from Vue 3 to React 19
- Stack: React 19 + Zustand 5 + React Router 7 + Tailwind 3 + Vite 6
- Zero backend changes. Zero shared package changes.
- See: https://github.com/zan-ia/neon-dusk/issues/5

## 2026-08-05 — Criação Inicial

### Trigger
Setup do projeto Neon Dusk. Criação do sistema de agentes de código para desenvolvimento.

### Changes
- Criados 7 agentes core: `dev-orchestrator`, `architect`, `developer`, `test-writer`, `code-reviewer`, `db-designer`, `game-logic-dev`
- Criadas 8 skills: `neon-dusk-design`, `game-economy`, `cyberpunk-lore`, `nodejs-patterns`, `sql-design`, `react-patterns`, `testing-patterns`, `continual-harness-dev`
- Criados 8 comandos: `dev-feature`, `dev-review`, `dev-refactor`, `dev-debug`, `dev-research`, `dev-lore`, `dev-schema`, `refine-dev-harness`
- Criados arquivos de configuração: `opencode.json`, `AGENTS.md`, `.opencode/AGENTS.md`

### Architecture Decisions
- **3 camadas de contexto**: Entry (build agent), Synthesis (dev-orchestrator), Execution (workers)
- **Model tiering**: Pro (estratégia), Flash (volume), Opus (decisões)
- **Quality gate**: score ≥ 4.5 (menor nota entre 6 critérios)
- **Handoff por arquivo**: outputs grandes em `.handoff/nd-<run_id>/`
- **Stack alvo**: Node.js + TypeScript + Fastify + PostgreSQL + Redis + React 19 + PWA

### Impact
Harness de desenvolvimento completo. Projeto pode iniciar implementação via comandos `/dev-*`.

## 2026-08-06 — Handoff GitHub-Native + PR Reviewer (QA/DevOps/Tech Lead)

### Trigger
Handoffs em arquivos `.handoff/*.md` eram frágeis (colisão entre features, sem rastreabilidade, sem integração com fluxo de mercado). Necessidade de um revisor nível QA/DevOps/Tech Lead auditando PRs, não apenas código.

### Changes
- **Filosofia**: GitHub é a fonte única de verdade. Zero arquivos `.handoff/`. Handoffs vivem como comentários em issues, corpo de issue atualizado com status, PRs como artefatos finais.
- **`github-workflow` skill**: Reescrevida para fluxo GitHub-native — issues como registros canônicos, comentários como handoffs, PR template, labels de estado (`in-progress`, `needs-review`, `approved`, `changes-requested`, `completed`)
- **`github-ops` agent**: Expandido com `comment-on-issue`, `update-issue-body`, `create-sub-issue`, `update-issue-labels`, `approve-pr`, `request-changes`. Removeu dependência de `.handoff/index.md`
- **Novo agente `pr-reviewer`**: QA/DevOps/Tech Lead. Audita PR com contexto completo (diff + handoffs da issue + design doc). 6 dimensões: código, testes, segurança, design, performance, documentação. Score mínimo 4.5/5.0. Comentários inline no PR. Approve ou Request Changes.
- **`dev-orchestrator`**: Pipeline redesenhado em 9 passos GitHub-native. Handoffs via `github-ops` comentam na issue. Passo 7: criar PR. Passo 8: `pr-reviewer` audita. Passo 9: fechamento com labels. Sem `--github`, handoffs são inline (JSON de resposta dos subagents).
- **`dev-feature`**: Adicionado `pr-reviewer` ao diagrama de workflow

### Architecture Decisions
- `pr-reviewer`: Pro (DeepSeek v4), thinking 32K — precisa de capacidade analítica profunda para auditar código + contexto
- `pr-reviewer` pode spawnar `github-ops` para comentar/aprovar PRs — ele mesmo não tem permissão write
- Score do `pr-reviewer` é independente do `code-reviewer` — code-reviewer avalia código bruto, pr-reviewer avalia o PR completo (código + testes + design + contexto)
- Labels rastreiam estado do pipeline diretamente no GitHub — sem índice externo

### Impact
Pipeline totalmente integrável com fluxo GitHub padrão. Handoffs auditáveis, rastreáveis e indexados nativamente pelo GitHub. Dupla camada de qualidade: code-reviewer (código) + pr-reviewer (PR completo).

### Trigger
Pipeline Feature 0 executado end-to-end: architect → developer → test-writer → code-reviewer → fix cycle. 6 review warnings + 1 design bug (rate-limit v9 incompatível com Fastify 5).

### Changes
- **Agentes ajustados**: developer (15→18 self-review checks), test-writer (8→9), architect (10→11) — ver `agents-changelog.md`
- **Skill `testing-patterns`**: Adicionada seção "Known Issues" documentando incompatibilidade Supertest + Fastify 5 + rate-limit, com workaround (`listen(port 0)` + `fetch`)

### Architecture Decisions
- Self-review checks crescem incrementalmente via N1 — sem refatoração estrutural
- Padrão: cada warning do reviewer que ocorrer em feature vira check de self-review no agente relevante
- Métrica inicial: 6 warnings → 4 checks adicionados. Eficácia avaliada na Feature 1

### Impact
Próximo pipeline (Feature 1: Conta + Personagem) deve ter menos warnings de higiene de código. Esperado score inicial ≥ 4.5 sem ciclo de fixes.
