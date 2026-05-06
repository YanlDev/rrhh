import { db } from "./db";
import {
  schedulePeriods,
  scheduleOverrides,
  type SchedulePeriod,
  type ScheduleOverride,
} from "./db/schema";
import { asc } from "drizzle-orm";
import { cache } from "react";

export type Schedule = {
  weekday: { start: string; end: string; hours: number; lunchMinutes: number };
  saturday: { start: string; end: string; hours: number; lunchMinutes: number };
  toleranceMinutes: number;
  duplicateThresholdMinutes: number;
  minLunchMinutes: number;
  lunchWindowStart: string;
  lunchWindowEnd: string;
  effectiveFrom: string;
};

/** Resultado del resolver: schedule + flag de override (si lo hay). */
export type ResolvedSchedule = { schedule: Schedule; isOverride: boolean };

function periodToSchedule(p: SchedulePeriod): Schedule {
  return {
    weekday: {
      start: p.weekdayStart,
      end: p.weekdayEnd,
      hours: p.weekdayHours,
      lunchMinutes: p.weekdayLunchMinutes,
    },
    saturday: {
      start: p.saturdayStart,
      end: p.saturdayEnd,
      hours: p.saturdayHours,
      lunchMinutes: p.saturdayLunchMinutes,
    },
    toleranceMinutes: p.toleranceMinutes,
    duplicateThresholdMinutes: p.duplicateThresholdMinutes,
    minLunchMinutes: p.minLunchMinutes,
    lunchWindowStart: p.lunchWindowStart,
    lunchWindowEnd: p.lunchWindowEnd,
    effectiveFrom: p.effectiveFrom,
  };
}

/**
 * Construye un Schedule a partir de un override, heredando del periodo base
 * los valores que no son específicos del día (tolerancia, threshold, almuerzo crítico).
 * El override define start/end/hours/lunch idénticos para weekday y saturday — el
 * analyzer usa el lado correcto según `dayOfWeek`, pero ambos lados coinciden.
 */
function overrideToSchedule(o: ScheduleOverride, base: SchedulePeriod): Schedule {
  const slot = {
    start: o.startTime,
    end: o.endTime,
    hours: o.hours,
    lunchMinutes: o.lunchMinutes,
  };
  return {
    weekday: slot,
    saturday: slot,
    toleranceMinutes: base.toleranceMinutes,
    duplicateThresholdMinutes: base.duplicateThresholdMinutes,
    minLunchMinutes: base.minLunchMinutes,
    lunchWindowStart: o.lunchWindowStart,
    lunchWindowEnd: o.lunchWindowEnd,
    effectiveFrom: o.workDate,
  };
}

/** Periodos ordenados ASC por effectiveFrom (cacheado por request). */
export const loadAllSchedulePeriods = cache(async (): Promise<SchedulePeriod[]> => {
  return db.select().from(schedulePeriods).orderBy(asc(schedulePeriods.effectiveFrom));
});

/** Overrides cacheados por request, devueltos como Map por work_date. */
export const loadScheduleOverrides = cache(
  async (): Promise<Map<string, ScheduleOverride>> => {
    const rows = await db.select().from(scheduleOverrides);
    return new Map(rows.map((r) => [r.workDate, r]));
  }
);

function pickPeriodForDate(
  periods: SchedulePeriod[],
  workDate: string
): SchedulePeriod {
  if (periods.length === 0) {
    throw new Error("No hay periodos de horario configurados");
  }
  for (let i = periods.length - 1; i >= 0; i--) {
    if (periods[i].effectiveFrom <= workDate) return periods[i];
  }
  return periods[0];
}

/**
 * Resolver: dado un workDate, devuelve el schedule aplicable
 * (override si existe, sino el periodo correspondiente) y un flag.
 */
export function resolveScheduleForDate(
  periods: SchedulePeriod[],
  overrides: Map<string, ScheduleOverride>,
  workDate: string
): ResolvedSchedule {
  const ov = overrides.get(workDate);
  const basePeriod = pickPeriodForDate(periods, workDate);
  if (ov) return { schedule: overrideToSchedule(ov, basePeriod), isOverride: true };
  return { schedule: periodToSchedule(basePeriod), isOverride: false };
}

/** Backwards compatible: devuelve solo el Schedule (sin flag de override). */
export function pickScheduleForDate(
  periods: SchedulePeriod[],
  workDate: string,
  overrides?: Map<string, ScheduleOverride>
): Schedule {
  return resolveScheduleForDate(periods, overrides ?? new Map(), workDate).schedule;
}

/** Conveniencia: una sola llamada para una fecha (consulta BD). */
export async function getScheduleFor(workDate: string): Promise<Schedule> {
  const [periods, overrides] = await Promise.all([
    loadAllSchedulePeriods(),
    loadScheduleOverrides(),
  ]);
  return resolveScheduleForDate(periods, overrides, workDate).schedule;
}

/** Para flujos sin fecha (parser de Excel): usa el periodo más reciente. */
export async function getCurrentSchedule(): Promise<Schedule> {
  const periods = await loadAllSchedulePeriods();
  if (periods.length === 0) throw new Error("No hay periodos de horario configurados");
  return periodToSchedule(periods[periods.length - 1]);
}
