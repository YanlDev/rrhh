"use server";

import { db, ensureMigrated } from "@/lib/db";
import { importBatches, attendanceDays, employees } from "@/lib/db/schema";
import { and, eq, gte, lte, sql, isNotNull, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth-helpers";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

export type BatchImpact = {
  id: string;
  filename: string;
  periodStart: string;
  periodEnd: string;
  totalDays: number;
  correctedDays: number;
  justifiedDays: number;
  employeesAffected: number;
};

/** Calcula cuántos días, correcciones y justificaciones quedarán afectados al borrar el batch. */
export async function getImportBatchImpactAction(input: {
  id: string;
}): Promise<Result<BatchImpact>> {
  try {
    await requireAdmin();
    await ensureMigrated();
    const id = z.string().uuid().safeParse(input.id);
    if (!id.success) return { ok: false, error: "ID inválido" };

    const found = await db
      .select()
      .from(importBatches)
      .where(eq(importBatches.id, id.data))
      .limit(1);
    const batch = found[0];
    if (!batch) return { ok: false, error: "Importación no encontrada" };

    const stats = await db
      .select({
        totalDays: sql<number>`count(*)::int`,
        correctedDays: sql<number>`count(*) filter (where ${attendanceDays.correctedPunches} is not null)::int`,
        justifiedDays: sql<number>`count(*) filter (where ${attendanceDays.justificationId} is not null)::int`,
        employeesAffected: sql<number>`count(distinct ${attendanceDays.employeeId})::int`,
      })
      .from(attendanceDays)
      .where(
        and(
          gte(attendanceDays.workDate, batch.periodStart),
          lte(attendanceDays.workDate, batch.periodEnd)
        )
      );

    return {
      ok: true,
      data: {
        id: batch.id,
        filename: batch.filename,
        periodStart: batch.periodStart,
        periodEnd: batch.periodEnd,
        totalDays: stats[0]?.totalDays ?? 0,
        correctedDays: stats[0]?.correctedDays ?? 0,
        justifiedDays: stats[0]?.justifiedDays ?? 0,
        employeesAffected: stats[0]?.employeesAffected ?? 0,
      },
    };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}

/**
 * Borra un batch de importación junto con todos los `attendance_days`
 * cuyo `work_date` cae dentro del periodo del batch. Recalcula el flag
 * `active` de los empleados afectados.
 */
export async function deleteImportBatchAction(input: {
  id: string;
}): Promise<Result<{ deletedDays: number }>> {
  try {
    await requireAdmin();
    await ensureMigrated();
    const id = z.string().uuid().safeParse(input.id);
    if (!id.success) return { ok: false, error: "ID inválido" };

    const found = await db
      .select()
      .from(importBatches)
      .where(eq(importBatches.id, id.data))
      .limit(1);
    const batch = found[0];
    if (!batch) return { ok: false, error: "Importación no encontrada" };

    const deleted = await db
      .delete(attendanceDays)
      .where(
        and(
          gte(attendanceDays.workDate, batch.periodStart),
          lte(attendanceDays.workDate, batch.periodEnd)
        )
      )
      .returning({ id: attendanceDays.id });

    await db.delete(importBatches).where(eq(importBatches.id, batch.id));

    // Recalcular employees.active: un empleado queda activo si tiene al menos
    // un attendance_day con marcas crudas no vacías.
    await db.execute(sql`
      update ${employees} set active = exists(
        select 1 from ${attendanceDays} a
        where a.employee_id = ${employees}.id
          and jsonb_array_length(a.raw_punches) > 0
      )
    `);

    revalidatePath("/import");
    revalidatePath("/", "layout");
    return { ok: true, data: { deletedDays: deleted.length } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}
