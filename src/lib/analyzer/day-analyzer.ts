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
  overtimeMinutes: number;
  undertimeMinutes: number;
  incidents: string[];
};

export function analyzeDay(args: {
  punches: string[];
  dayOfWeek: number;
  isHoliday: boolean;
  schedule: Schedule;
  justified?: {
    countsAsWorked: boolean;
    /** 'HH:mm' o null/undefined = día completo */
    fromTime?: string | null;
    toTime?: string | null;
  } | null;
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
      overtimeMinutes: 0,
      undertimeMinutes: 0,
      incidents,
    };
  }

  const isSat = dayOfWeek === 6;
  const sched = isSat ? schedule.saturday : schedule.weekday;
  const startMin = toMin(sched.start);
  const endMin = toMin(sched.end);
  const expectedMin = Math.round(sched.hours * 60);

  // Justificación de día completo (sin ventana): comportamiento original.
  if (justified && !justified.fromTime && !justified.toTime) {
    return {
      status: "justified",
      isWorkday: true,
      checkIn: punches[0] ?? null,
      checkOut: punches[punches.length - 1] ?? null,
      workedMinutes: justified.countsAsWorked ? expectedMin : 0,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      overtimeMinutes: 0,
      undertimeMinutes: 0,
      incidents,
    };
  }

  // Justificación con ventana horaria: ajusta los límites de tarde / salida temprana.
  let effectiveStart = startMin;
  let effectiveEnd = endMin;
  let justifiedWorkedMin = 0;

  if (justified && justified.fromTime && justified.toTime) {
    const jFrom = toMin(justified.fromTime);
    const jTo = toMin(justified.toTime);
    if (jTo > jFrom) {
      // Si la ventana cubre el inicio del día, el worker puede llegar a `jTo` sin ser tarde.
      if (jFrom <= startMin && jTo > startMin) effectiveStart = jTo;
      // Si la ventana cubre el final, el worker puede salir desde `jFrom` sin ser early-leave.
      if (jTo >= endMin && jFrom < endMin) effectiveEnd = jFrom;
      // Si la justificación cuenta como trabajada, sumamos sus minutos al worked.
      if (justified.countsAsWorked) justifiedWorkedMin = jTo - jFrom;
    }
  }

  const limitMin = effectiveStart + schedule.toleranceMinutes;

  if (punches.length === 0) {
    return {
      status: "absent",
      isWorkday: true,
      checkIn: null,
      checkOut: null,
      workedMinutes: 0,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      overtimeMinutes: 0,
      undertimeMinutes: 0,
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
    if (!isSat) {
      const lunchOutMin = toMin(punches[1]);
      const lunchMinutes = toMin(punches[2]) - lunchOutMin;
      const expectedLunch = schedule.weekday.lunchMinutes;
      // Almuerzo crítico (debajo del piso absoluto): flag adicional severo.
      if (schedule.minLunchMinutes > 0 && lunchMinutes < schedule.minLunchMinutes) {
        incidents.push("lunch_critically_short");
      }
      if (expectedLunch > 0 && lunchMinutes < expectedLunch) {
        incidents.push("lunch_too_short");
      } else if (expectedLunch > 0 && lunchMinutes > expectedLunch) {
        incidents.push("lunch_too_long");
      }
      // Ventana de salida a almuerzo (ej. 12:00-14:00). Se evalúa SOLO el inicio.
      const winStart = toMin(schedule.lunchWindowStart);
      const winEnd = toMin(schedule.lunchWindowEnd);
      if (lunchOutMin < winStart || lunchOutMin > winEnd) {
        incidents.push("lunch_outside_window");
      }
    }
  } else if (punches.length === 2) {
    workedMinutes = outMin - inMin;
    // 2 marcas es problema solo si el horario del día CONTEMPLA almuerzo.
    // Sábado o días con override de "trabajo corrido" (lunchMinutes=0) no flaggean.
    const expectedLunch = isSat
      ? schedule.saturday.lunchMinutes
      : schedule.weekday.lunchMinutes;
    if (!isSat && expectedLunch > 0) {
      incidents.push("no_lunch_break");
      status = "incomplete";
    }
  }

  const lateMinutes = Math.max(0, inMin - limitMin);
  const earlyLeaveMinutes = Math.max(0, effectiveEnd - outMin);

  if (status === "ok" && lateMinutes > 0) status = "late";

  // Sumar minutos justificados al worked si aplica.
  if (workedMinutes != null && justifiedWorkedMin > 0) {
    workedMinutes += justifiedWorkedMin;
  }

  // Marcar status=justified si hay ventana de justificación (mantener visibilidad).
  if (justified && (justified.fromTime || justified.toTime) && status !== "incomplete") {
    status = "justified";
  }

  // Horas extras / faltantes — para días trabajados o con justificación parcial.
  let overtimeMinutes = 0;
  let undertimeMinutes = 0;
  if (workedMinutes != null && (status === "ok" || status === "late" || status === "justified")) {
    const diff = workedMinutes - expectedMin;
    if (diff > 0) overtimeMinutes = diff;
    else if (diff < 0) undertimeMinutes = -diff;
  }

  return {
    status,
    isWorkday: true,
    checkIn,
    checkOut,
    workedMinutes,
    lateMinutes,
    earlyLeaveMinutes,
    overtimeMinutes,
    undertimeMinutes,
    incidents,
  };
}
