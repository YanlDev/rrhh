"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CorrectionModal, type DayForModal, type JustificationOption } from "./correction-modal";
import { justifyManyAction } from "@/actions/justifications";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatusBadge } from "./status-badge";
import { DOW_SHORT } from "@/lib/status";
import { Pencil, Loader2, X } from "lucide-react";

type Row = DayForModal & {
  empId: string;
  empName: string;
  empDept: string | null;
  lateMin: number;
  incidentsList: string[];
};

export function ReviewTable({
  rows,
  justificationTypes,
  periodParam,
}: {
  rows: Row[];
  justificationTypes: JustificationOption[];
  periodParam: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<{ day: DayForModal; empName: string } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchJus, setBatchJus] = useState("");
  const [pending, setPending] = useState(false);

  const toggle = (id: string) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    setSelected(selected.size === rows.length ? new Set() : new Set(rows.map((r) => r.id)));
  };

  const applyBatch = async () => {
    if (!batchJus || selected.size === 0) return;
    setPending(true);
    try {
      await justifyManyAction({ attendanceDayIds: Array.from(selected), justificationTypeId: batchJus, note: null });
      setSelected(new Set());
      setBatchJus("");
      router.refresh();
    } finally { setPending(false); }
  };

  return (
    <div className="space-y-3">
      {selected.size > 0 && (
        <div className="rounded-md border bg-blue-50/60 px-3 py-2 flex items-center gap-2 text-sm">
          <span className="font-medium">{selected.size} seleccionado(s):</span>
          <Select value={batchJus} onValueChange={setBatchJus}>
            <SelectTrigger className="w-[260px] h-8"><SelectValue placeholder="Justificar como…" /></SelectTrigger>
            <SelectContent>
              {justificationTypes.map((j) => <SelectItem key={j.id} value={j.id}>{j.labelEs}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={applyBatch} disabled={!batchJus || pending}>
            {pending && <Loader2 className="size-3.5 animate-spin" />}
            Aplicar
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            <X className="size-3.5" /> cancelar
          </Button>
        </div>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[36px]">
                <Checkbox checked={selected.size === rows.length && rows.length > 0} onCheckedChange={toggleAll} />
              </TableHead>
              <TableHead>Empleado</TableHead>
              <TableHead>Depto</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Día</TableHead>
              <TableHead>Marcas</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Tarde</TableHead>
              <TableHead>Problemas</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell><Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} /></TableCell>
                <TableCell>
                  <Link href={`/employees/${r.empId}${periodParam ? `?period=${periodParam}` : ""}`} className="hover:underline">
                    {r.empName}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{r.empDept ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs">{r.workDate}</TableCell>
                <TableCell>{DOW_SHORT[r.dayOfWeek]}</TableCell>
                <TableCell className="font-mono text-xs">
                  {r.effectivePunches.length > 0 ? r.effectivePunches.join(" · ") : <span className="text-muted-foreground">sin marcas</span>}
                </TableCell>
                <TableCell><StatusBadge status={r.status} /></TableCell>
                <TableCell className="text-right tabular-nums">{r.lateMin || ""}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{r.incidentsList.join(", ")}</TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => setOpen({ day: r, empName: r.empName })}>
                    <Pencil className="size-3.5" /> Editar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <CorrectionModal
        open={!!open}
        onClose={() => setOpen(null)}
        day={open?.day ?? null}
        employeeName={open?.empName ?? ""}
        justificationTypes={justificationTypes}
      />
    </div>
  );
}
