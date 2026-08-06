# The Crims — Análise Completa

> **thecrims.com** | Lançamento: 2004 | País: Suécia (Helsingborg) | Desenvolvedor: PopCode KB | Stack: PHP → Vue.js SPA + Laravel [inferência]

## 1. História e Contexto

| Fato | Dado | Fonte |
|---|---|---|
| **Lançamento** | **2004** (não 2000 como consta em algumas bases) | 4 evidências independentes: domínio registrado 16/07/2003, empresa PopCode KB 01/04/2004, primeiro conteúdo no Wayback 28/11/2004, estúdio "Est. 2004" |
| **Tempo no ar** | ~22 anos contínuos (2004→2026) | thecrims.com |
| **Contas criadas** | ~18,25 milhões (contador de IDs) | archive.org |
| **Pico histórico** | ~1.643 online (mar/2009); era de ouro 2005-2010 | archive.org |
| **Ativos hoje** | ~508 online / ~1.446 últimas 24h (ago/2026) | thecrims.com |
| **Monetização** | F2P + VIP temporário + créditos (moeda premium) + prêmios em dinheiro real para top da rodada | changelog oficial |
| **Stack** | Origem PHP v1.161 (2007); hoje front Vue.js SPA + Bootstrap/jQuery, Cloudflare, backend Laravel [inferência] | Wikipedia-pt, archive, inspeção de build |
| **Versões** | Jogo contínuo com rodadas numeradas — Round 239 em ago/2026; sem "The Crims 2" | changelog oficial |

### Detalhe jurídico relevante
Em 2010 o MPF/Justiça brasileira mandou suspender sites do jogo por "apologia ao crime". **Implicação para produto**: um jogo de crime precisa de escudo editorial (contextualização, humor, ficção explícita) em mercados sensíveis.

## 2. Mecânicas Core

### 2.1 Sistema de Energia/Stamina
- **Stamina** exibida em %, tamanho absoluto não publicado
- Regen passiva, velocidade afetada por "spirit"/moral
- **Tickets** = unidade de ação: 200 no início da rodada, **72/dia** (120 para Robber), máx acumulado 300 (380 Robber)
- Extras via level, casino, VIP
- **Refill instantâneo**: drogas/cerveja na Nightlife (custa 1 ticket para entrar); preço sobe com **vício** (addiction)
- "Use All Stamina" = múltiplos roubos em 1 clique
- "Hire Robbers" = até 1.000 tickets por vez, -25% recompensa para não-VIP, cooldown 3 dias
- **Unidade de tempo**: 1 TC day = 6 horas reais. Rodada atual = 52 TC dias ≈ **13 dias reais**

### 2.2 Atividades Criminosas
- Roubos **solo** e **de gangue**; % de sucesso ligada a "Robbery Power"
- **Anti-grind embutido**: se power >> dificuldade, stats ganhos diminuem — ótimo é power ≈ dificuldade
- **Falha solo**: prisão + perda de **20% do dinheiro em mãos** (banco protegido)
- **Falha gangue**: todos presos + perda de **2% dos stats + 2% do dinheiro**
- Roubos especiais (Warren Buffet/Pentagon): falha = **5% stats + 10% money**
- **Prisão**: sem fuga; opções = esperar, bribe proporcional ao respeito, ou créditos
- **Hunting Grounds** (35 raves): bots escaláveis por dia do round
- **Street Fights** de gangue: 8 bosses com power fixo (600k → 37,5M)

### 2.3 Drogas
- Ciclo completo: produzir → vender no Dealer (comissão 5%) → vender nas Docas (sem comissão) → consumir para refill na Nightlife
- **14 drogas** (Hash → Magic Mushrooms), cada uma de um roubo de componente
- **Vício**: >10% reduz ganho de treino; curável com Detox/Metadona; overdose → hospital 1h real
- **Drug Mules** (gangue): líder chama mula; membros trusted recebem em 4 dias TC

### 2.4 Combate/Gangues
- **PvP (Assault)**: máx 2 assaults/dia na mesma pessoa; máx 20 kills/pessoa/rodada
- Vencedor ganha stats; vítima perde 3% (wounding) ou 2% (death)
- Após 5 assaults entre as mesmas contas, troca cai para 0,1% (anti-farming)
- **Guards**: 3 guardas, cada um -10% de perda
- **Gangues**: criar com 50 respect; 2 trusted members por rodada; até 15 membros via HQ
- **Gang Wars**: até 4 guerras/dia; atacante tem 5 min reais; perdedor perde 2% gang points
- **Sabotage**: fórmula com 4 stats, 1% de sucesso por level, cooldown 10 dias TC
- **Fight Club**: Weekly = $100M prêmio; Fresh Fish = $1M para contas até 100k respect

