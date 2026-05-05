"use server";

import { db, ensureMigrated } from "@/lib/db";
import { users, ROLES, type Role } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth-helpers";

export async function updateUserRoleAction(input: { id: string; role: Role }): Promise<{ ok: true }> {
  const me = await requireAdmin();
  await ensureMigrated();
  if (!ROLES.includes(input.role)) throw new Error("Rol inválido");
  // No te quites tu propio admin
  if (input.id === me.id && input.role !== "admin") {
    throw new Error("No puedes quitarte tu propio rol de admin");
  }
  await db.update(users).set({ role: input.role }).where(eq(users.id, input.id));
  revalidatePath("/settings/users");
  return { ok: true };
}

export async function setUserActiveAction(input: { id: string; active: boolean }): Promise<{ ok: true }> {
  const me = await requireAdmin();
  await ensureMigrated();
  if (input.id === me.id && !input.active) {
    throw new Error("No puedes desactivarte a ti mismo");
  }
  await db.update(users).set({ active: input.active }).where(eq(users.id, input.id));
  revalidatePath("/settings/users");
  return { ok: true };
}
