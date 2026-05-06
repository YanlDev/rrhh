"use server";

import { db, ensureMigrated } from "@/lib/db";
import { justificationTypes } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-helpers";

export async function createJustificationTypeAction(input: {
  code: string;
  labelEs: string;
  countsAsWorked: boolean;
  color?: string;
  orderIndex?: number;
}): Promise<{ ok: true }> {
  await requireAdmin();
  await ensureMigrated();
  await db.insert(justificationTypes).values({
    code: input.code.trim(),
    labelEs: input.labelEs.trim(),
    countsAsWorked: input.countsAsWorked,
    color: input.color ?? "#6b7280",
    orderIndex: input.orderIndex ?? 99,
    active: true,
  });
  revalidatePath("/settings");
  return { ok: true };
}

export async function updateJustificationTypeAction(input: {
  id: string;
  code?: string;
  labelEs?: string;
  countsAsWorked?: boolean;
  color?: string | null;
  orderIndex?: number;
  active?: boolean;
}): Promise<{ ok: true }> {
  await requireAdmin();
  await ensureMigrated();
  const { id, ...rest } = input;
  await db.update(justificationTypes).set(rest).where(eq(justificationTypes.id, id));
  revalidatePath("/settings");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deactivateJustificationTypeAction(id: string): Promise<{ ok: true }> {
  await requireAdmin();
  await ensureMigrated();
  await db.update(justificationTypes).set({ active: false }).where(eq(justificationTypes.id, id));
  revalidatePath("/settings");
  return { ok: true };
}
