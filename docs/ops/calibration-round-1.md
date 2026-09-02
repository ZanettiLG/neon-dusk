# Calibração — Round 1 (template)

> ND-018 — Template para o relatório de calibração de cada rodada. Copie este
> arquivo para `calibration-round-<n>.md` a cada rodada analisada e preencha
> com a saída do `npm run calibration:report -- --round <n>`.

## Números medidos

Rodada: **1** · Janela: `<started_at> → <ended_at>`

| Fluxo | Tipo | n | Total (G$) |
|---|---|---|---|
| FAUCET | GIG_PAYOUT | 0 | 0 |
| FAUCET | PVP_REWARD | 0 | 0 |
| FAUCET | CREW_BONUS | 0 | 0 |
| FAUCET | GRANT (ADMIN_ADJUSTMENT) | 0 | 0 |
| SINK | VENDOR_PURCHASE | 0 | 0 |
| SINK | PVP_LOSS | 0 | 0 |
| SINK | STIM_PURCHASE | 0 | 0 |
| SINK | CHROME_PURCHASE | 0 | 0 |
| SINK | CREW_CREATION | 0 | 0 |
| SINK | THERAPY_PAYMENT | 0 | 0 |
| OUTRO | _qualquer outro type_ | 0 | 0 |

Resumo:

- Faucets totais: **0 G$**
- Sinks totais: **0 G$**
- Net: **0 G$** (meta: levemente positivo)
- Sink ratio: **0%** (meta: ≥ 60%)
- Personagens ativos (round_stats): **0**
- Faucet / personagem: **0 G$** · Sink / personagem: **0 G$**

Verificação de inflação pós-reset:

- transaction_log ≤ fim da rodada: **0** (esperado 0)
- Σ(wallet.balance) ≤ fim da rodada: **0** (esperado 0)
- Resultado: ✅ reset intacto / ⚠ pendente

## Decisões de tuning (game_params)

| Param | Valor anterior | Valor novo | Justificativa |
|---|---|---|---|
| `INITIAL_BALANCE` | 500 | — | _preencher_ |
| _outro param_ | — | — | _preencher_ |

## Conclusão

_Net na meta? Sink ratio ≥ 60%? Ajustes necessários na próxima rodada?_