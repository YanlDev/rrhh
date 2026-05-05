"use server";

import { db, ensureMigrated } from "@/lib/db";
import { attendanceDays, employees, justificationTypes } from "@/lib/db/schema";
import { eq, and, gte, lte, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { recalcAttendanceDay } from "@/lib/analyzer/recalc-day";
import { requireUser, requireRrhh } from "@/lib/auth-helpers";

export async function listJustificationTypesAction() {
  await requireUser();
  await ensureMigrated();
  return db.select().from(justificationTypes).where(eq(justificationTypes.active, true)).orderBy(justificationTypes.orderIndex);
}

export async function justifyDayAction(args: {
  attendanceDayId: string;
  justificationTypeId: string;
  note?: string | null;
}): Promise<{ ok: true }> {
  await requireRrhh();
  await ensureMigrated();
  await db
    .update(attendanceDays)
    .set({
      justificationId: args.justificationTypeId,
      justificationNote: args.note ?? null,
      modifiedAt: new Date(),
    })
    .where(eq(attendanceDays.id, args.attendanceDayId));
  await recalcAttendanceDay(args.attendanceDayId);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function clearJustificationAction(attendanceDayId: string): Promise<{ ok: true }> {
  await requireRrhh();
  await ensureMigrated();
  await db
    .update(attendanceDays)
    .set({ justificationId: null, justificationNote: null, modifiedAt: new Date() })
    .where(eq(attendanceDays.id, attendanceDayId));
  await recalcAttendanceDay(attendanceDayId);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Aplica la misma justificación a un rango de fechas para un empleado. */
export async function justifyRangeAction(args: {
  employeeId: string;
  fromDate: string; // YYYY-MM-DD
  toDate: string;
  justificationTypeId: string;
  note?: string | null;
}): Promise<{ updated: number }> {
  await requireRrhh();
  await ensureMigrated();
  const rows = await db
    .select({ id: attendanceDays.id })
    .from(attendanceDays)
    .where(
      and(
        eq(attendanceDays.employeeId, args.employeeId),
        gte(attendanceDays.workDate, args.fromDate),
        lte(attendanceDays.workDate, args.toDate)
      )
    );

  for (const r of rows) {
    await db
      .update(attendanceDays)
      .set({
        justificationId: args.justificationTypeId,
        justificationNote: args.note ?? null,
        modifiedAt: new Date(),
      })
      .where(eq(attendanceDays.id, r.id));
    await recalcAttendanceDay(r.id);
  }
  revalidatePath("/", "layout");
  return { updated: rows.length };
}

export async function justifyManyAction(args: {
  attendanceDayIds: string[];
  justificationTypeId: string;
  note?: string | null;
}): Promise<{ updated: number }> {
  await requireRrhh();
  await ensureMigrated();
  if (args.attendanceDayIds.length === 0) return { updated: 0 };
  await db
    .update(attendanceDays)
    .set({
      justificationId: args.justificationTypeId,
      justificationNote: args.note ?? null,
      modifiedAt: new Date(),
    })
    .where(inArray(attendanceDays.id, args.attendanceDayIds));
  for (const id of args.attendanceDayIds) await recalcAttendanceDay(id);
  revalidatePath("/", "layout");
  return { updated: args.attendanceDayIds.length };
}
