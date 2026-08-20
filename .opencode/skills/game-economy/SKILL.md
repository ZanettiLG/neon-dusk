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
- Implementando mecânicas de economia (Grana, saque, vendors)
- Balanceando progressão (ganho de Moral, custo de cromo)
- Desenhando sinks de moeda (terapia, Resgate, housing)
- Carregada por: `game-logic-dev`, `db-designer`, `architect`

## Faucets e Sinks

### Faucets (fontes de moeda)
Toda moeda que entra na economia do jogo:

| Faucet | Frequência | Nota |
|---|---|---|
| Trampos | Diário (2-10x) | Principal fonte. Escala com tier |
| Hustle (renda passiva) | Semanal | Por banca. Pequeno mas consistente |
| Venda de saque | Variável | Componentes, dados, itens |
| Data brokering | Variável | Vultos vendem info hackeada |
| Recompensas de evento | Eventual | Corp War, Apagão |

### Sinks (sumidouros de moeda)
Toda moeda que SAI da economia:

| Sink | Propósito | Nota |
|---|---|---|
| Cromo e upgrades | Progressão vertical | Maior sink do jogo |
| Terapia de Humanidade | Manutenção de build | Essencial para balancear cromo |
| Resgate | Seguro contra morte | Sink recorrente + monetização saudável |
| Housing/Lifestyle | Custo recorrente | Anti-inflação passiva |
| Ampolas e consumíveis | Vantagem temporária | Sink de conveniência |
| Informação (Legwork) | Vantagem em trampos | Opcional, acelera progressão |

### Regra de Ouro
> Em estado estacionário, faucets ≤ sinks. Se faucets > sinks, a economia inflaciona. Se faucets < sinks, jogadores não progridem.

## Inflação

### Instrumentação
- Log de TODA transação de Grana desde o dia 1 (tabela `transaction_logs`)
- Métricas: Grana total em circulação, Grana média por jogador ativo, velocidade de circulação
- Alerta: se Grana média/ativo crescer >20% entre rodadas, economia está inflacionando

### Controle
- Preços fixos por categoria (modelo RED: Cheap → Super Luxury)
- Ajuste de sinks entre rodadas (custo de terapia, Resgate)
- Nunca ajustar faucets para baixo (jogadores percebem como nerf)

## Preços Fixos (Modelo RED)

| Categoria | Faixa (G$) | Exemplos |
|---|---|---|
| Cheap | 10-100 | Pingado, kibble, munição básica |
| Everyday | 100-500 | Refeição, aluguel de coffin, ampola comum |
| Costly | 500-1.000 | Ampolas incomuns, arma básica, cromo T1 |
| Premium | 1.000-5.000 | Cromo T2, arma avançada, terapia básica |
| Expensive | 5.000-20.000 | Cromo T3, estimulantes raros, informação |
| Very Expensive | 20.000-50.000 | Cromo T4, gazuá avançado, cirurgia |
| Luxury | 50.000-100.000 | Cromo T4 premium, veículo |
| Super Luxury | 100.000+ | Cromo T5, itens lendários |

## Anti-RMT (Real Money Trading)

- Sem trade player↔player no MVP (modelo The Crims)
- Itens de cromo são bound ao personagem (não transferíveis)
- Mercado entre jogadores só será aberto com população >5k DAU
- Exceção: dados/info podem ser vendidos via despachantes (controlado)

## Moeda Premium (Créditos ₵)

- Comprável com dinheiro real
- Usável para conveniência (NIL booster, Second Wind, cosméticos)
- NUNCA para poder (atributos, Moral, cromo superior)
- Jogadores podem ganhar pequenas quantidades via eventos e conquistas
