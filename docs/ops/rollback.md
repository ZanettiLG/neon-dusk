# Rollback de produção — Neon Dusk

> ND-018 — Integration & Polish. Baseado no comportamento real de
> `scripts/deploy-prod.sh` (auto-rollback por image ID + docker tag).

## Auto-rollback (deploy script)

`scripts/deploy-prod.sh` captura as images **em execução antes do pull** e, se o
smoke test falhar (`/` ou `/api/health`), reverte para elas automaticamente:

1. `capture_previous_images` grava os image IDs via `docker inspect`
   (`{{.Image}}`) dos containers `neondusk-server` / `neondusk-app`. São **IDs,
   não tags** — o pull sobrescreve a tag `latest`.
2. Em falha do smoke test, `rollback()`:
   - `docker tag <PREVIOUS_SERVER_IMAGE> ghcr.io/zan-ia/neon-dusk-server:latest`
   - `docker tag <PREVIOUS_APP_IMAGE> ghcr.io/zan-ia/neon-dusk-app:latest`
   - `docker compose up -d` (restart do stack com as imagens revertidas)
   - `exit 1` (deploy marcado como falho)

O rollback **sempre roda** — mesmo sem imagem anterior ele restart a stack e
sai com exit 1.

## Rollback manual

Se o problema aparecer depois do deploy (não capturado pelo smoke test), reverta
às imagens anteriores explicitamente — o script aceita override por env:

```bash
cd /opt/neon-dusk

# Com os image IDs das imagens boas conhecidas:
PREVIOUS_SERVER_IMAGE=<image_id> PREVIOUS_APP_IMAGE=<image_id> FORCE_SMOKE_FAIL=1 \
  ./scripts/deploy-prod.sh

# Ou direto, sem o script:
docker tag <image_id_server> ghcr.io/zan-ia/neon-dusk-server:latest
docker tag <image_id_app> ghcr.io/zan-ia/neon-dusk-app:latest
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

Para descobrir o image ID da versão boa: `docker inspect --format '{{.Image}}' neondusk-server`.

## Caveats

- **Migrations são forward-only.** O rollback de imagem não reverte schema — se
  a migration nova quebrou, o container antigo pode não funcionar contra o banco
  novo. O caminho é corrigir a migration e redeployar, não "desmigrar".
- **Primeiro deploy é no-op de rollback.** Não há imagem anterior para reverter
  (sem `PREVIOUS_*` o `docker tag` é pulado; o script só restart e sai com 1).
- **Falha no migrate = PARAR.** `run_migrations` roda antes do `up -d`; com
  `set -e` o script aborta e o stack continua nas imagens antigas (ainda de pé).
  NÃO rode `up -d` manualmente até a migration ser corrigida.
- Migrations de schema novo entram em arquivo novo; migrations já aplicadas não
  são editadas (ver `docs/definicoes-de-produto/` e conventions de SQL).

## Runbook de incidente

1. **Detectar** — smoke test do deploy falhou (exit 1), ou alerta Prometheus
   `NeonDuskServerDown`/`NeonDuskHighErrorRate` (ver `docs/ops/monitoring.md`).
2. **Confirmar** — `docker compose --env-file .env.production -f docker-compose.prod.yml ps`
   e `curl -sf http://localhost/api/health`. Se o migrate abortou, pare aqui e
   corrija a migration antes de qualquer `up -d`.
3. **Reverter** — `PREVIOUS_SERVER_IMAGE=... PREVIOUS_APP_IMAGE=... FORCE_SMOKE_FAIL=1 ./scripts/deploy-prod.sh`
   (ou rollback manual acima). Confirme `/api/health` OK após o restart.
4. **Registrar** — documente a causa no issue do deploy e abra follow-up para
   corrigir a migration/aplicação antes do próximo deploy.