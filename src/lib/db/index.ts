import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import path from "node:path";
import fs from "node:fs";
import * as schema from "./schema";

const dbPath = process.env.DATABASE_URL ?? "./data/asistencia.db";
const dir = path.dirname(dbPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const url = dbPath.startsWith("file:") || dbPath.startsWith("http") || dbPath.startsWith("libsql:")
  ? dbPath
  : `file:${path.resolve(dbPath)}`;

const client = createClient({ url });
export const db = drizzle(client, { schema });

let migrated = false;
export async function ensureMigrated() {
  if (migrated) return;
  const folder = path.resolve(process.cwd(), "drizzle");
  if (fs.existsSync(folder)) await migrate(db, { migrationsFolder: folder });
  migrated = true;
}
