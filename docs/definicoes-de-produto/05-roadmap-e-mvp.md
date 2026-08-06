# Roadmap e MVP

## MVP — Fase 1: The Street (Mês 1-3)

### Escopo Mínimo Viável

O MVP segue a recomendação da pesquisa: features BARATAS de implementar e ALTAMENTE eficazes em retenção. Nenhuma feature que não esteja entre as top 5 mais importantes.

### Features do MVP

| # | Feature | Descrição | Esforço |
|---|---|---|---|
| 1 | **Conta + Personagem** | Registro, login, criação de personagem (nome, origem, 5 atributos, role) | 3-5 dias |
| 2 | **NIL + Regeneração** | Barra de energia, recarga passiva, syn-café como consumível | 1-2 dias |
| 3 | **Gigs T1-T2** | 8-10 gigs de dificuldade progressiva, 3 tipos (Extraction, Delivery, Sabotage). Rolagem de stats vs dificuldade | 3-5 dias |
| 4 | **1 Fixer (Cupim)** | Quadro de gigs, aceitar/entregar, payout | 1-2 dias |
| 5 | **Chrome Básico (T1-T2)** | 4-5 implantes, slots simples, custo de Humanidade | 2-3 dias |
| 6 | **Street Cred** | Score, thresholds 10 e 25, leaderboard semanal | 1 dia |
| 7 | **Economia Básica** | Eddies, loot de gig, vendors com preço fixo | 2-3 dias |
| 8 | **Saideira (Hub)** | Acesso com SC 10, leaderboard, chat da cidade | 2-3 dias |
| 9 | **Crews Básicas** | Criar crew, convidar até 3 membros, bônus de 5-10% | 2-3 dias |
| 10 | **PvP Simples** | Ataque 1v1 (comparação de stats), proteção de noob, anti-griefing | 2-3 dias |
| 11 | **Rodada + Reset** | Duração de 14 dias, reset com preservação de Lendas | 2-3 dias |
| 12 | **PWA Responsivo** | Funciona em mobile e desktop | 2-4 dias |

**Total MVP**: ~23-37 dias de desenvolvimento (1 desenvolvedor full-stack)

### O que NÃO está no MVP

- Hacking/netrunning (Fase 2)
- Sistema de Stims completo (apenas syn-café no MVP)
- Crew Wars e territórios (Fase 2)
- Gigs T3+ e fixers avançados (Fase 2)
- Sistema de Lendas completo (apenas SC 100 no MVP)
- Underground/apostas (Fase 3)
- Eventos de temporada (Fase 2)

---

## Fase 2: The Edge (Mês 4-6)

| Feature | Descrição |
|---|---|
| **Hacking Básico** | Subnets, ICE layers, programas, RAM, trace |
| **Gigs T3-T4** | +3 fixers (Sombra, Malagueta, Graxa), novos tipos de gig |
| **Stims 1-4** | Syn-café, Reflex, AdrenaStim, Cortex+ com sistema de vício |
| **Crew Wars** | Batalhas entre crews, territórios por distrito |
| **Sistema de Humanidade** | Thresholds de cyberpsychosis, eventos, terapia |
| **Trauma Team** | Assinatura de seguro, planos Silver/Gold |
| **Missões Diárias** | 3-5 missões rotativas por dia |
| **Eventos de Temporada** | Corp War (evento de 48h), Blackout (hacking liberado) |

---

## Fase 3: The Legend (Mês 7-9)

| Feature | Descrição |
|---|---|
| **Hacking Avançado** | PvP de hacking, Black ICE, Deep Net |
| **Gigs T5 + Fixers Elite** | Carcará, Cobra, Fantasma, Coveiro |
| **Underground Completo** | Arenas de luta, drone races, data-trading |
| **Sistema de Lendas** | Hall de Lendas completo com todos os achievements |
| **Sistema de Reputação** | Multi-vetor com facções (corps, gangues, fixers individuais) |
| **Crafting** | Blueprints, componentes, upgrades de chrome |
| **Crew Roles** | Habilidades especiais de crew, gigs cooperativos |

---

## Fase 4: The Singularity (Mês 10+)

| Feature | Descrição |
|---|---|
| **Guildas** | Alianças de crews (meta-clãs) |
| **Território Persistente** | Conquista e defesa de territórios entre rodadas |
| **Net PvP Ranking** | Temporada competitiva de hacking |
| **Eventos Narrativos** | Arcos de história com escolhas que afetam o mundo |
| **Economia Player-Driven** | Mercado entre jogadores (se população > 5k DAU) |
| **App Nativo** | Se métricas de PWA indicarem necessidade |

---

## Stack Tecnológica

### Recomendação Baseada na Pesquisa

O gênero PBBG inteiro roda em stacks web convencionais há 25+ anos. A complexidade está nos **timers e na economia**, não na stack.

| Camada | Escolha | Justificativa |
|---|---|---|
| **Backend** | Node.js + TypeScript + Express/Fastify | Performance adequada, ecossistema rico, timers nativos |
| **Banco Principal** | PostgreSQL | Robustez, transações ACID para economia |
| **Cache/Filas** | Redis | Timers, filas de jobs, rate limiting, leaderboards |
| **Frontend** | Vue 3 + Vite (ou React/Next.js) | SPA reativa, PWA nativa via Vite PWA plugin |
| **Estilo** | Tailwind CSS + paleta customizada | Rápido, responsivo, tema escuro fácil |
| **Infra** | Hetzner VPS (~€10-15/mês) + Cloudflare | Barato, CDN, anti-DDoS básico |
| **Autenticação** | JWT + OAuth (Google, Discord) | Padrão, baixa fricção |
| **Anti-cheat** | Rate limiting (Redis), server-side validation, action cooldowns | Essencial desde dia 1 (lição The Crims) |
| **Telemetria** | PostgreSQL (event sourcing simples), Prometheus + Grafana | Rastrear faucets/sinks desde dia 1 (lição Torn) |

