# Jogos Similares de Sucesso

> Análise de 15+ jogos browser-based com mecânicas similares. Para cada jogo: ficha técnica, mecânicas core, diferenciais, monetização, stack, insights de retenção e lições para produto.

## Tabela Comparativa Geral

| Jogo | Ano | País | Pico | Status 2026 | Tema | Reset? |
|---|---|---|---|---|---|---|
| **Torn** | 2004 | UK | >100k DAU (2026) | VIVO, crescendo | Crime text MMO | Nunca (22 anos) |
| **Mafia Wars** | 2008 | EUA | ~45M MAU (2010) | MORTO (2016) | Máfia clicker | N/A |
| **OGame** | 2002 | DE | >100M registros | VIVO | Espaço | Universos fundidos |
| **Travian** | 2004 | DE | ~5,2M (2011) | VIVO | Antiguidade | Rodadas ~200-300 dias |
| **Tribal Wars** | 2003 | DE | 59M registros | VIVO | Medieval | Mundos com fim |
| **Ikariam** | 2008 | DE | ~110k contas DE (2009) | VIVO | Grécia clássica | Sem conquista permanente |
| **Gladiatus** | 2008 | DE | "Milhões" | VIVO | Gladiador | Rank semanal 7 dias |
| **Bitefight** | 2006 | DE | "Milhões" | VIVO | Vampiros × Lobisomens | Guerras agendadas |
| **eRepublik** | 2008 | RO | 367k ativos (2010) | VIVO (encolhido) | Política real | Dia 6.833, sem reset |
| **Hattrick** | 1997 | SE | ~1M (2009) | VIVO, 28 anos | Futebol | Temporadas 16 semanas |
| **Shakes & Fidget** | 2009 | DE | 50M+ registros | VIVO | Comédia semi-idle | Servidores com fusão |
| **Kingdom of Loathing** | 2003 | EUA | 100-150k (2008) | VIVO, 23 anos | Comédia absurda | **Ascensão** (reset + bônus) |
| **Utopia** | 1998 | EUA | ~100k ativos | VIVO, 27 anos | Fantasia textual | Ages 10-12 semanas |
| **Planetarion** | 2000 | NO | 30k+ (2000) | VIVO | Espaço | Rounds ~2 meses |
| **Omerta** | 2003 | NL | ~38M registros | VIVO | Máfia anos 30 | Kill permanente |
| **Astro Empires** | ~2006 | PT | "2M+" | VIVO, 20 anos | Espaço RTS | Servidores |

---

## Destaques Individuais

### TORN — O Benchmark do Gênero Crime

**Por que é o benchmark**: 100k DAU em 2026 após 22 anos, sem reset, economia 100% player-driven, time de ~40 pessoas remoto.

**Mecânicas distintivas**:
- Energy: +5/15min, máx 100 (150 donator), cheia em 5h; teto 1.000
- Nerve (crimes), Life, Happiness como recursos paralelos
- **Crimes 2.0** lançado em 2023 após 9 anos de desenvolvimento (sucesso varia com hora do dia e jogadores online)
- Empresas 1★-10★ com Job Points
- Facções com guerras de semanas
- Flying/importação entre países
- Mercado de itens 100% player-driven

**Monetização**: Donator Pack US$5 (31 dias + 60 points), **negociável entre jogadores** por ~US$24M in-game — monetização que se integra à economia, não a corrompe. "Assinatura Forever" NÃO existe — o modelo real é packs + subscriptions.

**Stack**: PHP de origem → engine RESPO reescrita em 2014, API pública, app Android 2018.

**Insights de retenção**:
- Rastreia faucets/sinks há 10+ anos para controlar inflação ("o maior matador de PBBGs")
- Crescimento **deliberadamente contido** — "segurei a publicidade para não diluir a comunidade"
- Retenção atribuída à comunidade, não à jogabilidade
- Golpe histórico de 800 bilhões via engenharia social — a economia é tão real que gera crimes reais

**Lições para produto**:
1. Economia é o sistema de retenção nº1 — instrumente faucets/sinks desde o dia 1
2. Sem wipes = sunk cost gigante
3. Crescer com intenção
4. Co-criar com a comunidade ("The Committee")

---

### MAFIA WARS — O Conto de Advertência

**Por que morreu**: dependência do Facebook, P2W agressivo, pivot corporativo.

**Números do desastre**:
- 45M MAU no pico (verão 2010) → 4,4M MAU em ~1 ano → fechado 2016
- Causas: mudanças de notificações do Facebook (2010/2012), taxa 30% do Facebook Credits, energia comprável, Zynga pivotou para mobile

