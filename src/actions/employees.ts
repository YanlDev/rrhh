"use server";

import { db, ensureMigrated } from "@/lib/db";
import { employees, attendanceDays } from "@/lib/db/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireRrhh } from "@/lib/auth-helpers";
import { recalcAttendanceDays } from "@/lib/analyzer/recalc-day";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const tenureSchema = z.object({
  id: z.string().uuid(),
  hireDate: z.string().regex(DATE_RE).nullable(),
  terminationDate: z.string().regex(DATE_RE).nullable(),
}).refine(
  (v) => !v.hireDate || !v.terminationDate || v.hireDate <= v.terminationDate,
  { message: "La fecha de baja debe ser igual o posterior al ingreso" }
);

/** Actualiza fechas de vínculo del empleado y recalcula sus attendance_days. */
export async function updateEmployeeTenureAction(input: {
  id: string;
  hireDate: string | null;
  terminationDate: string | null;
}): Promise<Result<{ recalculated: number }>> {
  try {
    await requireRrhh();
    await ensureMigrated();
    const parsed = tenureSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }

    await db
      .update(employees)
      .set({
        hireDate: parsed.data.hireDate,
        terminationDate: parsed.data.terminationDate,
      })
      .where(eq(employees.id, parsed.data.id));

    // Recalcular SOLO los días del empleado — barato y suficiente.
    const ids = await db
      .select({ id: attendanceDays.id })
      .from(attendanceDays)
      .where(eq(attendanceDays.employeeId, parsed.data.id));
    const updated = await recalcAttendanceDays(ids.map((r) => r.id));

    revalidatePath(`/employees/${parsed.data.id}`);
    revalidatePath("/employees");
    revalidatePath("/");
    return { ok: true, data: { recalculated: updated } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}

/**
 * Borra empleados que no tienen ningún `attendance_day` asociado.
 * Es seguro: cualquier empleado con datos históricos NO se toca.
 * Si más adelante se vuelve a importar el Excel, los empleados se recrean.
 */
export async function deleteInactiveEmployeesAction(): Promise<
  Result<{ deleted: number }>
> {
  try {
    await requireRrhh();
    await ensureMigrated();

    const deleted = await db
      .delete(employees)
      .where(
        sql`NOT EXISTS (SELECT 1 FROM ${attendanceDays} a WHERE a.employee_id = ${employees.id})`
      )
      .returning({ id: employees.id });

    revalidatePath("/employees");
    revalidatePath("/", "layout");
    return { ok: true, data: { deleted: deleted.length } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}
