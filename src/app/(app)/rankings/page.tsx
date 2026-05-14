import { db, ensureMigrated } from "@/lib/db";
import { employees, attendanceDays, justificationTypes } from "@/lib/db/schema";
import { and, eq, gte, lte, sql, isNotNull } from "drizzle-orm";
import Link from "next/link";
import { resolvePeriod, listAvailablePeriods } from "@/lib/period";
import { PeriodSelector } from "@/components/period-selector";
import { DeptFilter } from "@/components/dept-filter";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Trophy, Clock, Hourglass, ShieldCheck } from "lucide-react";

export const dynamic = "force-dynamic";

type EmpAgg = {
  id: string;
  name: string;
  dept: string | null;
  marcables: number;
  puntuales: number;
  lateMin: number;
  lateDays: number;
  workedMin: number;
  jusDays: number;
};

function MedalBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span title="Oro" className="text-amber-500">🥇</span>;
  if (rank === 2) return <span title="Plata" className="text-zinc-400">🥈</span>;
  if (rank === 3) return <span title="Bronce" className="text-orange-700">🥉</span>;
  return null;
}

function RankRow({
  rank, name, dept, primary, secondary, partial, empId,
}: {
  rank: number | null;
  name: string;
  dept: string | null;
  primary: string;
  secondary?: string;
  partial: boolean;
  empId: string;
}) {
  return (
    <tr className={`border-b last:border-0 hover:bg-muted/40 ${partial ? "opacity-60" : ""}`}>
      <td className="py-2 px-3 w-14 text-center font-mono text-sm tabular-nums">
        {rank !== null ? (
          <span className="flex items-center justify-center gap-1">
            <MedalBadge rank={rank} />
            <span>{rank}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
      </td>
      <td className="py-2 px-3">
        <Link href={`/employees/${empId}`} className="font-medium hover:underline">{name}</Link>
        {partial && (
          <span className="ml-2 inline-block text-[10px] uppercase font-mono rounded border border-amber-300 bg-amber-50 text-amber-800 px-1.5 py-0.5 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800">
            parcial
          </span>
        )}
      </td>
      <td className="py-2 px-3 text-sm text-muted-foreground">{dept ?? "—"}</td>
      <td className="py-2 px-3 text-right tabular-nums font-semibold">{primary}</td>
      {secondary !== undefined && (
        <td className="py-2 px-3 text-right tabular-nums text-sm text-muted-foreground">{secondary}</td>
      )}
    </tr>
  );
}

function EmptyMsg({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground py-8 text-center">{children}</p>;
}

export default async function RankingsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; dept?: string; tab?: string }>;
}) {
  await ensureMigrated();
  const sp = await searchParams;
  const period = await resolvePeriod(sp);
  const periods = await listAvailablePeriods();
  const dept = sp.dept ?? null;
  const tab = sp.tab ?? "puntualidad";

  if (!period) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
          <Trophy className="size-5" /> Rankings
        </h1>
        <Card><CardContent className="py-12 text-center text-muted-foreground">Importa un Excel primero.</CardContent></Card>
      </div>
    );
  }

  const inRange = and(gte(attendanceDays.workDate, period.start), lte(attendanceDays.workDate, period.end));
  const deptCond = dept ? eq(employees.department, dept) : undefined;

  const [rawAgg, deptList, jusByEmp] = await Promise.all([
    db.select({
      id: employees.id,
      name: employees.name,
      dept: employees.department,
      marcables: sql<number>`COUNT(*) FILTER (WHERE ${attendanceDays.isWorkday} AND ${attendanceDays.status} != 'no_workday')`,
      puntuales: sql<number>`COUNT(*) FILTER (WHERE ${attendanceDays.status} = 'justified' OR (${attendanceDays.graceMinutes} = 0 AND ${attendanceDays.lateMinutes} = 0 AND ${attendanceDays.isWorkday} AND ${attendanceDays.checkIn} IS NOT NULL))`,
      lateMin: sql<number>`COALESCE(SUM(${attendanceDays.lateMinutes}), 0)`,
      lateDays: sql<number>`COUNT(*) FILTER (WHERE ${attendanceDays.status} = 'late')`,
      workedMin: sql<number>`COALESCE(SUM(${attendanceDays.workedMinutes}), 0)`,
      jusDays: sql<number>`COUNT(*) FILTER (WHERE ${attendanceDays.status} = 'justified')`,
    })
      .from(attendanceDays)
      .innerJoin(employees, eq(employees.id, attendanceDays.employeeId))
      .where(and(inRange, eq(employees.active, true), deptCond))
      .groupBy(employees.id),

    db.selectDistinct({ dept: employees.department })
      .from(employees)
      .where(and(eq(employees.active, true), isNotNull(employees.department))),

    // Desglose de justificaciones por empleado (motivos más frecuentes).
    db.select({
      empId: attendanceDays.employeeId,
      label: justificationTypes.labelEs,
      n: sql<number>`COUNT(*)`,
    })
      .from(attendanceDays)
      .innerJoin(justificationTypes, eq(justificationTypes.id, attendanceDays.justificationId))
      .innerJoin(employees, eq(employees.id, attendanceDays.employeeId))
      .where(and(inRange, eq(employees.active, true), deptCond, isNotNull(attendanceDays.justificationId)))
      .groupBy(attendanceDays.employeeId, justificationTypes.labelEs),
  ]);

  const departments = deptList.map((d) => d.dept!).filter(Boolean).sort();

  const agg: EmpAgg[] = rawAgg.map((r) => ({
    id: r.id,
    name: r.name,
    dept: r.dept,
    marcables: Number(r.marcables),
    puntuales: Number(r.puntuales),
    lateMin: Number(r.lateMin),
    lateDays: Number(r.lateDays),
    workedMin: Number(r.workedMin),
    jusDays: Number(r.jusDays),
  }));

  // Top-3 elegible: con al menos 50% de los días del período.
  const maxMarcables = Math.max(0, ...agg.map((r) => r.marcables));
  const minMarcables = Math.max(1, Math.floor(maxMarcables * 0.5));
  const isPartial = (r: EmpAgg) => r.marcables < minMarcables;

  // === Puntualidad ===
  const puntRows = agg
    .map((r) => ({ ...r, pct: r.marcables > 0 ? Math.round((r.puntuales / r.marcables) * 100) : 0 }))
    .sort((a, b) => {
      const ap = isPartial(a), bp = isPartial(b);
      if (ap !== bp) return ap ? 1 : -1;
      return b.pct - a.pct || a.lateMin - b.lateMin;
    });
  let pRank = 0;
  const puntWithRank = puntRows.map((r) => ({
    ...r,
    rank: isPartial(r) ? null : (pRank += 1),
  }));

  // === Tardanzas (más impuntuales) ===
  const lateRows = [...agg]
    .filter((r) => r.lateMin > 0 || r.lateDays > 0)
    .sort((a, b) => {
      const ap = isPartial(a), bp = isPartial(b);
      if (ap !== bp) return ap ? 1 : -1;
      return b.lateMin - a.lateMin;
    });
  let lRank = 0;
  const lateWithRank = lateRows.map((r) => ({ ...r, rank: isPartial(r) ? null : (lRank += 1) }));

  // === Horas trabajadas ===
  const hoursRows = [...agg]
    .sort((a, b) => {
      const ap = isPartial(a), bp = isPartial(b);
      if (ap !== bp) return ap ? 1 : -1;
      return b.workedMin - a.workedMin;
    });
  let hRank = 0;
  const hoursWithRank = hoursRows.map((r) => ({ ...r, rank: isPartial(r) ? null : (hRank += 1) }));

  // === Justificaciones ===
  const jusBreakdownByEmp = new Map<string, string>();
  const tmp = new Map<string, { label: string; n: number }[]>();
  for (const j of jusByEmp) {
    const arr = tmp.get(j.empId) ?? [];
    arr.push({ label: j.label, n: Number(j.n) });
    tmp.set(j.empId, arr);
  }
  for (const [empId, list] of tmp) {
    list.sort((a, b) => b.n - a.n);
    jusBreakdownByEmp.set(empId, list.slice(0, 3).map((x) => `${x.label} (${x.n})`).join(" · "));
  }
  const jusRows = [...agg]
    .filter((r) => r.jusDays > 0)
    .sort((a, b) => b.jusDays - a.jusDays);
  const jusWithRank = jusRows.map((r, i) => ({ ...r, rank: i + 1 }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Trophy className="size-5" /> Rankings
          </h1>
          <p className="text-sm text-muted-foreground">{period.label}</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <DeptFilter departments={departments} current={dept} />
          <PeriodSelector periods={periods} current={period} />
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue={tab}>
            <TabsList>
              <TabsTrigger value="puntualidad"><Trophy className="size-4" /> Puntualidad</TabsTrigger>
              <TabsTrigger value="tardanzas"><Clock className="size-4" /> Tardanzas</TabsTrigger>
              <TabsTrigger value="horas"><Hourglass className="size-4" /> Horas trabajadas</TabsTrigger>
              <TabsTrigger value="justificaciones"><ShieldCheck className="size-4" /> Justificaciones</TabsTrigger>
            </TabsList>

            <TabsContent value="puntualidad" className="mt-4">
              <p className="text-sm text-muted-foreground mb-3">
                % de días con entrada ≤ 08:30 o justificados sobre días que debía marcar.
                Empleados con menos del 50% de los días del período aparecen marcados como <span className="font-mono text-xs">parcial</span> y no compiten por el podio.
              </p>
              {puntWithRank.length === 0 ? <EmptyMsg>Sin datos.</EmptyMsg> : (
                <div className="overflow-x-auto border rounded-md">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="py-2 px-3 text-center w-14">#</th>
                        <th className="py-2 px-3 text-left">Empleado</th>
                        <th className="py-2 px-3 text-left">Departamento</th>
                        <th className="py-2 px-3 text-right">% puntual</th>
                        <th className="py-2 px-3 text-right">Días puntuales / marcables</th>
                      </tr>
                    </thead>
                    <tbody>
                      {puntWithRank.map((r) => (
                        <RankRow
                          key={r.id}
                          rank={r.rank}
                          name={r.name}
                          dept={r.dept}
                          primary={`${r.pct}%`}
                          secondary={`${r.puntuales} / ${r.marcables}`}
                          partial={isPartial(r)}
                          empId={r.id}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="tardanzas" className="mt-4">
              <p className="text-sm text-muted-foreground mb-3">
                Minutos totales llegando después de la tolerancia (08:35). Ordenado de mayor a menor.
              </p>
              {lateWithRank.length === 0 ? <EmptyMsg>Nadie llegó tarde en el período.</EmptyMsg> : (
                <div className="overflow-x-auto border rounded-md">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="py-2 px-3 text-center w-14">#</th>
                        <th className="py-2 px-3 text-left">Empleado</th>
                        <th className="py-2 px-3 text-left">Departamento</th>
                        <th className="py-2 px-3 text-right">Min tarde</th>
                        <th className="py-2 px-3 text-right">Días tarde</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lateWithRank.map((r) => (
                        <RankRow
                          key={r.id}
                          rank={r.rank}
                          name={r.name}
                          dept={r.dept}
                          primary={r.lateMin.toLocaleString()}
                          secondary={String(r.lateDays)}
                          partial={isPartial(r)}
                          empId={r.id}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="horas" className="mt-4">
              <p className="text-sm text-muted-foreground mb-3">
                Total de horas registradas (excluye justificaciones que no cuentan como trabajadas).
              </p>
              {hoursWithRank.length === 0 ? <EmptyMsg>Sin datos.</EmptyMsg> : (
                <div className="overflow-x-auto border rounded-md">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="py-2 px-3 text-center w-14">#</th>
                        <th className="py-2 px-3 text-left">Empleado</th>
                        <th className="py-2 px-3 text-left">Departamento</th>
                        <th className="py-2 px-3 text-right">Horas</th>
                        <th className="py-2 px-3 text-right">Promedio/día</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hoursWithRank.map((r) => {
                        const hours = r.workedMin / 60;
                        const avg = r.marcables > 0 ? r.workedMin / r.marcables / 60 : 0;
                        return (
                          <RankRow
                            key={r.id}
                            rank={r.rank}
                            name={r.name}
                            dept={r.dept}
                            primary={`${hours.toFixed(1)} h`}
                            secondary={`${avg.toFixed(1)} h`}
                            partial={isPartial(r)}
                            empId={r.id}
                          />
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="justificaciones" className="mt-4">
              <p className="text-sm text-muted-foreground mb-3">
                Empleados con más días justificados en el período. Se muestra el desglose de los 3 motivos más frecuentes.
              </p>
              {jusWithRank.length === 0 ? <EmptyMsg>Sin justificaciones en el período.</EmptyMsg> : (
                <div className="overflow-x-auto border rounded-md">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                      <tr>
                        <th className="py-2 px-3 text-center w-14">#</th>
                        <th className="py-2 px-3 text-left">Empleado</th>
                        <th className="py-2 px-3 text-left">Departamento</th>
                        <th className="py-2 px-3 text-right">Días</th>
                        <th className="py-2 px-3 text-left">Motivos principales</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jusWithRank.map((r) => (
                        <tr key={r.id} className="border-b last:border-0 hover:bg-muted/40">
                          <td className="py-2 px-3 w-14 text-center font-mono text-sm tabular-nums">
                            <span className="flex items-center justify-center gap-1">
                              <MedalBadge rank={r.rank} />
                              <span>{r.rank}</span>
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <Link href={`/employees/${r.id}`} className="font-medium hover:underline">{r.name}</Link>
                          </td>
                          <td className="py-2 px-3 text-sm text-muted-foreground">{r.dept ?? "—"}</td>
                          <td className="py-2 px-3 text-right tabular-nums font-semibold">{r.jusDays}</td>
                          <td className="py-2 px-3 text-xs text-muted-foreground">{jusBreakdownByEmp.get(r.id) ?? ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