**Lições para produto**:
1. **Nunca dependa de canal que não controla**
2. Vender a saída do timer corrói confiança
3. Viral loop precisa de limite anti-spam desde o dia 1
4. **Pico não é produto** — métrica de vaidade

---

### OGAME — Guerra Assíncrona e Perda Evitável

**Mecânica definidora**: **fleetsave** — "If it sits, it gets hit". Frota em movimento é indestrutível. Raid leva máx 50% dos recursos, prédios intactos, defesa se reconstrói (70%), anti-bashing (>6 ataques/dia), noob protection. Sem objetivo nem reset — universos envelhecem e são **fundidos** (Unifusion).

**Lições**:
1. Projete ausência para gerar perda evitável **com teto** (ansiedade dosada, não punição)
2. Travel time cria "horários a cumprir" no calendário real
3. Sem reset = sunk cost, merge em vez de delete
4. Universos 1x vs 5x+ segmentam ritmo

---

### TRAVIAN — Produção Offline + Deadline Narrativo

**Mecânica definidora**: produção continua offline mas **storage cap é 800 no início** → cada hora sem logar = produção desperdiçada ou estoque exposto. Rodada termina com **Maravilha do Mundo nível 100** → vitória → reset → recomeço (~200+ dias).

**Monetização**: Plus (conveniência) vs Gold (produção/instante; +10% ataque/defesa foi **revogado após backlash**).

**Lições**:
1. Production continua + storage cap = cadência forçada de login (âncora mais barata já testada)
2. **Reset programado é feature, não perda**
3. Ameaça social (aliança traída) > mecânica de ganho
4. Monetize conveniência, nunca poder

---

### TRIBAL WARS — Perda Permanente e Coordenação Social

**Mecânica definidora**: conquista permanente de vilas via nobleman; "noble train" com timing de 300ms (habilidade real). Maioria da coordenação acontece **fora do jogo** (fórum/IM). Mundos com regras distintas; inativos removidos após 14 dias.

**Números**: 59M registrados; ~800k ativos/mês (2019); €110M receita acumulada (2018).

**Stack**: PHP + MySQL; InnoGames publica no GitHub (php-resque/Redis, MySQL, Postgres, RabbitMQ, memcached, Go, Python, Haxe). Erlang: NÃO CONFIRMADO.

**Lições**:
1. Perda permanente + ameaça visível é motor de retenção
2. O produto social é o verdadeiro jogo (ferramentas de clã > conteúdo)
3. Worlds com reset = loop de recomeço infinito
4. Monetização competitiva gera backlash

---

### IKARIAM — Comércio como Motor Social

**Mecânica definidora**: 5 recursos, **2 por ilha → nenhuma ilha é autossuficiente → comércio obrigatório**. Até 16 cidades/ilha; 8 deuses; formas de governo (8, com período de anarquia); saque/ocupação sem conquista permanente; alianças com bônus diário de recursos.

**Lições**:
1. Economia/comércio gera retenção **sem PvP destrutivo**
2. Micro-gestão diária + meta de longo prazo
3. Tema como sistema (deuses = mecânicas), não skin
4. Segmentar intensidade de PvP amplia público

---

### GLADIATUS — Ranking Semanal e Itemização Profunda

**Mecânicas distintivas**:
- Arena PvP por Honra como centro social
- 12 pts expedição/dia (24 Centurion) + 12 dungeon (regen 1h30/pt, timer 48h)
- Dungeon em grupo de **mercenários que clonam seus stats** (cooperação sem players online)
- Job system de até 8h
- Itemização com prefixo/sufixo + 6 raridades com % públicas (Green 68,58% → Red 0,01%)
- Highscore de 7 dias; ~11 eventos recorrentes/mês

**Monetização**: Rubies (skip cooldown) + Centurion (assinatura de conveniência) — "compre tempo, não poder".

**Lições**:
1. "Gaste ou perca" com recurso regenerativo é o hook mais simples
2. Ranking semanal renovável
3. Dupla moeda (soft/hard) com gasto de conveniência
4. Raridades conhecidas sustentam grind de 18 anos

---

### BITEFIGHT — Facção como Identidade e Ritual Diário

**Mecânicas distintivas**:
- Vampiro × Lobisomem (**raça = identidade + lado na guerra**)
- **2h de caça/dia (4h premium), reset 0h** — ritual diário
- PvP por faixa de nível (±9 níveis ou ±15% — protege onboarding)
- Trabalho de até 8h no cemitério
- Guerras de clãs agendadas (declaração → 8h preparo → máx 28 rounds)
- Esconderijo pessoal defensivo; modo esconder-se (2-30 dias anti-PvP)

**Lições**:
1. Ritual diário com recurso escasso renovável
2. **"Nós × eles" como estrutura social** — todo player tem inimigo natural
3. PvP por faixa de nível protege novato
4. Viral por referência integrada ao tema ("mordedura")

