"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createJustificationTypeAction,
  updateJustificationTypeAction,
  deactivateJustificationTypeAction,
} from "@/actions/justification-types";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, RotateCcw, Loader2 } from "lucide-react";

type Row = {
  id: string;
  code: string;
  labelEs: string;
  countsAsWorked: boolean;
  color: string | null;
  orderIndex: number;
  active: boolean;
};

export function JustificationTypesEditor({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [newRow, setNewRow] = useState({ code: "", labelEs: "", countsAsWorked: true });

  const update = (id: string, patch: Partial<Row>) =>
    start(async () => {
      await updateJustificationTypeAction({ id, ...patch });
      router.refresh();
    });

  const create = () => {
    if (!newRow.code || !newRow.labelEs) return;
    start(async () => {
      await createJustificationTypeAction(newRow);
      setNewRow({ code: "", labelEs: "", countsAsWorked: true });
      router.refresh();
    });
  };

  const deactivate = (id: string) => {
    if (!confirm("¿Desactivar esta justificación?")) return;
    start(async () => {
      await deactivateJustificationTypeAction(id);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Label</TableHead>
              <TableHead className="text-center">Cuenta como trabajado</TableHead>
              <TableHead>Color</TableHead>
              <TableHead className="text-right">Orden</TableHead>
              <TableHead className="text-center">Activo</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-mono text-xs">{r.code}</TableCell>
                <TableCell>
                  <Input
                    defaultValue={r.labelEs}
                    onBlur={(e) => e.target.value !== r.labelEs && update(r.id, { labelEs: e.target.value })}
                    className="h-8"
                  />
                </TableCell>
                <TableCell className="text-center">
                  <Switch defaultChecked={r.countsAsWorked} onCheckedChange={(v) => update(r.id, { countsAsWorked: v })} />
                </TableCell>
                <TableCell>
                  <input
                    type="color"
                    defaultValue={r.color ?? "#6b7280"}
                    onBlur={(e) => e.target.value !== r.color && update(r.id, { color: e.target.value })}
                    className="w-9 h-7 rounded border cursor-pointer"
                  />
                </TableCell>
                <TableCell className="text-right">
                  <Input
                    type="number"
                    defaultValue={r.orderIndex}
                    onBlur={(e) => Number(e.target.value) !== r.orderIndex && update(r.id, { orderIndex: Number(e.target.value) })}
                    className="h-8 w-20 text-right"
                  />
                </TableCell>
                <TableCell className="text-center">
                  {r.active ? <span className="text-emerald-600">●</span> : <span className="text-muted-foreground">○</span>}
                </TableCell>
                <TableCell className="text-right">
                  {r.active ? (
                    <Button variant="ghost" size="sm" onClick={() => deactivate(r.id)}>
                      <Trash2 className="size-3.5 text-destructive" /> Desactivar
                    </Button>
                  ) : (
                    <Button variant="ghost" size="sm" onClick={() => update(r.id, { active: true })}>
                      <RotateCcw className="size-3.5" /> Reactivar
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="rounded-md border p-3 flex gap-2 items-end flex-wrap bg-muted/30">
        <div>
          <label className="text-xs text-muted-foreground">Code</label>
          <Input value={newRow.code} onChange={(e) => setNewRow({ ...newRow, code: e.target.value })} placeholder="bereavement" className="h-8 font-mono" />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs text-muted-foreground">Label</label>
          <Input value={newRow.labelEs} onChange={(e) => setNewRow({ ...newRow, labelEs: e.target.value })} placeholder="Duelo familiar" className="h-8" />
        </div>
        <label className="flex items-center gap-2 text-sm h-8">
          <Switch checked={newRow.countsAsWorked} onCheckedChange={(v) => setNewRow({ ...newRow, countsAsWorked: v })} />
          Cuenta como trabajado
        </label>
        <Button onClick={create} disabled={pending || !newRow.code || !newRow.labelEs}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Agregar
        </Button>
      </div>
    </div>
  );
}
