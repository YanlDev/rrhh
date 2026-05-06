"use server";

import { db, ensureMigrated } from "@/lib/db";
import {
  employees,
  attendanceDays,
  importBatches,
  holidays,
  justificationTypes,
} from "@/lib/db/schema";
import { parseWorkbookBuffer } from "@/lib/excel/parser";
import { analyzeDay } from "@/lib/analyzer/day-analyzer";
import {
  loadAllSchedulePeriods,
  loadScheduleOverrides,
  resolveScheduleForDate,
  getCurrentSchedule,
} from "@/lib/settings";
import { inArray, sql } from "drizzle-orm";
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

  // Para limpiar duplicados al parsear usamos el horario más reciente (criterio uniforme).
  const currentSchedule = await getCurrentSchedule();
  const parsed = parseWorkbookBuffer(buf, file.name, currentSchedule.duplicateThresholdMinutes);

  // ---------- Precarga de TODO en pocas queries ----------
  const [periods, overrides, holidayRows, existingEmployees, jusTypes] = await Promise.all([
    loadAllSchedulePeriods(),
    loadScheduleOverrides(),
    db.select({ holidayDate: holidays.holidayDate }).from(holidays),
    db
      .select({
        id: employees.id,
        personId: employees.personId,
        hireDate: employees.hireDate,
        terminationDate: employees.terminationDate,
      })
      .from(employees),
    db
      .select({
        id: justificationTypes.id,
        countsAsWorked: justificationTypes.countsAsWorked,
      })
      .from(justificationTypes),
  ]);
  const holidaySet = new Set(holidayRows.map((h) => h.holidayDate));
  const existingEmpIdByPersonId = new Map(existingEmployees.map((e) => [e.personId, e.id]));
  const tenureByPersonId = new Map(
    existingEmployees.map((e) => [
      e.personId,
      { hireDate: e.hireDate, terminationDate: e.terminationDate },
    ])
  );
  const jusById = new Map(jusTypes.map((j) => [j.id, j.countsAsWorked]));

  // ---------- Insert del batch (auditoría) ----------
  const inactiveCount = parsed.employees.filter((e) => e.totalPunches === 0).length;
  await db.insert(importBatches).values({
    filename: parsed.filename,
    periodStart: parsed.periodStart,
    periodEnd: parsed.periodEnd,
    totalRows: parsed.employees.length,
    employeesCount: parsed.employees.length - inactiveCount,
    daysCount: parsed.employees.reduce((s, e) => s + e.days.length, 0),
    rawSnapshot: { warnings: parsed.warnings },
  });

  // ---------- Upsert de employees en UN solo INSERT ... ON CONFLICT ----------
  const empValues = parsed.employees.map((emp) => ({
    id: existingEmpIdByPersonId.get(emp.personId) ?? crypto.randomUUID(),
    personId: emp.personId,
    name: emp.name,
    department: emp.department,
    active: emp.totalPunches > 0,
    lastSeenAt: new Date(),
  }));

  const upsertedEmps = await db
    .insert(employees)
    .values(empValues)
    .onConflictDoUpdate({
      target: employees.personId,
      set: {
        name: sql`EXCLUDED.name`,
        department: sql`EXCLUDED.department`,
        active: sql`EXCLUDED.active`,
        lastSeenAt: sql`EXCLUDED.last_seen_at`,
      },
    })
    .returning({ id: employees.id, personId: employees.personId });

  const empIdByPersonId = new Map(upsertedEmps.map((e) => [e.personId, e.id]));
  const employeesUpserted = upsertedEmps.length;

  // ---------- Precargar TODOS los attendance_days afectados (1 query) ----------
  const activeEmpIds = parsed.employees
    .filter((e) => e.totalPunches > 0)
    .map((e) => empIdByPersonId.get(e.personId)!)
    .filter(Boolean);

  const existingDays = activeEmpIds.length
    ? await db
        .select({
          id: attendanceDays.id,
          employeeId: attendanceDays.employeeId,
          workDate: attendanceDays.workDate,
          correctedPunches: attendanceDays.correctedPunches,
          justificationId: attendanceDays.justificationId,
          justificationNote: attendanceDays.justificationNote,
          justificationFrom: attendanceDays.justificationFrom,
          justificationTo: attendanceDays.justificationTo,
        })
        .from(attendanceDays)
        .where(inArray(attendanceDays.employeeId, activeEmpIds))
    : [];

  const existingByKey = new Map(
    existingDays.map((d) => [`${d.employeeId}|${d.workDate}`, d])
  );

  // ---------- Construir todas las filas en memoria ----------
  const dayRows: (typeof attendanceDays.$inferInsert)[] = [];
  let incidentsDetected = 0;
  let preservedCorrections = 0;

  for (const emp of parsed.employees) {
    if (emp.totalPunches === 0) continue;
    const empId = empIdByPersonId.get(emp.personId);
    if (!empId) continue;

    for (const d of emp.days) {
      const existing = existingByKey.get(`${empId}|${d.date}`);
      const corrected = existing?.correctedPunches ?? null;
      const justified =
        existing?.justificationId
          ? {
              countsAsWorked: jusById.get(existing.justificationId) ?? true,
              fromTime: existing.justificationFrom,
              toTime: existing.justificationTo,
            }
          : null;
      const effective = corrected ?? d.punches;

      const tenure = tenureByPersonId.get(emp.personId);
      const outOfTenure =
        !!tenure &&
        ((tenure.hireDate && d.date < tenure.hireDate) ||
          (tenure.terminationDate && d.date > tenure.terminationDate));

      const resolved = resolveScheduleForDate(periods, overrides, d.date);
      const analysis = outOfTenure
        ? {
            status: "no_workday" as const,
            isWorkday: false,
            checkIn: null,
            checkOut: null,
            workedMinutes: 0,
            lateMinutes: 0,
            earlyLeaveMinutes: 0,
            overtimeMinutes: 0,
            undertimeMinutes: 0,
            incidents: [] as string[],
          }
        : analyzeDay({
            punches: effective,
            dayOfWeek: d.dayOfWeek,
            // Si la fecha tiene override, ignora si está en holidays — el override la convierte en workday.
            isHoliday: resolved.isOverride ? false : holidaySet.has(d.date),
            schedule: resolved.schedule,
            justified,
          });
      if (["incomplete", "absent"].includes(analysis.status)) incidentsDetected++;
      if (corrected) preservedCorrections++;

      dayRows.push({
        employeeId: empId,
        workDate: d.date,
        dayOfWeek: d.dayOfWeek,
        isWorkday: analysis.isWorkday,
        rawPunches: d.punches,
        correctedPunches: corrected,
        justificationId: existing?.justificationId ?? null,
        justificationNote: existing?.justificationNote ?? null,
        justificationFrom: existing?.justificationFrom ?? null,
        justificationTo: existing?.justificationTo ?? null,
        effectivePunches: effective,
        status: analysis.status,
        checkIn: analysis.checkIn,
        checkOut: analysis.checkOut,
        workedMinutes: analysis.workedMinutes,
        lateMinutes: analysis.lateMinutes,
        earlyLeaveMinutes: analysis.earlyLeaveMinutes,
        overtimeMinutes: analysis.overtimeMinutes,
        undertimeMinutes: analysis.undertimeMinutes,
        incidents: analysis.incidents,
        modifiedAt: new Date(),
      });
    }
  }

  // ---------- Upsert masivo de attendance_days en chunks ----------
  const CHUNK = 500;
  for (let i = 0; i < dayRows.length; i += CHUNK) {
    await db
      .insert(attendanceDays)
      .values(dayRows.slice(i, i + CHUNK))
      .onConflictDoUpdate({
        target: [attendanceDays.employeeId, attendanceDays.workDate],
        set: {
          rawPunches: sql`EXCLUDED.raw_punches`,
          dayOfWeek: sql`EXCLUDED.day_of_week`,
          isWorkday: sql`EXCLUDED.is_workday`,
          effectivePunches: sql`EXCLUDED.effective_punches`,
          justificationFrom: sql`EXCLUDED.justification_from`,
          justificationTo: sql`EXCLUDED.justification_to`,
          status: sql`EXCLUDED.status`,
          checkIn: sql`EXCLUDED.check_in`,
          checkOut: sql`EXCLUDED.check_out`,
          workedMinutes: sql`EXCLUDED.worked_minutes`,
          lateMinutes: sql`EXCLUDED.late_minutes`,
          earlyLeaveMinutes: sql`EXCLUDED.early_leave_minutes`,
          overtimeMinutes: sql`EXCLUDED.overtime_minutes`,
          undertimeMinutes: sql`EXCLUDED.undertime_minutes`,
          incidents: sql`EXCLUDED.incidents`,
          modifiedAt: sql`now()`,
        },
      });
  }

  revalidatePath("/");
  revalidatePath("/employees");
  revalidatePath("/review");
  revalidatePath("/import");

  return {
    ok: true,
    filename: parsed.filename,
    periodStart: parsed.periodStart,
    periodEnd: parsed.periodEnd,
    employeesUpserted,
    inactiveCount,
    daysUpserted: dayRows.length,
    incidentsDetected,
    preservedCorrections,
    warnings: parsed.warnings,
  };
}
