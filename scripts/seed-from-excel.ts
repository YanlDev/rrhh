/* Importa REPORTE_ABRIL_ZKBIO_ZLINK.xlsx directamente a la BD para tener datos al abrir el dashboard. */
import fs from "node:fs";
import path from "node:path";
import { db, ensureMigrated } from "../src/lib/db";
import { employees, attendanceDays, importBatches, holidays } from "../src/lib/db/schema";
import { parseWorkbookBuffer } from "../src/lib/excel/parser";
import { analyzeDay } from "../src/lib/analyzer/day-analyzer";
import { eq, and } from "drizzle-orm";

async function main() {
  await ensureMigrated();
  const file = path.resolve("..", "REPORTE_ABRIL_ZKBIO_ZLINK.xlsx");
  if (!fs.existsSync(file)) {
    console.error("No existe:", file);
    process.exit(1);
  }
  const buf = fs.readFileSync(file);
  const parsed = parseWorkbookBuffer(buf, "REPORTE_ABRIL_ZKBIO_ZLINK.xlsx");
  console.log(`Parsed: ${parsed.employees.length} empleados, ${parsed.periodStart} → ${parsed.periodEnd}`);

  const holidayRows = await db.select().from(holidays);
  const holidaySet = new Set(holidayRows.map((h) => h.holidayDate));

  await db.insert(importBatches).values({
    filename: parsed.filename,
    periodStart: parsed.periodStart,
    periodEnd: parsed.periodEnd,
    totalRows: parsed.employees.length,
    employeesCount: parsed.employees.filter((e) => e.totalPunches > 0).length,
    daysCount: parsed.employees.reduce((s, e) => s + e.days.length, 0),
    rawSnapshot: JSON.stringify({ warnings: parsed.warnings }),
  });

  let inactive = 0;
  let incidents = 0;
  let daysCount = 0;

  for (const emp of parsed.employees) {
    const isActive = emp.totalPunches > 0;
    if (!isActive) inactive++;
    const existing = (await db.select().from(employees).where(eq(employees.personId, emp.personId)))[0];
    let employeeId: string;
    if (existing) {
      await db.update(employees).set({
        name: emp.name, department: emp.department, active: isActive, lastSeenAt: new Date(),
      }).where(eq(employees.id, existing.id));
      employeeId = existing.id;
    } else {
      employeeId = crypto.randomUUID();
      await db.insert(employees).values({
        id: employeeId, personId: emp.personId, name: emp.name, department: emp.department, active: isActive,
      });
    }
    if (!isActive) continue;

    for (const d of emp.days) {
      const isHoliday = holidaySet.has(d.date);
      const a = analyzeDay({ punches: d.punches, dayOfWeek: d.dayOfWeek, isHoliday });
      if (["incomplete", "absent"].includes(a.status)) incidents++;

      const existingDay = (await db.select().from(attendanceDays).where(
        and(eq(attendanceDays.employeeId, employeeId), eq(attendanceDays.workDate, d.date))
      ))[0];
      if (existingDay) {
        await db.update(attendanceDays).set({
          rawPunches: d.punches, dayOfWeek: d.dayOfWeek, isWorkday: a.isWorkday,
          effectivePunches: d.punches, status: a.status, checkIn: a.checkIn, checkOut: a.checkOut,
          workedMinutes: a.workedMinutes, lateMinutes: a.lateMinutes, earlyLeaveMinutes: a.earlyLeaveMinutes,
          incidents: a.incidents, modifiedAt: new Date(),
        }).where(eq(attendanceDays.id, existingDay.id));
      } else {
        await db.insert(attendanceDays).values({
          employeeId, workDate: d.date, dayOfWeek: d.dayOfWeek, isWorkday: a.isWorkday,
          rawPunches: d.punches, effectivePunches: d.punches, status: a.status,
          checkIn: a.checkIn, checkOut: a.checkOut, workedMinutes: a.workedMinutes,
          lateMinutes: a.lateMinutes, earlyLeaveMinutes: a.earlyLeaveMinutes, incidents: a.incidents,
        });
      }
      daysCount++;
    }
  }
  console.log(`✓ Importado: ${parsed.employees.length - inactive} activos, ${inactive} inactivos, ${daysCount} días, ${incidents} incidencias`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
