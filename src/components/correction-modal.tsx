"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setCorrectedPunchesAction, clearCorrectionAction } from "@/actions/corrections";
import { justifyDayAction, clearJustificationAction } from "@/actions/justifications";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2, AlertCircle } from "lucide-react";
import { DOW_FULL } from "@/lib/status";

export type DayForModal = {
  id: string;
  workDate: string;
  dayOfWeek: number;
  rawPunches: string[];
  correctedPunches: string[] | null;
  effectivePunches: string[];
  status: string;
  justificationId: string | null;
  justificationNote: string | null;
};

export type JustificationOption = {
  id: string;
  code: string;
  labelEs: string;
  countsAsWorked: boolean;
};

type Mode = "keep" | "edit" | "justify";

export function CorrectionModal({
  open,
  onClose,
  day,
  employeeName,
  justificationTypes,
}: {
  open: boolean;
  onClose: () => void;
  day: DayForModal | null;
  employeeName: string;
  justificationTypes: JustificationOption[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("keep");
  const [punches, setPunches] = useState<string[]>([]);
  const [note, setNote] = useState("");
  const [jusId, setJusId] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  useEffect(() => {
    if (!day) return;
    setPunches(day.correctedPunches ?? day.rawPunches);
    setNote(day.justificationNote ?? "");
    setJusId(day.justificationId ?? "");
    if (day.justificationId) setMode("justify");
    else if (day.correctedPunches) setMode("edit");
    else setMode("keep");
    setError(null);
  }, [day?.id]);

  if (!day) return null;

  const submit = () => {
    setError(null);
    start(async () => {
      try {
        if (mode === "edit") {
          await setCorrectedPunchesAction({ attendanceDayId: day.id, punches: punches.filter(Boolean), note: note || null });
          if (day.justificationId) await clearJustificationAction(day.id);
        } else if (mode === "justify") {
          if (!jusId) { setError("Selecciona un motivo"); return; }
          await justifyDayAction({ attendanceDayId: day.id, justificationTypeId: jusId, note: note || null });
        } else {
          if (day.correctedPunches) await clearCorrectionAction(day.id);
          if (day.justificationId) await clearJustificationAction(day.id);
        }
        router.refresh();
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{employeeName}</DialogTitle>
          <DialogDescription>{DOW_FULL[day.dayOfWeek]} · {day.workDate}</DialogDescription>
        </DialogHeader>

        <section className="space-y-1 text-sm">
          <Label className="text-xs uppercase text-muted-foreground">Marcas originales</Label>
          {day.rawPunches.length === 0 ? (
            <div className="text-muted-foreground italic">— sin marcas —</div>
          ) : (
            <ul className="font-mono text-xs flex flex-wrap gap-1">
              {day.rawPunches.map((p, i) => (
                <li key={i} className="px-2 py-0.5 rounded bg-muted">{p}</li>
              ))}
            </ul>
          )}
        </section>

        <RadioGroup value={mode} onValueChange={(v) => setMode(v as Mode)} className="space-y-1">
          <div className="flex items-center gap-2">
            <RadioGroupItem value="keep" id="m-keep" />
            <Label htmlFor="m-keep" className="font-normal">Mantener originales</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="edit" id="m-edit" />
            <Label htmlFor="m-edit" className="font-normal">Editar marcas manualmente</Label>
          </div>
          <div className="flex items-center gap-2">
            <RadioGroupItem value="justify" id="m-justify" />
            <Label htmlFor="m-justify" className="font-normal">Justificar (no estuvo)</Label>
          </div>
        </RadioGroup>

        {mode === "edit" && (
          <section className="space-y-2">
            <Label className="text-xs uppercase text-muted-foreground">Marcas corregidas (HH:mm)</Label>
            {punches.map((p, i) => (
              <div key={i} className="flex gap-2 items-center">
                <Input
                  value={p}
                  onChange={(e) => {
                    const next = [...punches]; next[i] = e.target.value; setPunches(next);
                  }}
                  placeholder="08:30"
                  className="font-mono w-28"
                />
                <Button type="button" size="icon" variant="ghost" onClick={() => setPunches(punches.filter((_, j) => j !== i))}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </div>
            ))}
            <Button type="button" size="sm" variant="outline" onClick={() => setPunches([...punches, ""])}>
              <Plus className="size-3.5" /> Agregar marca
            </Button>
          </section>
        )}

        {mode === "justify" && (
          <section className="space-y-2">
            <Label className="text-xs uppercase text-muted-foreground">Motivo</Label>
            <Select value={jusId} onValueChange={setJusId}>
              <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
              <SelectContent>
                {justificationTypes.map((j) => (
                  <SelectItem key={j.id} value={j.id}>
                    {j.labelEs}{j.countsAsWorked ? "" : " (no cuenta)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </section>
        )}

        <section className="space-y-1">
          <Label htmlFor="note" className="text-xs uppercase text-muted-foreground">Nota interna</Label>
          <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
        </section>

        {error && (
          <div className="flex items-start gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-md p-2">
            <AlertCircle className="size-4 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
