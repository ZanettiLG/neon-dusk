#!/usr/bin/env bash
# Deploy images → migrate → restart stack → smoke test → rollback on failure →
# prune old images. Runs ON THE VPS (not the laptop). Serves BOTH environments:
# production (`IMAGE_TAG=latest`, the default) and staging (`IMAGE_TAG=homolog`,
# via the thin `deploy-staging.sh` wrapper):
#
#   ssh vps && cd /opt/neon-dusk && git pull && ./scripts/deploy-prod.sh
#   IMAGE_TAG=homolog ./scripts/deploy-staging.sh   # staging VPS
#
# A flock serializes concurrent deploys on this host (workflow + manual): the
# second deploy blocks until the first finishes, then deploys the newest image.
#
# Test hooks (no VPS needed):
#   DRY_RUN=1                     print commands instead of executing them.
#   PREVIOUS_SERVER_IMAGE=<id>    override docker inspect (manual rollback).
#   PREVIOUS_APP_IMAGE=<id>       override docker inspect (manual rollback).
#   FORCE_SMOKE_FAIL=1            force the smoke test to fail (rollback path).
#
# Known gaps: GHCR images only refresh via a manual build (build-and-push was
# removed); if the FIRST deploy fails the rollback is a no-op (recovery is
# manual); if migrate fails, stop — do NOT `up -d` until the migration is fixed;
# the one-shot DB reset warning from the original workflow (#158) was dropped as
# obsolete — a first deploy onto a pre-#158 DB fails at migrate with a cryptic
# knex error (README covers the upgrade path).
set -euo pipefail

REGISTRY=ghcr.io/zan-ia
REGISTRY_TAG="${IMAGE_TAG:-latest}"

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
  echo "  ssh vps && cd /opt/neon-dusk && git pull && ./scripts/deploy-prod.sh"
  exit 1
fi

# Serialize deploys on this host (workflow + manual). Blocking, not -n:
# the second deploy waits and deploys the newest image.
exec 9>/tmp/neondusk-deploy.lock
flock 9

# Capture the currently-running images BEFORE pulling, so a failed smoke test
# can roll back to them. Image IDs, not tags — pull overwrites `latest`.
capture_previous_images() {
  [ "${DRY_RUN:-0}" = "1" ] && return 0
  if [ -z "${PREVIOUS_SERVER_IMAGE:-}" ]; then
    PREVIOUS_SERVER_IMAGE="$(docker inspect --format '{{.Image}}' neondusk-server 2>/dev/null || true)"
  fi
  if [ -z "${PREVIOUS_APP_IMAGE:-}" ]; then
    PREVIOUS_APP_IMAGE="$(docker inspect --format '{{.Image}}' neondusk-app 2>/dev/null || true)"
  fi
}

bring_up_infra() {
  echo "[1/6] Bringing up infra (postgres + redis)..."
  compose up -d --wait postgres redis
}

pull_images() {
  echo "[2/6] Pulling latest images..."
  compose pull
}

run_migrations() {
  echo "[3/6] Running migrations (idempotent)..."
  # workdir /app/server so knexfile.ts and ./migrations resolve; the knex CLI
  # is hoisted to /app/node_modules inside the server image.
  compose run --rm --no-deps --workdir /app/server server \
    /app/node_modules/.bin/knex --knexfile knexfile.ts migrate:latest
}

deploy_containers() {
  echo "[4/6] Replacing changed containers..."
  compose up -d --remove-orphans
}

# Smoke test app and API, each with a 10×2s retry loop.
smoke_test() {
  echo "[5/6] Smoke test (app + api, 20s max each)..."
  if [ "${FORCE_SMOKE_FAIL:-0}" = "1" ]; then
    echo "! FORCE_SMOKE_FAIL=1 — forcing smoke test failure (rollback path)"
    APP_OK=false
    API_OK=false
    return 0
  fi

  APP_OK=false
  for i in $(seq 1 10); do
    if run curl -sf http://localhost/ -o /dev/null; then
      echo "  ✓ App OK"
      APP_OK=true
      break
    fi
    sleep 2
  done

  API_OK=false
  for i in $(seq 1 10); do
    if run curl -sf http://localhost/api/health -o /dev/null; then
      echo "  ✓ API OK"
      API_OK=true
      break
    fi
    sleep 2
  done
}

# Roll back to the previous images. docker tag accepts image IDs. No-op when
# there is no previous image (first deploy); still restarts the stack.
rollback() {
  echo "! Rolling back to previous images..."
  if [ -n "${PREVIOUS_SERVER_IMAGE:-}" ]; then
    run docker tag "$PREVIOUS_SERVER_IMAGE" "$REGISTRY/neon-dusk-server:${REGISTRY_TAG}"
  fi
  if [ -n "${PREVIOUS_APP_IMAGE:-}" ]; then
    run docker tag "$PREVIOUS_APP_IMAGE" "$REGISTRY/neon-dusk-app:${REGISTRY_TAG}"
  fi
  compose up -d
  exit 1
}

prune_images() {
  echo "[6/6] Pruning old images (non-fatal)..."
  run docker image prune -af --filter "until=24h" || true
}

capture_previous_images
bring_up_infra
pull_images
run_migrations
deploy_containers
smoke_test
if [ "$APP_OK" != "true" ] || [ "$API_OK" != "true" ]; then
  echo "ERROR: smoke test failed (app=$APP_OK api=$API_OK) — rolling back"
  rollback
fi
prune_images
echo "Deploy complete."
