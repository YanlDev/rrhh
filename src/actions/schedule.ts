"use server";

import { db, ensureMigrated } from "@/lib/db";
import { appSettings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getSettings } from "@/lib/settings";
import { recalcAllAction } from "./recalc";
import { requireAdmin } from "@/lib/auth-helpers";

const HM_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

export async function updateScheduleAction(input: {
  weekdayStart: string;
  weekdayEnd: string;
  weekdayHours: number;
  saturdayStart: string;
  saturdayEnd: string;
  saturdayHours: number;
  toleranceMinutes: number;
  duplicateThresholdMinutes: number;
}): Promise<{ ok: true; recalculated: number }> {
  await requireAdmin();
  await ensureMigrated();
  for (const k of ["weekdayStart", "weekdayEnd", "saturdayStart", "saturdayEnd"] as const) {
    if (!HM_RE.test(input[k])) throw new Error(`Hora inválida en ${k}: ${input[k]} (formato HH:mm)`);
  }
  if (input.weekdayHours <= 0 || input.weekdayHours > 24) throw new Error("Horas L-V fuera de rango");
  if (input.saturdayHours < 0 || input.saturdayHours > 24) throw new Error("Horas sábado fuera de rango");
  if (input.toleranceMinutes < 0 || input.toleranceMinutes > 60) throw new Error("Tolerancia fuera de rango");
  if (input.duplicateThresholdMinutes < 0 || input.duplicateThresholdMinutes > 30) throw new Error("Umbral de duplicados fuera de rango");

  const current = await getSettings();
  await db
    .update(appSettings)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(appSettings.id, current.id));

  const r = await recalcAllAction();
  revalidatePath("/", "layout");
  return { ok: true, recalculated: r.updated };
}
