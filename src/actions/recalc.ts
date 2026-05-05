"use server";

import { db, ensureMigrated } from "@/lib/db";
import { attendanceDays, holidays, justificationTypes } from "@/lib/db/schema";
import { analyzeDay } from "@/lib/analyzer/day-analyzer";
import { getSchedule } from "@/lib/settings";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-helpers";

export async function recalcAllAction(): Promise<{ updated: number }> {
  await requireAdmin();
  await ensureMigrated();
  const schedule = await getSchedule();

  const [holidayRows, jusTypes] = await Promise.all([
    db.select().from(holidays),
    db.select().from(justificationTypes),
  ]);
  const holidaySet = new Set(holidayRows.map((h) => h.holidayDate));
  const jusById = new Map(jusTypes.map((j) => [j.id, j]));

  const rows = await db.select().from(attendanceDays);
  let updated = 0;

  for (const r of rows) {
    const effective = r.correctedPunches ?? r.rawPunches;
    const jus = r.justificationId ? jusById.get(r.justificationId) ?? null : null;
    const a = analyzeDay({
      punches: effective,
      dayOfWeek: r.dayOfWeek,
      isHoliday: holidaySet.has(r.workDate),
      schedule,
      justified: jus ? { countsAsWorked: jus.countsAsWorked } : null,
    });

    await db
      .update(attendanceDays)
      .set({
        effectivePunches: effective,
        isWorkday: a.isWorkday,
        status: a.status,
        checkIn: a.checkIn,
        checkOut: a.checkOut,
        workedMinutes: a.workedMinutes,
        lateMinutes: a.lateMinutes,
        earlyLeaveMinutes: a.earlyLeaveMinutes,
        incidents: a.incidents,
        modifiedAt: new Date(),
      })
      .where(eq(attendanceDays.id, r.id));
    updated++;
  }

  revalidatePath("/", "layout");
  return { updated };
}
