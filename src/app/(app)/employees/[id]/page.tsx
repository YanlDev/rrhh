import { db, ensureMigrated } from "@/lib/db";
import { employees, attendanceDays } from "@/lib/db/schema";
import { eq, and, gte, lte, asc, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { resolvePeriod, listAvailablePeriods } from "@/lib/period";
import { PeriodSelector } from "@/components/period-selector";
import { EmployeeDayView } from "@/components/employee-day-view";
import { listJustificationTypesAction } from "@/actions/justifications";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft, Hourglass, Clock, LogOut, AlertTriangle, XCircle, ShieldCheck, FileDown } from "lucide-react";
import { getCurrentUser } from "@/lib/auth-helpers";
import { EmployeeTenureCard } from "@/components/employee-tenure-card";

export const dynamic = "force-dynamic";

export default async function EmployeeDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  await ensureMigrated();
  const me = await getCurrentUser();
  const canEdit = me?.role === "admin" || me?.role === "rrhh";
  const { id } = await params;
  const sp = await searchParams;
  const period = await resolvePeriod(sp);
  const periods = await listAvailablePeriods();

  const emp = (await db.select().from(employees).where(eq(employees.id, id)))[0];
  if (!emp) notFound();

  if (!period) {
    return (
      <div>
        <h1 className="text-2xl font-semibold">{emp.name}</h1>
        <p className="text-muted-foreground mt-2">Sin periodos importados.</p>
      </div>
    );
  }

  const inRange = and(
    eq(attendanceDays.employeeId, id),
    gte(attendanceDays.workDate, period.start),
    lte(attendanceDays.workDate, period.end)
  );

  const days = await db.select().from(attendanceDays).where(inRange).orderBy(asc(attendanceDays.workDate));
  const jusTypes = await listJustificationTypesAction();
  const jusOptions = jusTypes.map((j) => ({ id: j.id, code: j.code, labelEs: j.labelEs, countsAsWorked: j.countsAsWorked }));
  const jusLabelById = new Map(jusTypes.map((j) => [j.id, j.labelEs]));

  const totals = await db
    .select({
      worked: sql<number>`COALESCE(SUM(${attendanceDays.workedMinutes}), 0)`,
      late: sql<number>`COALESCE(SUM(${attendanceDays.lateMinutes}), 0)`,
      early: sql<number>`COALESCE(SUM(${attendanceDays.earlyLeaveMinutes}), 0)`,
      lateDays: sql<number>`COUNT(CASE WHEN ${attendanceDays.status} = 'late' THEN 1 END)`,
      absent: sql<number>`COUNT(CASE WHEN ${attendanceDays.status} = 'absent' THEN 1 END)`,
      incomplete: sql<number>`COUNT(CASE WHEN ${attendanceDays.status} = 'incomplete' THEN 1 END)`,
      justified: sql<number>`COUNT(CASE WHEN ${attendanceDays.status} = 'justified' THEN 1 END)`,
    })
    .from(attendanceDays)
    .where(inRange);
  const t = totals[0];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2 h-7 px-2">
            <Link href="/employees"><ArrowLeft className="size-3.5" /> Empleados</Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight mt-1">{emp.name}</h1>
          <div className="text-sm text-muted-foreground">
            {emp.department ?? "—"} · ID <span className="font-mono">{emp.personId}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <PeriodSelector periods={periods} current={period} />
          <Button asChild variant="outline" size="sm">
            <a href={`/api/export/employee/${id}?period=${period.key}`} download>
              <FileDown className="size-3.5" /> Exportar
            </a>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Mini icon={Hourglass} label="Horas trab." value={`${(Number(t.worked) / 60).toFixed(1)}h`} />
        <Mini icon={Clock} label="Min. tarde" value={Number(t.late)} />
        <Mini icon={LogOut} label="Salida temp." value={`${Number(t.early)} min`} />
        <Mini icon={Clock} label="Días tarde" value={Number(t.lateDays)} />
        <Mini icon={XCircle} label="Ausencias" value={Number(t.absent)} />
        <Mini icon={AlertTriangle} label="Incompletos" value={Number(t.incomplete)} />
        <Mini icon={ShieldCheck} label="Justificados" value={Number(t.justified)} />
      </div>

      <EmployeeTenureCard
        employeeId={emp.id}
        hireDate={emp.hireDate}
        terminationDate={emp.terminationDate}
        canEdit={canEdit}
      />

      <EmployeeDayView
        canEdit={canEdit}
        employeeName={emp.name}
        justificationTypes={jusOptions}
        periodLabel={period.label}
        periodStart={period.start}
        periodEnd={period.end}
        rows={days.map((d) => ({
          id: d.id,
          workDate: d.workDate,
          dayOfWeek: d.dayOfWeek,
          rawPunches: d.rawPunches,
          correctedPunches: d.correctedPunches,
          effectivePunches: d.effectivePunches ?? [],
          status: d.status,
          justificationId: d.justificationId,
          justificationNote: d.justificationNote,
          justificationFrom: d.justificationFrom,
          justificationTo: d.justificationTo,
          justificationLabel: d.justificationId ? jusLabelById.get(d.justificationId) ?? null : null,
          lateMinutes: d.lateMinutes,
          earlyLeaveMinutes: d.earlyLeaveMinutes,
          workedMinutes: d.workedMinutes,
        }))}
      />
    </div>
  );
}

function Mini({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-3 space-y-1">
        <div className="flex items-center gap-1.5 text-[10px] uppercase text-muted-foreground tracking-wide">
          <Icon className="size-3" /> {label}
        </div>
        <div className="text-lg font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}
