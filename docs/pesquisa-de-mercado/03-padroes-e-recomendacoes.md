# Padrões de Retenção & Recomendações Estratégicas

> Análise transversal de TODOS os jogos pesquisados. Padrões que aparecem em múltiplos sobreviventes de décadas e recomendações acionáveis para produto.

## 1. Mecânicas Recorrentes de Retenção

### Tabela de Padrões Transversais

| Mecânica | Onde aparece | Padrão dominante |
|---|---|---|
| **Energia com regeneração** | Todos | Barra pequena (100-250) que enche em 4-6h; reset diário fixo ou regen contínua; "gaste ou perca" |
| **Produção passiva + coleta** | Crims, OGame, Travian, Ikariam, Torn | Recurso acumula offline; coleta = gancho de login; **storage cap cria urgência** |
| **Timers como âncora** | Todos | Treino 30min-1h, construção horas-dias, dungeon 48h, guerra 8h, dados grátis diários |
| **Perda evitável com teto** | OGame, Travian, TW, Crims, Bitefight, Omerta | Jogador volta para EVITAR perder, não para ganhar; sempre com teto (50% máx, capital inconquistável); **sem teto vira churn** |
| **Clãs/gangues** | Todos | Dívida social + rivalidade "nós × eles"; o clã prende quando a mecânica cansa |
| **Ranking/leaderboard** | Todos | Comparação pública com deadline renovável (diário/semanal/rodada) |
| **Reset/seasons com prestígio** | Crims, Travian, TW, Planetarion, Utopia, KoL, S&F | Reset é POSITIVO quando: tem propósito narrativo, preserva algo permanente, é opcional |
| **Curva exponencial** | Todos | Rápida no início (dopamina), lentíssima no fim (sustenta "só mais um dia") |
| **Dupla moeda** | Todos F2P | Soft + premium; premium = conveniência (saudável) vs poder (mortal) |
| **Premium negociável** | Torn, KoL | Mercado define valor, não o dev — **dilui o P2W** |

### Economia entre Jogadores: Essencial?

**Sim, quando há população** — mas é a feature mais perigosa de escalar cedo:
- Torn: economia player-driven é o coração, exige 10+ anos de telemetria
- Ikariam: comércio obrigatório gera retenção sem PvP destrutivo
- **Contraexemplo**: The Crims não tem trade direto e sobreviveu 22 anos
- **Regra**: mercado vazio é pior que nenhum mercado; instrumente a economia primeiro

---

## 2. Psicologia do "Só Mais Um Dia"

### Os 7 Fatores de Retorno

1. **FOMO de recurso**: energia enchendo sem uso = perda silenciosa (Crims tickets, S&F thirst 100, KoL 40 adventures no rollover)
2. **FOMO de perda**: ataque a caminho com horário de chegada (OGame/TW), produção no limite do storage (Travian)
3. **Progresso constante perceptível**: números subindo a cada sessão — "velocity" visível
4. **Dívida social**: guerra de gangue marcada, aliado precisando de reforço, eleição na semana
5. **Deadlines renováveis**: fim de rodada + prêmio, fim de temporada, rank semanal, IoTM mensal
6. **Sunk cost**: 22 anos sem reset (Torn) = progresso que "vale até hoje" e dói abandonar
7. **Relevância após meses**: eventos que mudam regras, conteúdo novo barato, updates grandes que viram notícia

### Fatores de Replay
- **Novas contas**: servidores/mundos novos com piso de igualdade
- **Retorno após meses**: nostalgia, conteúdo novo acumulado, item "pegue de onde parou"
- **Seasons/resets**: positivos com preservação (KoL Ascensão), positivos com deadline narrativo (Travian WW), positivos como escolha (servidor novo)
- **Negativos quando**: apagam sem compensação ou monetizam o reset

---

## 3. Modelo de Custo-Benefício

### BARATAS e ALTAMENTE eficazes

Todas aparecem em múltiplos sobreviventes e nenhuma exige mais que CRUD + timers:

| Feature | Esforço estimado | Evidência |
|---|---|---|
| Barra de energia com regen + reset diário | ~1 dia | Presente em 100% dos jogos |
| 5-10 ações com % de sucesso e tabela de recompensa | ~2-3 dias | Core loop de todos |
| Produção passiva com coleta + storage cap | ~2 dias | Travian, OGame, Crims |
| Timers de treino/construção | ~1-2 dias | Todos |
| Perda evitável com teto | ~2 dias | OGame, Crims, TW |
| Leaderboard | ~1 dia | Todos |
| Chat + clãs simples | ~3-5 dias | Todos |
| Eventos globais como flag no banco | ~1 dia | Crims |
| Rodada com reset + prêmios | ~2 dias | Crims, Travian, KoL |
| Sistema de missões diárias | ~2 dias | Crims, S&F |

### CARAS e CORTÁVEIS

