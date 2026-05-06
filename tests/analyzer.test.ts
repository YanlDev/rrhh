import { test } from "node:test";
import assert from "node:assert/strict";
import { analyzeDay } from "../src/lib/analyzer/day-analyzer";
import type { Schedule } from "../src/lib/settings";

/* ============================================================
 * Schedules de prueba
 * ============================================================ */

// Periodo VIEJO (hasta abril 2026): L-V 9h con almuerzo 1h, sábado hasta 14:00.
const SCHED_VIEJO: Schedule = {
  weekday: { start: "08:30", end: "18:30", hours: 9, lunchMinutes: 60 },
  saturday: { start: "08:30", end: "14:00", hours: 5.5, lunchMinutes: 0 },
  toleranceMinutes: 5,
  duplicateThresholdMinutes: 2,
  minLunchMinutes: 25,
  lunchWindowStart: "12:00",
  lunchWindowEnd: "14:00",
  effectiveFrom: "2020-01-01",
};

// Periodo NUEVO (mayo 2026 en adelante): L-V 8.5h con almuerzo 1.5h, sábado hasta 13:00.
const SCHED_MAYO: Schedule = {
  weekday: { start: "08:30", end: "18:30", hours: 8.5, lunchMinutes: 90 },
  saturday: { start: "08:30", end: "13:00", hours: 4.5, lunchMinutes: 0 },
  toleranceMinutes: 5,
  duplicateThresholdMinutes: 2,
  minLunchMinutes: 25,
  lunchWindowStart: "12:00",
  lunchWindowEnd: "14:00",
  effectiveFrom: "2026-05-01",
};

const LUNES = 1;
const SABADO = 6;
const DOMINGO = 0;

/* ============================================================
 * 1. Día perfecto en mayo
 * ============================================================ */
test("Caso 1 · día perfecto mayo (4 marcas, almuerzo 1.5h)", () => {
  const r = analyzeDay({
    schedule: SCHED_MAYO,
    punches: ["08:30", "12:00", "13:30", "18:30"],
    dayOfWeek: LUNES,
    isHoliday: false,
  });
  assert.equal(r.status, "ok");
  assert.equal(r.workedMinutes, 510, "8.5h efectivas");
  assert.equal(r.lateMinutes, 0);
  assert.equal(r.earlyLeaveMinutes, 0);
  assert.equal(r.overtimeMinutes, 0);
  assert.equal(r.undertimeMinutes, 0);
  assert.deepEqual(r.incidents, []);
});

/* ============================================================
 * 2. Tardanza
 * ============================================================ */
test("Caso 2 · tardanza (10 min después de la gracia)", () => {
  const r = analyzeDay({
    schedule: SCHED_MAYO,
    punches: ["08:45", "12:00", "13:30", "18:30"],
    dayOfWeek: LUNES,
    isHoliday: false,
  });
  assert.equal(r.status, "late");
  assert.equal(r.lateMinutes, 10, "08:45 - 08:35 = 10 min tarde");
  assert.equal(r.workedMinutes, 495, "trabajó 15 min menos de lo esperado");
  assert.equal(r.undertimeMinutes, 15);
  assert.equal(r.overtimeMinutes, 0);
});

/* ============================================================
 * 3. Salida temprana
 * ============================================================ */
test("Caso 3 · salida temprana (30 min antes de 18:30)", () => {
  const r = analyzeDay({
    schedule: SCHED_MAYO,
    punches: ["08:30", "12:00", "13:30", "18:00"],
    dayOfWeek: LUNES,
    isHoliday: false,
  });
  assert.equal(r.status, "ok");
  assert.equal(r.earlyLeaveMinutes, 30);
  assert.equal(r.workedMinutes, 480);
  assert.equal(r.undertimeMinutes, 30);
  assert.equal(r.overtimeMinutes, 0);
});

/* ============================================================
 * 4. Almuerzo corto (60 < 90 esperado mayo)
 * ============================================================ */
