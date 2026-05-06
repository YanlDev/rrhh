"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createHolidayAction, updateHolidayAction, deleteHolidayAction } from "@/actions/holidays";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Loader2 } from "lucide-react";

type Row = { id: string; holidayDate: string; description: string; isNational: boolean };

export function HolidaysEditor({ rows }: { rows: Row[] }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [newRow, setNewRow] = useState({ date: "", description: "", isNational: true });

  const update = (id: string, patch: Partial<Row>) =>
    start(async () => {
      try {
        await updateHolidayAction({ id, ...patch });
        router.refresh();
      } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    });

  const create = () =>
    start(async () => {
      setError(null);
      try {
        await createHolidayAction(newRow);
        setNewRow({ date: "", description: "", isNational: true });
        router.refresh();
      } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
    });

  const remove = (id: string, desc: string) => {
    if (!confirm(`¿Eliminar feriado "${desc}"? Se recalcularán los días afectados.`)) return;
    start(async () => {
      await deleteHolidayAction(id);
      router.refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">Fecha</TableHead>
              <TableHead>Descripción</TableHead>
              <TableHead className="text-center w-[120px]">Nacional</TableHead>
              <TableHead className="w-[120px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                  Sin feriados registrados.
                </TableCell>
              </TableRow>
            ) : rows.map((r) => (
              // key incluye los datos para forzar remount al actualizar.
              <TableRow key={`${r.id}:${r.description}:${r.isNational}`}>
                <TableCell className="font-mono text-xs">{r.holidayDate}</TableCell>
                <TableCell>
                  <Input
                    defaultValue={r.description}
                    onBlur={(e) => e.target.value !== r.description && update(r.id, { description: e.target.value })}
                    className="h-8"
                  />
                </TableCell>
                <TableCell className="text-center">
                  <Switch defaultChecked={r.isNational} onCheckedChange={(v) => update(r.id, { isNational: v })} />
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="sm" onClick={() => remove(r.id, r.description)}>
                    <Trash2 className="size-3.5 text-destructive" /> Eliminar
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="rounded-md border p-3 flex gap-2 items-end flex-wrap bg-muted/30">
        <div>
          <label className="text-xs text-muted-foreground">Fecha</label>
          <Input type="date" value={newRow.date} onChange={(e) => setNewRow({ ...newRow, date: e.target.value })} className="h-8 font-mono" />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="text-xs text-muted-foreground">Descripción</label>
          <Input value={newRow.description} onChange={(e) => setNewRow({ ...newRow, description: e.target.value })} placeholder="Día del Trabajo" className="h-8" />
        </div>
        <label className="flex items-center gap-2 text-sm h-8">
          <Switch checked={newRow.isNational} onCheckedChange={(v) => setNewRow({ ...newRow, isNational: v })} />
          Nacional
        </label>
        <Button onClick={create} disabled={pending || !newRow.date || !newRow.description}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
          Agregar
        </Button>
      </div>

      {error && <div className="text-sm text-destructive">{error}</div>}
    </div>
  );
}
