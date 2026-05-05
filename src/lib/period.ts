import { db } from "./db";
import { importBatches } from "./db/schema";
import { desc } from "drizzle-orm";

export type RangeMode = "month" | "fortnight" | "week";

export type Period = {
  start: string;
  end: string;
  label: string;
  mode: RangeMode;
  /** key compacto para el query string */
  key: string;
};

const MONTHS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function pad(n: number) { return String(n).padStart(2, "0"); }
function iso(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

export function monthPeriod(year: number, monthIdx0: number): Period {
  const start = new Date(year, monthIdx0, 1);
  const end = new Date(year, monthIdx0 + 1, 0);
  return {
    start: iso(start),
    end: iso(end),
    label: `${MONTHS[monthIdx0]} ${year}`,
    mode: "month",
    key: `m:${year}-${pad(monthIdx0 + 1)}`,
  };
}

export function fortnightPeriod(year: number, monthIdx0: number, half: 1 | 2): Period {
  const start = new Date(year, monthIdx0, half === 1 ? 1 : 16);
  const end = half === 1 ? new Date(year, monthIdx0, 15) : new Date(year, monthIdx0 + 1, 0);
  return {
    start: iso(start),
    end: iso(end),
    label: `${MONTHS[monthIdx0]} ${year} · ${half === 1 ? "1ra" : "2da"} quincena`,
    mode: "fortnight",
    key: `q:${year}-${pad(monthIdx0 + 1)}-${half}`,
  };
}

/** Semana ISO (lunes a domingo) que contiene la fecha indicada. */
export function weekPeriod(anchorISO: string): Period {
  const d = new Date(anchorISO + "T00:00:00");
  const dow = (d.getDay() + 6) % 7; // 0 = lun
  const monday = new Date(d);
  monday.setDate(d.getDate() - dow);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: iso(monday),
    end: iso(sunday),
    label: `Semana ${iso(monday)} → ${iso(sunday)}`,
    mode: "week",
    key: `w:${iso(monday)}`,
  };
}

/** Decodifica un period key (formato "m:YYYY-MM" | "q:YYYY-MM-N" | "w:YYYY-MM-DD"). */
export function decodePeriodKey(key: string): Period | null {
  const [kind, ...rest] = key.split(":");
  const v = rest.join(":");
  if (kind === "m") {
    const m = v.match(/^(\d{4})-(\d{2})$/);
    if (!m) return null;
    return monthPeriod(Number(m[1]), Number(m[2]) - 1);
  }
  if (kind === "q") {
    const m = v.match(/^(\d{4})-(\d{2})-([12])$/);
    if (!m) return null;
    return fortnightPeriod(Number(m[1]), Number(m[2]) - 1, Number(m[3]) as 1 | 2);
  }
  if (kind === "w") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
    return weekPeriod(v);
  }
  return null;
}

export async function getDefaultPeriod(): Promise<Period | null> {
  const last = await db.select().from(importBatches).orderBy(desc(importBatches.uploadedAt)).limit(1);
  if (!last[0]) return null;
  // por defecto, el mes del último import
  const d = new Date(last[0].periodStart + "T00:00:00");
  return monthPeriod(d.getFullYear(), d.getMonth());
}

export async function resolvePeriod(searchParams: { period?: string } | undefined): Promise<Period | null> {
  if (searchParams?.period) {
    // 1) intentar formato nuevo "m:" "q:" "w:"
    if (/^[mqw]:/.test(searchParams.period)) {
      const decoded = decodePeriodKey(searchParams.period);
      if (decoded) return decoded;
    }
    // 2) compatibilidad: "YYYY-MM"
    const m = searchParams.period.match(/^(\d{4})-(\d{2})$/);
    if (m) return monthPeriod(Number(m[1]), Number(m[2]) - 1);
  }
  return getDefaultPeriod();
}

export async function listAvailablePeriods(): Promise<Period[]> {
  const rows = await db.select().from(importBatches).orderBy(desc(importBatches.uploadedAt));
  const months = new Set<string>();
  for (const r of rows) months.add(r.periodStart.slice(0, 7));

  const out: Period[] = [];
  const seen = new Set<string>();
  const push = (p: Period) => {
    if (!seen.has(p.key)) { seen.add(p.key); out.push(p); }
  };
  for (const ym of Array.from(months).sort().reverse()) {
    const [y, m] = ym.split("-").map(Number);
    push(monthPeriod(y, m - 1));
    push(fortnightPeriod(y, m - 1, 1));
    push(fortnightPeriod(y, m - 1, 2));
    const first = new Date(y, m - 1, 1);
    const last = new Date(y, m, 0);
    for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
      push(weekPeriod(iso(d)));
    }
  }
  return out;
}
