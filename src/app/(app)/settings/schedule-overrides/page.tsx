import { listScheduleOverridesAction } from "@/actions/schedule-overrides";
import { ScheduleOverridesEditor } from "@/components/schedule-overrides-editor";
import { Button } from "@/components/ui/button";
import { CalendarDays, ArrowLeft } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function ScheduleOverridesPage() {
  const rows = await listScheduleOverridesAction();
  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 h-7 px-2">
          <Link href="/settings"><ArrowLeft className="size-3.5" /> Configuración</Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2 mt-1">
          <CalendarDays className="size-5" /> Días especiales
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Excepciones al horario regular para fechas puntuales (ej. Jueves Santo medio día).
          Solo aplican al día configurado, sin afectar al resto del periodo.
        </p>
      </div>
      <ScheduleOverridesEditor rows={rows} />
    </div>
  );
}
