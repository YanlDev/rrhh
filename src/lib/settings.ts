import { db } from "./db";
import { appSettings, type AppSettings } from "./db/schema";

const DEFAULTS: Omit<AppSettings, "updatedAt"> = {
  id: "default",
  weekdayStart: "08:30",
  weekdayEnd: "18:30",
  weekdayHours: 9,
  saturdayStart: "08:30",
  saturdayEnd: "14:00",
  saturdayHours: 5.5,
  toleranceMinutes: 5,
  duplicateThresholdMinutes: 2,
};

export type Schedule = {
  weekday: { start: string; end: string; hours: number };
  saturday: { start: string; end: string; hours: number };
  toleranceMinutes: number;
  duplicateThresholdMinutes: number;
};

export async function getSettings(): Promise<AppSettings> {
  const rows = await db.select().from(appSettings);
  if (rows[0]) return rows[0];
  await db.insert(appSettings).values(DEFAULTS).onConflictDoNothing();
  const seeded = await db.select().from(appSettings);
  return seeded[0]!;
}

export async function getSchedule(): Promise<Schedule> {
  const s = await getSettings();
  return {
    weekday: { start: s.weekdayStart, end: s.weekdayEnd, hours: s.weekdayHours },
    saturday: { start: s.saturdayStart, end: s.saturdayEnd, hours: s.saturdayHours },
    toleranceMinutes: s.toleranceMinutes,
    duplicateThresholdMinutes: s.duplicateThresholdMinutes,
  };
}
