export const SCHEDULE = {
  weekday: { start: "08:30", end: "18:30", hours: 9 },
  saturday: { start: "08:30", end: "14:00", hours: 5.5 },
  toleranceMinutes: 5,
  duplicateThresholdMinutes: 2,
} as const;

export const STATUSES = [
  "ok",
  "late",
  "incomplete",
  "absent",
  "justified",
  "no_workday",
] as const;
export type Status = (typeof STATUSES)[number];
