import ExcelJS, { type Worksheet } from "exceljs";
import { db } from "@/lib/db";
import { employees, attendanceDays, justificationTypes } from "@/lib/db/schema";
import { eq, and, gte, lte, asc, isNotNull, sql, desc } from "drizzle-orm";
import { areaChartPng, barChartPng, donutChartPng } from "./svg-charts";

const DOW_FULL = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

type Period = { start: string; end: string; label: string; mode?: "month" | "fortnight" | "week"; key?: string };

/* =========================== Estilo unificado =========================== */

const COLORS = {
  brand: "FF1E293B",       // slate-800
  brandSoft: "FFF1F5F9",   // slate-100
  rowAlt: "FFFAFAFA",
  borderSoft: "FFE2E8F0",  // slate-200
  text: "FF0F172A",
  muted: "FF64748B",

  ok: "FFD1FAE5",          // emerald-100
  okText: "FF065F46",
  late: "FFFFEDD5",        // orange-100
  lateText: "FF9A3412",
  incomplete: "FFFEF3C7",  // amber-100
  incompleteText: "FF92400E",
  absent: "FFFEE2E2",      // red-100
  absentText: "FF991B1B",
  justified: "FFDBEAFE",   // blue-100
  justifiedText: "FF1E40AF",
  no_workday: "FFF1F5F9",
  no_workdayText: "FF475569",
};

const STATUS_FILL: Record<string, { bg: string; text: string; label: string }> = {
  ok: { bg: COLORS.ok, text: COLORS.okText, label: "OK" },
  late: { bg: COLORS.late, text: COLORS.lateText, label: "Tarde" },
  incomplete: { bg: COLORS.incomplete, text: COLORS.incompleteText, label: "Incompleto" },
  absent: { bg: COLORS.absent, text: COLORS.absentText, label: "Ausente" },
  justified: { bg: COLORS.justified, text: COLORS.justifiedText, label: "Justificado" },
  no_workday: { bg: COLORS.no_workday, text: COLORS.no_workdayText, label: "No laborable" },
};

function periodSlug(p: Period): string {
  if (p.mode === "week") return `semana_${p.start}_a_${p.end}`;
  if (p.mode === "fortnight") {
    const half = p.key?.endsWith("-1") ? "Q1" : "Q2";
    return `${p.start.slice(0, 7)}_${half}`;
  }
  return p.start.slice(0, 7);
}

function titleBlock(ws: Worksheet, title: string, subtitle: string, colCount: number) {
  // Fila título
  ws.mergeCells(1, 1, 1, colCount);
  const t = ws.getCell(1, 1);
  t.value = title;
  t.font = { name: "Calibri", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
  t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.brand } };
  t.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(1).height = 28;

  ws.mergeCells(2, 1, 2, colCount);
  const s = ws.getCell(2, 1);
  s.value = subtitle;
  s.font = { name: "Calibri", size: 10, color: { argb: COLORS.muted }, italic: true };
  s.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.brandSoft } };
  s.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  ws.getRow(2).height = 18;
}

/**
 * Escribe headers + data como tabla nativa de Excel con estilo banded + autofilter + frozen.
 * `headers` define títulos y `widths`. `rows` son arrays alineados con headers.
 */
function styledTable(
  ws: Worksheet,
  startRow: number,
  headers: { label: string; width?: number; numFmt?: string; align?: "left" | "right" | "center" }[],
  rows: (string | number | null)[][],
  opts: { tableName: string; styleName?: string } = { tableName: "Data" },
) {
  const colCount = headers.length;
  const headerRowIdx = startRow;
  const dataStartIdx = startRow + 1;

  // Set column widths and number formats
  headers.forEach((h, i) => {
    const col = ws.getColumn(i + 1);
    if (h.width) col.width = h.width;
    if (h.numFmt) col.numFmt = h.numFmt;
    if (h.align) col.alignment = { horizontal: h.align };
  });

  // Use addTable for native styled table
  const ref = `${cell(headerRowIdx, 1)}:${cell(headerRowIdx + rows.length, colCount)}`;
  ws.addTable({
    name: opts.tableName.replace(/[^A-Za-z0-9_]/g, "_"),
    ref: cell(headerRowIdx, 1),
    headerRow: true,
    totalsRow: false,
    style: {
      theme: opts.styleName ?? "TableStyleMedium2",
      showRowStripes: true,
    },
    columns: headers.map((h) => ({ name: h.label, filterButton: true })),
    rows: rows.map((r) => r.map((v) => v as string | number)),
  });

  // Freeze header
  ws.views = [{ state: "frozen", ySplit: headerRowIdx, xSplit: 0 }];

  return { headerRowIdx, dataStartIdx, colCount, lastRow: headerRowIdx + rows.length, ref };
}

function cell(row: number, col: number) {
  let s = "";
  let n = col;
  while (n > 0) {
    const m = (n - 1) % 26;
    s = String.fromCharCode(65 + m) + s;
    n = Math.floor((n - 1) / 26);
  }
  return `${s}${row}`;
}

/** Pinta status como pill coloreado. Aplica a una columna entera de filas. */
function paintStatusColumn(ws: Worksheet, dataStartRow: number, lastRow: number, colIdx: number) {
  for (let r = dataStartRow; r <= lastRow; r++) {
    const c = ws.getCell(r, colIdx);
    const code = String(c.value ?? "");
    const meta = STATUS_FILL[code];
    if (!meta) continue;
    c.value = meta.label;
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: meta.bg } };
    c.font = { color: { argb: meta.text }, bold: true, size: 10 };
    c.alignment = { horizontal: "center", vertical: "middle" };
  }
}

function inP(period: Period) {
  return and(gte(attendanceDays.workDate, period.start), lte(attendanceDays.workDate, period.end));
}

async function workbookToBuffer(wb: ExcelJS.Workbook): Promise<Buffer> {
  const ab = await wb.xlsx.writeBuffer();
  return Buffer.from(ab);
}

