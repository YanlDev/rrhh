import { ensureMigrated } from "@/lib/db";
import { resolvePeriod, listAvailablePeriods } from "@/lib/period";
import { PeriodSelector } from "@/components/period-selector";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  FileSpreadsheet,
  FileDown,
  ListChecks,
  BookOpen,
  UserCircle,
  Building2,
  Sparkles,
  Calendar,
} from "lucide-react";

export const dynamic = "force-dynamic";

type ReportDef = {
  type: string;
  title: string;
  description: string;
  icon: React.ElementType;
  format: "xlsx" | "csv";
};

const REPORTS: ReportDef[] = [
  { type: "executive", title: "Reporte ejecutivo", description: "Multi-hoja: KPIs, departamentos, empleados, top puntualidad, incidencias.", icon: Sparkles, format: "xlsx" },
  { type: "clean", title: "Excel limpio (formato ZKBio)", description: "Reproduce el formato original con marcas corregidas + hoja 'Justificaciones'.", icon: FileSpreadsheet, format: "xlsx" },
  { type: "daily", title: "Detalle diario", description: "Una fila por persona/día con marcas separadas en columnas.", icon: Calendar, format: "xlsx" },
  { type: "employee-summary", title: "Resumen por empleado", description: "Días trabajados, faltados, justificados, totales y % asistencia.", icon: UserCircle, format: "xlsx" },
  { type: "department", title: "Resumen por departamento", description: "Promedios y totales agregados por equipo.", icon: Building2, format: "xlsx" },
  { type: "incidents", title: "Incidencias pendientes", description: "Solo días incompletos / ausencias para acción de RRHH.", icon: ListChecks, format: "csv" },
];

export default async function ReportsPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  await ensureMigrated();
  const sp = await searchParams;
  const period = await resolvePeriod(sp);
  const periods = await listAvailablePeriods();

  const periodQs = period ? `?period=${period.key}` : "";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <BookOpen className="size-5" /> Reportes
          </h1>
          <p className="text-sm text-muted-foreground">{period ? period.label : "Sin periodo seleccionado"}</p>
        </div>
        <PeriodSelector periods={periods} current={period} />
      </div>

      {!period ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Importa un Excel primero.</CardContent></Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {REPORTS.map((r) => {
            const Icon = r.icon;
            return (
              <Card key={r.type} className="flex flex-col">
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="size-10 rounded-md bg-primary/10 text-primary grid place-items-center">
                      <Icon className="size-5" />
                    </div>
                    <span className="text-[10px] font-mono uppercase text-muted-foreground rounded border px-1.5 py-0.5">{r.format}</span>
                  </div>
                  <CardTitle className="text-base mt-3">{r.title}</CardTitle>
                  <CardDescription>{r.description}</CardDescription>
                </CardHeader>
                <CardContent className="mt-auto pt-0">
                  <Button asChild className="w-full">
                    <a href={`/api/export/${r.type}${periodQs}`} download>
                      <FileDown className="size-4" /> Descargar
                    </a>
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
