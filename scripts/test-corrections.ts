/* Verifica el ciclo: corrige un día → re-importa Excel → la corrección sobrevive. */
import fs from "node:fs";
import path from "node:path";
import { db, ensureMigrated } from "../src/lib/db";
import { employees, attendanceDays, importBatches, holidays, justificationTypes } from "../src/lib/db/schema";
import { parseWorkbookBuffer } from "../src/lib/excel/parser";
import { analyzeDay } from "../src/lib/analyzer/day-analyzer";
import { eq, and } from "drizzle-orm";

async function reimport() {
  const file = path.resolve("..", "REPORTE_ABRIL_ZKBIO_ZLINK.xlsx");
  const buf = fs.readFileSync(file);
  const parsed = parseWorkbookBuffer(buf, "REPORTE_ABRIL_ZKBIO_ZLINK.xlsx");
  const holidayRows = await db.select().from(holidays);
  const holidaySet = new Set(holidayRows.map((h) => h.holidayDate));
  const jusTypes = await db.select().from(justificationTypes);
  const jusById = new Map(jusTypes.map((j) => [j.id, j]));

  await db.insert(importBatches).values({
    filename: parsed.filename, periodStart: parsed.periodStart, periodEnd: parsed.periodEnd,
    totalRows: parsed.employees.length,
    employeesCount: parsed.employees.filter((e) => e.totalPunches > 0).length,
    daysCount: parsed.employees.reduce((s, e) => s + e.days.length, 0),
  });

  for (const emp of parsed.employees) {
    const isActive = emp.totalPunches > 0;
    const existing = (await db.select().from(employees).where(eq(employees.personId, emp.personId)))[0];
    let employeeId: string;
    if (existing) {
      await db.update(employees).set({ name: emp.name, department: emp.department, active: isActive, lastSeenAt: new Date() }).where(eq(employees.id, existing.id));
      employeeId = existing.id;
    } else {
      employeeId = crypto.randomUUID();
      await db.insert(employees).values({ id: employeeId, personId: emp.personId, name: emp.name, department: emp.department, active: isActive });
    }
    if (!isActive) continue;

    for (const d of emp.days) {
      const existingDay = (await db.select().from(attendanceDays).where(and(eq(attendanceDays.employeeId, employeeId), eq(attendanceDays.workDate, d.date))))[0];
      const isHoliday = holidaySet.has(d.date);
      const corrected = existingDay?.correctedPunches ?? null;
      const jus = existingDay?.justificationId ? jusById.get(existingDay.justificationId) ?? null : null;
      const effective = corrected ?? d.punches;
      const a = analyzeDay({ punches: effective, dayOfWeek: d.dayOfWeek, isHoliday, justified: jus ? { countsAsWorked: jus.countsAsWorked } : null });

      if (existingDay) {
        await db.update(attendanceDays).set({
          rawPunches: d.punches, dayOfWeek: d.dayOfWeek, isWorkday: a.isWorkday,
          effectivePunches: effective, status: a.status, checkIn: a.checkIn, checkOut: a.checkOut,
          workedMinutes: a.workedMinutes, lateMinutes: a.lateMinutes, earlyLeaveMinutes: a.earlyLeaveMinutes,
          incidents: a.incidents, modifiedAt: new Date(),
        }).where(eq(attendanceDays.id, existingDay.id));
      } else {
        await db.insert(attendanceDays).values({
          employeeId, workDate: d.date, dayOfWeek: d.dayOfWeek, isWorkday: a.isWorkday,
          rawPunches: d.punches, effectivePunches: effective, status: a.status,
          checkIn: a.checkIn, checkOut: a.checkOut, workedMinutes: a.workedMinutes,
          lateMinutes: a.lateMinutes, earlyLeaveMinutes: a.earlyLeaveMinutes, incidents: a.incidents,
        });
      }
    }
  }
}

async function main() {
  await ensureMigrated();
  const fail = (m: string) => { console.error("✗", m); process.exit(1); };

  // Tomar el día con más marcas de Hipolito (8:21,13:14,14:16,19:32 -> 4-9)
  const hip = (await db.select().from(employees).where(eq(employees.personId, "2416096")))[0];
  if (!hip) fail("No existe Hipolito");
  const target = (await db.select().from(attendanceDays).where(and(eq(attendanceDays.employeeId, hip!.id), eq(attendanceDays.workDate, "2026-04-09"))))[0];
  if (!target) fail("No existe attendance 2026-04-09 de Hipolito");
  console.log("Antes:", target!.rawPunches, "status=", target!.status);

  // Aplicar corrección manual
  const myCorrection = ["08:00", "12:00", "13:00", "18:00"];
  await db.update(attendanceDays).set({ correctedPunches: myCorrection }).where(eq(attendanceDays.id, target!.id));
  console.log("Corregido a:", myCorrection);

  // Reimport
  console.log("Re-importando Excel...");
  await reimport();

  // Verificar que la corrección sobrevivió
  const after = (await db.select().from(attendanceDays).where(eq(attendanceDays.id, target!.id)))[0];
  console.log("Después de reimport:");
  console.log("  rawPunches    =", after.rawPunches);
  console.log("  correctedPunches=", after.correctedPunches);
  console.log("  effectivePunches=", after.effectivePunches);

  const ok = JSON.stringify(after.correctedPunches) === JSON.stringify(myCorrection);
  console.log(ok ? "✓ Corrección PRESERVADA" : "✗ Corrección PERDIDA");

  // Limpiar para no dejar huella
  await db.update(attendanceDays).set({ correctedPunches: null }).where(eq(attendanceDays.id, target!.id));
  process.exit(ok ? 0 : 1);
}

main();
