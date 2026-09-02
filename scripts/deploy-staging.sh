#!/usr/bin/env bash
# Deploy staging (homolog): thin wrapper over deploy-prod.sh.
# The staging VPS runs the SAME compose as prod (docker-compose.prod.yml) with
# IMAGE_TAG=homolog and its own .env.production (staging values).
#
#   IMAGE_TAG=homolog ./scripts/deploy-staging.sh
#
# ⚠️ ONE-SHOT DB RESET REQUIRED before the FIRST deploy of the DB repository
# layer refactor (#158): pre-refactor databases have `0001_initial_schema`
# recorded in knex_migrations but the file no longer exists, so the boot-time
# migrate:latest aborts. Reset once on the staging VPS:
#   docker compose -f docker-compose.prod.yml down -v
# or via psql: DROP SCHEMA public CASCADE; CREATE SCHEMA public;
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
IMAGE_TAG="${IMAGE_TAG:-homolog}"
exec "$SCRIPT_DIR/deploy-prod.sh"