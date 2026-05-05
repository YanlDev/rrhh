"use client";

import { useState } from "react";
import { CorrectionModal, type DayForModal, type JustificationOption } from "./correction-modal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "./status-badge";
import { DOW_SHORT } from "@/lib/status";
import { Pencil, PencilLine } from "lucide-react";

export function DayRowsTable({
  rows,
  employeeName,
  justificationTypes,
}: {
  rows: (DayForModal & { lateMinutes: number; earlyLeaveMinutes: number; workedMinutes: number | null })[];
  employeeName: string;
  justificationTypes: JustificationOption[];
}) {
  const [open, setOpen] = useState<DayForModal | null>(null);

  return (
    <>
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
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((d) => (
            <TableRow key={d.id}>
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
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" onClick={() => setOpen(d)}>
                  <Pencil className="size-3.5" /> Editar
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <CorrectionModal
        open={!!open}
        onClose={() => setOpen(null)}
        day={open}
        employeeName={employeeName}
        justificationTypes={justificationTypes}
      />
    </>
  );
}
