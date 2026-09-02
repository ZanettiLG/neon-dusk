# Monitoramento — Neon Dusk (Prometheus)

> ND-018 — Integration & Polish. Stack: Prometheus (docker compose) scrapping
> o `/metrics` do servidor + regras de alerta em `prometheus/alerts.yml`.

## Métricas expostas

O servidor expõe `/metrics` (text format, `prom-client`) com:

| Métrica | Tipo | Significado |
|---|---|---|
| `neondusk_nil_spent_total` | counter | NIL consumido (por character) |
| `neondusk_eddies_earned_total` | counter | Grana ganha (faucets) |
| `neondusk_eddies_spent_total` | counter | Grana gasta (sinks) |
| `neondusk_gigs_completed_total` | counter | Trampos concluídos |
| `neondusk_pvp_attacks_total` | counter | Ataques PvP |
| `neondusk_http_requests_total{status_class}` | counter | Requests HTTP por classe de status (ND-018) |
| `neondusk_active_characters` | gauge | Personagens ativos nas últimas 24h |

> Os nomes das métricas no `alerts.yml` foram verificados contra
> `server/src/telemetry/metrics.ts` — mantenha os dois em sync ao alterar.

## Alertas (`prometheus/alerts.yml`)

| Alerta | Condição | Severidade |
|---|---|---|
| `NeonDuskServerDown` | `up{job="neondusk"} == 0` por 5m | critical |
| `NeonDuskZeroActiveCharacters` | `neondusk_active_characters == 0` por 30m | warning |
| `NeonDuskHighErrorRate` | 5xx / total > 5% por 10m | warning |

Regras avaliadas a cada 15s (`evaluation_interval`).

## Ver alertas na UI do Prometheus

```bash
cd /opt/neon-dusk && docker compose --env-file .env.production -f docker-compose.prod.yml up -d prometheus
# (prometheus service usa prometheus/prometheus.yml + prometheus/alerts.yml;
#  scrapa o servidor via host.docker.internal:3000)
```

1. Abra `http://<vps>:9090` (ou túnel ssh `ssh -L 9090:localhost:9090 vps`).
2. **Alerts**: menu *Alerts* → lista `NeonDuskServerDown` / `NeonDuskZeroActiveCharacters` /
   `NeonDuskHighErrorRate` com estado `inactive`/`pending`/`firing`.
3. **Graph**: menu *Graph* → digite `neondusk_active_characters` ou
   `rate(neondusk_http_requests_total{status_class="5xx"}[5m])` para inspecionar.
4. **Targets**: menu *Status → Targets* → job `neondusk` deve estar `UP`.

## Alertmanager (pós-MVP)

Hoje os alertas vivem na UI/avaliação do Prometheus (não há routing externo).
Pós-MVP, adicionar:

- serviço `alertmanager` no compose de produção (imagem `prom/alertmanager`);
- `route:` no `prometheus.yml` apontando para o Alertmanager;
- receivers: e-mail (SMTP), Discord webhook ou Slack — conforme canais de
  community da fase de launch.

Nada mais muda nos `alerts.yml` — as regras já emitem o estado `firing` que o
Alertmanager consome.