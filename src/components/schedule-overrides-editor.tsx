"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createScheduleOverrideAction,
  updateScheduleOverrideAction,
  deleteScheduleOverrideAction,
} from "@/actions/schedule-overrides";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Loader2, Save, AlertCircle, CheckCircle2, Plus, Trash2, Pencil, CalendarDays,
} from "lucide-react";

export type OverrideRow = {
  workDate: string;
  description: string;
  startTime: string;
  endTime: string;
  hours: number;
  lunchMinutes: number;
  lunchWindowStart: string;
  lunchWindowEnd: string;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

const DEFAULT: OverrideRow = {
  workDate: todayISO(),
  description: "",
  startTime: "08:30",
  endTime: "13:00",
  hours: 4.5,
  lunchMinutes: 0,
  lunchWindowStart: "12:00",
  lunchWindowEnd: "14:00",
};

export function ScheduleOverridesEditor({ rows }: { rows: OverrideRow[] }) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<OverrideRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<OverrideRow | null>(null);
  const [pending, start] = useTransition();
  const [info, setInfo] = useState<{ recalculated: number } | null>(null);

  const onDelete = () =>
    start(async () => {
      if (!confirmDelete) return;
      const target = confirmDelete;
      setConfirmDelete(null);
      const res = await deleteScheduleOverrideAction({ workDate: target.workDate });
      if (!res.ok) {
        alert(res.error);
        return;
      }
      setInfo({ recalculated: res.data?.recalculated ?? 0 });
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Días con horario distinto al periodo (ej. Jueves Santo medio día). Aplica solo
          a esa fecha; el resto del periodo no se afecta. Si la fecha también está en
          feriados, el override gana y el día se trata como laborable.
        </p>
        <Dialog open={creating} onOpenChange={setCreating}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-4" /> Nuevo día especial
            </Button>
          </DialogTrigger>
          <OverrideFormDialog
            mode="create"
            initial={DEFAULT}
            onClose={() => setCreating(false)}
            onSaved={(r) => { setInfo(r); router.refresh(); }}
          />
        </Dialog>
      </div>

      {info && (
        <div className="flex items-start gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md p-3">
          <CheckCircle2 className="size-4 mt-0.5 shrink-0" />
          <span>Guardado. Se recalcularon {info.recalculated} día(s).</span>
        </div>
      )}

      {rows.length === 0 ? (
        <Card>
          <CardContent className="text-sm text-muted-foreground py-10 text-center">
            No hay días especiales configurados.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rows.map((r) => (
            <Card key={r.workDate}>
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                <div className="space-y-1">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CalendarDays className="size-4" /> {formatDate(r.workDate)}
                  </CardTitle>
                  <CardDescription>{r.description}</CardDescription>
                </div>
                <div className="flex gap-1">
                  <Dialog
                    open={editing?.workDate === r.workDate}
                    onOpenChange={(v) => !v && setEditing(null)}
                  >
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => setEditing(r)}>
                        <Pencil className="size-4" />
                      </Button>
                    </DialogTrigger>
                    {editing?.workDate === r.workDate && (
                      <OverrideFormDialog
                        mode="edit"
                        initial={editing}
                        onClose={() => setEditing(null)}
                        onSaved={(info) => { setInfo(info); router.refresh(); setEditing(null); }}
                      />
                    )}
                  </Dialog>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive hover:text-destructive"
                    onClick={() => setConfirmDelete(r)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <Stat label="Entrada" value={r.startTime} mono />
                <Stat label="Salida" value={r.endTime} mono />
                <Stat label="Horas efectivas" value={`${r.hours}h`} />
                <Stat label="Almuerzo" value={r.lunchMinutes > 0 ? `${r.lunchMinutes} min` : "—"} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar día especial</DialogTitle>
            <DialogDescription>
              Se eliminará el override del <strong>{confirmDelete && formatDate(confirmDelete.workDate)}</strong>.
              Ese día volverá a calcularse con la regla del periodo (y como feriado si corresponde).
              Recalculo automático.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)} disabled={pending}>Cancelar</Button>
            <Button variant="destructive" onClick={onDelete} disabled={pending}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function OverrideFormDialog({
  mode, initial, onClose, onSaved,
}: {
  mode: "create" | "edit";
  initial: OverrideRow;
  onClose: () => void;
  onSaved: (info: { recalculated: number }) => void;
}) {
  const [form, setForm] = useState(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof OverrideRow>(k: K, v: OverrideRow[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = () =>
    start(async () => {
      setError(null);
      const payload = {
        workDate: form.workDate,
        description: form.description,
        startTime: form.startTime,
        endTime: form.endTime,
        hours: Number(form.hours),
        lunchMinutes: Number(form.lunchMinutes),
        lunchWindowStart: form.lunchWindowStart,
        lunchWindowEnd: form.lunchWindowEnd,
      };
      const res =
        mode === "create"
          ? await createScheduleOverrideAction(payload)
          : await updateScheduleOverrideAction(payload);
      if (!res.ok) { setError(res.error); return; }
      onSaved({ recalculated: res.data?.recalculated ?? 0 });
      onClose();
    });

  return (
    <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>
          {mode === "create" ? "Nuevo día especial" : "Editar día especial"}
        </DialogTitle>
        <DialogDescription>
          Define el horario aplicable a esa fecha. Recalcula al guardar.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="Fecha" type="date" mono
            value={form.workDate} onChange={(v) => set("workDate", v)} disabled={mode === "edit"} />
          <Field label="Motivo" placeholder="Jueves Santo, salida 13:00"
            value={form.description} onChange={(v) => set("description", v)} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Horario del día</CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-3">
            <Field label="Entrada" mono value={form.startTime} onChange={(v) => set("startTime", v)} />
            <Field label="Salida" mono value={form.endTime} onChange={(v) => set("endTime", v)} />
            <Field label="Horas efectivas" type="number" step="0.25"
              value={String(form.hours)} onChange={(v) => set("hours", Number(v))} />
            <Field label="Almuerzo (min) — 0 si no hay" type="number"
              value={String(form.lunchMinutes)} onChange={(v) => set("lunchMinutes", Number(v))} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Ventana para salir a almorzar</CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-3">
            <Field label="Desde" mono
              value={form.lunchWindowStart} onChange={(v) => set("lunchWindowStart", v)} />
            <Field label="Hasta" mono
              value={form.lunchWindowEnd} onChange={(v) => set("lunchWindowEnd", v)} />
          </CardContent>
        </Card>

        {error && (
          <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-md p-3">
            <AlertCircle className="size-4 mt-0.5 shrink-0" /> <span>{error}</span>
          </div>
        )}
      </div>

      <DialogFooter>
        <Button variant="ghost" onClick={onClose} disabled={pending}>Cancelar</Button>
        <Button onClick={submit} disabled={pending}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Guardar y recalcular
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function Field({
  label, value, onChange, type = "text", mono, placeholder, step, disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string; mono?: boolean; placeholder?: string; step?: string; disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs uppercase text-muted-foreground tracking-wide">{label}</Label>
      <Input
        type={type} step={step} value={value} placeholder={placeholder} disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className={mono ? "font-mono" : ""}
      />
    </div>
  );
}

function Stat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={"font-medium " + (mono ? "font-mono" : "")}>{value}</div>
    </div>
  );
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
