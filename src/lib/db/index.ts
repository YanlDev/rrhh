import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL no está configurada");

// Pooler (Supabase port 6543) requiere prepare:false porque pgbouncer no soporta prepared statements
const isPooler = url.includes("pooler.supabase.com") || url.includes("pgbouncer=true");

const client = postgres(url, {
  prepare: !isPooler,
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
});

export const db = drizzle(client, { schema });

let migrated = false;
export async function ensureMigrated() {
  // En Postgres las migraciones se aplican vía drizzle-kit / Supabase MCP, no en runtime.
  if (migrated) return;
  migrated = true;
}