test("Caso 4 · almuerzo corto (60 min en mayo, esperado 90)", () => {
  const r = analyzeDay({
    schedule: SCHED_MAYO,
    punches: ["08:30", "12:00", "13:00", "18:30"],
    dayOfWeek: LUNES,
    isHoliday: false,
  });
  assert.equal(r.status, "ok");
  assert.equal(r.workedMinutes, 540, "9h reales (almorzó 30 min menos)");
  assert.equal(r.overtimeMinutes, 30, "30 min más que las 8.5h esperadas");
  assert.equal(r.undertimeMinutes, 0);
  assert.ok(r.incidents.includes("lunch_too_short"));
  assert.ok(!r.incidents.includes("lunch_critically_short"), "60 min no es crítico (>25)");
});

/* ============================================================
 * 5. Almuerzo largo (120 > 90 esperado mayo)
 * ============================================================ */
test("Caso 5 · almuerzo largo (120 min en mayo, esperado 90)", () => {
  const r = analyzeDay({
    schedule: SCHED_MAYO,
    punches: ["08:30", "12:00", "14:00", "18:30"],
    dayOfWeek: LUNES,
    isHoliday: false,
  });
  assert.equal(r.status, "ok");
  assert.equal(r.workedMinutes, 480, "8h reales");
  assert.equal(r.overtimeMinutes, 0);
  assert.equal(r.undertimeMinutes, 30, "30 min menos que 8.5h");
  assert.ok(r.incidents.includes("lunch_too_long"));
});

/* ============================================================
 * 6. Almuerzo críticamente corto (10 min < 25 piso)
 * ============================================================ */
test("Caso 6 · almuerzo crítico (10 min, piso 25)", () => {
  const r = analyzeDay({
    schedule: SCHED_MAYO,
    punches: ["08:30", "12:00", "12:10", "18:30"],
    dayOfWeek: LUNES,
    isHoliday: false,
  });
  assert.equal(r.status, "ok");
  assert.equal(r.workedMinutes, 590);
  assert.equal(r.overtimeMinutes, 80);
  assert.ok(r.incidents.includes("lunch_critically_short"));
  assert.ok(r.incidents.includes("lunch_too_short"));
});

/* ============================================================
 * 7. Sin almuerzo (2 marcas L-V → incomplete)
 * ============================================================ */
test("Caso 7 · 2 marcas L-V (no salió a almorzar) → incomplete", () => {
  const r = analyzeDay({
    schedule: SCHED_MAYO,
    punches: ["08:30", "18:30"],
    dayOfWeek: LUNES,
    isHoliday: false,
  });
  assert.equal(r.status, "incomplete");
  assert.equal(r.workedMinutes, 600, "10h en oficina (sin descontar almuerzo)");
  assert.equal(r.overtimeMinutes, 0, "no se computa over en estado incomplete");
  assert.equal(r.undertimeMinutes, 0, "no se computa under en estado incomplete");
  assert.ok(r.incidents.includes("no_lunch_break"));
});

/* ============================================================
 * 8. Ausencia
 * ============================================================ */
test("Caso 8 · sin marcas L-V → absent", () => {
  const r = analyzeDay({
    schedule: SCHED_MAYO,
    punches: [],
    dayOfWeek: LUNES,
    isHoliday: false,
  });
  assert.equal(r.status, "absent");
  assert.equal(r.workedMinutes, 0);
  assert.deepEqual(r.incidents, ["no_punches"]);
});

/* ============================================================
 * 9. 3 marcas (incompleto)
 * ============================================================ */
test("Caso 9 · 3 marcas → incomplete", () => {
  const r = analyzeDay({
    schedule: SCHED_MAYO,
    punches: ["08:30", "12:00", "18:30"],
    dayOfWeek: LUNES,
    isHoliday: false,
  });
  assert.equal(r.status, "incomplete");
  assert.equal(r.workedMinutes, null);
  assert.ok(r.incidents.includes("odd_punches_3"));
});

/* ============================================================
 * 10. 5+ marcas (heurística)
 * ============================================================ */
