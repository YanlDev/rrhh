import { db } from "@/lib/db";
import { attendanceDays, holidays, justificationTypes } from "@/lib/db/schema";
import { analyzeDay } from "./day-analyzer";
import { getSchedule, type Schedule } from "@/lib/settings";
import { eq } from "drizzle-orm";

export async function recalcAttendanceDay(rowId: string, scheduleArg?: Schedule) {
  const row = (await db.select().from(attendanceDays).where(eq(attendanceDays.id, rowId)))[0];
  if (!row) throw new Error(`attendance_day no existe: ${rowId}`);

  const schedule = scheduleArg ?? (await getSchedule());
  const isHoliday = !!(await db.select().from(holidays).where(eq(holidays.holidayDate, row.workDate)))[0];
  const jus = row.justificationId
    ? (await db.select().from(justificationTypes).where(eq(justificationTypes.id, row.justificationId)))[0]
    : null;

  const effective = row.correctedPunches ?? row.rawPunches;
  const a = analyzeDay({
    punches: effective,
    dayOfWeek: row.dayOfWeek,
    isHoliday,
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
    .where(eq(attendanceDays.id, rowId));
}