### 2.5 Economia
- Moeda **$** (em mãos vs banco — banco protege de prisão)
- Conversão: **30.000 $ = 1 respeito; 8 stats = 1 respeito** (hitman: 4)
- **Stock Market**: 16 empresas, 3 riscos; preço inicial 150$; eventos sobem/descem 4-35%
- **Investimentos**: 5 créditos → 3% retorno em 4 dias TC
- **Negócios**: fábricas (upgrade nível 13; condição cai 10/dia), nightclubs, puteiros, casas
- **Trade direto jogador↔jogador: NÃO existe** — só leilão de componentes (Black Market)
- **Inflação**: administrada por eventos de injeção + sinks (manutenção, bribe, hospital, guards)
- Moeda premium: **créditos** (item ~7-8 centavos)

### 2.6 Progressão
- **13 níveis**; 4 stats (Intelligence, Tolerance, Strength, Charisma)
- Teto de respeito por stats: 5M (não-hitman) / 30M (hitman)
- **7 profissões** escolhidas no nível 2: Gangster, Businessman, Robber, Pimp, Dealer, Broker, Hitman
- Cada profissão com bônus numéricos específicos
- **Treino**: 2.400 stats/30min reais; bônus de gangue +10%/nível (até +100%)
- **Universidade**: 6 cursos, 3 tiers, custo 150 créditos ou $50M-500M, bônus permanentes
- **Missões diárias**: 15 missões do dia 5 ao 49
- **Reset de conta**: 2x por rodada

### 2.7 Casino
- Blackjack, caça-níqueis (aposta máx $5M), **loteria** (6/25, prêmio 150 créditos), **dados** (2 compras + 1 grátis/dia)
- House edge: **NUNCA publicado**
- Motivo de uso: ganhar tickets, itens raros, créditos

### 2.8 Eventos/Sazonalidade
- **Rodada com reset completo** + medalhas/prêmios no fim
- **Eventos globais** que mudam regras no meio (Rusga Policial, Black Friday, Black Thursday)
- Contas inativas por 1 rodada são apagadas

### 2.9 Social
- Chat global, mensagens privadas, livro de visitas
- Relações/contatos (necessário para convidar para gangue)
- Rankings (respeito, killers, países, gangues)
- Fórum vBulletin + Discord

## 3. Game Loop

### Loop diário reconstruído
> "meu esquema de jogo era escolher ladrão e ficar roubando 24 horas, roubava até a estamina zerar, ia na minha própria boate, enchia até 100% com cerva ou maconha e roubava de novo. O dinheiro dos roubos ia tudo pra comprar fábricas de drogas." — jogador BR, r/brasil 2019

1. Login → checar eventos do dia → gastar stamina em roubos → refill com drogas/boate → checar gangue → treinar (30min/1h) → timers diários → logout

### Motivação de retorno
- Energia recarregada + produção passiva para coletar (FOMO de "desperdiçar recarga")
- Treinos que precisam ser ligados
- Dados grátis diários
- Rodada com deadline e prêmio
- Rivalidades nacionais ("BORA BATER NOS POLACO")
- **Nostalgia**: jogador voltando após 8 anos

### O que NÃO existe
- **NÃO existe daily reward de login** — os ganchos são todos de mecânica (timers), não bônus

## 4. PRD Implícito

### Essenciais (sem as quais não funciona)
1. Barra de energia como recurso central (cria fim de sessão, ritmo de retorno, monetiza consumíveis)
2. Crimes como core loop e fonte primária de dinheiro
3. Economia multi-camada que converte dinheiro em progressão passiva
4. "Respeito" como score de rodada + ranking (competição/status)
5. Rodada com reset + prêmios (arco de temporada, fair start, limpeza de inativos)
6. Gangues + PvP (rivalidade/drama/comunidade)
7. Treino com timer (idle progress)

### Diferenciais
- Tema de crime coeso com humor adulto
- Casino como sink+emoção
- Economia simulada rica (bolsa 16 empresas, docas, investimentos)
- **Eventos globais que mudam as regras no meio da rodada**
- Prêmios em dinheiro real (esports pré-esports)
- Comunidades nacionais por idioma (~28)

### O que NÃO tem (e por que é inteligente)
- Sem gráficos elaborados (conteúdo = estado, não animação)
- Sem gameplay em tempo real (turno/timer = sem servidor de baixa latência)
- Sem PvP mecânico (comparar poder e clicar — PvP é social/estratégico)
- Sem mapa explorável (menu de locais)
- **Sem app nativo** (roda no navegador do celular — um front-end só)

Essas ausências são o que mantém o jogo barato de operar por 22 anos.

### Críticas conhecidas
- Bots/scripts de auto-roubo (vendidos publicamente)
- Multi-account "spy" com transferência de respeito (corrói confiança no ranking)
- Banimento por IP (casal no mesmo IP banido)
- Comunicação in-game quebrada (equipes usam WhatsApp)
- Endgame raso ("depois do último nível de roubo tem o que pra fazer?")
- **Pay-to-win reconhecido até no changelog oficial**
- Crítico: *"Já foi o melhor jogo de navegador. Agora se entregaram ao p2w"*
