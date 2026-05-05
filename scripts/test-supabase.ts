import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { db } = await import("../src/lib/db");
  const { justificationTypes, holidays, appSettings } = await import("../src/lib/db/schema");

  const [j, h, s] = await Promise.all([
    db.select().from(justificationTypes),
    db.select().from(holidays),
    db.select().from(appSettings),
  ]);
  console.log("✓ Conexión a Supabase Postgres OK");
  console.log(`  - justification_types: ${j.length}`);
  console.log(`  - holidays:            ${h.length}`);
  console.log(`  - app_settings:        ${s.length}`);
  console.log(`  - schedule weekday:    ${s[0]?.weekdayStart} → ${s[0]?.weekdayEnd}`);
}

main().then(() => process.exit(0)).catch((e) => { console.error("✗ Error:", e); process.exit(1); });
