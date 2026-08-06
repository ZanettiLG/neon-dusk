# Neon Dusk — server image (3 stages: deps -> build -> production).
# Build context is the repo ROOT (see .github/workflows/deploy.yml), so every
# COPY path below is relative to the monorepo root.

# Stage 1: Production dependencies
# Install ONLY production deps so native modules (bcrypt) resolve prebuilt
# binaries for Alpine musl (bcrypt 6.x ships prebuilds/linux-x64/bcrypt.musl.node —
# no build-base/python3 needed). This stage's node_modules is what the final
# image runs.
FROM node:22-alpine AS deps
WORKDIR /app

# Workspace manifests needed by npm ci (app/package.json intentionally omitted —
# `npm ci --omit=dev` resolves workspaces from the lockfile without it).
COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY packages/shared/package.json ./packages/shared/

RUN npm ci --omit=dev

# Stage 2: Build
# Full install (devDeps included) to run `tsc` as a type-check gate.
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY packages/shared/package.json ./packages/shared/
COPY app/package.json ./app/

RUN npm ci

COPY tsconfig.base.json ./
COPY server/tsconfig.json ./server/
COPY server/src/ ./server/src/
COPY packages/shared/ ./packages/shared/

RUN npm run build -w server

# Stage 3: Production
# Runtime runs the TS source through tsx: `tsc` emits extensionless ESM imports
# (`from "./env"`) that plain `node` cannot resolve, and `@neon-dusk/shared`
# resolves to a `.ts` entry point. tsx (a production dependency) is the same
# loader the dev workflow uses.
FROM node:22-alpine
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Production node_modules (incl. Alpine-musl bcrypt binary)
COPY --from=deps /app/node_modules ./node_modules

# Source + shared package (tsx runtime + @neon-dusk/shared resolution)
COPY --from=build /app/server/src ./server/src
COPY --from=build /app/packages/shared ./packages/shared
COPY --from=build /app/server/package.json ./server/
COPY --from=build /app/package.json ./

# SQL migrations — used by the deploy script's one-shot migrate step
# (docker compose run --workdir /app/server ... tsx server/src/db/migrate.ts)
COPY server/migrations ./server/migrations

# Run as non-root (security best practice)
USER node

EXPOSE 3000

CMD ["node_modules/.bin/tsx", "server/src/server.ts"]
