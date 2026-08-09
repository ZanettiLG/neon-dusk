import { db } from "./index";

async function main() {
  console.log("Running migrations...");
  const [batchNo, migrations] = await db.migrate.latest();
  console.log(`Batch ${batchNo} complete: ${migrations.length} migrations run.`);
  await db.destroy();
}
main().catch((err) => { console.error(err); process.exit(1); });
