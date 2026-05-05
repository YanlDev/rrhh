import type { Status } from "../constants";
import type { Schedule } from "../settings";

function toMin(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

export type DayAnalysis = {
  status: Status;
  isWorkday: boolean;
  checkIn: string | null;
  checkOut: string | null;
  workedMinutes: number | null;
  lateMinutes: number;
  earlyLeaveMinutes: number;
  incidents: string[];
};

export function analyzeDay(args: {
  punches: string[];
  dayOfWeek: number;
  isHoliday: boolean;
  schedule: Schedule;
  justified?: { countsAsWorked: boolean } | null;
}): DayAnalysis {
  const { punches, dayOfWeek, isHoliday, schedule, justified } = args;
  const incidents: string[] = [];

  if (dayOfWeek === 0 || isHoliday) {
    return {
      status: "no_workday",
      isWorkday: false,
      checkIn: punches[0] ?? null,
      checkOut: punches[punches.length - 1] ?? null,
      workedMinutes: punches.length >= 2 ? toMin(punches[punches.length - 1]) - toMin(punches[0]) : 0,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      incidents,
    };
  }

  const isSat = dayOfWeek === 6;
  const sched = isSat ? schedule.saturday : schedule.weekday;
  const startMin = toMin(sched.start);
  const endMin = toMin(sched.end);
  const limitMin = startMin + schedule.toleranceMinutes;

  if (justified) {
    return {
      status: "justified",
      isWorkday: true,
      checkIn: punches[0] ?? null,
      checkOut: punches[punches.length - 1] ?? null,
      workedMinutes: justified.countsAsWorked ? Math.round(sched.hours * 60) : 0,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      incidents,
    };
  }

  if (punches.length === 0) {
    return {
      status: "absent",
      isWorkday: true,
      checkIn: null,
      checkOut: null,
      workedMinutes: 0,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      incidents: ["no_punches"],
    };
  }

  const checkIn = punches[0];
  const checkOut = punches[punches.length - 1];
  const inMin = toMin(checkIn);
  const outMin = toMin(checkOut);

  let workedMinutes: number | null = null;
  let status: Status = "ok";

  if (punches.length === 1) {
    incidents.push("single_punch");
    status = "incomplete";
  } else if (punches.length === 3) {
    incidents.push("odd_punches_3");
    status = "incomplete";
  } else if (punches.length >= 5) {
    incidents.push("too_many_punches");
    workedMinutes = (toMin(punches[1]) - inMin) + (outMin - toMin(punches[punches.length - 2]));
    status = "incomplete";
  } else if (punches.length === 4) {
    workedMinutes = (toMin(punches[1]) - inMin) + (outMin - toMin(punches[2]));
  } else if (punches.length === 2) {
    workedMinutes = outMin - inMin;
    if (!isSat) incidents.push("only_2_punches_weekday");
  }

  const lateMinutes = Math.max(0, inMin - limitMin);
  const earlyLeaveMinutes = Math.max(0, endMin - outMin);

  if (status === "ok" && lateMinutes > 0) status = "late";

  return {
    status,
    isWorkday: true,
    checkIn,
    checkOut,
    workedMinutes,
    lateMinutes,
    earlyLeaveMinutes,
    incidents,
  };
}
