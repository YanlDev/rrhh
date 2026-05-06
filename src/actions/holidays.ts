"use server";

import { db, ensureMigrated } from "@/lib/db";
import { holidays } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { recalcAttendanceDaysByDates } from "@/lib/analyzer/recalc-day";
import { requireRrhh } from "@/lib/auth-helpers";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Invalidación común tras cambios de feriados. */
function revalidateAffected() {
  revalidatePath("/settings/holidays");
  revalidatePath("/review");
  revalidatePath("/employees");
  revalidatePath("/");
}

export async function createHolidayAction(input: {
  date: string;
  description: string;
  isNational: boolean;
}): Promise<{ ok: true }> {
  await requireRrhh();
  await ensureMigrated();
  if (!DATE_RE.test(input.date)) throw new Error("Fecha debe ser YYYY-MM-DD");
  if (!input.description.trim()) throw new Error("Descripción requerida");
  await db
    .insert(holidays)
    .values({
      holidayDate: input.date,
      description: input.description.trim(),
      isNational: input.isNational,
    })
    .onConflictDoNothing({ target: holidays.holidayDate });

  // Recalcular solo el día afectado (no toda la tabla).
  await recalcAttendanceDaysByDates([input.date]);
  revalidateAffected();
  return { ok: true };
}

export async function updateHolidayAction(input: {
  id: string;
  description?: string;
  isNational?: boolean;
}): Promise<{ ok: true }> {
  await requireRrhh();
  await ensureMigrated();
  const { id, ...rest } = input;
  await db.update(holidays).set(rest).where(eq(holidays.id, id));
  // Cambiar descripción/isNational no afecta cálculos, solo invalidar UI.
  revalidatePath("/settings/holidays");
  return { ok: true };
}

export async function deleteHolidayAction(id: string): Promise<{ ok: true }> {
  await requireRrhh();
  await ensureMigrated();
  // Capturar la fecha antes de borrar para poder recalcular solo ese día.
  const found = await db
    .select({ holidayDate: holidays.holidayDate })
    .from(holidays)
    .where(eq(holidays.id, id))
    .limit(1);
  await db.delete(holidays).where(eq(holidays.id, id));

  if (found[0]) {
    await recalcAttendanceDaysByDates([found[0].holidayDate]);
  }
  revalidateAffected();
  return { ok: true };
}
