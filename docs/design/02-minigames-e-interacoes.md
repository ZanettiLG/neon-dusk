# 02 — Minigames e Interações

## Regra fundamental

NÃO fazer minigame de reflexo ou habilidade client-side. O servidor decide o resultado; a interface é uma camada de decisão, suspense e revelação.

Isso preserva: filosofia do gênero PBBG, autoridade do servidor (anti-cheat) e orçamento.

## Interações do MVP

| Interação | Descrição |
|---|---|
| Teatro de rolagem | Ao executar trampo, números correm 1-2s em font-data e travam no resultado (roll vs. chance) |
| Cirurgia de cromo | Log do Ferrageiro digitando, batimento neural, custo de Humanidade piscando durante o cooldown |
| Confronto PvP | Barras de poder colidem e revelam o resultado server-side |
| Rank-up de Moral | Glitch dourado, título revelado, efeito breve no header |
| Porta do Saideira | Segurança avalia Moral antes de liberar a entrada ("Sem moral, sem entrada, sem choro") |
| Menu de Lendas | Cards de drinks com "brindar", card flip e detalhes do jogador |
| Syn-café ritual | Microanimação de café + NIL regenerando |
| Reset da rodada | Contagem final + "Apagão" visual + tela de transição |

## Fase 2

| Interação | Observação |
|---|---|
| Hacking como tabuleiro de nós | Nós, camadas de ICE, RAM e Trace; jogador decide programas e rota; servidor resolve |
| Escolha de abordagem | Stealth, Assault ou Netrun com modificadores visíveis antes do execute |
| Scanner de heat | Rádio policial/mapa de risco por distrito |
| Boletim do submundo | Missões diárias como mural da Babilônia |
| Eventos de temporada | Overlay global para Corp War, Blackout 2.0 e Night of the Long Knives |

## Fase 3 (referência futura)

- Rinha, Racha de Drones, Mercado de Dados, Roleta das Corp no formato apostar-e-revelar, nunca tempo real.
- House edge publicado e auditável.

## Nunca fazer

- Combate em tempo real.
- Quick time events.
- Mira, reflexo ou timing.
- Mapa aberto explorável.
- Minigames isolados que não afetem economia, trampos, cromo, bonde ou Moral.
