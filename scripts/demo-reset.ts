// `npm run demo:reset` — safe reset: deletes only isDemo records, then reseeds. Uses DATABASE_URL when set,
// otherwise the local embedded database in .data/pglite.
import "dotenv/config";
import { getDb } from "../lib/db";
import { seedDemoData } from "../server/demo/seed";

async function main() {
  const db = await getDb();
  await seedDemoData(db);
  console.log("Demo data reset.");
  await db.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
