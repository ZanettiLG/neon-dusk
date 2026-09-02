# Backup de banco de dados — Neon Dusk

> ND-018 — Integration & Polish. Script: `scripts/backup-db.sh` (roda na VPS).

## Procedimento

Backup diário do Postgres de produção via `pg_dump` (dentro do container
`postgres`, então `POSTGRES_USER`/`POSTGRES_DB` vêm do `env_file` — nada é
sourced). Saída: `/opt/neon-dusk/backups/neondusk-YYYYMMDD-HHMMSS.sql.gz`.

```bash
ssh vps && cd /opt/neon-dusk && ./scripts/backup-db.sh
```

O script:
1. valida `.env.production` presente (pre-flight, mesma mensagem do deploy);
2. `pg_dump | gzip` para o arquivo com timestamp;
3. verifica que o arquivo não está vazio (`test -s`, exit 1 + remove em caso de
   falha — dumps vazios reais morrem antes no `pipefail` do pg_dump);
4. prune: mantém os 7 backups mais recentes (`ls -1t | tail -n +8 | xargs rm`).

Simulação sem executar (útil para validar a cron em staging):

```bash
DRY_RUN=1 ./scripts/backup-db.sh
```

## Cron

Como root (ou via `crontab -e` do usuário com acesso a /opt/neon-dusk):

```cron
0 3 * * * cd /opt/neon-dusk && ./scripts/backup-db.sh >> /var/log/neondusk-backup.log 2>&1
```

Valide a cron com `DRY_RUN=1` e confira o log após o primeiro disparo.

## Restore

```bash
# 1. Parar o stack de aplicação (opcional — evita escrita durante o restore)
cd /opt/neon-dusk
docker compose --env-file .env.production -f docker-compose.prod.yml stop server app

# 2. Restaurar o dump mais recente (gunzip | psql dentro do container)
gunzip -c /opt/neon-dusk/backups/neondusk-$(ls -1t /opt/neon-dusk/backups/ | head -1 | sed 's/\.sql\.gz//').sql.gz \
  | docker compose --env-file .env.production -f docker-compose.prod.yml exec -T postgres \
      sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'

# 3. Subir o stack de novo
docker compose --env-file .env.production -f docker-compose.prod.yml up -d
```

Alternativa sem pipe (idempotente para re-tentativa):

```bash
gzip -dc /opt/neon-dusk/backups/neondusk-<TIMESTAMP>.sql.gz \
  | docker compose --env-file .env.production -f docker-compose.prod.yml exec -T postgres \
      sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'
```

> O restore sobrescreve o schema atual. Confirme o timestamp do dump antes de
> restaurar e considere tirar um backup "pre-restore" manual primeiro.