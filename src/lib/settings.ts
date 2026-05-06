import { db } from "./db";
import { schedulePeriods, type SchedulePeriod } from "./db/schema";
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

/** Carga todos los periodos ordenados ascendentes por effectiveFrom (cacheado por request). */
export const loadAllSchedulePeriods = cache(async (): Promise<SchedulePeriod[]> => {
  const rows = await db.select().from(schedulePeriods).orderBy(asc(schedulePeriods.effectiveFrom));
  return rows;
});

/** Selector: dado un workDate ('YYYY-MM-DD'), elige el último periodo con effectiveFrom <= workDate. */
export function pickScheduleForDate(periods: SchedulePeriod[], workDate: string): Schedule {
  if (periods.length === 0) {
    throw new Error("No hay periodos de horario configurados");
  }
  // periods viene ASC. Recorrer al revés y devolver el primero <= workDate.
  for (let i = periods.length - 1; i >= 0; i--) {
    if (periods[i].effectiveFrom <= workDate) return periodToSchedule(periods[i]);
  }
  // Si workDate es anterior a todos, usar el más antiguo (mejor que crashear).
  return periodToSchedule(periods[0]);
}

/** Conveniencia: una sola llamada para una fecha. */
export async function getScheduleFor(workDate: string): Promise<Schedule> {
  const periods = await loadAllSchedulePeriods();
  return pickScheduleForDate(periods, workDate);
}

/** Conveniencia para flujos sin fecha (parser de Excel): usa el periodo más reciente. */
export async function getCurrentSchedule(): Promise<Schedule> {
  const periods = await loadAllSchedulePeriods();
  if (periods.length === 0) throw new Error("No hay periodos de horario configurados");
  return periodToSchedule(periods[periods.length - 1]);
}
