import { db } from "@/lib/db";
import {
  attendanceDays,
  holidays,
  justificationTypes,
  employees,
  type AttendanceDay,
} from "@/lib/db/schema";
import { analyzeDay } from "./day-analyzer";
import {
  loadAllSchedulePeriods,
  loadScheduleOverrides,
  resolveScheduleForDate,
  type Schedule,
} from "@/lib/settings";
import { eq, inArray } from "drizzle-orm";

export type RecalcContext = {
  /** Devuelve `Schedule` + flag `isOverride` para `workDate`. */
  resolveSchedule: (workDate: string) => { schedule: Schedule; isOverride: boolean };
  holidaySet: Set<string>;
  jusById: Map<string, { countsAsWorked: boolean }>;
  /** Tenure por employeeId: hire/termination dates. */
  tenureByEmpId: Map<string, { hireDate: string | null; terminationDate: string | null }>;
};

/** ¿La fecha cae fuera del período de vínculo del empleado? */
export function isOutOfTenure(
  workDate: string,
  tenure: { hireDate: string | null; terminationDate: string | null } | undefined
): boolean {
  if (!tenure) return false;
  if (tenure.hireDate && workDate < tenure.hireDate) return true;
  if (tenure.terminationDate && workDate > tenure.terminationDate) return true;
  return false;
}

/**
 * Carga UNA vez todos los datos auxiliares (periodos, overrides, feriados,
 * justificaciones) para evitar queries por cada attendance_day.
 */
export async function loadRecalcContext(): Promise<RecalcContext> {
  const [periods, overrides, holidayRows, jusTypes, empTenure] = await Promise.all([
    loadAllSchedulePeriods(),
    loadScheduleOverrides(),
    db.select({ holidayDate: holidays.holidayDate }).from(holidays),
    db
      .select({
        id: justificationTypes.id,
        countsAsWorked: justificationTypes.countsAsWorked,
      })
      .from(justificationTypes),
    db
      .select({
        id: employees.id,
        hireDate: employees.hireDate,
        terminationDate: employees.terminationDate,
      })
      .from(employees),
  ]);
  return {
    resolveSchedule: (workDate: string) =>
      resolveScheduleForDate(periods, overrides, workDate),
    holidaySet: new Set(holidayRows.map((h) => h.holidayDate)),
    jusById: new Map(
      jusTypes.map((j) => [j.id, { countsAsWorked: j.countsAsWorked }])
    ),
    tenureByEmpId: new Map(
      empTenure.map((e) => [
        e.id,
        { hireDate: e.hireDate, terminationDate: e.terminationDate },
      ])
    ),
  };
}

async function applyRecalc(row: AttendanceDay, ctx: RecalcContext) {
  // Fuera del período de vínculo del empleado: día no laborable, todo en cero.
  const tenure = ctx.tenureByEmpId.get(row.employeeId);
  if (isOutOfTenure(row.workDate, tenure)) {
    await db
      .update(attendanceDays)
      .set({
        effectivePunches: row.correctedPunches ?? row.rawPunches,
        isWorkday: false,
        status: "no_workday",
        checkIn: null,
        checkOut: null,
        workedMinutes: 0,
        lateMinutes: 0,
        graceMinutes: 0,
        earlyLeaveMinutes: 0,
        overtimeMinutes: 0,
        undertimeMinutes: 0,
        incidents: [],
        modifiedAt: new Date(),
      })
      .where(eq(attendanceDays.id, row.id));
    return;
  }

  const effective = row.correctedPunches ?? row.rawPunches;
  const jus = row.justificationId ? ctx.jusById.get(row.justificationId) ?? null : null;
  const { schedule, isOverride } = ctx.resolveSchedule(row.workDate);
  // Si hay override, el día se trata como workday aunque esté en holidays.
  const isHoliday = isOverride ? false : ctx.holidaySet.has(row.workDate);
  const a = analyzeDay({
    punches: effective,
    dayOfWeek: row.dayOfWeek,
    isHoliday,
    schedule,
    justified: jus
      ? {
          countsAsWorked: jus.countsAsWorked,
          fromTime: row.justificationFrom,
          toTime: row.justificationTo,
        }
      : null,
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
      graceMinutes: a.graceMinutes,
      earlyLeaveMinutes: a.earlyLeaveMinutes,
      overtimeMinutes: a.overtimeMinutes,
      undertimeMinutes: a.undertimeMinutes,
      incidents: a.incidents,
      modifiedAt: new Date(),
    })
    .where(eq(attendanceDays.id, row.id));
}

export async function recalcAttendanceDay(rowId: string, ctxArg?: RecalcContext) {
  const ctx = ctxArg ?? (await loadRecalcContext());
  const row = (
    await db.select().from(attendanceDays).where(eq(attendanceDays.id, rowId))
  )[0];
  if (!row) throw new Error(`attendance_day no existe: ${rowId}`);
  await applyRecalc(row, ctx);
}

/**
 * Recalcula los attendance_days de una o varias FECHAS específicas.
 * Útil para cambios de feriados, días especiales, etc. — donde solo
 * cambia el comportamiento de un día puntual.
 */
export async function recalcAttendanceDaysByDates(
  dates: string[],
  ctxArg?: RecalcContext
): Promise<number> {
  if (dates.length === 0) return 0;
  const ctx = ctxArg ?? (await loadRecalcContext());
  const rows = await db
    .select()
    .from(attendanceDays)
    .where(inArray(attendanceDays.workDate, dates));
  if (rows.length === 0) return 0;
  await Promise.all(rows.map((r) => applyRecalc(r, ctx)));
  return rows.length;
}

/**
 * Recalcula varias filas en paralelo (pipelined). Carga el contexto auxiliar
 * UNA sola vez. Si `ids === null` recalcula TODA la tabla.
 */
export async function recalcAttendanceDays(
  ids: string[] | null,
  ctxArg?: RecalcContext
): Promise<number> {
  const ctx = ctxArg ?? (await loadRecalcContext());
  const rows =
    ids === null
      ? await db.select().from(attendanceDays)
      : ids.length === 0
        ? []
        : await db.select().from(attendanceDays).where(inArray(attendanceDays.id, ids));
  if (rows.length === 0) return 0;
  const CHUNK = 25;
  for (let i = 0; i < rows.length; i += CHUNK) {
    await Promise.all(rows.slice(i, i + CHUNK).map((r) => applyRecalc(r, ctx)));
  }
  return rows.length;
}
