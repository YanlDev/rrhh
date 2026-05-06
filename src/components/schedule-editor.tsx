"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createSchedulePeriodAction,
  updateSchedulePeriodAction,
  deleteSchedulePeriodAction,
} from "@/actions/schedule";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Loader2, Save, AlertCircle, CheckCircle2, Plus, Trash2, Pencil, CalendarClock,
} from "lucide-react";

export type SchedulePeriodRow = {
  id: string;
  effectiveFrom: string;
  weekdayStart: string;
  weekdayEnd: string;
  weekdayHours: number;
  weekdayLunchMinutes: number;
  saturdayStart: string;
  saturdayEnd: string;
  saturdayHours: number;
  saturdayLunchMinutes: number;
  toleranceMinutes: number;
  duplicateThresholdMinutes: number;
  minLunchMinutes: number;
  lunchWindowStart: string;
  lunchWindowEnd: string;
};

const todayISO = () => new Date().toISOString().slice(0, 10);

export function SchedulePeriodsEditor({ periods }: { periods: SchedulePeriodRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<SchedulePeriodRow | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<SchedulePeriodRow | null>(null);
  const [pending, start] = useTransition();
  const [info, setInfo] = useState<{ recalculated: number } | null>(null);

  // Periodo activo hoy: el último cuyo effectiveFrom <= today.
  const today = todayISO();
  const sorted = [...periods].sort((a, b) => a.effectiveFrom.localeCompare(b.effectiveFrom));
  const activeIdx = sorted.reduce(
    (acc, p, i) => (p.effectiveFrom <= today ? i : acc),
    -1
  );

  const onDelete = () =>
    start(async () => {
      if (!confirmDelete) return;
      const target = confirmDelete;
      setConfirmDelete(null);
      const res = await deleteSchedulePeriodAction({ id: target.id });
      if (!res.ok) {
        alert(res.error);
        return;
      }
      setInfo({ recalculated: res.data?.recalculated ?? 0 });
      router.refresh();
    });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Cada periodo aplica desde su fecha de inicio hasta el inicio del siguiente.
          Al guardar, se recalculan todos los días registrados.
        </p>
        <Dialog open={creating} onOpenChange={setCreating}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="size-4" /> Nuevo periodo
            </Button>
          </DialogTrigger>
          <PeriodFormDialog
            mode="create"
            initial={defaultPeriodFromLatest(sorted)}
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

      <div className="space-y-3">
        {sorted.map((p, i) => {
          const isActive = i === activeIdx;
          const upcomingFrom = i > activeIdx;
          return (
            <Card key={p.id} className={isActive ? "border-primary/40" : undefined}>
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                <div className="space-y-1">
                  <CardTitle className="text-base flex items-center gap-2">
                    <CalendarClock className="size-4" />
                    Desde {formatDate(p.effectiveFrom)}
                    {isActive && <Badge className="bg-emerald-100 text-emerald-800 border-transparent">Vigente</Badge>}
                    {upcomingFrom && <Badge variant="outline">Futuro</Badge>}
                    {!isActive && !upcomingFrom && <Badge variant="outline">Histórico</Badge>}
                  </CardTitle>
                  <CardDescription>
                    L–V {p.weekdayStart}–{p.weekdayEnd} ({p.weekdayHours}h, almuerzo {p.weekdayLunchMinutes}m)
                    {" · "}
                    Sáb {p.saturdayStart}–{p.saturdayEnd} ({p.saturdayHours}h)
                  </CardDescription>
                </div>
                <div className="flex gap-1">
                  <Dialog
                    open={editing?.id === p.id}
                    onOpenChange={(v) => !v && setEditing(null)}
                  >
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="size-8" onClick={() => setEditing(p)}>
                        <Pencil className="size-4" />
                      </Button>
                    </DialogTrigger>
                    {editing?.id === p.id && (
                      <PeriodFormDialog
                        mode="edit"
                        initial={editing}
                        onClose={() => setEditing(null)}
                        onSaved={(r) => { setInfo(r); router.refresh(); setEditing(null); }}
                      />
                    )}
                  </Dialog>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 text-destructive hover:text-destructive"
                    onClick={() => setConfirmDelete(p)}
                    disabled={periods.length <= 1}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <Stat label="Tolerancia tardanza" value={`${p.toleranceMinutes} min`} />
                <Stat label="Duplicado < " value={`${p.duplicateThresholdMinutes} min`} />
                <Stat label="Almuerzo mínimo" value={`${p.minLunchMinutes} min`} />
                <Stat label="Almuerzo sábado" value={`${p.saturdayLunchMinutes} min`} />
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar periodo</DialogTitle>
            <DialogDescription>
              Se eliminará el periodo desde <strong>{confirmDelete && formatDate(confirmDelete.effectiveFrom)}</strong>.
              Los días de ese rango pasarán a calcularse con el periodo anterior. Recalculo automático.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)} disabled={pending}>
              Cancelar
            </Button>
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

function PeriodFormDialog({
  mode, initial, onClose, onSaved,
}: {
  mode: "create" | "edit";
  initial: SchedulePeriodRow;
  onClose: () => void;
  onSaved: (info: { recalculated: number }) => void;
}) {
  const [form, setForm] = useState<SchedulePeriodRow>(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof SchedulePeriodRow>(k: K, v: SchedulePeriodRow[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const submit = () =>
    start(async () => {
      setError(null);
      const payload = {
        effectiveFrom: form.effectiveFrom,
        weekdayStart: form.weekdayStart,
        weekdayEnd: form.weekdayEnd,
        weekdayHours: Number(form.weekdayHours),
        weekdayLunchMinutes: Number(form.weekdayLunchMinutes),
        saturdayStart: form.saturdayStart,
        saturdayEnd: form.saturdayEnd,
        saturdayHours: Number(form.saturdayHours),
        saturdayLunchMinutes: Number(form.saturdayLunchMinutes),
        toleranceMinutes: Number(form.toleranceMinutes),
        duplicateThresholdMinutes: Number(form.duplicateThresholdMinutes),
        minLunchMinutes: Number(form.minLunchMinutes),
        lunchWindowStart: form.lunchWindowStart,
        lunchWindowEnd: form.lunchWindowEnd,
      };
      const res =
        mode === "create"
          ? await createSchedulePeriodAction(payload)
          : await updateSchedulePeriodAction({ id: form.id, ...payload });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onSaved({ recalculated: res.data?.recalculated ?? 0 });
      onClose();
    });

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>
          {mode === "create" ? "Nuevo periodo de horario" : "Editar periodo"}
        </DialogTitle>
        <DialogDescription>
          Aplica desde la fecha de inicio. Cambios disparan recalculo de toda la BD.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4">
        <div>
          <Label className="text-xs uppercase text-muted-foreground tracking-wide">Vigente desde</Label>
          <Input
            type="date"
            value={form.effectiveFrom}
            onChange={(e) => set("effectiveFrom", e.target.value)}
            className="font-mono"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Lunes a Viernes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Field label="Entrada" value={form.weekdayStart} onChange={(v) => set("weekdayStart", v)} mono />
              <Field label="Salida" value={form.weekdayEnd} onChange={(v) => set("weekdayEnd", v)} mono />
              <Field label="Horas efectivas" type="number" step="0.25"
                value={String(form.weekdayHours)} onChange={(v) => set("weekdayHours", Number(v))} />
              <Field label="Almuerzo (min)" type="number"
                value={String(form.weekdayLunchMinutes)}
                onChange={(v) => set("weekdayLunchMinutes", Number(v))} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Sábado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Field label="Entrada" value={form.saturdayStart} onChange={(v) => set("saturdayStart", v)} mono />
              <Field label="Salida" value={form.saturdayEnd} onChange={(v) => set("saturdayEnd", v)} mono />
              <Field label="Horas efectivas" type="number" step="0.25"
                value={String(form.saturdayHours)} onChange={(v) => set("saturdayHours", Number(v))} />
              <Field label="Almuerzo (min) — usar 0 si no hay" type="number"
                value={String(form.saturdayLunchMinutes)}
                onChange={(v) => set("saturdayLunchMinutes", Number(v))} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Tolerancias</CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-3 gap-3">
            <Field label="Tardanza (min)" type="number" min="0" max="60"
              value={String(form.toleranceMinutes)}
              onChange={(v) => set("toleranceMinutes", Number(v))} />
            <Field label="Duplicado < (min)" type="number" min="0" max="30"
              value={String(form.duplicateThresholdMinutes)}
              onChange={(v) => set("duplicateThresholdMinutes", Number(v))} />
            <Field label="Almuerzo crítico < (min)" type="number" min="0" max="240"
              value={String(form.minLunchMinutes)}
              onChange={(v) => set("minLunchMinutes", Number(v))} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Ventana para salir a almorzar</CardTitle>
          </CardHeader>
          <CardContent className="grid sm:grid-cols-2 gap-3">
            <Field label="Desde" mono
              value={form.lunchWindowStart}
              onChange={(v) => set("lunchWindowStart", v)} />
            <Field label="Hasta" mono
              value={form.lunchWindowEnd}
              onChange={(v) => set("lunchWindowEnd", v)} />
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
  label, value, onChange, type = "text", step, min, max, mono,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string; step?: string; min?: string; max?: string; mono?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs uppercase text-muted-foreground tracking-wide">{label}</Label>
      <Input
        type={type} step={step} min={min} max={max}
        value={value} onChange={(e) => onChange(e.target.value)}
        className={mono ? "font-mono" : ""}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function defaultPeriodFromLatest(periods: SchedulePeriodRow[]): SchedulePeriodRow {
  const last = periods[periods.length - 1];
  return last
    ? { ...last, id: "", effectiveFrom: todayISO() }
    : {
        id: "",
        effectiveFrom: todayISO(),
        weekdayStart: "08:30",
        weekdayEnd: "18:30",
        weekdayHours: 9,
        weekdayLunchMinutes: 60,
        saturdayStart: "08:30",
        saturdayEnd: "14:00",
        saturdayHours: 5.5,
        saturdayLunchMinutes: 0,
        toleranceMinutes: 5,
        duplicateThresholdMinutes: 2,
        minLunchMinutes: 25,
        lunchWindowStart: "12:00",
        lunchWindowEnd: "14:00",
      };
}

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
