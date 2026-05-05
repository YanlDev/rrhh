"use server";

import { db, ensureMigrated } from "@/lib/db";
import { holidays } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { recalcAllAction } from "./recalc";
import { requireAdmin } from "@/lib/auth-helpers";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function createHolidayAction(input: {
  date: string;
  description: string;
  isNational: boolean;
}): Promise<{ ok: true }> {
  await requireAdmin();
  await ensureMigrated();
  if (!DATE_RE.test(input.date)) throw new Error("Fecha debe ser YYYY-MM-DD");
  if (!input.description.trim()) throw new Error("Descripción requerida");
  await db.insert(holidays).values({
    holidayDate: input.date,
    description: input.description.trim(),
    isNational: input.isNational,
  }).onConflictDoNothing({ target: holidays.holidayDate });
  await recalcAllAction();
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateHolidayAction(input: {
  id: string;
  description?: string;
  isNational?: boolean;
}): Promise<{ ok: true }> {
  await requireAdmin();
  await ensureMigrated();
  const { id, ...rest } = input;
  await db.update(holidays).set(rest).where(eq(holidays.id, id));
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteHolidayAction(id: string): Promise<{ ok: true }> {
  await requireAdmin();
  await ensureMigrated();
  await db.delete(holidays).where(eq(holidays.id, id));
  await recalcAllAction();
  revalidatePath("/", "layout");
  return { ok: true };
}
