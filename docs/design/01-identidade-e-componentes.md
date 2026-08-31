# 01 — Identidade e Componentes

## Vocabulário de componentes

| Componente   | Função                                                     | Estado                                       |
| ------------ | ---------------------------------------------------------- | -------------------------------------------- |
| Panel        | Superfície elevada com borda de terminal                   | normal, alerta, perigo, destaque             |
| MetricBar    | Barra de recurso (NIL, Humanidade, progresso, dificuldade) | valor, cor por faixa, label, contagem        |
| ActionButton | Ação primária grande e legível                             | ativo, loading, cooldown, bloqueado + motivo |
| EventLog     | Timeline de eventos com timestamp                          | severidade, resultado, custo, retry          |
| StatusBadge  | Tier, tipo, estado                                         | cor por semântica, sempre com texto          |
| OutcomeChip  | Resultado de rolagem (roll vs. chance)                     | sucesso, falha, crítica                      |
| Tab          | Navegação local                                            | ativo, inativo, disabled                     |
| PhaseStepper | Fases do trampo (Meet, Legwork, Execute, Escape, Wrap Up)  | concluída, atual, pendente                   |
| Button       | Ação base com variantes (primária, perigo, ouro, fantasma) | ativo, loading, disabled                     |
| Input        | Campo de texto com label, erro e dica                      | normal, erro, disabled                       |
| Modal        | Diálogo modal com foco preso                               | aberto, fechado                              |
| Tabs         | Navegação por abas com painéis (roving tabindex)           | selecionada, inativa, disabled               |
| TabPanel     | Painel de conteúdo de uma aba                              | visível, oculto                              |
| Table        | Tabela de dados com estados                                | dados, loading, erro, vazio                  |
| EmptyState   | Estado vazio reutilizável                                  | mensagem, ação                               |
| LoadingState | Estado de carregamento                                     | skeleton, inline                             |
| ErrorState   | Estado de erro com retry                                   | erro, retry                                  |

## Shell mobile

Hoje a navegação principal fica oculta no mobile (app/src/components/AppHeader.tsx). Evoluir para:

- Bottom navigation com 5 atalhos principais (Painel, Trampos, Saideira, Cromo, PvP).
- Drawer/menu lateral para telas secundárias (Vendedores, Economia, Bondes, Admin).
- HUD compacto persistente: NIL, Humanidade, Grana e Moral.
- Alertas de timers, trampo ativo, PvP e reset de rodada.
- Estado offline/degradado visível sem poluir a tela.

## Painel do Corredor (Dashboard)

Transformar em ficha viva:

- Retrato/avatar do personagem.
- Banca e origem com identidade própria.
- Barras de NIL e Humanidade.
- Cromo resumido no body-map.
- Últimos eventos e timers importantes.
- Ações rápidas: trampo, Saideira, vendors, cromo.

## Mapa de São Paulo

NÃO usar mapa aberto explorável (cortável pela pesquisa de mercado; The Crims usa menu de locais).

Usar mapa-metrô/diagrama de distritos:

- Cada distrito é uma estação/card.
- A Paraíso no topo; Quebrada e As Mortas na base.
- Saturação visual por classe social.
- Ícones de trampos disponíveis, vendors, despachantes e perigo.
- Travessia entre distritos como loading diegético de elevador/metrô.
- A Saideira já é uma estação da antiga Linha 3-Vermelha.

## Cromo

Evoluir de catálogo para tela de build:

- Body-map com slots clicáveis (Frontal Cortex 3, Ocular 2, OS 1, Arms 2, Skeleton 2, Nervous 3, Circulatory 3, Integumentary 3, Legs 1).
- Bônus individuais por implante.
- Custo de Humanidade sempre visível.
- Antes/depois de atributos, HP e NIL.
- Estado de cyberpsychosis progressivo na UI.
- SO como decisão central (Gazuá, SO Fúria, SO Surto).

## PvP

- Dois cards espelhados (atacante vs. defensor).
- Poder, Moral, custo de NIL e risco.
- Resultado com log de combate.
- Saque e variação de cred.
- Indicadores de noob shield e anti-griefing.

## Trampos

- Retrato do despachante.
- Distrito com banner atmosférico.
- Tipo e tier como carimbos.
- Chance de sucesso, custo, risco e recompensa antes do aceite.
- Requisitos visíveis.
- Resultado com o Catálogo de Elogios de Rua (canônico em `docs/definicoes-de-produto/06-terminologia-e-ip.md`): "Serviço limpo." ✅, "Deu ruim." ✅, "Alguém viu tua cara." ✅, "Boa. Volta amanhã que tem mais." ✅, "Ninguém viu nada. Nem você." 🆕, "Trampo perfeito. A rua vai falar teu nome." 🆕, "Deu ruim. Mas cê tá vivo — já é lucro." 🆕, "Tenta de novo, na moral." 🆕.

## Saideira

- Porta/segurança como gate visual (Moral >= 10).
- Balcão com Carcará.
- Menu de Lendas como artefato permanente (cards de drinks com brinde).
- Chat com moldura de bar.
- Leaderboard como quadro de reputação.
- Boletins do submundo.

## Estados obrigatórios em toda tela

Loading (skeleton), vazio, erro + retry, sucesso, cooldown, ação bloqueada com motivo, confirmação para ações destrutivas, offline/degradado.
