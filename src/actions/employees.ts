"use server";

import { db, ensureMigrated } from "@/lib/db";
import { employees, attendanceDays } from "@/lib/db/schema";
import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-helpers";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

/**
 * Borra empleados que no tienen ningún `attendance_day` asociado.
 * Es seguro: cualquier empleado con datos históricos NO se toca.
 * Si más adelante se vuelve a importar el Excel, los empleados se recrean.
 */
export async function deleteInactiveEmployeesAction(): Promise<
  Result<{ deleted: number }>
> {
  try {
    await requireAdmin();
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
