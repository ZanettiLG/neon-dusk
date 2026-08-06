# @neon-dusk/server

Node.js 22 + TypeScript + Fastify + Drizzle (PostgreSQL) + Redis (ioredis).

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | tsx watch on `src/server.ts` |
| `npm run build` | `tsc` → `dist/` |
| `npm run start` | `node dist/server.js` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:generate` | Drizzle Kit migration generation |
| `npm run db:migrate` | Apply migrations via `src/db/migrate.ts` |
| `npm run db:studio` | Drizzle Studio |