---

### EREPUBLIK — Drama Emergente que Virou P2W

**Mecânica definidora**: país virtual espelhando países reais; política real (eleições mensais, golpes e revoluções possíveis); guerras entre nações; mídia/jornais de jogadores; "14 minutos por dia".

**Queda documentada**: P2W em guerras — "one older and stronger player can conquer any medium-sized nation by continually fighting via using their gold to purchase wellness packs" (Wikipedia). Pico 367k ativos (2010) → hoje milhares.

**Lições**:
1. Conteúdo emergente de PvP social é o conteúdo mais barato que existe
2. **P2W em jogo competitivo de longa duração é veneno de retenção**
3. Ritmo de baixa fricção cria hábito
4. "Morto" ≠ "encerrado" — comunidade pequena + custo baixo sustenta décadas

---

### HATTRICK — Baixa Frequência como Produto (28 anos)

**Mecânica definidora**: gestão ultra-realista; **1 partida/semana** na liga (16 semanas/temporada); "log in once a week... you'll have the same chance to be a champion". **Sem recompensas diárias obrigatórias**. API CHPP para ferramentas de terceiros.

**Monetização**: Supporter (Silver/Gold/Platinum/Diamond) — só QoL/cosmética/estatística. "There is no way to buy in-game advantages."

**Stack**: ASP.NET (URLs .aspx).

**Lições**:
1. **Baixa frequência pode ser o produto** — desenhe o ritmo como feature e promova-o
2. Monetização que não toca o equilíbrio preserva a base
3. Ecossistema aberto (API) retém
4. Profundidade estatística cria o veterano de 20 anos

---

### SHAKES & FIDGET — Loop de 2 Minutos + Escala Massiva

**Mecânicas distintivas**:
- **Thirst: reset para 100 à meia-noite** (cerveja premium = +20min)
- Arena 10 lutas/dia com 10min de espera
- 33 dungeons; torre de 100 andares; fortaleza estilo Clash of Clans
- 12 classes; 8 raças; 100+ pets colecionáveis
- **50M+ registrados**

**Lições**:
1. Loop minúsculo + reset diário fixo = hábito de custo zero
2. **Humor é feature de retenção**, não decoração
3. Social raso mas presente multiplica retenção
4. Compre tempo, F2P completa

---

### KINGDOM OF LOATHING — A Ascensão como Meta-Progressão

> **O mecanismo de replay mais poderoso encontrado em toda a pesquisa.**

**Ascensão (2005)**: zerar a quest final → Valhalla → **reencarnar do nível 1 com karma permanente** (Casual=11 / Normal=111 / Hardcore=211 karma) que compra **skills permanentes**. Paths de restrição voluntária (Teetotaler, Oxygenarian, Avatar of Boris). "New Game Plus" mais antigo e completo do gênero.

**Mecânicas base**: 40 adventures/dia (rollover), cap 200; 6 classes; crafting; Mall (lojas de jogadores); clans com dungeons cooperativas (Hobopolis); PvP voluntário por temporadas.

**Monetização**: doação US$10 = 1 Mr. Accessory (item equipável + moeda no Mr. Store). Mr. A é **negociável livremente** → moeda secundária com lastro em doação real. Sem ads, sem assinatura.

**IoTM (Item-of-the-Month)**: desde 2006 — data fixa de retorno no calendário todo mês.

**Stack**: PHP confirmado (dumps de erro com paths .php); MySQL [inferência]; CDN S3.

**Lições**:
1. **Prestígio com reset total + bônus permanente é o motor de retenção de longo prazo** — a perda é aceita porque a próxima run é objetivamente mais forte e diferente
2. Restrições voluntárias viram conteúdo (replay sem conteúdo novo)
3. Moeda real com lastro em item negociável
4. Escrita contínua e barata sustenta 23 anos (8 funcionários)

---

### Outros Jogos Relevantes

| Jogo | Destaque |
|---|---|
| **Utopia (1998)** | PBBG fundador; ages de 10-12 semanas com reset; 100% textual; reinos com monarca eleito |
| **Planetarion (2000)** | Pioneiro de rounds com reset + ticks/hora; 30k+ jogadores; virou pay-to-play e a base caiu |
| **Omerta (2003)** | Máfia anos 30; **kill permanente de contas rivais**; ~38M registros; F2P sem banners; click-limit histórico |
| **Astro Empires (~2006)** | RTS espacial 20 anos; **assistente de IA GPT em 2026** — sinal de que IA está entrando no gênero |
| **Pardus (2004)** | Action Points; economia player-driven; documenta "strip-mining" (depleção permanente de recursos) |
