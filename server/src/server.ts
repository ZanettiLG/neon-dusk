import { env } from "./env";
import { buildApp } from "./app";
import { seedGigTemplates } from "./services/gig-service";
import { startRoundCheckCron } from "./cron/round-check";

async function main() {
  const app = await buildApp({ env });

  // Seed the static gig catalog (Fixer Cupim board) on boot. Best-effort:
  // when migrations have not run yet the table is missing and the server
  // still comes up — the seed simply runs again on the next restart.
  try {
    const seeded = await seedGigTemplates();
    if (seeded > 0) app.log.info(`Seeded ${seeded} gig templates`);
  } catch (err) {
    app.log.warn({ err }, "Gig template seed skipped (is the DB migrated?)");
  }

  const signals: NodeJS.Signals[] = ["SIGINT", "SIGTERM"];

  for (const signal of signals) {
    process.on(signal, async () => {
      app.log.info(`Received ${signal}. Shutting down gracefully...`);
      await app.close();
      process.exit(0);
    });
  }

  try {
    await app.listen({ port: env.PORT, host: env.HOST });
    app.log.info(`NEON//DUSK running at http://${env.HOST}:${env.PORT}`);
    // ND-017: hourly round-expiry check (single-instance MVP, ADR-4).
    startRoundCheckCron(app);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
