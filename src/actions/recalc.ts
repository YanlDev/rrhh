"use server";

import { ensureMigrated } from "@/lib/db";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-helpers";
import { recalcAttendanceDays } from "@/lib/analyzer/recalc-day";

export async function recalcAllAction(): Promise<{ updated: number }> {
  await requireAdmin();
  await ensureMigrated();
  const updated = await recalcAttendanceDays(null);
  // Invalidar solo las rutas que muestran data, sin volar todo el árbol.
  revalidatePath("/");
  revalidatePath("/review");
  revalidatePath("/employees");
  return { updated };
}