test("Caso 10 · 5 marcas → incomplete con heurística", () => {
  const r = analyzeDay({
    schedule: SCHED_MAYO,
    punches: ["08:30", "12:00", "12:30", "13:30", "18:30"],
    dayOfWeek: LUNES,
    isHoliday: false,
  });
  assert.equal(r.status, "incomplete");
  assert.equal(r.workedMinutes, 510, "(12:00-08:30) + (18:30-13:30) = 210 + 300");
  assert.equal(r.overtimeMinutes, 0);
  assert.equal(r.undertimeMinutes, 0);
  assert.ok(r.incidents.includes("too_many_punches"));
});

/* ============================================================
 * 11. Sábado mayo perfecto (08:30 → 13:00)
 * ============================================================ */
test("Caso 11 · sábado mayo perfecto (4.5h, sin almuerzo)", () => {
  const r = analyzeDay({
    schedule: SCHED_MAYO,
    punches: ["08:30", "13:00"],
    dayOfWeek: SABADO,
    isHoliday: false,
  });
  assert.equal(r.status, "ok");
  assert.equal(r.workedMinutes, 270, "4.5h");
  assert.equal(r.overtimeMinutes, 0);
  assert.equal(r.undertimeMinutes, 0);
  assert.equal(r.incidents.length, 0, "sábado con 2 marcas no genera incidencia");
});

/* ============================================================
 * 12. Justificación que cuenta como trabajada (vacaciones, médico)
 * ============================================================ */
test("Caso 12 · justificación cuenta como trabajada (mayo)", () => {
  const r = analyzeDay({
    schedule: SCHED_MAYO,
    punches: [],
    dayOfWeek: LUNES,
    isHoliday: false,
    justified: { countsAsWorked: true },
  });
  assert.equal(r.status, "justified");
  assert.equal(r.workedMinutes, 510, "8.5h × 60 = 510");
});

/* ============================================================
 * 13. Justificación que NO cuenta como trabajada (permiso sin goce, ausencia)
 * ============================================================ */
test("Caso 13 · justificación NO cuenta (countsAsWorked=false)", () => {
  const r = analyzeDay({
    schedule: SCHED_MAYO,
    punches: [],
    dayOfWeek: LUNES,
    isHoliday: false,
    justified: { countsAsWorked: false },
  });
  assert.equal(r.status, "justified");
  assert.equal(r.workedMinutes, 0, "no cuenta → 0 minutos");
});

/* ============================================================
 * 14. Feriado con marcas
 * ============================================================ */
test("Caso 14 · feriado con marcas → no_workday, no over/under", () => {
  const r = analyzeDay({
    schedule: SCHED_MAYO,
    punches: ["08:30", "18:30"],
    dayOfWeek: LUNES,
    isHoliday: true,
  });
  assert.equal(r.status, "no_workday");
  assert.equal(r.workedMinutes, 600, "span completo");
  assert.equal(r.overtimeMinutes, 0);
  assert.equal(r.undertimeMinutes, 0);
});

/* ============================================================
 * 15. Domingo con marcas
 * ============================================================ */
test("Caso 15 · domingo con marcas → no_workday", () => {
  const r = analyzeDay({
    schedule: SCHED_MAYO,
    punches: ["08:30", "13:00"],
    dayOfWeek: DOMINGO,
    isHoliday: false,
  });
  assert.equal(r.status, "no_workday");
});

/* ============================================================
 * 16. Mismas marcas, distintos periodos → distintos resultados
 * ============================================================ */
test("Caso 16a · 08:30/12:00/13:00/18:30 en ABRIL (lunch=60, exp=540)", () => {
  const r = analyzeDay({
    schedule: SCHED_VIEJO,
    punches: ["08:30", "12:00", "13:00", "18:30"],
    dayOfWeek: LUNES,
    isHoliday: false,
  });
  assert.equal(r.status, "ok");
  assert.equal(r.workedMinutes, 540, "9h reales");
  assert.equal(r.overtimeMinutes, 0, "esperado 9h, igualó");
  assert.equal(r.undertimeMinutes, 0);
  assert.deepEqual(r.incidents, [], "almuerzo de 60 min coincide con esperado");
});

