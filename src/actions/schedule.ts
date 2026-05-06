"use server";

import { db, ensureMigrated } from "@/lib/db";
import { schedulePeriods } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recalcAllAction } from "./recalc";
import { requireRrhh } from "@/lib/auth-helpers";

const HM_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const periodSchema = z.object({
  effectiveFrom: z.string().regex(DATE_RE, "Fecha inválida (YYYY-MM-DD)"),
  weekdayStart: z.string().regex(HM_RE, "Hora inválida (HH:mm)"),
  weekdayEnd: z.string().regex(HM_RE, "Hora inválida (HH:mm)"),
  weekdayHours: z.number().min(0).max(24),
  weekdayLunchMinutes: z.number().int().min(0).max(240),
  saturdayStart: z.string().regex(HM_RE),
  saturdayEnd: z.string().regex(HM_RE),
  saturdayHours: z.number().min(0).max(24),
  saturdayLunchMinutes: z.number().int().min(0).max(240),
  toleranceMinutes: z.number().int().min(0).max(60),
  duplicateThresholdMinutes: z.number().int().min(0).max(30),
  minLunchMinutes: z.number().int().min(0).max(240),
  lunchWindowStart: z.string().regex(HM_RE),
  lunchWindowEnd: z.string().regex(HM_RE),
});

type PeriodInput = z.infer<typeof periodSchema>;
type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

export async function listSchedulePeriodsAction() {
  await requireRrhh();
  await ensureMigrated();
  return db.select().from(schedulePeriods).orderBy(asc(schedulePeriods.effectiveFrom));
}

export async function createSchedulePeriodAction(
  input: PeriodInput
): Promise<Result<{ id: string; recalculated: number }>> {
  try {
    await requireRrhh();
    await ensureMigrated();
    const parsed = periodSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    const inserted = await db
      .insert(schedulePeriods)
      .values({ ...parsed.data, updatedAt: new Date() })
      .returning({ id: schedulePeriods.id });

    const r = await recalcAllAction();
    revalidatePath("/settings/schedule");
    return { ok: true, data: { id: inserted[0].id, recalculated: r.updated } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    if (/unique/i.test(msg)) return { ok: false, error: "Ya existe un periodo con esa fecha" };
    return { ok: false, error: msg };
  }
}

export async function updateSchedulePeriodAction(input: {
  id: string;
} & PeriodInput): Promise<Result<{ recalculated: number }>> {
  try {
    await requireRrhh();
    await ensureMigrated();
    const id = z.string().uuid().safeParse(input.id);
    if (!id.success) return { ok: false, error: "ID inválido" };
    const parsed = periodSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    await db
      .update(schedulePeriods)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(schedulePeriods.id, id.data));

    const r = await recalcAllAction();
    revalidatePath("/settings/schedule");
    return { ok: true, data: { recalculated: r.updated } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}

export async function deleteSchedulePeriodAction(input: {
  id: string;
}): Promise<Result<{ recalculated: number }>> {
  try {
    await requireRrhh();
    await ensureMigrated();
    const id = z.string().uuid().safeParse(input.id);
    if (!id.success) return { ok: false, error: "ID inválido" };

    const remaining = await db.select({ id: schedulePeriods.id }).from(schedulePeriods);
    if (remaining.length <= 1) {
      return { ok: false, error: "Debe quedar al menos un periodo de horario" };
    }
    await db.delete(schedulePeriods).where(eq(schedulePeriods.id, id.data));

    const r = await recalcAllAction();
    revalidatePath("/settings/schedule");
    return { ok: true, data: { recalculated: r.updated } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}
