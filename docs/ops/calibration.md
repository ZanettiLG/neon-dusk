# Calibração da economia — Neon Dusk

> ND-018 — Integration & Polish. Script: `scripts/calibration-report.ts`
> (`npm run calibration:report`).

## Metodologia

A economia do Neon Dusk é fechada por rodada: faucets criam grana
(GIG_PAYOUT, PVP_REWARD, CREW_BONUS + o grant inicial de 500 G$ registrado
como ADMIN_ADJUSTMENT em `wallet.ensure`), sinks removem (VENDOR_PURCHASE,
PVP_LOSS, STIM_PURCHASE, CHROME_PURCHASE, CREW_CREATION, THERAPY_PAYMENT).
O reset da rodada zera wallets e apaga o ledger (`wipe_transaction_log` +
`zero_wallets` em `server/src/game/round-reset.ts`).

Metas de balanceamento:

| Métrica | Meta | Motivo |
|---|---|---|
| **Net (faucets − sinks)** | levemente positivo | precisa dar grana para o jogador gastar no próximo ciclo |
| **Sink ratio (sinks / faucets)** | ≥ 60% | sem sinks suficientes o excesso vira inflação acumulada na rodada |
| **Inflação pós-reset** | 0 / 0 | reset impermeável: nada sobrevive ao boundary |

Leitura: rodar o relatório após o reset (rodada encerrada = tabela vazia +
check de inflação 0/0) e ao vivo (rodada ativa = fluxo real).

## Uso

```bash
# Última rodada encerrada (default) — valida o reset + inflação 0/0
npm run calibration:report

# Rodada específica
npm run calibration:report -- --round 2

# Rodada ativa (fluxo ao vivo)
npm run calibration:report -- --round <n_ativa>
```

Requer DB de produção/staging acessível via `DATABASE_URL` (o script usa o
mesmo `db` Knex do servidor).

## Tuning

Ajustes de economia acontecem via `game_params` (admin panel), nunca em
migration. Parametros relevantes:

- `INITIAL_BALANCE` — grant inicial (default 500).
- Preços de estoque de vendors / cromo — parametrizados no seed de conteúdo
  (`content-seeds.ts`) e ajustáveis no painel admin.
- Payouts de trampo / recompensas PvP — ver `server/src/services/gig-service.ts`
  e `pvp-service.ts` (tabelas de loot/outcome).

Decisão de tuning: medir com o relatório → ajustar o param no admin → rodar o
relatório da rodada seguinte para confirmar a convergência (net leve + sink
ratio ≥ 60%).