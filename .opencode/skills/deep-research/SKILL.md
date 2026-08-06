---
name: deep-research
description: Deep research methodology for exhaustive investigation of technical and game design topics. Defines how to decompose questions, search strategies, source hierarchy, synthesis, and verification. Use when investigating a topic in depth.
license: MIT
compatibility: opencode
metadata:
  audience: agent
  workflow: research
---

# Skill: deep-research

## O que é Pesquisa Profunda

Investigação exaustiva de um tópico que vai além da primeira página de resultados. Decompõe a pergunta central em sub-questões, cruza múltiplos tipos de fontes, verifica contra fontes primárias e sintetiza achados com níveis de confiança.

**Não é para:** perguntas factuais simples, buscas rápidas de API, consultas pontuais.

**É para:** mapear ecossistema de ferramentas, comparar abordagens concorrentes, entender arquitetura interna, extrair padrões de múltiplas codebases, ou levantar tudo sobre um domínio antes de decisões de design.

---

## Metodologia: 4 Fases

### Fase 1: Decomposição

Decomponha a pergunta central em sub-questões independentes:

1. **Identifique dimensões**: aspectos distintos do tópico
2. **Formule sub-questões**: cada dimensão vira pergunta específica
3. **Priorize**: pré-requisitos vs paralelizáveis
4. **Estime fontes**: onde a resposta provavelmente está

**Exemplo — pesquisando "ORM para projeto de jogo multiplayer":**

| Dimensão | Sub-questão | Fontes prováveis |
|---|---|---|
| API | Como é a DX? TypeScript support? | Docs oficiais, exemplos |
| Performance | Benchmarks com queries de jogo? | Blog posts, repositórios |
| Migrations | Suporte a migrations? Rollback? | Docs, GitHub issues |
| Ecossistema | Comunidade ativa? Manutenção? | npm trends, GitHub stars |
| Comparação | Drizzle vs Knex vs Prisma? | Artigos comparativos |

### Fase 2: Investigação Paralela

Dispare agentes `general` em paralelo via `task` (máximo 5 simultâneos).

**Estratégia de busca por tipo de fonte:**

| Tipo | Ferramenta | Quando usar |
|---|---|---|
| Documentação oficial | `context7_query-docs` | Sempre que houver lib no Context7 |
| Documentação web | `webfetch` (markdown) | Docs fora do Context7 |
| Código fonte | Leitura de repositórios | Entender implementação |
| Busca ampla | `websearch` | Descoberta de fontes |
| Docs de produto | `read` em `definicoes-de-produto/` | Lore e mecânicas do Neon Dusk |

**Profundidade por rodada:**
- **Rodada 1**: Fontes oficiais — baseline
- **Rodada 2**: Fontes comunitárias — lacunas práticas
- **Rodada 3**: Verificação e contraste — contradições

### Fase 3: Síntese

Relatório estruturado:
```markdown
# Relatório de Pesquisa: [Tópico]
## Sumário Executivo
## 1. [Dimensão 1]
### Achados
### Análise
## Lacunas Identificadas
## Fontes Consultadas
## Nível de Confiança por Dimensão
```

### Fase 4: Verificação

1. Todas as sub-questões respondidas?
2. Afirmações críticas verificadas contra fonte primária?
3. Contradições entre fontes documentadas?
4. Fontes citadas com URL?
5. Sumário reflete achados reais?

---

## Níveis de Profundidade

| Nível | Rodadas | Fontes por sub-questão | Quando usar |
|---|---|---|---|
| **Rápido** | 1 | 1-2 oficiais | Orientação inicial |
| **Padrão** | 2 | 3-5 | Decisões de design, mapeamento |
| **Profundo** | 3+ | 5+ | Antes de construir algo novo |
| **Exaustivo** | 4+ | 10+ | Decisão arquitetural de alto risco |

---

## Padrões de Pesquisa por Domínio

### Stack Técnica (bibliotecas, frameworks, ferramentas)
1. API Surface, breaking changes, versão estável
2. Performance em cenários de jogo (concorrência, caching)
3. Ecossistema e manutenção (comunidade ativa? último commit?)
4. Comparação com alternativas
5. Casos de uso similares

### Mecânicas de Jogo (game design)
1. Jogos de referência: como implementaram?
2. RPGs de mesa: sistemas formais (Cyberpunk RED, Shadowrun)
3. Fórmulas e balanceamento
4. Comunidade: o que jogadores consideram justo/divertido?

### Lore Cyberpunk
1. Obras fundacionais: Neuromancer, Blade Runner, GitS, CP2077
2. Consistência com `definicoes-de-produto/`
3. Tom de voz apropriado

### Harness de Desenvolvimento
1. Configuração, elementos customizáveis
2. Modelo de agentes (tipos, modos, permissões)
3. Ferramentas e extensibilidade
4. Contexto e compaction
5. Segurança e permissões

---

## Anti-Padrões

1. **Não pesquise sequencialmente** — paralelize com `task`
2. **Não aceite a primeira resposta** — verifique ≥2 fontes independentes
3. **Não cite sem verificar** — leia o conteúdo linkado
4. **Não omita lacunas** — "não encontrei" é melhor que fingir
5. **Não confunda opinião com fato** — marque tipo de fonte e confiança
6. **Não pesquise além do necessário** — respeite o nível solicitado
7. **Não faça afirmações sem especificar versão**
8. **Nunca invente URLs** — cite descritivamente se não houver URL
9. **Não use um único tipo de fonte** — diversidade aumenta confiança