function newWorkbook(period: Period): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Asistencia App";
  wb.created = new Date();
  wb.properties.date1904 = false;
  return wb;
}

/* ============================ 8.6 Excel limpio ============================ */
function pad2(n: number) { return String(n).padStart(2, "0"); }
function dateColLabel(iso: string) {
  const [, m, d] = iso.split("-");
  return `${Number(m)}-${Number(d)}`;
}

export async function exportCleanExcel(period: Period): Promise<{ buffer: Buffer; filename: string }> {
  const dates: string[] = [];
  const start = new Date(period.start + "T00:00:00");
  const end = new Date(period.end + "T00:00:00");
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dates.push(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`);
  }

  const empRows = await db.select().from(employees).where(eq(employees.active, true)).orderBy(asc(employees.name));
  const days = await db.select().from(attendanceDays)
    .innerJoin(employees, eq(employees.id, attendanceDays.employeeId))
    .where(inP(period));

  const idx = new Map<string, Map<string, string>>();
  for (const r of days) {
    const punches = (r.attendance_days.effectivePunches ?? []).join("\n");
    if (!idx.has(r.employees.personId)) idx.set(r.employees.personId, new Map());
    idx.get(r.employees.personId)!.set(r.attendance_days.workDate, punches);
  }

  const wb = newWorkbook(period);
  const sheetName = `Punch Time(${period.start.replace(/-/g, "")}-${period.end.replace(/-/g, "")})`.slice(0, 31);
  const ws = wb.addWorksheet(sheetName, { views: [{ state: "frozen", xSplit: 3, ySplit: 1 }] });

  // header row 1: ZKBio-style (without title block to remain re-importable)
  const header = ["Person ID", "Person Name", "Department", ...dates.map(dateColLabel)];
  ws.addRow(header);

  for (const e of empRows) {
    const m = idx.get(e.personId);
    ws.addRow([e.personId, e.name, e.department ?? "", ...dates.map((d) => m?.get(d) ?? "")]);
  }

  // Styles
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 11 };
  headerRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.brand } };
  headerRow.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  headerRow.height = 26;

  ws.getColumn(1).width = 14;
  ws.getColumn(2).width = 32;
  ws.getColumn(3).width = 18;
  for (let i = 4; i <= header.length; i++) {
    const c = ws.getColumn(i);
    c.width = 12;
    c.alignment = { vertical: "top", horizontal: "center", wrapText: true };
  }

  // Banded rows + borders
  for (let r = 2; r <= empRows.length + 1; r++) {
    const row = ws.getRow(r);
    row.height = 60;
    if (r % 2 === 0) {
      row.eachCell({ includeEmpty: true }, (c) => {
        c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.rowAlt } };
      });
    }
    row.eachCell({ includeEmpty: true }, (c) => {
      c.border = { bottom: { style: "thin", color: { argb: COLORS.borderSoft } } };
      if (typeof c.value === "string" && c.value.includes("\n")) {
        c.alignment = { vertical: "top", horizontal: "center", wrapText: true };
        c.font = { name: "Consolas", size: 9 };
      }
    });
  }

  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: header.length } };

  // Hoja Justificaciones
  const jusRows = await db
    .select({
      empName: employees.name, empDept: employees.department, empId: employees.personId,
      date: attendanceDays.workDate, code: justificationTypes.code, label: justificationTypes.labelEs,
      countsAsWorked: justificationTypes.countsAsWorked, note: attendanceDays.justificationNote,
    })
    .from(attendanceDays)
    .innerJoin(employees, eq(employees.id, attendanceDays.employeeId))
    .innerJoin(justificationTypes, eq(justificationTypes.id, attendanceDays.justificationId))
    .where(and(inP(period), isNotNull(attendanceDays.justificationId)))
    .orderBy(asc(attendanceDays.workDate), asc(employees.name));

  const ws2 = wb.addWorksheet("Justificaciones");
  titleBlock(ws2, "Justificaciones aplicadas", `${period.label}`, 8);
  const t2 = styledTable(ws2, 4,
    [
      { label: "Fecha", width: 12 },
      { label: "Person ID", width: 14 },
      { label: "Empleado", width: 32 },
      { label: "Depto", width: 18 },
      { label: "Código", width: 14 },
      { label: "Motivo", width: 30 },
      { label: "Cuenta como trabajado", width: 22, align: "center" },
      { label: "Nota", width: 40 },
    ],
    jusRows.map((r) => [
      r.date, r.empId, r.empName, r.empDept ?? "", r.code, r.label,
      r.countsAsWorked ? "Sí" : "No", r.note ?? "",
    ]),
    { tableName: "Justificaciones" },
  );
  ws2.views = [{ state: "frozen", ySplit: t2.headerRowIdx }];

  return { buffer: await workbookToBuffer(wb), filename: `asistencia_limpio_${periodSlug(period)}.xlsx` };
}

/* ============================ 8.2 Detalle diario ============================ */
export async function exportDailyDetail(period: Period): Promise<{ buffer: Buffer; filename: string }> {
  const rows = await db
    .select({
      empName: employees.name, empDept: employees.department, empId: employees.personId,
      date: attendanceDays.workDate, dow: attendanceDays.dayOfWeek,
      punches: attendanceDays.effectivePunches, status: attendanceDays.status,
      worked: attendanceDays.workedMinutes, late: attendanceDays.lateMinutes,
      early: attendanceDays.earlyLeaveMinutes,
      overtime: attendanceDays.overtimeMinutes, undertime: attendanceDays.undertimeMinutes,
      note: attendanceDays.justificationNote,
      jusCode: justificationTypes.code,
    })
    .from(attendanceDays)
    .innerJoin(employees, eq(employees.id, attendanceDays.employeeId))
    .leftJoin(justificationTypes, eq(justificationTypes.id, attendanceDays.justificationId))
    .where(inP(period))
    .orderBy(asc(employees.name), asc(attendanceDays.workDate));

  const wb = newWorkbook(period);
  const ws = wb.addWorksheet("Detalle diario");
  titleBlock(ws, "Detalle diario por empleado", `${period.label} · ${rows.length} registros`, 17);

  const data = rows.map((r) => {
    const p = r.punches ?? [];
    return [
      r.empName, r.empDept ?? "", r.empId, r.date, DOW_FULL[r.dow],
      p[0] ?? "", p[1] ?? "", p[2] ?? "", p[3] ?? "",
      r.worked != null ? Number((r.worked / 60).toFixed(2)) : null,
      r.late, r.early, r.overtime, r.undertime, r.status, r.jusCode ?? "", r.note ?? "",
    ];
  });

  const t = styledTable(ws, 4,
    [
      { label: "Empleado", width: 32 },
      { label: "Depto", width: 18 },
      { label: "ID", width: 12 },
      { label: "Fecha", width: 12 },
      { label: "Día", width: 12 },
      { label: "Entrada", width: 10, align: "center" },
      { label: "Salida almuerzo", width: 14, align: "center" },
      { label: "Retorno almuerzo", width: 14, align: "center" },
      { label: "Salida", width: 10, align: "center" },
      { label: "Horas trab.", width: 12, align: "right", numFmt: "0.00" },
      { label: "Min. tarde", width: 11, align: "right", numFmt: "0" },
      { label: "Min. salida temp.", width: 14, align: "right", numFmt: "0" },
      { label: "Min. extras", width: 11, align: "right", numFmt: "0" },
      { label: "Min. faltantes", width: 12, align: "right", numFmt: "0" },
      { label: "Estado", width: 16, align: "center" },
      { label: "Justificación", width: 16 },
      { label: "Nota", width: 28 },
    ],
    data,
    { tableName: "DetalleDiario" },
  );

  paintStatusColumn(ws, t.dataStartIdx, t.lastRow, 15);
  ws.views = [{ state: "frozen", ySplit: t.headerRowIdx, xSplit: 1 }];

  return { buffer: await workbookToBuffer(wb), filename: `detalle_diario_${periodSlug(period)}.xlsx` };
}

/* ============================ 8.3 Resumen empleados ============================ */
export async function exportEmployeeSummary(period: Period): Promise<{ buffer: Buffer; filename: string }> {
  const rows = await db
    .select({
      id: employees.id, name: employees.name, dept: employees.department, personId: employees.personId,
      worked: sql<number>`COALESCE(SUM(${attendanceDays.workedMinutes}), 0)`,
      late: sql<number>`COALESCE(SUM(${attendanceDays.lateMinutes}), 0)`,
      early: sql<number>`COALESCE(SUM(${attendanceDays.earlyLeaveMinutes}), 0)`,
      overtime: sql<number>`COALESCE(SUM(${attendanceDays.overtimeMinutes}), 0)`,
      undertime: sql<number>`COALESCE(SUM(${attendanceDays.undertimeMinutes}), 0)`,
      lateDays: sql<number>`COUNT(CASE WHEN ${attendanceDays.status} = 'late' THEN 1 END)`,
      absDays: sql<number>`COUNT(CASE WHEN ${attendanceDays.status} = 'absent' THEN 1 END)`,
      incDays: sql<number>`COUNT(CASE WHEN ${attendanceDays.status} = 'incomplete' THEN 1 END)`,
      jusDays: sql<number>`COUNT(CASE WHEN ${attendanceDays.status} = 'justified' THEN 1 END)`,
      okDays: sql<number>`COUNT(CASE WHEN ${attendanceDays.status} IN ('ok','late') THEN 1 END)`,
      workdays: sql<number>`COUNT(CASE WHEN ${attendanceDays.isWorkday} = TRUE THEN 1 END)`,
      saturdays: sql<number>`COUNT(CASE WHEN ${attendanceDays.dayOfWeek} = 6 AND ${attendanceDays.status} IN ('ok','late','justified') THEN 1 END)`,
    })
    .from(attendanceDays)
    .innerJoin(employees, eq(employees.id, attendanceDays.employeeId))
    .where(and(inP(period), eq(employees.active, true)))
    .groupBy(employees.id)
    .orderBy(asc(employees.name));

  const data = rows.map((r) => {
    const wd = Number(r.workdays);
    const present = Number(r.okDays) + Number(r.jusDays);
    const pct = wd > 0 ? Math.round((present / wd) * 100) : 0;
    return [
      r.name, r.dept ?? "", r.personId,
      Number(r.okDays), Number(r.absDays), Number(r.jusDays), Number(r.incDays),
      Number((Number(r.worked) / 60).toFixed(2)),
      Number(r.late), Number(r.early),
      Number(r.overtime), Number(r.undertime),
      Number(r.lateDays), Number(r.saturdays),
      pct / 100, // store as fraction so % format displays correctly
    ];
  });

  const wb = newWorkbook(period);
  const ws = wb.addWorksheet("Por empleado");
  titleBlock(ws, "Resumen por empleado", `${period.label} · ${rows.length} empleados activos`, 15);

  const t = styledTable(ws, 4,
    [
      { label: "Empleado", width: 32 },
      { label: "Depto", width: 18 },
      { label: "ID", width: 14 },
      { label: "Días trabajados", width: 12, align: "right" },
      { label: "Días faltados", width: 12, align: "right" },
      { label: "Días justificados", width: 14, align: "right" },
      { label: "Días incompletos", width: 14, align: "right" },
      { label: "Total horas", width: 12, align: "right", numFmt: "0.00" },
      { label: "Min. tarde", width: 11, align: "right" },
      { label: "Min. salida temp.", width: 14, align: "right" },
      { label: "Min. extras", width: 11, align: "right" },
      { label: "Min. faltantes", width: 12, align: "right" },
      { label: "Tardanzas", width: 11, align: "right" },
      { label: "Sábados asistidos", width: 14, align: "right" },
      { label: "% asistencia", width: 12, align: "right", numFmt: "0%" },
    ],
    data,
    { tableName: "ResumenEmpleado", styleName: "TableStyleMedium9" },
  );

  // Conditional: data bars on Total horas, color scale on % asistencia
  const horasCol = "H";
  ws.addConditionalFormatting({
    ref: `${horasCol}${t.dataStartIdx}:${horasCol}${t.lastRow}`,
    rules: [{ type: "dataBar", priority: 1, cfvo: [{ type: "min" }, { type: "max" }], gradient: true, color: { argb: "FF60A5FA" } } as never],
  });
  const pctCol = "O";
  ws.addConditionalFormatting({
    ref: `${pctCol}${t.dataStartIdx}:${pctCol}${t.lastRow}`,
    rules: [{
      type: "colorScale", priority: 2,
      cfvo: [{ type: "min" }, { type: "percentile", value: 50 }, { type: "max" }],
      color: [{ argb: "FFFCA5A5" }, { argb: "FFFEF08A" }, { argb: "FF86EFAC" }],
    } as never],
  });

  ws.views = [{ state: "frozen", ySplit: t.headerRowIdx, xSplit: 1 }];

  return { buffer: await workbookToBuffer(wb), filename: `resumen_empleados_${periodSlug(period)}.xlsx` };
}

/* ============================ 8.4 Resumen depto ============================ */
export async function exportDepartmentSummary(period: Period): Promise<{ buffer: Buffer; filename: string }> {
  const rows = await db
    .select({
      dept: sql<string>`COALESCE(${employees.department}, '—')`,
      empCount: sql<number>`COUNT(DISTINCT ${employees.id})`,
      worked: sql<number>`COALESCE(SUM(${attendanceDays.workedMinutes}), 0)`,
      late: sql<number>`COALESCE(SUM(${attendanceDays.lateMinutes}), 0)`,
      lateDays: sql<number>`COUNT(CASE WHEN ${attendanceDays.status} = 'late' THEN 1 END)`,
      absDays: sql<number>`COUNT(CASE WHEN ${attendanceDays.status} = 'absent' THEN 1 END)`,
      jusDays: sql<number>`COUNT(CASE WHEN ${attendanceDays.status} = 'justified' THEN 1 END)`,
      okDays: sql<number>`COUNT(CASE WHEN ${attendanceDays.status} IN ('ok','late') THEN 1 END)`,
      workdays: sql<number>`COUNT(CASE WHEN ${attendanceDays.isWorkday} = TRUE THEN 1 END)`,
    })
    .from(attendanceDays)
    .innerJoin(employees, eq(employees.id, attendanceDays.employeeId))
    .where(and(inP(period), eq(employees.active, true)))
    .groupBy(employees.department)
    .orderBy(asc(employees.department));

  const data = rows.map((r) => {
    const wd = Number(r.workdays);
    const present = Number(r.okDays) + Number(r.jusDays);
    const pct = wd > 0 ? present / wd : 0;
    const totalH = Number(r.worked) / 60;
    return [
      r.dept, Number(r.empCount), pct,
      Number(totalH.toFixed(1)),
      Number((totalH / Math.max(1, Number(r.empCount))).toFixed(1)),
      Number(r.lateDays), Number(r.absDays), Number(r.jusDays),
    ];
  });

  const wb = newWorkbook(period);
  const ws = wb.addWorksheet("Por departamento");
  titleBlock(ws, "Resumen por departamento", `${period.label}`, 8);

  const t = styledTable(ws, 4,
    [
      { label: "Depto", width: 22 },
      { label: "Empleados", width: 12, align: "right" },
      { label: "% asistencia", width: 14, align: "right", numFmt: "0%" },
      { label: "Total horas", width: 14, align: "right", numFmt: "0.0" },
      { label: "Promedio horas/emp", width: 18, align: "right", numFmt: "0.0" },
      { label: "Total tardanzas", width: 14, align: "right" },
      { label: "Total ausencias", width: 14, align: "right" },
      { label: "Total justificados", width: 16, align: "right" },
    ],
    data,
    { tableName: "ResumenDepto", styleName: "TableStyleMedium11" },
  );

  // % asistencia color scale
  ws.addConditionalFormatting({
    ref: `C${t.dataStartIdx}:C${t.lastRow}`,
    rules: [{
      type: "colorScale", priority: 1,
      cfvo: [{ type: "min" }, { type: "percentile", value: 50 }, { type: "max" }],
      color: [{ argb: "FFFCA5A5" }, { argb: "FFFEF08A" }, { argb: "FF86EFAC" }],
    } as never],
  });
  // Tardanzas/ausencias bars
  for (const col of ["F", "G"]) {
    ws.addConditionalFormatting({
      ref: `${col}${t.dataStartIdx}:${col}${t.lastRow}`,
      rules: [{ type: "dataBar", priority: 2, cfvo: [{ type: "min" }, { type: "max" }], gradient: true, color: { argb: "FFF87171" } } as never],
    });
  }

  ws.views = [{ state: "frozen", ySplit: t.headerRowIdx }];

  return { buffer: await workbookToBuffer(wb), filename: `resumen_departamentos_${periodSlug(period)}.xlsx` };
}

/* ============================ 8.5 Incidencias pendientes ============================ */
const INCIDENT_LABELS: Record<string, string> = {
  no_punches: "Sin marcas",
  single_punch: "Solo una marca",
  odd_punches_3: "3 marcas (incompleto)",
  too_many_punches: "Marcas duplicadas (5+)",
  only_2_punches_weekday: "Solo 2 marcas (sin almuerzo)",
  no_lunch_break: "No salió a almorzar",
  lunch_too_short: "Almuerzo más corto que el requerido",
  lunch_too_long: "Almuerzo más largo que el requerido",
  lunch_critically_short: "Almuerzo críticamente corto",
  lunch_outside_window: "Salió a almorzar fuera de la ventana",
};

function labelIncidents(codes: string[] | null | undefined): string {
  if (!codes || codes.length === 0) return "";
  return codes.map((c) => INCIDENT_LABELS[c] ?? c).join(" · ");
}

export async function exportIncidentsCsv(period: Period): Promise<{ buffer: Buffer; filename: string }> {
  const rows = await db
    .select({
      empName: employees.name, empDept: employees.department, empId: employees.personId,
      date: attendanceDays.workDate, dow: attendanceDays.dayOfWeek,
      status: attendanceDays.status, punches: attendanceDays.effectivePunches,
      incidents: attendanceDays.incidents, lateMin: attendanceDays.lateMinutes,
    })
    .from(attendanceDays)
    .innerJoin(employees, eq(employees.id, attendanceDays.employeeId))
    .where(
      and(
        inP(period),
        // Incompleto/ausente, o cualquier día con incidentes (incluye lunch_too_short).
        sql`(${attendanceDays.status} IN ('incomplete','absent') OR jsonb_array_length(${attendanceDays.incidents}) > 0)`
      )
    )
    .orderBy(asc(attendanceDays.workDate), asc(employees.name));

  const wb = newWorkbook(period);
  const ws = wb.addWorksheet("Incidencias");
  titleBlock(
    ws,
    "Incidencias pendientes",
    `${period.label} · ${rows.length} día(s) por revisar`,
    9,
  );

  const data = rows.map((r) => {
    const p = r.punches ?? [];
    return [
      r.date,
      DOW_FULL[r.dow],
      r.empName,
      r.empDept ?? "",
      r.empId,
      p[0] ?? "",
      p[1] ?? "",
      p[2] ?? "",
      p[3] ?? "",
      r.status,
      labelIncidents(r.incidents),
      r.lateMin,
    ];
  });

  const t = styledTable(
    ws,
    4,
    [
      { label: "Fecha", width: 12, align: "center" },
      { label: "Día", width: 12 },
      { label: "Empleado", width: 32 },
      { label: "Depto", width: 18 },
      { label: "ID", width: 12 },
      { label: "Entrada", width: 10, align: "center" },
      { label: "Salida alm.", width: 12, align: "center" },
      { label: "Retorno alm.", width: 12, align: "center" },
      { label: "Salida", width: 10, align: "center" },
      { label: "Estado", width: 16, align: "center" },
      { label: "Problemas", width: 36 },
      { label: "Min. tarde", width: 11, align: "right", numFmt: "0" },
    ],
    data,
    { tableName: "Incidencias", styleName: "TableStyleMedium4" },
  );

  paintStatusColumn(ws, t.dataStartIdx, t.lastRow, 10);
  ws.views = [{ state: "frozen", ySplit: t.headerRowIdx, xSplit: 3 }];

  return {
    buffer: await workbookToBuffer(wb),
    filename: `incidencias_${periodSlug(period)}.xlsx`,
  };
}

/* ============================ 8.1 Reporte Ejecutivo ============================ */
export async function exportExecutive(period: Period): Promise<{ buffer: Buffer; filename: string }> {
  const [active, inactive, total, totalLate, totalAbs, totalInc, totalJus, attendance] = await Promise.all([
    db.select({ n: sql<number>`COUNT(*)` }).from(employees).where(eq(employees.active, true)),
    db.select({ n: sql<number>`COUNT(*)` }).from(employees).where(eq(employees.active, false)),
    db.select({ n: sql<number>`COUNT(*)` }).from(attendanceDays).where(inP(period)),
    db.select({ n: sql<number>`COUNT(*)` }).from(attendanceDays).where(and(inP(period), eq(attendanceDays.status, "late"))),
    db.select({ n: sql<number>`COUNT(*)` }).from(attendanceDays).where(and(inP(period), eq(attendanceDays.status, "absent"))),
    db.select({ n: sql<number>`COUNT(*)` }).from(attendanceDays).where(and(inP(period), eq(attendanceDays.status, "incomplete"))),
    db.select({ n: sql<number>`COUNT(*)` }).from(attendanceDays).where(and(inP(period), eq(attendanceDays.status, "justified"))),
    db.select({
      present: sql<number>`COUNT(CASE WHEN ${attendanceDays.status} IN ('ok','late','justified') THEN 1 END)`,
      workdays: sql<number>`COUNT(CASE WHEN ${attendanceDays.isWorkday} = TRUE THEN 1 END)`,
    }).from(attendanceDays).innerJoin(employees, eq(employees.id, attendanceDays.employeeId))
      .where(and(inP(period), eq(employees.active, true))),
  ]);

  const wd = Number(attendance[0].workdays);
  const pct = wd > 0 ? Math.round((Number(attendance[0].present) / wd) * 100) : 0;

  const wb = newWorkbook(period);

  /* --- Hoja 1: Portada --- */
  const cover = wb.addWorksheet("Resumen");
  cover.getColumn(1).width = 30;
  cover.getColumn(2).width = 28;

  cover.mergeCells("A1:B1");
  const head = cover.getCell("A1");
  head.value = "Reporte Ejecutivo de Asistencia";
  head.font = { name: "Calibri", size: 18, bold: true, color: { argb: "FFFFFFFF" } };
  head.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.brand } };
  head.alignment = { vertical: "middle", horizontal: "center" };
  cover.getRow(1).height = 36;

  cover.mergeCells("A2:B2");
  const sub = cover.getCell("A2");
  sub.value = period.label;
  sub.font = { name: "Calibri", size: 12, color: { argb: COLORS.muted }, italic: true };
  sub.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.brandSoft } };
  sub.alignment = { vertical: "middle", horizontal: "center" };
  cover.getRow(2).height = 22;

  const kpis: [string, string | number, string][] = [
    ["Periodo", `${period.start} → ${period.end}`, ""],
    ["Empleados activos", Number(active[0].n), ""],
    ["Empleados inactivos", Number(inactive[0].n), ""],
    ["% asistencia general", `${pct}%`, pct >= 90 ? "FF86EFAC" : pct >= 75 ? "FFFEF08A" : "FFFCA5A5"],
    ["Total días registrados", Number(total[0].n), ""],
    ["Tardanzas", Number(totalLate[0].n), COLORS.late],
    ["Ausencias", Number(totalAbs[0].n), COLORS.absent],
    ["Incompletos", Number(totalInc[0].n), COLORS.incomplete],
    ["Justificados", Number(totalJus[0].n), COLORS.justified],
  ];

  let row = 4;
  for (const [k, v, color] of kpis) {
    cover.getCell(row, 1).value = k;
    cover.getCell(row, 1).font = { bold: true, color: { argb: COLORS.text } };
    cover.getCell(row, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.brandSoft } };
    cover.getCell(row, 1).alignment = { vertical: "middle", indent: 1 };

    const c = cover.getCell(row, 2);
    c.value = v;
    c.font = { bold: true, size: 12 };
    c.alignment = { vertical: "middle", horizontal: "center" };
    if (color) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: color } };
    cover.getRow(row).height = 22;
    row++;
  }

  cover.getCell(row + 1, 1).value = "Generado";
  cover.getCell(row + 1, 1).font = { color: { argb: COLORS.muted }, italic: true };
  cover.getCell(row + 1, 2).value = new Date().toLocaleString("es-PE");
  cover.getCell(row + 1, 2).font = { color: { argb: COLORS.muted }, italic: true };

  /* --- Charts en portada --- */
  // Pie de status
  const totalDays = Number(total[0].n);
  const okJus = totalDays - Number(totalLate[0].n) - Number(totalAbs[0].n) - Number(totalInc[0].n) - Number(totalJus[0].n);
  const statusData = [
    { label: "OK", value: okJus, color: "#10b981" },
    { label: "Tarde", value: Number(totalLate[0].n), color: "#f97316" },
    { label: "Justificado", value: Number(totalJus[0].n), color: "#3b82f6" },
    { label: "Incompleto", value: Number(totalInc[0].n), color: "#f59e0b" },
    { label: "Ausente", value: Number(totalAbs[0].n), color: "#ef4444" },
  ].filter((d) => d.value > 0);

  if (statusData.length > 0) {
    const donut = await donutChartPng(statusData, { title: "Distribución de estados", width: 480, height: 260 });
    const id = wb.addImage({ buffer: donut.buffer, extension: "png" });
    cover.addImage(id, { tl: { col: 2.5, row: 3 }, ext: { width: donut.width / 2, height: donut.height / 2 } });
  }

  /* --- Hoja 2: Por departamento --- */
  const deptRows = await db
    .select({
      dept: sql<string>`COALESCE(${employees.department}, '—')`,
      empCount: sql<number>`COUNT(DISTINCT ${employees.id})`,
      worked: sql<number>`COALESCE(SUM(${attendanceDays.workedMinutes}), 0)`,
      late: sql<number>`COALESCE(SUM(${attendanceDays.lateMinutes}), 0)`,
      lateDays: sql<number>`COUNT(CASE WHEN ${attendanceDays.status} = 'late' THEN 1 END)`,
      absDays: sql<number>`COUNT(CASE WHEN ${attendanceDays.status} = 'absent' THEN 1 END)`,
      jusDays: sql<number>`COUNT(CASE WHEN ${attendanceDays.status} = 'justified' THEN 1 END)`,
    })
    .from(attendanceDays)
    .innerJoin(employees, eq(employees.id, attendanceDays.employeeId))
    .where(and(inP(period), eq(employees.active, true)))
    .groupBy(employees.department)
    .orderBy(asc(employees.department));

  const wsDept = wb.addWorksheet("Por departamento");
  titleBlock(wsDept, "Indicadores por departamento", period.label, 7);
  const tDept = styledTable(wsDept, 4,
    [
      { label: "Depto", width: 22 },
      { label: "Empleados", width: 12, align: "right" },
      { label: "Total horas", width: 14, align: "right", numFmt: "0.0" },
      { label: "Min. tarde", width: 12, align: "right" },
      { label: "Tardanzas", width: 12, align: "right" },
      { label: "Ausencias", width: 12, align: "right" },
      { label: "Justificados", width: 14, align: "right" },
    ],
    deptRows.map((d) => [
      d.dept, Number(d.empCount), Number((Number(d.worked) / 60).toFixed(1)),
      Number(d.late), Number(d.lateDays), Number(d.absDays), Number(d.jusDays),
    ]),
    { tableName: "ResumenDepto", styleName: "TableStyleMedium11" },
  );

  // bars
  for (const col of ["E", "F"]) {
    wsDept.addConditionalFormatting({
      ref: `${col}${tDept.dataStartIdx}:${col}${tDept.lastRow}`,
      rules: [{ type: "dataBar", priority: 1, cfvo: [{ type: "min" }, { type: "max" }], gradient: true, color: { argb: "FFF87171" } } as never],
    });
  }
  wsDept.addConditionalFormatting({
    ref: `G${tDept.dataStartIdx}:G${tDept.lastRow}`,
    rules: [{ type: "dataBar", priority: 1, cfvo: [{ type: "min" }, { type: "max" }], gradient: true, color: { argb: "FF60A5FA" } } as never],
  });

  // Bar chart por departamento
  if (deptRows.length > 0) {
    const bar = await barChartPng(
      deptRows.map((d) => ({ label: d.dept, values: [Number(d.late), Number(d.absDays)] })),
      [{ name: "Min. tarde", color: "#f97316" }, { name: "Ausencias", color: "#ef4444" }],
      { title: "Comparativo por departamento", width: 760, height: 320 },
    );
    const id = wb.addImage({ buffer: bar.buffer, extension: "png" });
    wsDept.addImage(id, { tl: { col: 0, row: tDept.lastRow + 2 }, ext: { width: bar.width / 2, height: bar.height / 2 } });
  }

  /* --- Hoja 3: Por empleado --- */
  const empRows = await db
    .select({
      name: employees.name, dept: employees.department,
      worked: sql<number>`COALESCE(SUM(${attendanceDays.workedMinutes}), 0)`,
      late: sql<number>`COALESCE(SUM(${attendanceDays.lateMinutes}), 0)`,
      lateDays: sql<number>`COUNT(CASE WHEN ${attendanceDays.status} = 'late' THEN 1 END)`,
      absDays: sql<number>`COUNT(CASE WHEN ${attendanceDays.status} = 'absent' THEN 1 END)`,
      jusDays: sql<number>`COUNT(CASE WHEN ${attendanceDays.status} = 'justified' THEN 1 END)`,
    })
    .from(attendanceDays)
    .innerJoin(employees, eq(employees.id, attendanceDays.employeeId))
    .where(and(inP(period), eq(employees.active, true)))
    .groupBy(employees.id)
    .orderBy(asc(employees.name));

  const wsEmp = wb.addWorksheet("Por empleado");
  titleBlock(wsEmp, "Resumen por empleado", `${period.label} · ${empRows.length} empleados`, 7);
  const tEmp = styledTable(wsEmp, 4,
    [
      { label: "Empleado", width: 32 },
      { label: "Depto", width: 18 },
      { label: "Horas trab.", width: 12, align: "right", numFmt: "0.0" },
      { label: "Min. tarde", width: 12, align: "right" },
      { label: "Días tarde", width: 12, align: "right" },
      { label: "Ausencias", width: 12, align: "right" },
      { label: "Justificados", width: 14, align: "right" },
    ],
    empRows.map((r) => [
      r.name, r.dept ?? "",
      Number((Number(r.worked) / 60).toFixed(1)),
      Number(r.late), Number(r.lateDays), Number(r.absDays), Number(r.jusDays),
    ]),
    { tableName: "PorEmpleado", styleName: "TableStyleMedium9" },
  );

  wsEmp.addConditionalFormatting({
    ref: `C${tEmp.dataStartIdx}:C${tEmp.lastRow}`,
    rules: [{ type: "dataBar", priority: 1, cfvo: [{ type: "min" }, { type: "max" }], gradient: true, color: { argb: "FF60A5FA" } } as never],
  });
  wsEmp.addConditionalFormatting({
    ref: `D${tEmp.dataStartIdx}:D${tEmp.lastRow}`,
    rules: [{ type: "dataBar", priority: 2, cfvo: [{ type: "min" }, { type: "max" }], gradient: true, color: { argb: "FFFB923C" } } as never],
  });

  /* --- Hoja 4: Ranking puntualidad --- */
  const wsRank = wb.addWorksheet("Ranking puntualidad");
  titleBlock(wsRank, "Top 10 puntualidad", period.label, 4);

  const sortedAsc = [...empRows].sort((a, b) => Number(a.late) - Number(b.late)).slice(0, 10);
  const sortedDesc = [...empRows].sort((a, b) => Number(b.late) - Number(a.late)).slice(0, 10);

  // Group label
  wsRank.mergeCells("A4:D4");
  const g1 = wsRank.getCell("A4");
  g1.value = "MÁS PUNTUALES";
  g1.font = { bold: true, color: { argb: COLORS.okText } };
  g1.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.ok } };
  g1.alignment = { vertical: "middle", horizontal: "center" };

  const tPunct = styledTable(wsRank, 5,
    [
      { label: "#", width: 5, align: "center" },
      { label: "Empleado", width: 32 },
      { label: "Depto", width: 18 },
      { label: "Min. tarde", width: 14, align: "right" },
    ],
    sortedAsc.map((r, i) => [i + 1, r.name, r.dept ?? "", Number(r.late)]),
    { tableName: "TopPuntuales", styleName: "TableStyleMedium7" },
  );

  const startImp = tPunct.lastRow + 3;
  wsRank.mergeCells(`A${startImp}:D${startImp}`);
  const g2 = wsRank.getCell(`A${startImp}`);
  g2.value = "MÁS IMPUNTUALES";
  g2.font = { bold: true, color: { argb: COLORS.absentText } };
  g2.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.absent } };
  g2.alignment = { vertical: "middle", horizontal: "center" };

  const tImp = styledTable(wsRank, startImp + 1,
    [
      { label: "#", width: 5, align: "center" },
      { label: "Empleado", width: 32 },
      { label: "Depto", width: 18 },
      { label: "Min. tarde", width: 14, align: "right" },
    ],
    sortedDesc.map((r, i) => [i + 1, r.name, r.dept ?? "", Number(r.late)]),
    { tableName: "TopImpuntuales", styleName: "TableStyleMedium3" },
  );
  wsRank.addConditionalFormatting({
    ref: `D${tImp.dataStartIdx}:D${tImp.lastRow}`,
    rules: [{ type: "dataBar", priority: 1, cfvo: [{ type: "min" }, { type: "max" }], gradient: true, color: { argb: "FFEF4444" } } as never],
  });

  /* --- Hoja extra: Asistencia diaria --- */
  const dailyRaw = await db
    .select({
      date: attendanceDays.workDate,
      isWorkday: attendanceDays.isWorkday,
      status: attendanceDays.status,
    })
    .from(attendanceDays)
    .innerJoin(employees, eq(employees.id, attendanceDays.employeeId))
    .where(and(inP(period), eq(employees.active, true)));

  const daily = new Map<string, { present: number; expected: number }>();
  for (const r of dailyRaw) {
    if (!r.isWorkday) continue;
    const cur = daily.get(r.date) ?? { present: 0, expected: 0 };
    cur.expected++;
    if (["ok", "late", "justified"].includes(r.status)) cur.present++;
    daily.set(r.date, cur);
  }
  const points = Array.from(daily.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ x: date, y: v.expected ? Math.round((v.present / v.expected) * 100) : 0 }));

  if (points.length > 0) {
    const wsDaily = wb.addWorksheet("Asistencia diaria");
    titleBlock(wsDaily, "Asistencia diaria del periodo", `${period.label} · % de empleados activos presentes`, 12);
    const area = await areaChartPng(points, { title: "% asistencia por día laborable", width: 880, height: 320, color: "#10b981", yMax: 100, yUnit: "%" });
    const id = wb.addImage({ buffer: area.buffer, extension: "png" });
    wsDaily.addImage(id, { tl: { col: 0, row: 4 }, ext: { width: area.width / 2, height: area.height / 2 } });

    // Tabla auxiliar bajo el chart
    const tableStart = 4 + Math.ceil(area.height / 2 / 15) + 2;
    styledTable(wsDaily, tableStart,
      [
        { label: "Fecha", width: 14 },
        { label: "% asistencia", width: 14, align: "right", numFmt: "0\"%\"" },
      ],
      points.map((p) => [p.x, p.y]),
      { tableName: "DailyAttendance", styleName: "TableStyleMedium6" },
    );
  }

  /* --- Hoja 5: Incidencias --- */
  const incRowsRaw = await db
    .select({
      empName: employees.name, dept: employees.department, date: attendanceDays.workDate,
      status: attendanceDays.status, punches: attendanceDays.effectivePunches, incidents: attendanceDays.incidents,
    })
    .from(attendanceDays).innerJoin(employees, eq(employees.id, attendanceDays.employeeId))
    .where(and(inP(period), sql`${attendanceDays.status} IN ('incomplete','absent')`))
    .orderBy(asc(attendanceDays.workDate));

  const wsInc = wb.addWorksheet("Incidencias");
  titleBlock(wsInc, "Incidencias pendientes de revisión", `${period.label} · ${incRowsRaw.length} días`, 6);
  const tInc = styledTable(wsInc, 4,
    [
      { label: "Empleado", width: 32 },
      { label: "Depto", width: 18 },
      { label: "Fecha", width: 12 },
      { label: "Estado", width: 14, align: "center" },
      { label: "Marcas", width: 32 },
      { label: "Problemas", width: 30 },
    ],
    incRowsRaw.map((r) => [
      r.empName, r.dept ?? "", r.date, r.status,
      (r.punches ?? []).join(" / "), (r.incidents ?? []).join(", "),
    ]),
    { tableName: "Incidencias", styleName: "TableStyleMedium4" },
  );
  paintStatusColumn(wsInc, tInc.dataStartIdx, tInc.lastRow, 4);
  wsInc.views = [{ state: "frozen", ySplit: tInc.headerRowIdx }];

  return { buffer: await workbookToBuffer(wb), filename: `reporte_ejecutivo_${periodSlug(period)}.xlsx` };
}

/* ============================ 8.7 Reporte individual ============================ */
export async function exportEmployeeReport(employeeId: string, period: Period): Promise<{ buffer: Buffer; filename: string }> {
  const emp = (await db.select().from(employees).where(eq(employees.id, employeeId)))[0];
  if (!emp) throw new Error("Empleado no existe");

  const days = await db.select().from(attendanceDays)
    .where(and(eq(attendanceDays.employeeId, employeeId), inP(period)))
    .orderBy(asc(attendanceDays.workDate));

  const totalLate = days.reduce((s, d) => s + d.lateMinutes, 0);
  const totalWorked = days.reduce((s, d) => s + (d.workedMinutes ?? 0), 0);

  const wb = newWorkbook(period);

  /* Cover */
  const ws1 = wb.addWorksheet("Resumen");
  ws1.getColumn(1).width = 26;
  ws1.getColumn(2).width = 36;

  ws1.mergeCells("A1:B1");
  ws1.getCell("A1").value = emp.name;
  ws1.getCell("A1").font = { size: 18, bold: true, color: { argb: "FFFFFFFF" } };
  ws1.getCell("A1").fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.brand } };
  ws1.getCell("A1").alignment = { vertical: "middle", horizontal: "center" };
  ws1.getRow(1).height = 32;

  ws1.mergeCells("A2:B2");
  ws1.getCell("A2").value = `${emp.department ?? "—"} · ID ${emp.personId}`;
  ws1.getCell("A2").font = { color: { argb: COLORS.muted }, italic: true };
  ws1.getCell("A2").fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.brandSoft } };
  ws1.getCell("A2").alignment = { vertical: "middle", horizontal: "center" };

  const items: [string, string | number][] = [
    ["Periodo", `${period.start} → ${period.end}`],
    ["Total días", days.length],
    ["Total min. tarde", totalLate],
    ["Total horas trab.", Number((totalWorked / 60).toFixed(1))],
  ];
  let r = 4;
  for (const [k, v] of items) {
    ws1.getCell(r, 1).value = k;
    ws1.getCell(r, 1).font = { bold: true };
    ws1.getCell(r, 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLORS.brandSoft } };
    ws1.getCell(r, 2).value = v;
    ws1.getCell(r, 2).alignment = { horizontal: "center" };
    ws1.getRow(r).height = 22;
    r++;
  }

  /* Detalle */
  const ws2 = wb.addWorksheet("Detalle diario");
  titleBlock(ws2, "Detalle diario", `${emp.name} · ${period.label}`, 8);
  const t = styledTable(ws2, 4,
    [
      { label: "Fecha", width: 12 },
      { label: "Día", width: 12 },
      { label: "Marcas", width: 32 },
      { label: "Estado", width: 16, align: "center" },
      { label: "Min. tarde", width: 11, align: "right" },
      { label: "Min. salida temp.", width: 14, align: "right" },
      { label: "Horas trab.", width: 12, align: "right", numFmt: "0.00" },
      { label: "Nota", width: 28 },
    ],
    days.map((d) => [
      d.workDate, DOW_FULL[d.dayOfWeek],
      (d.effectivePunches ?? []).join(" · "),
      d.status, d.lateMinutes, d.earlyLeaveMinutes,
      d.workedMinutes != null ? Number((d.workedMinutes / 60).toFixed(2)) : null,
      d.justificationNote ?? "",
    ]),
    { tableName: "DetalleEmpleado" },
  );
  paintStatusColumn(ws2, t.dataStartIdx, t.lastRow, 4);

  const safe = emp.name.replace(/[^a-z0-9]+/gi, "_").toLowerCase();
  return { buffer: await workbookToBuffer(wb), filename: `${safe}_${periodSlug(period)}.xlsx` };
}
