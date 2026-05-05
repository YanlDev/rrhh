import { db, ensureMigrated } from "../src/lib/db";
import { employees } from "../src/lib/db/schema";
import { eq } from "drizzle-orm";

async function main() {
  await ensureMigrated();
  const kevin = await db.select().from(employees).where(eq(employees.personId, "60377216"));
  console.log("KEVIN_ID=" + (kevin[0]?.id ?? ""));
}
main().then(() => process.exit(0));
