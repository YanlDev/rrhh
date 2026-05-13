import { db, ensureMigrated } from "@/lib/db";
import { employees, attendanceDays, justificationTypes } from "@/lib/db/schema";
import { eq, count, and, gte, lte, sql, asc, desc, isNotNull } from "drizzle-orm";
import Link from "next/link";
import { resolvePeriod, listAvailablePeriods } from "@/lib/period";
import { PeriodSelector } from "@/components/period-selector";
import { DepartmentBars } from "@/components/charts/department-bars";
import { AttendanceLine } from "@/components/charts/attendance-line";
import { JustificationPie } from "@/components/charts/justification-pie";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Upload, Users, UserMinus, TrendingUp, Clock, AlertTriangle, XCircle, CheckCircle2,
  ArrowDownNarrowWide, ArrowUpNarrowWide, Hourglass, ShieldCheck,
} from "lucide-react";

export const dynamic = "force-dynamic";

function Kpi({ title, value, icon: Icon, accent }: { title: string; value: string | number; icon: React.ElementType; accent?: string }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</CardTitle>
        <Icon className={`size-4 ${accent ?? "text-muted-foreground"}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold tabular-nums">{value}</div>
      </CardContent>
    </Card>
  );
}

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  await ensureMigrated();
  const sp = await searchParams;
  const period = await resolvePeriod(sp);
  const periods = await listAvailablePeriods();

  if (!period) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <Card>
          <CardContent className="py-16 text-center space-y-4">
            <Upload className="size-10 mx-auto text-muted-foreground" />
            <p className="text-muted-foreground">Aún no se ha importado ningún reporte.</p>
            <Button asChild>
              <Link href="/import">Importar Excel</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const inRange = and(gte(attendanceDays.workDate, period.start), lte(attendanceDays.workDate, period.end));

  const [
    active, inactive, days, late, inc, abs, jus,
    topLate, topPunctual, topHours, topJustified,
    deptStats, dailyRows, jusBreakdown,
  ] = await Promise.all([
    db.select({ n: count() }).from(employees).where(eq(employees.active, true)),
    db.select({ n: count() }).from(employees).where(eq(employees.active, false)),
    db.select({ n: count() }).from(attendanceDays).where(inRange),
    db.select({ n: count() }).from(attendanceDays).where(and(inRange, eq(attendanceDays.status, "late"))),
    db.select({ n: count() }).from(attendanceDays).where(and(inRange, eq(attendanceDays.status, "incomplete"))),
    db.select({ n: count() }).from(attendanceDays).where(and(inRange, eq(attendanceDays.status, "absent"))),
    db.select({ n: count() }).from(attendanceDays).where(and(inRange, eq(attendanceDays.status, "justified"))),

    db.select({ id: employees.id, name: employees.name, dept: employees.department, total: sql<number>`SUM(${attendanceDays.lateMinutes})` })
      .from(attendanceDays).innerJoin(employees, eq(employees.id, attendanceDays.employeeId))
      .where(and(inRange, eq(employees.active, true))).groupBy(employees.id)
      .orderBy(desc(sql`SUM(${attendanceDays.lateMinutes})`)).limit(8),
    // Más puntuales: primero por minutos tarde (ASC), luego por minutos en gracia (ASC)
    // — así el que entra antes de 08:30 supera al que entra entre 08:30-08:35.
    // `total` muestra los minutos en gracia (los minutos tarde son 0 para todos los top).
    db.select({ id: employees.id, name: employees.name, dept: employees.department, total: sql<number>`SUM(${attendanceDays.graceMinutes})` })
      .from(attendanceDays).innerJoin(employees, eq(employees.id, attendanceDays.employeeId))
      .where(and(inRange, eq(employees.active, true))).groupBy(employees.id)
      .orderBy(asc(sql`SUM(${attendanceDays.lateMinutes})`), asc(sql`SUM(${attendanceDays.graceMinutes})`)).limit(8),
    db.select({ id: employees.id, name: employees.name, dept: employees.department, total: sql<number>`SUM(${attendanceDays.workedMinutes})` })
      .from(attendanceDays).innerJoin(employees, eq(employees.id, attendanceDays.employeeId))
      .where(and(inRange, eq(employees.active, true))).groupBy(employees.id)
      .orderBy(desc(sql`SUM(${attendanceDays.workedMinutes})`)).limit(8),
    db.select({
      id: employees.id, name: employees.name, dept: employees.department,
      total: sql<number>`COUNT(CASE WHEN ${attendanceDays.status} = 'justified' THEN 1 END)`,
    })
      .from(attendanceDays).innerJoin(employees, eq(employees.id, attendanceDays.employeeId))
      .where(and(inRange, eq(employees.active, true))).groupBy(employees.id)
      .having(sql`COUNT(CASE WHEN ${attendanceDays.status} = 'justified' THEN 1 END) > 0`)
      .orderBy(desc(sql`COUNT(CASE WHEN ${attendanceDays.status} = 'justified' THEN 1 END)`)).limit(8),

    db.select({
      dept: sql<string>`COALESCE(${employees.department}, '—')`,
      lateMinutes: sql<number>`COALESCE(SUM(${attendanceDays.lateMinutes}), 0)`,
      absences: sql<number>`COUNT(CASE WHEN ${attendanceDays.status} = 'absent' THEN 1 END)`,
    }).from(attendanceDays).innerJoin(employees, eq(employees.id, attendanceDays.employeeId))
      .where(and(inRange, eq(employees.active, true)))
      .groupBy(employees.department),

    db.select({
      date: attendanceDays.workDate,
      isWorkday: attendanceDays.isWorkday,
      status: attendanceDays.status,
    }).from(attendanceDays).innerJoin(employees, eq(employees.id, attendanceDays.employeeId))
      .where(and(inRange, eq(employees.active, true))),

    db.select({
      label: justificationTypes.labelEs,
      color: justificationTypes.color,
      n: count(),
    }).from(attendanceDays).innerJoin(justificationTypes, eq(justificationTypes.id, attendanceDays.justificationId))
      .where(and(inRange, isNotNull(attendanceDays.justificationId)))
      .groupBy(justificationTypes.id),
  ]);

  const dailyMap = new Map<string, { present: number; expected: number }>();
  for (const r of dailyRows) {
    if (!r.isWorkday) continue;
    const cur = dailyMap.get(r.date) ?? { present: 0, expected: 0 };
    cur.expected++;
    if (["ok", "late", "justified"].includes(r.status)) cur.present++;
    dailyMap.set(r.date, cur);
  }
  const dailyArr = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, present: v.present, expected: v.expected, pct: v.expected ? Math.round((v.present / v.expected) * 100) : 0 }));

  const totalDays = Number(days[0].n);
  const presentish = Number(late[0].n) + (totalDays - Number(late[0].n) - Number(inc[0].n) - Number(abs[0].n));
  const attendancePct = totalDays > 0 ? Math.round((presentish / totalDays) * 100) : 0;

  const periodQs = period ? `?period=${period.key}` : "";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">{period.label}</p>
        </div>
        <PeriodSelector periods={periods} current={period} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <Kpi title="Activos" value={active[0].n} icon={Users} />
        <Kpi title="Inactivos" value={inactive[0].n} icon={UserMinus} />
        <Kpi title="% Asistencia" value={`${attendancePct}%`} icon={TrendingUp} accent="text-emerald-600" />
        <Kpi title="Tardanzas" value={late[0].n} icon={Clock} accent="text-orange-600" />
        <Kpi title="Incompletos" value={inc[0].n} icon={AlertTriangle} accent="text-amber-600" />
        <Kpi title="Ausencias" value={abs[0].n} icon={XCircle} accent="text-red-600" />
        <Kpi title="Justificados" value={jus[0].n} icon={CheckCircle2} accent="text-blue-600" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Asistencia diaria</CardTitle>
            <CardDescription>% de empleados activos presentes cada día laborable</CardDescription>
          </CardHeader>
          <CardContent>
            <AttendanceLine data={dailyArr} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Por departamento</CardTitle>
            <CardDescription>Minutos tarde y ausencias agregadas</CardDescription>
          </CardHeader>
          <CardContent>
            <DepartmentBars data={deptStats.map(d => ({ dept: d.dept, lateMinutes: Number(d.lateMinutes), absences: Number(d.absences) }))} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribución de justificaciones</CardTitle>
            <CardDescription>Motivos asignados en el periodo</CardDescription>
          </CardHeader>
          <CardContent>
            <JustificationPie data={jusBreakdown.map(j => ({ label: j.label, value: Number(j.n), color: j.color ?? "#6b7280" }))} />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-2">
        <h2 className="text-lg font-semibold tracking-tight">Rankings del periodo</h2>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <RankCard
            title="Más impuntuales"
            description="Suma de minutos llegados después de la tolerancia"
            rows={topLate}
            unit="min tarde"
            icon={ArrowDownNarrowWide}
            accent="text-orange-600"
            periodQs={periodQs}
          />
          <RankCard
            title="Más puntuales"
            description="Llegada antes de 08:30 — desempata por minutos en gracia (08:30-08:35)"
            rows={topPunctual}
            unit="min en gracia"
            icon={ArrowUpNarrowWide}
            accent="text-emerald-600"
            periodQs={periodQs}
            invert
          />
          <RankCard
            title="Más horas trabajadas"
            description="Total de horas registradas en el periodo"
            rows={topHours.map(r => ({ ...r, total: Math.round((Number(r.total) / 60) * 10) / 10 }))}
            unit="h"
            icon={Hourglass}
            accent="text-blue-600"
            periodQs={periodQs}
          />
          <RankCard
            title="Más justificaciones / permisos"
            description="Días marcados como justificados (comisión, médico, vacaciones, etc.)"
            rows={topJustified}
            unit="días"
            icon={ShieldCheck}
            accent="text-violet-600"
            periodQs={periodQs}
          />
        </div>
      </div>
    </div>
  );
}

function RankCard({
  title, description, rows, unit, icon: Icon, accent, periodQs, invert,
}: {
  title: string;
  description: string;
  rows: { id: string; name: string; dept: string | null; total: number | null }[];
  unit: string;
  icon: React.ElementType;
  accent: string;
  periodQs: string;
  invert?: boolean;
}) {
  const max = Math.max(1, ...rows.map((r) => Number(r.total ?? 0)));

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Icon className={`size-4 ${accent}`} /> {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Sin datos en el periodo.</p>
        ) : (
          <ol className="space-y-2.5">
            {rows.map((r, i) => {
              const v = Number(r.total ?? 0);
              const pct = invert ? 100 - (v / max) * 100 : (v / max) * 100;
              return (
                <li key={r.id} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <Link
                      href={`/employees/${r.id}${periodQs}`}
                      className="hover:underline truncate flex items-baseline gap-2 min-w-0"
                    >
                      <span className="text-xs text-muted-foreground tabular-nums w-5 text-right shrink-0">{i + 1}.</span>
                      <span className="truncate font-medium">{r.name}</span>
                      {r.dept && <span className="text-xs text-muted-foreground truncate">· {r.dept}</span>}
                    </Link>
                    <span className="text-sm tabular-nums shrink-0">
                      <span className="font-semibold">{v}</span>
                      <span className="text-xs text-muted-foreground ml-1">{unit}</span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${barColor(accent)}`}
                      style={{ width: `${Math.max(4, Math.min(100, pct))}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}

function barColor(textClass: string): string {
  // map text-* → bg-*
  if (textClass.includes("orange")) return "bg-orange-500";
  if (textClass.includes("emerald")) return "bg-emerald-500";
  if (textClass.includes("blue")) return "bg-blue-500";
  if (textClass.includes("violet")) return "bg-violet-500";
  if (textClass.includes("red")) return "bg-red-500";
  return "bg-primary";
}
