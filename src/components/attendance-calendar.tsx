"use client";

import { STATUS_META } from "@/lib/status";

export type CalendarCell = {
  date: string;
  dayOfWeek: number;
  status: string;
  punches: string[];
  lateMinutes: number;
  workedMinutes: number | null;
};

const DOW_LABELS = ["L", "M", "M", "J", "V", "S", "D"];

export function AttendanceCalendar({
  days,
  periodStart,
  periodEnd,
  onDayClick,
}: {
  days: CalendarCell[];
  periodStart: string;
  periodEnd: string;
  onDayClick?: (date: string) => void;
}) {
  const start = new Date(periodStart + "T00:00:00");
  const end = new Date(periodEnd + "T00:00:00");
  const byDate = new Map(days.map((d) => [d.date, d]));

  const firstDow = (start.getDay() + 6) % 7;
  const cells: ({ kind: "blank" } | { kind: "day"; iso: string; cell: CalendarCell | null })[] = [];
  for (let i = 0; i < firstDow; i++) cells.push({ kind: "blank" });
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    cells.push({ kind: "day", iso, cell: byDate.get(iso) ?? null });
  }

  return (
    <div>
      <div className="grid grid-cols-7 gap-1 text-xs text-muted-foreground mb-1">
        {DOW_LABELS.map((l, i) => <div key={i} className="text-center font-medium">{l}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((c, i) =>
          c.kind === "blank"
            ? <div key={i} />
            : <DayBox key={c.iso} iso={c.iso} cell={c.cell} onClick={onDayClick} />
        )}
      </div>
      <Legend />
    </div>
  );
}

function DayBox({
  iso, cell, onClick,
}: { iso: string; cell: CalendarCell | null; onClick?: (date: string) => void }) {
  const day = Number(iso.slice(8, 10));
  const meta = cell ? STATUS_META[cell.status] : null;
  const cls = meta ? meta.cellClass : "bg-muted/40 text-muted-foreground";
  const interactive = !!onClick && !!cell;
  const tip = cell
    ? `${iso} · ${meta?.label ?? cell.status}` +
      (cell.punches.length ? ` · ${cell.punches.join(" / ")}` : "") +
      (cell.lateMinutes ? ` · +${cell.lateMinutes}min tarde` : "")
    : iso;

  const inner = (
    <>
      <div className="font-semibold">{day}</div>
      {cell && cell.punches.length > 0 && (
        <div className="text-[9px] leading-tight font-mono">{cell.punches[0]}</div>
      )}
    </>
  );

  const baseCls = `rounded-md p-1.5 text-xs aspect-square flex flex-col justify-between transition ${cls}`;

  if (interactive) {
    return (
      <button
        type="button"
        title={tip}
        onClick={() => onClick!(iso)}
        className={`${baseCls} text-left hover:scale-[1.03] hover:shadow-md cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary`}
      >
        {inner}
      </button>
    );
  }

  return (
    <div className={baseCls} title={tip}>
      {inner}
    </div>
  );
}

function Legend() {
  const items = Object.entries(STATUS_META);
  return (
    <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
      {items.map(([k, m]) => (
        <span key={k} className="inline-flex items-center gap-1">
          <span className={`inline-block w-3 h-3 rounded ${m.legendClass}`} />
          {m.label}
        </span>
      ))}
    </div>
  );
}
