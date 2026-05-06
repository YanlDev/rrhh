import { test } from "node:test";
import assert from "node:assert/strict";
import { parsePunchCell, dedupe, parseWorkbookBuffer } from "../src/lib/excel/parser";
import { analyzeDay } from "../src/lib/analyzer/day-analyzer";
import type { Schedule } from "../src/lib/settings";

const SCHED: Schedule = {
  weekday: { start: "08:30", end: "18:30", hours: 9, lunchMinutes: 60 },
  saturday: { start: "08:30", end: "14:00", hours: 5.5, lunchMinutes: 0 },
  toleranceMinutes: 5,
  duplicateThresholdMinutes: 2,
  minLunchMinutes: 25,
  lunchWindowStart: "12:00",
  lunchWindowEnd: "14:00",
  effectiveFrom: "2020-01-01",
};
import fs from "node:fs";
import path from "node:path";

test("parsePunchCell: empty", () => {
  assert.deepEqual(parsePunchCell(""), []);
  assert.deepEqual(parsePunchCell(null), []);
});

test("parsePunchCell: single time with seconds", () => {
  assert.deepEqual(parsePunchCell("14:03:00"), ["14:03"]);
});

test("parsePunchCell: 4 normal punches via \\r\\n", () => {
  assert.deepEqual(parsePunchCell("08:30\r\n12:30\r\n13:22\r\n18:33"), ["08:30", "12:30", "13:22", "18:33"]);
});

test("dedupe: removes punches < 2 min apart", () => {
  assert.deepEqual(dedupe(["08:30", "08:31", "12:00"]), ["08:30", "12:00"]);
});

test("dedupe: keeps 2 min gap", () => {
  assert.deepEqual(dedupe(["08:30", "08:32"]), ["08:30", "08:32"]);
});

test("analyzeDay: 4 punches normal weekday", () => {
  const r = analyzeDay({ schedule: SCHED, punches: ["08:30", "12:30", "13:22", "18:33"], dayOfWeek: 1, isHoliday: false });
  assert.equal(r.status, "ok");
  assert.equal(r.lateMinutes, 0);
  assert.equal(r.workedMinutes, (12 * 60 + 30 - (8 * 60 + 30)) + (18 * 60 + 33 - (13 * 60 + 22)));
});

test("analyzeDay: late after 08:35", () => {
  const r = analyzeDay({ schedule: SCHED, punches: ["08:40", "12:30", "13:22", "18:33"], dayOfWeek: 1, isHoliday: false });
  assert.equal(r.status, "late");
  assert.equal(r.lateMinutes, 5);
});

test("analyzeDay: 1 punch -> incomplete", () => {
  const r = analyzeDay({ schedule: SCHED, punches: ["14:03"], dayOfWeek: 1, isHoliday: false });
  assert.equal(r.status, "incomplete");
  assert.deepEqual(r.incidents, ["single_punch"]);
});

test("analyzeDay: 0 punches workday -> absent", () => {
  const r = analyzeDay({ schedule: SCHED, punches: [], dayOfWeek: 1, isHoliday: false });
  assert.equal(r.status, "absent");
});

test("analyzeDay: sunday -> no_workday", () => {
  const r = analyzeDay({ schedule: SCHED, punches: [], dayOfWeek: 0, isHoliday: false });
  assert.equal(r.status, "no_workday");
});

test("analyzeDay: justified counts as worked", () => {
  const r = analyzeDay({ schedule: SCHED, punches: [], dayOfWeek: 1, isHoliday: false, justified: { countsAsWorked: true } });
  assert.equal(r.status, "justified");
  assert.equal(r.workedMinutes, 9 * 60);
});

test("integration: parse real Excel", () => {
  const file = path.resolve(__dirname, "../../REPORTE_ABRIL_ZKBIO_ZLINK.xlsx");
  if (!fs.existsSync(file)) {
    console.log("skip: no Excel sample");
    return;
  }
  const buf = fs.readFileSync(file);
  const result = parseWorkbookBuffer(buf, "REPORTE_ABRIL_ZKBIO_ZLINK.xlsx");
  assert.equal(result.periodStart, "2026-04-01");
  assert.equal(result.periodEnd, "2026-04-30");
  assert.ok(result.employees.length > 0, "should have employees");
  const kevin = result.employees.find((e) => e.personId === "60377216");
  assert.ok(kevin, "Kevin should exist");
  const apr13 = kevin!.days.find((d) => d.date === "2026-04-13");
  assert.ok(apr13, "Apr 13 day exists");
  assert.equal(apr13!.punches.length, 4);
});