test("Caso 16b · 08:30/12:00/13:00/18:30 en MAYO (lunch=90, exp=510)", () => {
  const r = analyzeDay({
    schedule: SCHED_MAYO,
    punches: ["08:30", "12:00", "13:00", "18:30"],
    dayOfWeek: LUNES,
    isHoliday: false,
  });
  assert.equal(r.status, "ok");
  assert.equal(r.workedMinutes, 540);
  assert.equal(r.overtimeMinutes, 30, "trabajó 30 min más que el esperado de 510");
  assert.equal(r.undertimeMinutes, 0);
  assert.ok(r.incidents.includes("lunch_too_short"), "60 min < 90 esperado");
});

/* ============================================================
 * Casos extra: combinaciones interesantes
 * ============================================================ */

test("Extra · llegada tarde + almuerzo largo (acumula undertime)", () => {
  const r = analyzeDay({
    schedule: SCHED_MAYO,
    punches: ["09:00", "12:00", "14:00", "18:30"],
    dayOfWeek: LUNES,
    isHoliday: false,
  });
  assert.equal(r.status, "late");
  assert.equal(r.lateMinutes, 25);
  // worked = (12:00-09:00) + (18:30-14:00) = 180 + 270 = 450
  assert.equal(r.workedMinutes, 450);
  assert.equal(r.undertimeMinutes, 60);
  assert.ok(r.incidents.includes("lunch_too_long"));
});

test("Extra · trabajó hasta tarde (overtime real)", () => {
  const r = analyzeDay({
    schedule: SCHED_MAYO,
    punches: ["08:30", "12:00", "13:30", "20:00"],
    dayOfWeek: LUNES,
    isHoliday: false,
  });
  assert.equal(r.status, "ok");
  assert.equal(r.earlyLeaveMinutes, 0, "salió después de 18:30");
  // worked = (12:00-08:30) + (20:00-13:30) = 210 + 390 = 600
  assert.equal(r.workedMinutes, 600);
  assert.equal(r.overtimeMinutes, 90, "1.5h más que las 8.5h esperadas");
});

test("Extra · sábado tarde", () => {
  const r = analyzeDay({
    schedule: SCHED_MAYO,
    punches: ["09:00", "13:00"],
    dayOfWeek: SABADO,
    isHoliday: false,
  });
  assert.equal(r.status, "late");
  assert.equal(r.lateMinutes, 25);
  // worked = 13:00-09:00 = 240
  assert.equal(r.workedMinutes, 240);
  assert.equal(r.undertimeMinutes, 30, "270 esperado - 240 real = 30");
});

test("Extra · sale a almorzar a la 1pm (dentro de la ventana 12-14)", () => {
  // Sale a las 13:00, vuelve 14:30 (1.5h exactos) → debería ser día perfecto.
  const r = analyzeDay({
    schedule: SCHED_MAYO,
    punches: ["08:30", "13:00", "14:30", "18:30"],
    dayOfWeek: LUNES,
    isHoliday: false,
  });
  assert.equal(r.status, "ok");
  // worked = (13:00-08:30) + (18:30-14:30) = 270 + 240 = 510
  assert.equal(r.workedMinutes, 510);
  assert.equal(r.overtimeMinutes, 0);
  assert.equal(r.undertimeMinutes, 0);
  assert.deepEqual(r.incidents, [], "lunch de 90 min coincide con esperado");
});

test("Extra · sale a almorzar a las 14:00 (límite tope de la ventana)", () => {
  // Sale a las 14:00, vuelve 15:30 → 1.5h exactos pero arrancando al final.
  const r = analyzeDay({
    schedule: SCHED_MAYO,
    punches: ["08:30", "14:00", "15:30", "18:30"],
    dayOfWeek: LUNES,
    isHoliday: false,
  });
  assert.equal(r.status, "ok");
  // worked = (14:00-08:30) + (18:30-15:30) = 330 + 180 = 510
  assert.equal(r.workedMinutes, 510);
  assert.deepEqual(r.incidents, []);
});

