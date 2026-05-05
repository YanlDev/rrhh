"use server";

import { db, ensureMigrated } from "@/lib/db";
import { attendanceDays } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { recalcAttendanceDay } from "@/lib/analyzer/recalc-day";
import { requireRrhh } from "@/lib/auth-helpers";

const TIME_RE = /^([01]?\d|2[0-3]):[0-5]\d$/;

function normalize(input: string[]): string[] {
  return input
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      if (!TIME_RE.test(s)) throw new Error(`Marca inválida: "${s}" (HH:mm)`);
      const [h, m] = s.split(":");
      return `${h.padStart(2, "0")}:${m}`;
    })
    .sort();
}

export async function setCorrectedPunchesAction(args: {
  attendanceDayId: string;
  punches: string[];
  note?: string | null;
}): Promise<{ ok: true }> {
  await requireRrhh();
  await ensureMigrated();
  const punches = normalize(args.punches);
  await db
    .update(attendanceDays)
    .set({
      correctedPunches: punches,
      justificationNote: args.note ?? null,
      modifiedAt: new Date(),
    })
    .where(eq(attendanceDays.id, args.attendanceDayId));
  await recalcAttendanceDay(args.attendanceDayId);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function clearCorrectionAction(attendanceDayId: string): Promise<{ ok: true }> {
  await requireRrhh();
  await ensureMigrated();
  await db
    .update(attendanceDays)
    .set({ correctedPunches: null, modifiedAt: new Date() })
    .where(eq(attendanceDays.id, attendanceDayId));
  await recalcAttendanceDay(attendanceDayId);
  revalidatePath("/", "layout");
  return { ok: true };
}
