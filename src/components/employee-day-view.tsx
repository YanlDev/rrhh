"use client";

import { useState } from "react";
import { CorrectionModal, type DayForModal, type JustificationOption } from "./correction-modal";
import { AttendanceCalendar } from "./attendance-calendar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./status-badge";
import { DOW_SHORT } from "@/lib/status";
import { Pencil, PencilLine } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarClock } from "lucide-react";

export type EmployeeDayRow = DayForModal & {
  lateMinutes: number;
  earlyLeaveMinutes: number;
  workedMinutes: number | null;
};

export function EmployeeDayView({
  rows,
  employeeName,
  justificationTypes,
  periodLabel,
  periodStart,
  periodEnd,
  canEdit = true,
}: {
  rows: EmployeeDayRow[];
  employeeName: string;
  justificationTypes: JustificationOption[];
  periodLabel: string;
  periodStart: string;
  periodEnd: string;
  canEdit?: boolean;
}) {
  const [open, setOpen] = useState<DayForModal | null>(null);
  const byDate = new Map(rows.map((r) => [r.workDate, r]));

  const openByDate = (date: string) => {
    if (!canEdit) return;
    const r = byDate.get(date);
    if (r) setOpen(r);
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarClock className="size-4" /> Calendario · {periodLabel}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <AttendanceCalendar
            periodStart={periodStart}
            periodEnd={periodEnd}
            onDayClick={openByDate}
            days={rows.map((d) => ({
              date: d.workDate,
              dayOfWeek: d.dayOfWeek,
              status: d.status,
              punches: d.effectivePunches,
              lateMinutes: d.lateMinutes,
              workedMinutes: d.workedMinutes,
            }))}
          />
          {canEdit && (
            <p className="text-xs text-muted-foreground mt-3">
              Click en un día para editar marcas o justificar.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalle diario</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Día</TableHead>
                <TableHead>Marcas</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Tarde</TableHead>
                <TableHead className="text-right">Salida temp.</TableHead>
                <TableHead className="text-right">H. trab.</TableHead>
                {canEdit && <TableHead></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((d) => (
                <TableRow
                  key={d.id}
                  className={canEdit ? "cursor-pointer" : ""}
                  onClick={canEdit ? () => setOpen(d) : undefined}
                >
                  <TableCell className="font-mono text-xs">{d.workDate}</TableCell>
                  <TableCell>{DOW_SHORT[d.dayOfWeek]}</TableCell>
                  <TableCell className="font-mono text-xs">
                    {d.effectivePunches.length > 0 ? d.effectivePunches.join(" · ") : <span className="text-muted-foreground">—</span>}
                    {d.correctedPunches && (
                      <PencilLine className="size-3 inline-block ml-1 text-blue-600" />
                    )}
                  </TableCell>
                  <TableCell><StatusBadge status={d.status} /></TableCell>
                  <TableCell className="text-right tabular-nums">{d.lateMinutes || ""}</TableCell>
                  <TableCell className="text-right tabular-nums">{d.earlyLeaveMinutes || ""}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {d.workedMinutes != null ? `${(d.workedMinutes / 60).toFixed(1)}h` : "—"}
                  </TableCell>
                  {canEdit && (
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" onClick={() => setOpen(d)}>
                        <Pencil className="size-3.5" /> Editar
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {canEdit && (
        <CorrectionModal
          open={!!open}
          onClose={() => setOpen(null)}
          day={open}
          employeeName={employeeName}
          justificationTypes={justificationTypes}
        />
      )}
    </>
  );
}