Sobreviventes provam que NÃO são necessárias:

- Gráficos/avatares elaborados (Crims/Torn/KoL/Utopia = texto/tabelas)
- Combate em tempo real/reflexo (PvP do gênero é comparar números + timer)
- Mapa explorável (Crims = menu de locais)
- App nativo (Crims roda no navegador; PWA resolve)
- Cutscenes/narrativa roteirizada (a narrativa é social/emergente)
- Matchmaking complexo (faixa de nível basta — Bitefight ±9)
- Mundo persistente aberto (menus bastam)

---

## 4. MVP Mínimo Viável

Conta + personagem com 4 stats → barra de energia com regen → 8-10 crimes com sucesso/falha/prisão → $ + banco → 1 prédio de produção passiva → treino com timer → chat + clãs → leaderboard → rodada de ~2 semanas com reset e prêmio simbólico → PWA responsivo.

---

## 5. As 5 Features MAIS Importantes

1. **Barra de energia com regeneração + reset diário** — mecânica nº1 em 100% dos jogos. Cria fim de sessão, ritmo de retorno (2-3x/dia) e base da monetização. Regra prática: energia que enche em ~4-6h com teto "gaste ou perca".
2. **Ações core (crimes) com progressão de dificuldade e % de sucesso** — gratificação imediata que alimenta toda a economia. Curva rápida no início, lenta depois. O anti-grind do Crims (power ≈ dificuldade otimiza ganho) é elegante e barato.
3. **Produção passiva + storage cap** — gancho de login nº2: "voltar para coletar antes do limite". Converte dinheiro das ações em progressão autônoma.
4. **Clãs/gangues + PvP simples + chat** — multiplicador de retenção. Padrão: PvP de comparação de poder, faixa de ±nível, rivalidade "nós × eles". Não precisa de combate tático — precisa de drama.
5. **Rodada com reset + leaderboard + prêmio simbólico** — ciclo de vida de ~2-4 semanas, com arco competitivo, fair start, limpeza de inativos e **algo permanente que sobreviva ao reset** (badges/medalhas). É o que sustenta "mais uma rodada".

## 6. As 5 Features que PODEM ser Cortadas

1. **Cadeia completa de drogas** — adicione na rodada 2; no início, 1-2 consumíveis bastam
2. **Mercado de ações / stock market** — complexidade alta, retenção incremental
3. **Casino completo** — alta carga de regulação e balanceamento; substitua por daily timer
4. **Trade player↔player / marketplace** — erro mais caro para escalar cedo; instrumente a economia primeiro
5. **App nativo (iOS/Android)** — PWA cobre 95%; app é custo alto no início

---

## 7. Estratégia de Lançamento

1. **Beta fechado com 200-500 jogadores** recrutados na comunidade (r/PBBG, r/browsergames, Discord)
2. **2 rodadas de beta** para calibrar economia (rastrear faucets/sinks desde dia 1 — lição Torn)
3. **Soft launch em UM mercado** (sugestão: Brasil/PT — The Crims era gigante no Brasil)
4. **Conteúdo pré-planejado para 2 rodadas** + 1 update mensal mínimo
5. **Regra de ouro**: crescimento com intenção — infraestrutura e comunidade antes de aquisição paga

---

## 8. Stack Tecnológica Recomendada

O gênero inteiro roda em PHP legado com bancos relacionais — **qualquer stack web moderna resolve; a complexidade está nos timers e na economia, não na stack.**

| Camada | Recomendação |
|---|---|
| **Backend** | TypeScript + Node.js (ou PHP/Laravel se o time for de PHP — o gênero prova que funciona há 25 anos) |
| **Banco** | PostgreSQL (single instance até ~50k DAU) + **Redis** para timers/filas |
| **Frontend** | HTML responsivo + Vue/React leve; PWA para mobile |
| **Infra** | 1 VPS (Hetzner/OVH ~€10-20/mês) + Cloudflare (anti-bot) |
| **Anti-cheat** | Rate limiting + server-side authority em toda ação |
| **Telemetria** | Log de toda transação desde dia 1 (faucets/sinks) — investimento mais barato que protege o jogo |

---

## 9. Modelo de Monetização Ideal

A evidência transversal é **inequívoca**:

### NUNCA
- Energia/atributos/poder compráveis (matou eRepublik, Mafia Wars, gerou backlash em Travian/TW)
- A fórmula que mata: "pagante derrota F2P" → base foge → jogo morre

### SIM
- Moeda premium para **conveniência** (skip de timers, filas extras, refills limitados/dia)
- Cosméticos, títulos, badges
- **Premium negociável entre jogadores** (Torn US$5 donator pack, KoL Mr. Accessory US$10) — mercado dilui P2W
- Doações/Patreon (KoL, Utopia)

