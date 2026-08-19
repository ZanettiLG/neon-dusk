#!/usr/bin/env bash
# ND-018: Deploy staging — pull images, restart stack, health check.
set -euo pipefail

# ⚠️ ONE-SHOT DB RESET REQUIRED before the FIRST deploy of the DB repository
# layer refactor (#158): pre-refactor databases have `0001_initial_schema`
# recorded in knex_migrations but the file no longer exists, so the boot-time
# migrate:latest aborts. The new DDL is byte-equivalent; dev/staging data is
# disposable. Reset once on the staging VPS:
#   docker compose -f docker-compose.yml down -v
# or, keeping containers up (via psql):
#   DROP SCHEMA public CASCADE; CREATE SCHEMA public;
# After the reset, this script can run normally again.

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="${ROOT_DIR}/docker-compose.yml"

echo "╔══════════════════════════════════════╗"
echo "║  ND-018 DEPLOY STAGING              ║"
echo "╚══════════════════════════════════════╝"
echo ""
echo "⚠️  One-shot DB reset required on the FIRST deploy of the DB repository"
echo "    layer refactor (#158) — see the comment block at the top of this"
echo "    script. Only needed once per environment."

# 1. Pull latest images
echo "[1/3] Pulling images..."
docker compose -f "${COMPOSE_FILE}" pull || true

# 2. Restart the stack
echo "[2/3] Restarting services..."
docker compose -f "${COMPOSE_FILE}" up -d --remove-orphans

# Wait for services to start
sleep 2

# 3. Health check loop (12 retries, 5s interval)
echo "[3/3] Health check (12 retries × 5s)..."
for i in $(seq 1 12); do
  if curl -sf http://localhost:3000/api/health > /dev/null 2>&1; then
    echo "  ✓ Health check passed on attempt ${i}"
    break
  fi
  if [ "$i" -eq 12 ]; then
    echo "  ❌ Health check FAILED after 12 attempts"
    echo ""
    echo "Container status:"
    docker compose -f "${COMPOSE_FILE}" ps
    exit 1
  fi
  sleep 5
done

echo ""
echo "Container status:"
docker compose -f "${COMPOSE_FILE}" ps

echo ""
echo "╔══════════════════════════════════════╗"
echo "║  DEPLOY COMPLETE                    ║"
echo "╚══════════════════════════════════════╝"
