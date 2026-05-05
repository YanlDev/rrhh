import { db, ensureMigrated } from "@/lib/db";
import { employees, attendanceDays } from "@/lib/db/schema";
import { eq, and, gte, lte, inArray, like, asc, type SQL } from "drizzle-orm";
import { resolvePeriod, listAvailablePeriods } from "@/lib/period";
import { PeriodSelector } from "@/components/period-selector";
import { ReviewTable } from "@/components/review-table";
import { listJustificationTypesAction } from "@/actions/justifications";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, ClipboardCheck } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS = [
  { value: "incomplete,absent", label: "Pendientes (incompleto + ausente)" },
  { value: "incomplete", label: "Solo incompletos" },
  { value: "absent", label: "Solo ausencias" },
  { value: "late", label: "Tardanzas" },
  { value: "justified", label: "Justificados" },
  { value: "all", label: "Todos" },
];

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; dept?: string; status?: string; q?: string }>;
}) {
  await ensureMigrated();
  const sp = await searchParams;
  const period = await resolvePeriod(sp);
  const periods = await listAvailablePeriods();

  const statusFilter = sp.status ?? "incomplete,absent";
  const statusList = statusFilter === "all" ? null : statusFilter.split(",");

  const conds: SQL[] = [];
  if (period) {
    conds.push(gte(attendanceDays.workDate, period.start));
    conds.push(lte(attendanceDays.workDate, period.end));
  }
  if (statusList) conds.push(inArray(attendanceDays.status, statusList));
  if (sp.dept) conds.push(eq(employees.department, sp.dept));
  if (sp.q) conds.push(like(employees.name, `%${sp.q}%`));

  const rows = await db
    .select({
      id: attendanceDays.id,
      empId: employees.id,
      workDate: attendanceDays.workDate,
      dayOfWeek: attendanceDays.dayOfWeek,
      status: attendanceDays.status,
      rawPunches: attendanceDays.rawPunches,
      correctedPunches: attendanceDays.correctedPunches,
      effectivePunches: attendanceDays.effectivePunches,
      justificationId: attendanceDays.justificationId,
      justificationNote: attendanceDays.justificationNote,
      lateMin: attendanceDays.lateMinutes,
      incidents: attendanceDays.incidents,
      empName: employees.name,
      empDept: employees.department,
    })
    .from(attendanceDays)
    .innerJoin(employees, eq(employees.id, attendanceDays.employeeId))
    .where(conds.length ? and(...conds) : undefined)
    .orderBy(asc(attendanceDays.workDate), asc(employees.name));

  const allDepts = await db.selectDistinct({ d: employees.department }).from(employees).orderBy(asc(employees.department));
  const deptList = allDepts.map((r) => r.d).filter(Boolean) as string[];

  const jusTypes = await listJustificationTypesAction();
  const jusOptions = jusTypes.map((j) => ({ id: j.id, code: j.code, labelEs: j.labelEs, countsAsWorked: j.countsAsWorked }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <ClipboardCheck className="size-5" /> Revisión de incidencias
          </h1>
          <p className="text-sm text-muted-foreground">{rows.length} días coinciden con los filtros.</p>
        </div>
        <PeriodSelector periods={periods} current={period} />
      </div>

      <form className="flex flex-wrap gap-2 items-center" action="/review">
        {sp.period && <input type="hidden" name="period" value={sp.period} />}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input name="q" defaultValue={sp.q} placeholder="Buscar empleado..." className="pl-8 w-[240px] h-9" />
        </div>
        <select name="dept" defaultValue={sp.dept ?? ""} className="h-9 px-3 rounded-md border bg-background text-sm">
          <option value="">Todos los deptos</option>
          {deptList.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select name="status" defaultValue={statusFilter} className="h-9 px-3 rounded-md border bg-background text-sm">
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <Button type="submit" size="sm">Aplicar</Button>
        {(sp.q || sp.dept || sp.status) && (
          <Button asChild variant="ghost" size="sm">
            <Link href={{ pathname: "/review", query: sp.period ? { period: sp.period } : {} }}>
              <X className="size-4" /> Limpiar
            </Link>
          </Button>
        )}
      </form>

      {rows.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">Sin resultados.</CardContent></Card>
      ) : (
        <ReviewTable
          periodParam={sp.period ?? null}
          justificationTypes={jusOptions}
          rows={rows.map((r) => ({
            id: r.id,
            empId: r.empId,
            empName: r.empName,
            empDept: r.empDept,
            workDate: r.workDate,
            dayOfWeek: r.dayOfWeek,
            rawPunches: r.rawPunches,
            correctedPunches: r.correctedPunches,
            effectivePunches: r.effectivePunches ?? [],
            status: r.status,
            justificationId: r.justificationId,
            justificationNote: r.justificationNote,
            lateMin: r.lateMin,
            incidentsList: r.incidents ?? [],
          }))}
        />
      )}
    </div>
  );
}
