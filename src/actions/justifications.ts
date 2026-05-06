"use server";

import { db, ensureMigrated } from "@/lib/db";
import { attendanceDays, justificationTypes } from "@/lib/db/schema";
import { eq, and, gte, lte, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { recalcAttendanceDay, recalcAttendanceDays } from "@/lib/analyzer/recalc-day";
import { requireUser, requireRrhh } from "@/lib/auth-helpers";

export async function listJustificationTypesAction() {
  await requireUser();
  await ensureMigrated();
  return db
    .select()
    .from(justificationTypes)
    .where(eq(justificationTypes.active, true))
    .orderBy(justificationTypes.orderIndex);
}

const HM_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

function validateWindow(from?: string | null, to?: string | null): string | null {
  // Ambos vacíos = día completo (válido).
  if (!from && !to) return null;
  // Ambos requeridos si uno está presente.
  if (!from || !to) return "Indica horas desde y hasta para la ventana, o deja ambos vacíos para día completo";
  if (!HM_RE.test(from) || !HM_RE.test(to)) return "Hora inválida (formato HH:mm)";
  const [fh, fm] = from.split(":").map(Number);
  const [th, tm] = to.split(":").map(Number);
  if (fh * 60 + fm >= th * 60 + tm) return "La hora 'hasta' debe ser mayor que 'desde'";
  return null;
}

export async function justifyDayAction(args: {
  attendanceDayId: string;
  justificationTypeId: string;
  note?: string | null;
  fromTime?: string | null;
  toTime?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireRrhh();
  await ensureMigrated();
  const err = validateWindow(args.fromTime, args.toTime);
  if (err) return { ok: false, error: err };
  await db
    .update(attendanceDays)
    .set({
      justificationId: args.justificationTypeId,
      justificationNote: args.note ?? null,
      justificationFrom: args.fromTime || null,
      justificationTo: args.toTime || null,
      modifiedAt: new Date(),
    })
    .where(eq(attendanceDays.id, args.attendanceDayId));
  await recalcAttendanceDay(args.attendanceDayId);
  revalidatePath("/review");
  revalidatePath("/employees", "layout");
  return { ok: true };
}

export async function clearJustificationAction(attendanceDayId: string): Promise<{ ok: true }> {
  await requireRrhh();
  await ensureMigrated();
  await db
    .update(attendanceDays)
    .set({
      justificationId: null,
      justificationNote: null,
      justificationFrom: null,
      justificationTo: null,
      modifiedAt: new Date(),
    })
    .where(eq(attendanceDays.id, attendanceDayId));
  await recalcAttendanceDay(attendanceDayId);
  revalidatePath("/review");
  revalidatePath("/employees", "layout");
  return { ok: true };
}

/** Aplica la misma justificación a un rango de fechas para un empleado (batch). */
export async function justifyRangeAction(args: {
  employeeId: string;
  fromDate: string; // YYYY-MM-DD
  toDate: string;
  justificationTypeId: string;
  note?: string | null;
}): Promise<{ updated: number }> {
  await requireRrhh();
  await ensureMigrated();
  const ids = await db
    .select({ id: attendanceDays.id })
    .from(attendanceDays)
    .where(
      and(
        eq(attendanceDays.employeeId, args.employeeId),
        gte(attendanceDays.workDate, args.fromDate),
        lte(attendanceDays.workDate, args.toDate)
      )
    );
  if (ids.length === 0) return { updated: 0 };
  const idList = ids.map((r) => r.id);

  await db
    .update(attendanceDays)
    .set({
      justificationId: args.justificationTypeId,
      justificationNote: args.note ?? null,
      modifiedAt: new Date(),
    })
    .where(inArray(attendanceDays.id, idList));

  await recalcAttendanceDays(idList);
  revalidatePath("/review");
  revalidatePath("/employees", "layout");
  return { updated: idList.length };
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
  await recalcAttendanceDays(args.attendanceDayIds);
  revalidatePath("/review");
  revalidatePath("/employees", "layout");
  return { updated: args.attendanceDayIds.length };
}
