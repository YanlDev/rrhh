import { db, ensureMigrated } from "@/lib/db";
import { employees, attendanceDays } from "@/lib/db/schema";
import { eq, and, gte, lte, sql, asc } from "drizzle-orm";
import { resolvePeriod, listAvailablePeriods } from "@/lib/period";
import { PeriodSelector } from "@/components/period-selector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, X } from "lucide-react";
import Link from "next/link";
import { CleanInactiveButton } from "@/components/clean-inactive-button";
import { getCurrentUser } from "@/lib/auth-helpers";

export const dynamic = "force-dynamic";

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; dept?: string; q?: string }>;
}) {
  await ensureMigrated();
  const me = await getCurrentUser();
  const sp = await searchParams;
  const period = await resolvePeriod(sp);
  const periods = await listAvailablePeriods();

  const inRange = period
    ? and(gte(attendanceDays.workDate, period.start), lte(attendanceDays.workDate, period.end))
    : undefined;

  const rows = await db
    .select({
      id: employees.id,
      personId: employees.personId,
      name: employees.name,
      department: employees.department,
      active: employees.active,
      daysCount: sql<number>`COALESCE(COUNT(${attendanceDays.id}), 0)`,
      lateMin: sql<number>`COALESCE(SUM(${attendanceDays.lateMinutes}), 0)`,
      workedMin: sql<number>`COALESCE(SUM(${attendanceDays.workedMinutes}), 0)`,
      incidents: sql<number>`COUNT(CASE WHEN ${attendanceDays.status} IN ('incomplete','absent') THEN 1 END)`,
    })
    .from(employees)
    .leftJoin(attendanceDays, and(eq(attendanceDays.employeeId, employees.id), inRange))
    .groupBy(employees.id)
    .orderBy(asc(employees.name));

  const depts = Array.from(new Set(rows.map((r) => r.department).filter(Boolean) as string[])).sort();
  const deptFilter = sp.dept ?? "";
  const search = (sp.q ?? "").toLowerCase();

  const filtered = rows.filter((r) => {
    if (deptFilter && r.department !== deptFilter) return false;
    if (search && !r.name.toLowerCase().includes(search)) return false;
    return true;
  });
  const active = filtered.filter((r) => r.active);
  const inactive = filtered.filter((r) => !r.active);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Empleados</h1>
          {period && <p className="text-sm text-muted-foreground">{period.label}</p>}
        </div>
        <PeriodSelector periods={periods} current={period} />
      </div>

      <form className="flex gap-2 flex-wrap items-center" action="/employees">
        {sp.period && <input type="hidden" name="period" value={sp.period} />}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input name="q" defaultValue={sp.q} placeholder="Buscar nombre..." className="pl-8 w-[240px] h-9" />
        </div>
        <select name="dept" defaultValue={deptFilter} className="h-9 px-3 rounded-md border bg-background text-sm">
          <option value="">Todos los deptos</option>
          {depts.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <Button type="submit" size="sm">Filtrar</Button>
        {(sp.q || sp.dept) && (
          <Button asChild variant="ghost" size="sm">
            <Link href={{ pathname: "/employees", query: sp.period ? { period: sp.period } : {} }}>
              <X className="size-4" /> Limpiar
            </Link>
          </Button>
        )}
      </form>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Activos ({active.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Depto</TableHead>
                <TableHead className="font-mono">ID</TableHead>
                <TableHead className="text-right">Días</TableHead>
                <TableHead className="text-right">Min. tarde</TableHead>
                <TableHead className="text-right">Horas trab.</TableHead>
                <TableHead className="text-right">Incidencias</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {active.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <Link href={`/employees/${r.id}${sp.period ? `?period=${sp.period}` : ""}`} className="font-medium hover:underline">
                      {r.name}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.department ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{r.personId}</TableCell>
                  <TableCell className="text-right tabular-nums">{Number(r.daysCount)}</TableCell>
                  <TableCell className="text-right tabular-nums">{Number(r.lateMin)}</TableCell>
                  <TableCell className="text-right tabular-nums">{(Number(r.workedMin) / 60).toFixed(1)}h</TableCell>
                  <TableCell className="text-right">
                    {Number(r.incidents) > 0 && (
                      <Badge variant="outline" className="bg-amber-100 text-amber-800 border-transparent">
                        {Number(r.incidents)}
                      </Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {inactive.length > 0 && (
        <Card className="opacity-80">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Sin actividad ({inactive.length})</CardTitle>
            {(me?.role === "admin" || me?.role === "rrhh") && <CleanInactiveButton count={inactive.length} />}
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableBody>
                {inactive.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>
                      <Link href={`/employees/${r.id}`} className="hover:underline">{r.name}</Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.department ?? "—"}</TableCell>
                    <TableCell className="font-mono text-xs">{r.personId}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
