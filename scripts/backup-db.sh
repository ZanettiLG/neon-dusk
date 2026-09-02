#!/usr/bin/env bash
# Daily production DB backup: pg_dump (via docker compose exec) → gzip →
# size guard → prune to the 7 most recent backups. Runs ON THE VPS:
#
#   ssh vps && cd /opt/neon-dusk && ./scripts/backup-db.sh
#
# Cron (docs/ops/backup.md):
#   0 3 * * * cd /opt/neon-dusk && ./scripts/backup-db.sh >> /var/log/neondusk-backup.log 2>&1
#
# Test hooks (no VPS needed):
#   DRY_RUN=1             print commands instead of executing them.
#   FORCE_EMPTY_BACKUP=1  force the empty-file error path (tests exit 1).
#   BACKUP_DIR=<path>     override the backup directory (tests use a tempdir).
#
# POSTGRES_USER/POSTGRES_DB resolve inside the container (the postgres service
# gets them via env_file in docker-compose.prod.yml), so nothing is sourced.
#
# Notes: the gzip header alone is never 0 bytes, so an empty DUMP would pass
# `test -s` — real empty dumps die earlier via `set -o pipefail` on the
# pg_dump side; FORCE_EMPTY_BACKUP simulates that path for the test.
set -euo pipefail

# The dump contains password hashes and PII — default to 600 on every file
# this script creates (backups dir, dump), regardless of the invoking umask.
umask 077

BACKUP_DIR=${BACKUP_DIR:-/opt/neon-dusk/backups}
KEEP=7

# run(): execute a command, or print it and return 0 when DRY_RUN=1.
run() {
  if [ "${DRY_RUN:-0}" = "1" ]; then
    printf '+ %s\n' "$*"
    return 0
  fi
  "$@"
}

# compose(): docker compose bound to the production env-file/compose-file.
compose() {
  run docker compose --env-file .env.production -f docker-compose.prod.yml "$@"
}

# Pre-flight: fail fast with a clear message before touching docker.
if [ ! -f .env.production ]; then
  echo "ERROR: .env.production not found. Run from /opt/neon-dusk:"
  echo "  ssh vps && cd /opt/neon-dusk && ./scripts/backup-db.sh"
  exit 1
fi

mkdir -p "$BACKUP_DIR"
BACKUP_FILE="$BACKUP_DIR/neondusk-$(date +%Y%m%d-%H%M%S).sql.gz"

# The dump pipeline runs inside the container shell (sh -c) so the container's
# own env vars (POSTGRES_USER/POSTGRES_DB via env_file) resolve. DRY_RUN prints
# the command to stdout — a plain `run ... | gzip` would swallow that print
# into the gzip stream, hence the explicit branch.
dump_database() {
  compose exec -T postgres \
    sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip' > "$BACKUP_FILE"
}

echo "[1/2] Dumping database to $BACKUP_FILE..."
if [ "${DRY_RUN:-0}" = "1" ]; then
  # compose() prints the canonical `docker compose ...` command (DRY_RUN).
  compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" | gzip'
  printf 'DRY_RUN placeholder\n' > "$BACKUP_FILE"
else
  dump_database
fi

# Test hook: simulate an empty dump (see notes above).
if [ "${FORCE_EMPTY_BACKUP:-0}" = "1" ]; then
  : > "$BACKUP_FILE"
fi

if [ ! -s "$BACKUP_FILE" ]; then
  echo "ERROR: backup file is empty — pg_dump produced no output"
  rm -f "$BACKUP_FILE"
  exit 1
fi
echo "  ✓ Backup OK ($(wc -c < "$BACKUP_FILE") bytes)"

# Prune: `ls -1t` sorts by mtime (newest first), so keeping the newest KEEP
# drops everything older via the tail + xargs pipe.
prune_backups() {
  ls -1t "$BACKUP_DIR"/neondusk-*.sql.gz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
}

echo "[2/2] Pruning backups — keeping the ${KEEP} most recent..."
if [ "${DRY_RUN:-0}" = "1" ]; then
  run ls -1t "$BACKUP_DIR"/neondusk-*.sql.gz
else
  prune_backups
fi
echo "Backup complete."