test("Override · día especial L-V (medio día sin almuerzo)", () => {
  // Simulamos un Schedule construido a partir de un override:
  // entrada 08:30, salida 13:00, 4.5h, sin almuerzo.
  const overrideSchedule = {
    weekday: { start: "08:30", end: "13:00", hours: 4.5, lunchMinutes: 0 },
    saturday: { start: "08:30", end: "13:00", hours: 4.5, lunchMinutes: 0 },
    toleranceMinutes: 5,
    duplicateThresholdMinutes: 2,
    minLunchMinutes: 25,
    lunchWindowStart: "12:00",
    lunchWindowEnd: "14:00",
    effectiveFrom: "2026-04-02",
  };
  // Trabajador llega 08:30, sale 13:00 (jueves santo "medio día").
  // isHoliday=false porque el override anula el feriado.
  const r = analyzeDay({
    schedule: overrideSchedule,
    punches: ["08:30", "13:00"],
    dayOfWeek: 4, // jueves
    isHoliday: false,
  });
  assert.equal(r.status, "ok", "se trata como día normal con horario reducido");
  assert.equal(r.workedMinutes, 270, "4.5h reales");
  assert.equal(r.overtimeMinutes, 0);
  assert.equal(r.undertimeMinutes, 0);
  assert.deepEqual(r.incidents, [], "2 marcas con lunch=0 esperado: no flaggea no_lunch_break");
});

test("Override · sale 30 min temprano en día especial (genera early_leave + undertime)", () => {
  const overrideSchedule = {
    weekday: { start: "08:30", end: "13:00", hours: 4.5, lunchMinutes: 0 },
    saturday: { start: "08:30", end: "13:00", hours: 4.5, lunchMinutes: 0 },
    toleranceMinutes: 5,
    duplicateThresholdMinutes: 2,
    minLunchMinutes: 25,
    lunchWindowStart: "12:00",
    lunchWindowEnd: "14:00",
    effectiveFrom: "2026-04-02",
  };
  const r = analyzeDay({
    schedule: overrideSchedule,
    punches: ["08:30", "12:30"],
    dayOfWeek: 4,
    isHoliday: false,
  });
  assert.equal(r.status, "ok");
  // worked = 12:30 − 08:30 = 240 min; expected = 270; under = 30
  assert.equal(r.workedMinutes, 240);
  assert.equal(r.earlyLeaveMinutes, 30);
  assert.equal(r.undertimeMinutes, 30);
});

test("Extra · sale a almorzar a las 11:30 (FUERA de la ventana 12-14)", () => {
  const r = analyzeDay({
    schedule: SCHED_MAYO,
    punches: ["08:30", "11:30", "13:00", "18:30"],
    dayOfWeek: LUNES,
    isHoliday: false,
  });
  assert.equal(r.status, "ok");
  assert.equal(r.workedMinutes, 510);
  assert.ok(r.incidents.includes("lunch_outside_window"), "arrancó a las 11:30 < 12:00");
});

test("Extra · sale a almorzar a las 14:30 (después del tope 14:00)", () => {
  const r = analyzeDay({
    schedule: SCHED_MAYO,
    punches: ["08:30", "14:30", "16:00", "18:30"],
    dayOfWeek: LUNES,
    isHoliday: false,
  });
  assert.equal(r.status, "ok");
  // worked = (14:30-08:30) + (18:30-16:00) = 360 + 150 = 510
  assert.equal(r.workedMinutes, 510);
  assert.ok(r.incidents.includes("lunch_outside_window"));
});

test("Extra · sale exactamente a las 14:00 (límite incluido)", () => {
  const r = analyzeDay({
    schedule: SCHED_MAYO,
    punches: ["08:30", "14:00", "15:30", "18:30"],
    dayOfWeek: LUNES,
    isHoliday: false,
  });
  assert.equal(r.status, "ok");
  assert.deepEqual(r.incidents, [], "14:00 está dentro de [12:00, 14:00]");
});

test("Extra · sale a las 12:00 sin antelación (límite inferior)", () => {
  const r = analyzeDay({
    schedule: SCHED_MAYO,
    punches: ["08:30", "12:00", "13:30", "18:30"],
    dayOfWeek: LUNES,
    isHoliday: false,
  });
  assert.equal(r.status, "ok");
  assert.deepEqual(r.incidents, [], "12:00 también está dentro de la ventana");
});

