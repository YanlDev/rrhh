import { ensureMigrated } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { ScheduleEditor } from "@/components/schedule-editor";
import { Button } from "@/components/ui/button";
import { Clock, ArrowLeft } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  await ensureMigrated();
  const s = await getSettings();
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
          Cambios aplican a todo el sistema. Al guardar, se recalculan automáticamente todos los días registrados.
        </p>
      </div>

      <ScheduleEditor
        initial={{
          weekdayStart: s.weekdayStart,
          weekdayEnd: s.weekdayEnd,
          weekdayHours: s.weekdayHours,
          saturdayStart: s.saturdayStart,
          saturdayEnd: s.saturdayEnd,
          saturdayHours: s.saturdayHours,
          toleranceMinutes: s.toleranceMinutes,
          duplicateThresholdMinutes: s.duplicateThresholdMinutes,
        }}
      />
    </div>
  );
}
