import { listSchedulePeriodsAction } from "@/actions/schedule";
import { SchedulePeriodsEditor } from "@/components/schedule-editor";
import { Button } from "@/components/ui/button";
import { Clock, ArrowLeft } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";
// Server Actions de esta page disparan recalc de toda la BD; subir timeout.
export const maxDuration = 60;

export default async function SchedulePage() {
  const rows = await listSchedulePeriodsAction();
  const periods = rows.map((p) => ({
    id: p.id,
    effectiveFrom: p.effectiveFrom,
    weekdayStart: p.weekdayStart,
    weekdayEnd: p.weekdayEnd,
    weekdayHours: p.weekdayHours,
    weekdayLunchMinutes: p.weekdayLunchMinutes,
    saturdayStart: p.saturdayStart,
    saturdayEnd: p.saturdayEnd,
    saturdayHours: p.saturdayHours,
    saturdayLunchMinutes: p.saturdayLunchMinutes,
    toleranceMinutes: p.toleranceMinutes,
    duplicateThresholdMinutes: p.duplicateThresholdMinutes,
    minLunchMinutes: p.minLunchMinutes,
    lunchWindowStart: p.lunchWindowStart,
    lunchWindowEnd: p.lunchWindowEnd,
  }));

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 h-7 px-2">
          <Link href="/settings"><ArrowLeft className="size-3.5" /> Configuración</Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2 mt-1">
          <Clock className="size-5" /> Horarios y tolerancias
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Maneja periodos versionados. Cuando cambian las reglas (p. ej. nuevo horario de
          sábado, nueva duración de almuerzo) crea un periodo nuevo con la fecha desde la
          que aplica. Los días anteriores siguen calculándose con su periodo correspondiente.
        </p>
      </div>

      <SchedulePeriodsEditor periods={periods} />
    </div>
  );
}