test("Extra · sábado mayo con 4 marcas (almorzó aunque no debía)", () => {
  const r = analyzeDay({
    schedule: SCHED_MAYO,
    punches: ["08:30", "11:00", "11:30", "13:00"],
    dayOfWeek: SABADO,
    isHoliday: false,
  });
  assert.equal(r.status, "ok");
  // worked = (11:00-08:30) + (13:00-11:30) = 150 + 90 = 240
  assert.equal(r.workedMinutes, 240);
  assert.equal(r.undertimeMinutes, 30);
  // Sábado no detecta lunch_too_short ni lunch_too_long
  assert.equal(r.incidents.length, 0);
});

/* ============================================================
 * Justificación con ventana horaria
 * ============================================================ */

test("Justificación · día completo (sin ventana) — vacaciones cuenta como trabajada", () => {
  const r = analyzeDay({
    schedule: SCHED_MAYO,
    punches: [],
    dayOfWeek: LUNES,
    isHoliday: false,
    justified: { countsAsWorked: true },
  });
  assert.equal(r.status, "justified");
  assert.equal(r.workedMinutes, 510); // 8.5h
});

test("Justificación · ventana de inicio cubre la entrada (comisión hasta 11:00)", () => {
  // Worker en comisión 08:30-11:00 (cuenta), llega a oficina 11:00, almuerzo, sale 18:30.
  const r = analyzeDay({
    schedule: SCHED_MAYO,
    punches: ["11:00", "12:30", "13:30", "18:30"],
    dayOfWeek: LUNES,
    isHoliday: false,
    justified: { countsAsWorked: true, fromTime: "08:30", toTime: "11:00" },
  });
  assert.equal(r.status, "justified");
  assert.equal(r.lateMinutes, 0, "llegada a 11:00 no es tarde porque la ventana cubre el inicio");
  // worked real = (12:30-11:00) + (18:30-13:30) = 90 + 300 = 390. + 150 justificadas = 540.
  assert.equal(r.workedMinutes, 540);
  assert.equal(r.overtimeMinutes, 30); // 540 vs 510 esperado
});

test("Justificación · ventana de fin cubre la salida (médico 16:00-18:30)", () => {
  // Worker día normal pero sale 16:00 con justificación médica.
  const r = analyzeDay({
    schedule: SCHED_MAYO,
    punches: ["08:30", "12:00", "13:30", "16:00"],
    dayOfWeek: LUNES,
    isHoliday: false,
    justified: { countsAsWorked: true, fromTime: "16:00", toTime: "18:30" },
  });
  assert.equal(r.status, "justified");
  assert.equal(r.earlyLeaveMinutes, 0, "salida 16:00 no es temprana porque la ventana cubre el final");
  // worked real = (12:00-08:30) + (16:00-13:30) = 210 + 150 = 360. + 150 justificadas = 510.
  assert.equal(r.workedMinutes, 510);
  assert.equal(r.overtimeMinutes, 0);
  assert.equal(r.undertimeMinutes, 0);
});

test("Justificación · ventana parcial sin cuenta (permiso sin goce 2h)", () => {
  // Worker día normal pero 14:00-16:00 permiso sin goce.
  const r = analyzeDay({
    schedule: SCHED_MAYO,
    punches: ["08:30", "12:00", "13:30", "18:30"],
    dayOfWeek: LUNES,
    isHoliday: false,
    justified: { countsAsWorked: false, fromTime: "14:00", toTime: "16:00" },
  });
  // worked real = (12:00-08:30) + (18:30-13:30) = 210 + 300 = 510. No suma justificadas.
  assert.equal(r.workedMinutes, 510);
});

test("Justificación · ventana de inicio + tardanza después de la ventana", () => {
  // Comisión hasta 11:00 pero llegó a oficina 11:30 (tarde de 25 min después de la ventana).
  const r = analyzeDay({
    schedule: SCHED_MAYO,
    punches: ["11:30", "12:30", "13:30", "18:30"],
    dayOfWeek: LUNES,
    isHoliday: false,
    justified: { countsAsWorked: true, fromTime: "08:30", toTime: "11:00" },
  });
  // limit ajustado: 11:00 + 5 = 11:05. Llegó 11:30 → tarde 25 min.
  assert.equal(r.lateMinutes, 25);
});

