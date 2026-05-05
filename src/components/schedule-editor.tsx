"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateScheduleAction } from "@/actions/schedule";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Save, AlertCircle, CheckCircle2 } from "lucide-react";

type Form = {
  weekdayStart: string;
  weekdayEnd: string;
  weekdayHours: number;
  saturdayStart: string;
  saturdayEnd: string;
  saturdayHours: number;
  toleranceMinutes: number;
  duplicateThresholdMinutes: number;
};

export function ScheduleEditor({ initial }: { initial: Form }) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ recalculated: number } | null>(null);

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  const submit = () =>
    start(async () => {
      setError(null);
      setSuccess(null);
      try {
        const r = await updateScheduleAction(form);
        setSuccess({ recalculated: r.recalculated });
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lunes a Viernes</CardTitle>
            <CardDescription>Hora estándar de jornada laboral.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="Entrada" value={form.weekdayStart} onChange={(v) => set("weekdayStart", v)} placeholder="08:30" mono />
            <Field label="Salida" value={form.weekdayEnd} onChange={(v) => set("weekdayEnd", v)} placeholder="18:30" mono />
            <Field label="Horas efectivas" value={String(form.weekdayHours)} onChange={(v) => set("weekdayHours", Number(v))} placeholder="9" type="number" step="0.25" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sábado</CardTitle>
            <CardDescription>Jornada parcial.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field label="Entrada" value={form.saturdayStart} onChange={(v) => set("saturdayStart", v)} placeholder="08:30" mono />
            <Field label="Salida" value={form.saturdayEnd} onChange={(v) => set("saturdayEnd", v)} placeholder="14:00" mono />
            <Field label="Horas efectivas" value={String(form.saturdayHours)} onChange={(v) => set("saturdayHours", Number(v))} placeholder="5.5" type="number" step="0.25" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tolerancias</CardTitle>
          <CardDescription>Reglas de cálculo aplicadas al analizar.</CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-3">
          <Field
            label="Tolerancia tardanza (min)"
            help="Minutos de gracia tras la hora de entrada antes de marcar tarde."
            value={String(form.toleranceMinutes)}
            onChange={(v) => set("toleranceMinutes", Number(v))}
            type="number" min="0" max="60"
          />
          <Field
            label="Umbral duplicados (min)"
            help="Marcas a menos de N min entre sí se consideran la misma."
            value={String(form.duplicateThresholdMinutes)}
            onChange={(v) => set("duplicateThresholdMinutes", Number(v))}
            type="number" min="0" max="30"
          />
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-md p-3">
          <AlertCircle className="size-4 mt-0.5 shrink-0" /> <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-start gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md p-3">
          <CheckCircle2 className="size-4 mt-0.5 shrink-0" />
          <span>Guardado. Se recalcularon {success.recalculated} días.</span>
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={submit} disabled={pending || !dirty}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          Guardar y recalcular
        </Button>
        {dirty && (
          <Button variant="outline" onClick={() => { setForm(initial); setError(null); setSuccess(null); }}>
            Descartar cambios
          </Button>
        )}
      </div>
    </div>
  );
}

function Field({
  label, value, onChange, placeholder, type = "text", step, min, max, mono, help,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  step?: string;
  min?: string;
  max?: string;
  mono?: boolean;
  help?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs uppercase text-muted-foreground tracking-wide">{label}</Label>
      <Input
        type={type}
        step={step}
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={mono ? "font-mono" : ""}
      />
      {help && <p className="text-xs text-muted-foreground">{help}</p>}
    </div>
  );
}