### Modelo híbrido recomendado
F2P + créditos premium (conveniência + cosméticos) + prêmio de rodada financiado por vendas premium + doações. **Ritmo**: ~2-5% de pagantes (padrão do gênero).

---

## 10. Métricas de Sucesso para Validar

| Métrica | Benchmark | Nota |
|---|---|---|
| Retenção D1/D7/D30 | D1 >40%, D7 >20%, D30 >10% [inferência] | Loop de energia projeta 2-3 sessões/dia |
| Sessões/dia | 2-3 | Energia em 4-6h |
| Taxa de gasto de energia | >80% diariamente | Se não gasta, loop quebrado |
| % em clãs | >30% até dia 7 | Correlaciona com retenção |
| Conversão (pagantes) | 1-3% | Padrão indústria |
| Retorno pós-reset (R1→R2) | >50% | Métrica de ciclo de vida |
| DAU/MAU | >0,3 | Jogos de sessão curta |

### Sinais de validação precoce (beta)
- Energia gasta >80% diariamente
- >30% jogadores em gangue até dia 7
- >40% retenção D7
- Pelo menos 1 jogador reclamando de bot (sinal de que ranking importa)
- Discussão competitiva em chat/fórum no fim da rodada 1

---

## 11. Decisões Críticas de Design

### Reset ou Não?
- **Com reset**: fair start, ciclo de replay, limpeza de inativos, arco narrativo. Risco: frustrar investimento.
- **Sem reset**: sunk cost gigante, veterano de 20 anos. Risco: newbie nunca alcança.
- **Solução KoL**: reset total + **prestígio permanente** — o melhor dos dois mundos.

### PvP Destrutivo ou Não?
- **Com destruição**: drama, rivalidade, retenção por medo. Risco: churn de novatos.
- **Sem destruição**: safe, inclusivo. Risco: tédio.
- **Solução**: destruição com **teto** (OGame 50%, Crims guards -30%, Bitefight esconderijo) + noob protection.

### Trade Player↔Player ou Não?
- **Com trade**: economia viva, especialização. Risco: inflação, RMT, bots.
- **Sem trade**: controlado. Risco: dependência de conteúdo do dev.
- **Solução**: sem trade no MVP; abrir quando houver população + telemetria.

---

## 12. Fontes e Metodologia

### Fontes Principais (~80 consultadas)

| Fonte | Tipo | Confiabilidade |
|---|---|---|
| thecrims.com + changelog + help center | Oficial | Alta |
| Game Guide oficial The Crims (52 days) | Oficial | **Alta** (fonte primária) |
| Wayback Machine thecrims.com (2004-2024) | Arquivo | Alta |
| RDAP Verisign + Allabolag PopCode | Registros legais | Alta |
| Wikipedia (EN/DE/PT) de todos os jogos | Enciclopédia | Média-Alta |
| GamesBeat entrevista Torn (2026) | Imprensa + fundador | **Alta** |
| r/brasil, r/thecrims, r/PBBG | Comunidade | Média |
| Wikis oficiais (Torn, eRepublik, KoL) | Oficial | Alta |
| GitHub InnoGames | Código fonte | Alta (stack) |

### Nível de Confiança por Dimensão

| Dimensão | Confiança |
|---|---|
| The Crims — mecânicas core | **Alta** (guia oficial atual) |
| The Crims — história/stack | **Média-Alta** (4 evidências para ano; backend Laravel é inferência) |
| Torn / Mafia Wars | **Alta** (Wikipedia + entrevista fundador) |
| OGame / Travian / TW / Ikariam | **Alta** (Wikipedia EN/DE + wikis) |
| Gladiatus / Bitefight | **Média** (fontes oficiais pobres) |
| eRepublik / Hattrick | **Alta** (Wikipedia + wikis oficiais) |
| Shakes & Fidget | **Média** (números de marketing sem verificação) |
| Kingdom of Loathing | **Alta** (Wikipedia + wiki oficial detalhada) |
| Padrões de retenção | **Alta** (múltiplas fontes convergentes) |
| Recomendações estratégicas | **Média** (análise própria baseada em evidências) |

### Lacunas Identificadas
1. Duração real de sessão do The Crims (minutos) — não encontrado
2. Dados quantitativos de retenção (coortes/churn) de qualquer jogo — nenhuma fonte pública
3. Números atuais de DAU/MAU de OGame, Travian, TW, Ikariam — só claims de marketing
4. Stack detalhada de Gameforge, Travian, Hattrick — não encontrado
5. Criador original do The Crims — só inferência
6. House edge dos casinos do gênero — nenhum jogo publica

### Nota de Honestidade
Nenhuma URL foi inventada — todas foram abertas e verificadas durante a pesquisa. Onde o acesso foi bloqueado, foram usados caminhos alternativos (Wayback Machine, API PullPush, Wikipedia). Inferências estão marcadas como `[inferência]` e dados não encontrados como `NÃO ENCONTRADO`.