### Por que NÃO usar...

| Tecnologia | Por que não |
|---|---|
| **WebSocket em tempo real** | Gênero PBBG não precisa. Timers + polling bastam |
| **GraphQL** | Overhead desnecessário para CRUD simples |
| **NoSQL (MongoDB)** | Economia do jogo precisa de transações ACID |
| **Microserviços** | Monólito bem estruturado escala até ~50k DAU (padrão do gênero) |
| **Kubernetes** | Overkill. 1 VPS com Docker Compose basta nos primeiros 2 anos |
| **App Nativo (React Native/Flutter)** | PWA cobre 95% dos casos. App nativo quando houver tração |

---

## Estratégia de Lançamento

### Beta Fechado (Mês 3-4)

- **200-300 jogadores** recrutados em r/PBBG, r/cyberpunk, Discord
- **2 rodadas completas** para calibrar economia (faucets/sinks)
- **Foco**: balanceamento, anti-cheat, feedback de UX
- **Métrica de sucesso**: D7 > 30%, energia gasta > 80%

### Soft Launch (Mês 5-6)

- **Mercado: Brasil/PT** — The Crims era gigante no Brasil. Nostalgia do gênero é aproveitável
- **Idiomas**: EN + PT-BR
- **Aquisição orgânica**: Reddit, Discord, boca-a-boca em comunidades PBBG
- **Meta**: 500-1.000 DAU estáveis

### Lançamento Oficial (Mês 7+)

- Abertura global (EN, PT-BR, ES, JP)
- Steam (se métricas justificarem)
- **Meta**: 2.000-5.000 DAU

---

## Métricas de Sucesso

### KPIs Primários

| Métrica | Alvo MVP | Alvo 6 meses | Benchmark do Gênero |
|---|---|---|---|
| **DAU** | 100 | 1.000 | Torn: 100k; The Crims: 1.5k |
| **Retenção D1** | >40% | >50% | Loop de energia projeta 2-3 sessões/dia |
| **Retenção D7** | >25% | >35% | Dívida social (crews) |
| **Retenção D30** | >10% | >15% | Prestígio (Lendas) |
| **Sessões/dia** | 2-3 | 3-4 | Energia em 4-6h |
| **% em Crews** | >30% até dia 7 | >50% | Dívida social |
| **Rodada 1→2** | >40% retornam | >60% | Prestígio permanente |

### KPIs Secundários

| Métrica | Propósito |
|---|---|
| **Taxa de gasto de NIL** | Se <80%, o loop está quebrado |
| **Tempo até primeira Crew** | Quanto mais cedo, maior retenção |
| **Distribuição de Roles** | Todos os roles precisam ser viáveis |
| **Inflação (preço médio de itens)** | Estabilidade entre rodadas = economia saudável |

### Sinais de Validação Precoce (Beta)

- ✅ Jogadores gastam >80% da NIL diariamente
- ✅ >30% em crews até dia 7
- ✅ D7 > 25%
- ✅ Pelo menos 1 jogador reclamando de bot/cheat (sinal de que ranking importa)
- ✅ Discussão competitiva no chat no fim da rodada
- ✅ Jogadores pedindo "quando começa a próxima rodada?"

---

## Monetização

### Modelo

F2P + moeda premium (Créditos ₵) + doações. **CONVENIÊNCIA, NUNCA PODER.**

### O que NUNCA vender

| Item | Razão |
|---|---|
| Atributos/Poder | Mata confiança. The Crims VIP Assassin é o exemplo do que não fazer |
| Street Cred | A moeda social deve ser 100% orgânica |
| Chrome superior | Quebra o trade-off humano-máquina |
| Vantagem em PvP | Mata o competitivo (eRepublik, Mafia Wars) |

### O que VENDER

| Item | Categoria | Preço sugerido |
|---|---|---|
| **Créditos (₵)** | Moeda premium | R$5 = 100₵ |
| **NIL Booster (24h)** | +50 NIL máximo por 24h | 50₵ |
| **Second Wind (semanal)** | Recarga total de NIL instantânea (1x/semana) | 100₵ |
| **Cosméticos** | Skins de HUD (cores de neon), títulos, avatares | 25-200₵ |
| **Trauma Team Platinum** | Seguro premium (comprável com eddies também) | 500₵ |
| **Nome de Crew customizado** | Cor, efeito no leaderboard | 250₵ |
| **Doação/Patreon** | Suporte ao jogo, badge de apoiador | Variável |

### Ritmo de Conversão

- Alvo: **2-5% de pagantes** (padrão indústria)
- Ticket médio: R$ 10-30/mês
- Receita no MVP: cobre infraestrutura + café
- Receita com 1.000 DAU: sustentável para 1 dev full-time

---

## Resumo de Custos

| Item | Custo Mensal Estimado |
|---|---|
| VPS (Hetzner CX22) | ~€10 |
| Cloudflare (plano gratuito) | €0 |
| Domínio (neondusk.io) | ~€1 |
| PostgreSQL (gerenciado ou VPS) | ~€15 |
| **Total Infra MVP** | **~€26/mês (R$ 150)** |
| Desenvolvimento (1 dev full-time, 3 meses MVP) | Custo do time |

**Conclusão**: Neon Dusk pode ser lançado com custo de infraestrutura **irrisório** (~R$ 150/mês), seguindo o padrão de todo o gênero PBBG que opera há décadas com stacks baratas.
