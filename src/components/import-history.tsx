"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  deleteImportBatchAction,
  getImportBatchImpactAction,
  type BatchImpact,
} from "@/actions/imports";
import { Trash2, Loader2, AlertTriangle } from "lucide-react";

export type ImportRow = {
  id: string;
  filename: string;
  periodStart: string;
  periodEnd: string;
  employeesCount: number;
  daysCount: number;
  uploadedAt: string | null;
};

export function ImportHistoryTable({
  rows,
  canDelete,
}: {
  rows: ImportRow[];
  canDelete: boolean;
}) {
  const router = useRouter();
  const [target, setTarget] = useState<ImportRow | null>(null);
  const [impact, setImpact] = useState<BatchImpact | null>(null);
  const [loading, start] = useTransition();
  const [deleting, startDelete] = useTransition();

  function openDelete(row: ImportRow) {
    setTarget(row);
    setImpact(null);
    start(async () => {
      const res = await getImportBatchImpactAction({ id: row.id });
      if (res.ok && res.data) setImpact(res.data);
      else alert(res.ok ? "Sin datos" : res.error);
    });
  }

  function confirmDelete() {
    if (!target) return;
    const t = target;
    startDelete(async () => {
      const res = await deleteImportBatchAction({ id: t.id });
      if (!res.ok) {
        alert(res.error);
        return;
      }
      setTarget(null);
      setImpact(null);
      router.refresh();
    });
  }

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Archivo</TableHead>
            <TableHead>Periodo</TableHead>
            <TableHead className="text-right">Empleados</TableHead>
            <TableHead className="text-right">Días</TableHead>
            <TableHead>Subido</TableHead>
            {canDelete && <TableHead></TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((b) => (
            <TableRow key={b.id}>
              <TableCell className="font-mono text-xs">{b.filename}</TableCell>
              <TableCell>{b.periodStart} → {b.periodEnd}</TableCell>
              <TableCell className="text-right tabular-nums">{b.employeesCount}</TableCell>
              <TableCell className="text-right tabular-nums">{b.daysCount}</TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {b.uploadedAt ? new Date(b.uploadedAt).toLocaleString("es-PE") : "—"}
              </TableCell>
              {canDelete && (
                <TableCell className="text-right">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive hover:text-destructive"
                    onClick={() => openDelete(b)}
                    disabled={loading || deleting}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog open={!!target} onOpenChange={(v) => { if (!v) { setTarget(null); setImpact(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="size-5 text-destructive" /> Eliminar importación
            </DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. Se borrará la importación y todos los días
              de asistencia del periodo.
            </DialogDescription>
          </DialogHeader>

          {!impact ? (
            <div className="py-6 text-center text-sm text-muted-foreground">
              <Loader2 className="size-5 animate-spin mx-auto mb-2" />
              Calculando impacto...
            </div>
          ) : (
            <div className="space-y-3 text-sm">
              <div className="rounded-md border bg-muted/30 p-3 space-y-1 font-mono text-xs">
                <div><span className="text-muted-foreground">Archivo:</span> {impact.filename}</div>
                <div><span className="text-muted-foreground">Periodo:</span> {impact.periodStart} → {impact.periodEnd}</div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Stat label="Días que se borrarán" value={impact.totalDays} highlight />
                <Stat label="Empleados afectados" value={impact.employeesAffected} />
                <Stat
                  label="Con correcciones manuales"
                  value={impact.correctedDays}
                  highlight={impact.correctedDays > 0}
                />
                <Stat
                  label="Con justificaciones"
                  value={impact.justifiedDays}
                  highlight={impact.justifiedDays > 0}
                />
              </div>
              {(impact.correctedDays > 0 || impact.justifiedDays > 0) && (
                <div className="flex items-start gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md p-2.5">
                  <AlertTriangle className="size-4 mt-0.5 shrink-0" />
                  <span>
                    Vas a perder <strong>{impact.correctedDays + impact.justifiedDays}</strong> día(s)
                    con trabajo manual. Si querés conservarlos, no elimines este reporte.
                  </span>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => { setTarget(null); setImpact(null); }} disabled={deleting}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={!impact || deleting}
            >
              {deleting ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Eliminar importación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <div className="rounded-md border p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={"text-xl font-semibold tabular-nums " + (highlight ? "text-destructive" : "")}>{value}</div>
    </div>
  );
}
