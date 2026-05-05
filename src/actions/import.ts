"use server";

import { db, ensureMigrated } from "@/lib/db";
import { employees, attendanceDays, importBatches, holidays } from "@/lib/db/schema";
import { parseWorkbookBuffer } from "@/lib/excel/parser";
import { analyzeDay } from "@/lib/analyzer/day-analyzer";
import { getSchedule } from "@/lib/settings";
import { eq, and } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireRrhh } from "@/lib/auth-helpers";

export type ImportResult = {
  ok: boolean;
  filename: string;
  periodStart: string;
  periodEnd: string;
  employeesUpserted: number;
  inactiveCount: number;
  daysUpserted: number;
  incidentsDetected: number;
  preservedCorrections: number;
  warnings: string[];
};

export async function importExcelAction(formData: FormData): Promise<ImportResult> {
  await requireRrhh();
  await ensureMigrated();
  const file = formData.get("file") as File | null;
  if (!file) throw new Error("No se recibió archivo");
  const buf = Buffer.from(await file.arrayBuffer());
  const schedule = await getSchedule();
  const parsed = parseWorkbookBuffer(buf, file.name, schedule.duplicateThresholdMinutes);

  const holidayRows = await db.select().from(holidays);
  const holidaySet = new Set(holidayRows.map((h) => h.holidayDate));

  let employeesUpserted = 0;
  let inactiveCount = 0;
  let daysUpserted = 0;
  let incidentsDetected = 0;
  let preservedCorrections = 0;

  await db.insert(importBatches).values({
    filename: parsed.filename,
    periodStart: parsed.periodStart,
    periodEnd: parsed.periodEnd,
    totalRows: parsed.employees.length,
    employeesCount: parsed.employees.filter((e) => e.totalPunches > 0).length,
    daysCount: parsed.employees.reduce((s, e) => s + e.days.length, 0),
    rawSnapshot: JSON.stringify({ warnings: parsed.warnings }),
  });

  for (const emp of parsed.employees) {
    const isActive = emp.totalPunches > 0;
    if (!isActive) inactiveCount++;

    const existing = (
      await db.select().from(employees).where(eq(employees.personId, emp.personId))
    )[0];

    let employeeId: string;
    if (existing) {
      await db
        .update(employees)
        .set({
          name: emp.name,
          department: emp.department,
          active: isActive,
          lastSeenAt: new Date(),
        })
        .where(eq(employees.id, existing.id));
      employeeId = existing.id;
    } else {
      const id = crypto.randomUUID();
      await db.insert(employees).values({
        id,
        personId: emp.personId,
        name: emp.name,
        department: emp.department,
        active: isActive,
      });
      employeeId = id;
    }
    employeesUpserted++;

    if (!isActive) continue;

    for (const d of emp.days) {
      const existingDay = (
        await db
          .select()
          .from(attendanceDays)
          .where(
            and(eq(attendanceDays.employeeId, employeeId), eq(attendanceDays.workDate, d.date))
          )
      )[0];

      const isHoliday = holidaySet.has(d.date);
      const corrected = existingDay?.correctedPunches ?? null;
      const justified = existingDay?.justificationId ? { countsAsWorked: true } : null;
      const effective = corrected ?? d.punches;
      const analysis = analyzeDay({
        punches: effective,
        dayOfWeek: d.dayOfWeek,
        isHoliday,
        schedule,
        justified,
      });
      if (["incomplete", "absent"].includes(analysis.status)) incidentsDetected++;

      if (existingDay) {
        if (corrected) preservedCorrections++;
        await db
          .update(attendanceDays)
          .set({
            rawPunches: d.punches,
            dayOfWeek: d.dayOfWeek,
            isWorkday: analysis.isWorkday,
            effectivePunches: effective,
            status: analysis.status,
            checkIn: analysis.checkIn,
            checkOut: analysis.checkOut,
            workedMinutes: analysis.workedMinutes,
            lateMinutes: analysis.lateMinutes,
            earlyLeaveMinutes: analysis.earlyLeaveMinutes,
            incidents: analysis.incidents,
            modifiedAt: new Date(),
          })
          .where(eq(attendanceDays.id, existingDay.id));
      } else {
        await db.insert(attendanceDays).values({
          employeeId,
          workDate: d.date,
          dayOfWeek: d.dayOfWeek,
          isWorkday: analysis.isWorkday,
          rawPunches: d.punches,
          effectivePunches: effective,
          status: analysis.status,
          checkIn: analysis.checkIn,
          checkOut: analysis.checkOut,
          workedMinutes: analysis.workedMinutes,
          lateMinutes: analysis.lateMinutes,
          earlyLeaveMinutes: analysis.earlyLeaveMinutes,
          incidents: analysis.incidents,
        });
      }
      daysUpserted++;
    }
  }

  revalidatePath("/");
  revalidatePath("/employees");
  revalidatePath("/review");

  return {
    ok: true,
    filename: parsed.filename,
    periodStart: parsed.periodStart,
    periodEnd: parsed.periodEnd,
    employeesUpserted,
    inactiveCount,
    daysUpserted,
    incidentsDetected,
    preservedCorrections,
    warnings: parsed.warnings,
  };
}
