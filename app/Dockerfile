# Neon Dusk — app image (2 stages: build -> nginx).
# Build context is the repo ROOT (see docker-compose.yml / scripts/deploy-staging.sh).

# Stage 1: Build
FROM node:22-alpine AS build
WORKDIR /app

# Workspace manifests for npm ci
COPY package.json package-lock.json ./
COPY app/package.json ./app/
COPY packages/shared/package.json ./packages/shared/

# Full install (Vite, TypeScript, React)
RUN npm ci

# Source + config needed by `tsc --noEmit && vite build`
COPY tsconfig.base.json ./
COPY app/tsconfig.json app/tsconfig.node.json app/env.d.ts ./app/
COPY app/index.html ./app/
COPY app/vite.config.ts app/postcss.config.js app/tailwind.config.js ./app/
COPY app/src/ ./app/src/
COPY app/public/ ./app/public/
COPY packages/shared/ ./packages/shared/

# tsc --noEmit + vite build (emits to app/dist)
RUN npm run build -w app

# Stage 2: Production (nginx)
FROM nginx:alpine

# SPA routing + /api reverse proxy + PWA caching rules
COPY app/nginx.conf /etc/nginx/conf.d/default.conf

# Built static assets
COPY --from=build /app/app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
