---
name: game-economy
description: Game economy design patterns for multiplayer games. Covers faucets/sinks, inflation control, balancing, and monetization patterns. Use when implementing economy mechanics (currency, loot, vendors), balancing progression, or designing currency sinks.
license: MIT
compatibility: opencode
metadata:
  audience: agents
  domain: game-design
---

# Game Economy — Padrões de Economia para Jogos Multiplayer

Skill de design de economia para jogos. Padrões de faucets/sinks, inflação, balanceamento e monetização.

## Quando Carregar
- Implementando mecânicas de economia (eddies, loot, vendors)
- Balanceando progressão (ganho de SC, custo de chrome)
- Desenhando sinks de moeda (terapia, Trauma Team, housing)
- Carregada por: `game-logic-dev`, `db-designer`, `architect`

## Faucets e Sinks

### Faucets (fontes de moeda)
Toda moeda que entra na economia do jogo:

| Faucet | Frequência | Nota |
|---|---|---|
| Gigs | Diário (2-10x) | Principal fonte. Escala com tier |
| Hustle (renda passiva) | Semanal | Por role. Pequeno mas consistente |
| Venda de loot | Variável | Componentes, dados, itens |
| Data brokering | Variável | Netrunners vendem info hackeada |
| Recompensas de evento | Eventual | Corp War, Blackout |

### Sinks (sumidouros de moeda)
Toda moeda que SAI da economia:

| Sink | Propósito | Nota |
|---|---|---|
| Chrome e upgrades | Progressão vertical | Maior sink do jogo |
| Terapia de Humanidade | Manutenção de build | Essencial para balancear chrome |
| Trauma Team | Seguro contra morte | Sink recorrente + monetização saudável |
| Housing/Lifestyle | Custo recorrente | Anti-inflação passiva |
| Stims e consumíveis | Vantagem temporária | Sink de conveniência |
| Informação (Legwork) | Vantagem em gigs | Opcional, acelera progressão |

### Regra de Ouro
> Em estado estacionário, faucets ≤ sinks. Se faucets > sinks, a economia inflaciona. Se faucets < sinks, jogadores não progridem.

## Inflação

### Instrumentação
- Log de TODA transação de eddies desde o dia 1 (tabela `transaction_logs`)
- Métricas: eddies totais em circulação, eddies médios por jogador ativo, velocidade de circulação
- Alerta: se eddies médios/ativo crescer >20% entre rodadas, economia está inflacionando

### Controle
- Preços fixos por categoria (modelo RED: Cheap → Super Luxury)
- Ajuste de sinks entre rodadas (custo de terapia, Trauma Team)
- Nunca ajustar faucets para baixo (jogadores percebem como nerf)

## Preços Fixos (Modelo RED)

| Categoria | Faixa (€$) | Exemplos |
|---|---|---|
| Cheap | 10-100 | Syn-café, kibble, munição básica |
| Everyday | 100-500 | Refeição, aluguel de coffin, stim comum |
| Costly | 500-1.000 | Stims incomuns, arma básica, chrome T1 |
| Premium | 1.000-5.000 | Chrome T2, arma avançada, terapia básica |
| Expensive | 5.000-20.000 | Chrome T3, estimulantes raros, informação |
| Very Expensive | 20.000-50.000 | Chrome T4, deck avançado, cirurgia |
| Luxury | 50.000-100.000 | Chrome T4 premium, veículo |
| Super Luxury | 100.000+ | Chrome T5, itens lendários |

## Anti-RMT (Real Money Trading)

- Sem trade player↔player no MVP (modelo The Crims)
- Itens de chrome são bound ao personagem (não transferíveis)
- Mercado entre jogadores só será aberto com população >5k DAU
- Exceção: dados/info podem ser vendidos via fixers (controlado)

## Moeda Premium (Créditos ₵)

- Comprável com dinheiro real
- Usável para conveniência (NIL booster, Second Wind, cosméticos)
- NUNCA para poder (atributos, SC, chrome superior)
- Jogadores podem ganhar pequenas quantidades via eventos e conquistas
