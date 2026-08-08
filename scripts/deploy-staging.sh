#!/usr/bin/env bash
# ND-018: Deploy staging — pull images, restart stack, health check.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="${ROOT_DIR}/docker-compose.yml"

echo "╔══════════════════════════════════════╗"
echo "║  ND-018 DEPLOY STAGING              ║"
echo "╚══════════════════════════════════════╝"
echo ""

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
