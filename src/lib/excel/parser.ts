import * as XLSX from "xlsx";
import type { ParsedWorkbook, ParsedEmployee, ParsedDay } from "../types";

const TIME_RE = /^(\d{1,2}):(\d{2})(?::\d{2})?$/;
const SHEET_TITLE_RE = /Punch\s*Time\s*\((\d{8})-(\d{8})\)/i;

function toHM(raw: string): string | null {
  const m = raw.trim().match(TIME_RE);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function minutesOf(hm: string): number {
  const [h, m] = hm.split(":").map(Number);
  return h * 60 + m;
}

export function parsePunchCell(raw: unknown, dupThresholdMinutes = 2): string[] {
  if (raw == null || raw === "") return [];
  const text = String(raw);
  const parts = text.split(/[\r\n,;]+/).map((s) => s.trim()).filter(Boolean);
  const times: string[] = [];
  for (const p of parts) {
    const hm = toHM(p);
    if (hm) times.push(hm);
  }
  times.sort();
  return dedupe(times, dupThresholdMinutes);
}

export function dedupe(times: string[], thresholdMinutes = 2): string[] {
  if (times.length <= 1) return times.slice();
  const out: string[] = [times[0]];
  for (let i = 1; i < times.length; i++) {
    const prev = minutesOf(out[out.length - 1]);
    const cur = minutesOf(times[i]);
    if (cur - prev >= thresholdMinutes) out.push(times[i]);
  }
  return out;
}

function parseYYYYMMDD(s: string): string {
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

function* eachDate(startISO: string, endISO: string) {
  const start = new Date(startISO + "T00:00:00");
  const end = new Date(endISO + "T00:00:00");
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    yield new Date(d);
  }
}

export function parseWorkbookBuffer(buf: ArrayBuffer | Buffer, filename: string, dupThresholdMinutes = 2): ParsedWorkbook {
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) throw new Error("Excel sin hojas");
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: "", raw: false });
  const warnings: string[] = [];

  const titleMatch = sheetName.match(SHEET_TITLE_RE);
  if (!titleMatch) throw new Error(`Nombre de hoja no reconocido: "${sheetName}". Esperado: Punch Time(YYYYMMDD-YYYYMMDD)`);
  const periodStart = parseYYYYMMDD(titleMatch[1]);
  const periodEnd = parseYYYYMMDD(titleMatch[2]);

  // header en fila 1 (índice 1)
  const header = rows[1] as string[] | undefined;
  if (!header) throw new Error("Falta cabecera en fila 2");
  const headerStr = header.map((c) => String(c).trim());
  if (headerStr[0] !== "Person ID" || headerStr[1] !== "Person Name" || headerStr[2] !== "Department") {
    throw new Error(`Cabecera inesperada: ${headerStr.slice(0, 3).join(" | ")}`);
  }

  // Mapear columnas de fecha (M-D) → fecha ISO
  const dateCols: { col: number; iso: string; dow: number }[] = [];
  const dates = Array.from(eachDate(periodStart, periodEnd));
  for (let c = 3; c < headerStr.length; c++) {
    const label = headerStr[c]; // "4-1", "4-2", etc.
    const m = label.match(/^(\d{1,2})-(\d{1,2})$/);
    if (!m) {
      warnings.push(`Columna ${c} con label inesperado: "${label}"`);
      continue;
    }
    const month = Number(m[1]);
    const day = Number(m[2]);
    const match = dates.find((d) => d.getMonth() + 1 === month && d.getDate() === day);
    if (!match) {
      warnings.push(`Columna "${label}" fuera del periodo`);
      continue;
    }
    const iso = `${match.getFullYear()}-${String(match.getMonth() + 1).padStart(2, "0")}-${String(match.getDate()).padStart(2, "0")}`;
    dateCols.push({ col: c, iso, dow: match.getDay() });
  }

  const employees: ParsedEmployee[] = [];
  for (let r = 2; r < rows.length; r++) {
    const row = rows[r];
    if (!row) continue;
    const personId = String(row[0] ?? "").trim();
    const name = String(row[1] ?? "").trim();
    const department = String(row[2] ?? "").trim() || null;
    if (!personId || !name) continue;

    const days: ParsedDay[] = [];
    let totalPunches = 0;
    for (const { col, iso, dow } of dateCols) {
      const punches = parsePunchCell(row[col], dupThresholdMinutes);
      totalPunches += punches.length;
      days.push({ date: iso, dayOfWeek: dow, punches });
    }
    employees.push({ personId, name, department, days, totalPunches });
  }

  return { filename, periodStart, periodEnd, employees, warnings };
}
