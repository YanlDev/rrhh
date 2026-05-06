"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateEmployeeTenureAction } from "@/actions/employees";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CalendarDays, Save, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

export function EmployeeTenureCard({
  employeeId,
  hireDate,
  terminationDate,
  canEdit,
}: {
  employeeId: string;
  hireDate: string | null;
  terminationDate: string | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [hire, setHire] = useState(hireDate ?? "");
  const [term, setTerm] = useState(terminationDate ?? "");
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<{ recalculated: number } | null>(null);

  const dirty = (hire || null) !== (hireDate ?? null) || (term || null) !== (terminationDate ?? null);

  function submit() {
    setError(null);
    setInfo(null);
    start(async () => {
      const res = await updateEmployeeTenureAction({
        id: employeeId,
        hireDate: hire || null,
        terminationDate: term || null,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setInfo({ recalculated: res.data?.recalculated ?? 0 });
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarDays className="size-4" /> Período de vínculo
        </CardTitle>
        <CardDescription>
          Días fuera del vínculo se tratan como no laborables y no afectan
          % asistencia ni rankings. Vacío = sin restricción.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="hire" className="text-xs uppercase text-muted-foreground tracking-wide">
              Fecha de ingreso
            </Label>
            <Input
              id="hire"
              type="date"
              value={hire}
              onChange={(e) => setHire(e.target.value)}
              disabled={!canEdit || pending}
              className="font-mono"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="term" className="text-xs uppercase text-muted-foreground tracking-wide">
              Fecha de baja (opcional)
            </Label>
            <Input
              id="term"
              type="date"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              disabled={!canEdit || pending}
              className="font-mono"
            />
          </div>
        </div>

        {error && (
          <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-md p-2">
            <AlertCircle className="size-4 mt-0.5 shrink-0" /> <span>{error}</span>
          </div>
        )}
        {info && (
          <div className="flex items-start gap-2 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md p-2">
            <CheckCircle2 className="size-4 mt-0.5 shrink-0" />
            <span>Guardado. Se recalcularon {info.recalculated} día(s).</span>
          </div>
        )}

        {canEdit && (
          <div className="flex justify-end">
            <Button size="sm" onClick={submit} disabled={pending || !dirty}>
              {pending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
              Guardar y recalcular
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
