"use server";

import { db, ensureMigrated } from "@/lib/db";
import { scheduleOverrides } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { recalcAllAction } from "./recalc";
import { requireAdmin } from "@/lib/auth-helpers";

const HM_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const schema = z.object({
  workDate: z.string().regex(DATE_RE, "Fecha inválida (YYYY-MM-DD)"),
  description: z.string().trim().min(1, "Describe el motivo").max(200),
  startTime: z.string().regex(HM_RE),
  endTime: z.string().regex(HM_RE),
  hours: z.number().min(0).max(24),
  lunchMinutes: z.number().int().min(0).max(240),
  lunchWindowStart: z.string().regex(HM_RE),
  lunchWindowEnd: z.string().regex(HM_RE),
});

type Input = z.infer<typeof schema>;
type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

export async function listScheduleOverridesAction() {
  await requireAdmin();
  await ensureMigrated();
  return db.select().from(scheduleOverrides).orderBy(asc(scheduleOverrides.workDate));
}

export async function createScheduleOverrideAction(
  input: Input
): Promise<Result<{ recalculated: number }>> {
  try {
    await requireAdmin();
    await ensureMigrated();
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    await db.insert(scheduleOverrides).values({ ...parsed.data, updatedAt: new Date() });
    const r = await recalcAllAction();
    revalidatePath("/settings/schedule-overrides");
    return { ok: true, data: { recalculated: r.updated } };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Error";
    if (/duplicate|unique|primary/i.test(msg)) {
      return { ok: false, error: "Ya existe un override para esa fecha" };
    }
    return { ok: false, error: msg };
  }
}

export async function updateScheduleOverrideAction(
  input: Input
): Promise<Result<{ recalculated: number }>> {
  try {
    await requireAdmin();
    await ensureMigrated();
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    await db
      .update(scheduleOverrides)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(scheduleOverrides.workDate, parsed.data.workDate));
    const r = await recalcAllAction();
    revalidatePath("/settings/schedule-overrides");
    return { ok: true, data: { recalculated: r.updated } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}

export async function deleteScheduleOverrideAction(input: {
  workDate: string;
}): Promise<Result<{ recalculated: number }>> {
  try {
    await requireAdmin();
    await ensureMigrated();
    const date = z.string().regex(DATE_RE).safeParse(input.workDate);
    if (!date.success) return { ok: false, error: "Fecha inválida" };
    await db.delete(scheduleOverrides).where(eq(scheduleOverrides.workDate, date.data));
    const r = await recalcAllAction();
    revalidatePath("/settings/schedule-overrides");
    return { ok: true, data: { recalculated: r.updated } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}