test("Justificación · 2 marcas tarde + ventana mañana cubre lunch (caso real comisión)", () => {
  // Comisión 08:30-14:57, llega oficina 14:58, sale 18:37.
  // Almuerzo se asume DENTRO de la ventana de comisión.
  const r = analyzeDay({
    schedule: SCHED_MAYO,
    punches: ["14:58", "18:37"],
    dayOfWeek: LUNES,
    isHoliday: false,
    justified: { countsAsWorked: true, fromTime: "08:30", toTime: "14:57" },
  });
  // Real = 18:37 - 14:58 = 219 min
  // Justificado bruto = 14:57 - 08:30 = 387 min
  // Ventana cubre lunch (12:00-14:00) → descontar 90 min del justificado
  // Justificado neto = 387 - 90 = 297 min
  // Total = 219 + 297 = 516 min
  assert.equal(r.workedMinutes, 516);
  assert.equal(r.lateMinutes, 0, "ventana cubre el inicio: no es tarde");
  assert.equal(r.overtimeMinutes, 6, "+6 min vs 510 esperado");
  assert.deepEqual(r.incidents, [], "no se dispara no_lunch_break porque la ventana cubrió la hora del almuerzo");
  assert.equal(r.status, "justified");
});

test("Justificación · ventana mañana NO cubre lunch (no almorzó durante)", () => {
  // Comisión 08:30-11:30 (sin tocar el horario de almuerzo).
  // Llega 11:35, sale 18:30. Esa persona aún debió almorzar en su propio horario.
  const r = analyzeDay({
    schedule: SCHED_MAYO,
    punches: ["11:35", "18:30"],
    dayOfWeek: LUNES,
    isHoliday: false,
    justified: { countsAsWorked: true, fromTime: "08:30", toTime: "11:30" },
  });
  // 2 marcas L-V, ventana NO cubre lunch → debería disparar no_lunch_break
  assert.ok(r.incidents.includes("no_lunch_break"));
  assert.equal(r.status, "incomplete");
});

test("Justificación · comisión 1.5 días — sale 12:30 día 1, vuelve 17:00 día 2", () => {
  // Día 1: entra 08:30, marca salida 12:30 y se va de comisión hasta fin de día.
  const dia1 = analyzeDay({
    schedule: SCHED_MAYO,
    punches: ["08:30", "12:30"],
    dayOfWeek: LUNES,
    isHoliday: false,
    justified: { countsAsWorked: true, fromTime: "12:30", toTime: "18:30" },
  });
  // Real = 240, justificado bruto = 360, ventana cubre lunch → -90 = 270
  // Total = 240 + 270 = 510 (= expected)
  assert.equal(dia1.workedMinutes, 510);
  assert.equal(dia1.lateMinutes, 0);
  assert.equal(dia1.earlyLeaveMinutes, 0, "ventana cubre el final → no hay salida temprana");
  assert.equal(dia1.overtimeMinutes, 0);
  assert.equal(dia1.undertimeMinutes, 0);
  assert.deepEqual(dia1.incidents, []);
  assert.equal(dia1.status, "justified");

  // Día 2: regresa de comisión a las 17:00, sale 18:30.
  const dia2 = analyzeDay({
    schedule: SCHED_MAYO,
    punches: ["17:00", "18:30"],
    dayOfWeek: 2,
    isHoliday: false,
    justified: { countsAsWorked: true, fromTime: "08:30", toTime: "17:00" },
  });
  // Real = 90, justificado bruto = 510, ventana cubre lunch → -90 = 420
  // Total = 90 + 420 = 510 (= expected)
  assert.equal(dia2.workedMinutes, 510);
  assert.equal(dia2.lateMinutes, 0, "ventana cubre el inicio → no es tarde");
  assert.equal(dia2.earlyLeaveMinutes, 0);
  assert.equal(dia2.overtimeMinutes, 0);
  assert.equal(dia2.undertimeMinutes, 0);
  assert.equal(dia2.status, "justified");

  // Total días sumados: 1020 min = 17h (= 2 días esperados de mayo)
  assert.equal((dia1.workedMinutes ?? 0) + (dia2.workedMinutes ?? 0), 1020);
});
