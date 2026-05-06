"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, sessions, ROLES, type Role } from "@/lib/db/schema";
import { requireAdmin, invalidateSessionCache } from "@/lib/auth-helpers";

type Result<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };

export type AdminUserRow = {
  id: string;
  username: string;
  name: string;
  role: Role;
  active: boolean;
  mustChangePassword: boolean;
  createdAt: string;
  lastLoginAt: string | null;
};

const usernameSchema = z
  .string()
  .trim()
  .min(3, "Mínimo 3 caracteres")
  .max(60)
  .regex(/^[a-z0-9._-]+$/, "Solo letras minúsculas, números, punto, guion y guion bajo");

const passwordSchema = z.string().min(8, "Mínimo 8 caracteres").max(200);

/* =========================== Listado =========================== */

export async function listUsersAction(): Promise<AdminUserRow[]> {
  await requireAdmin();
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      name: users.name,
      role: users.role,
      active: users.active,
      mustChangePassword: users.mustChangePassword,
      createdAt: users.createdAt,
      lastLoginAt: users.lastLoginAt,
    })
    .from(users)
    .orderBy(asc(users.createdAt));

  return rows.map((r) => ({
    id: r.id,
    username: r.username,
    name: r.name,
    role: r.role,
    active: r.active,
    mustChangePassword: r.mustChangePassword,
    createdAt: r.createdAt.toISOString(),
    lastLoginAt: r.lastLoginAt?.toISOString() ?? null,
  }));
}

/* =========================== Crear =========================== */

const createSchema = z.object({
  username: usernameSchema,
  name: z.string().trim().min(1, "Nombre requerido").max(120),
  role: z.enum(ROLES),
  password: passwordSchema,
});

export async function createUserAction(input: {
  username: string;
  name: string;
  role: Role;
  password: string;
}): Promise<Result<{ id: string }>> {
  try {
    await requireAdmin();
    const parsed = createSchema.safeParse({ ...input, username: input.username?.toLowerCase() });
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }

    const exists = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, parsed.data.username))
      .limit(1);
    if (exists[0]) return { ok: false, error: "Ese usuario ya existe" };

    const hash = await bcrypt.hash(parsed.data.password, 10);
    const inserted = await db
      .insert(users)
      .values({
        username: parsed.data.username,
        name: parsed.data.name,
        role: parsed.data.role,
        passwordHash: hash,
        mustChangePassword: true,
      })
      .returning({ id: users.id });

    revalidatePath("/settings/users");
    return { ok: true, data: { id: inserted[0].id } };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}

/* =========================== Cambiar rol =========================== */

const roleSchema = z.object({ id: z.string().uuid(), role: z.enum(ROLES) });

export async function updateUserRoleAction(input: {
  id: string;
  role: Role;
}): Promise<Result> {
  try {
    const me = await requireAdmin();
    const parsed = roleSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Datos inválidos" };
    if (parsed.data.id === me.id && parsed.data.role !== "admin") {
      return { ok: false, error: "No puedes quitarte tu propio rol de admin" };
    }
    await db
      .update(users)
      .set({ role: parsed.data.role, updatedAt: new Date() })
      .where(eq(users.id, parsed.data.id));
    invalidateSessionCache();
    revalidatePath("/settings/users");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}

/* =========================== Activar/Desactivar =========================== */

const activeSchema = z.object({ id: z.string().uuid(), active: z.boolean() });

export async function setUserActiveAction(input: {
  id: string;
  active: boolean;
}): Promise<Result> {
  try {
    const me = await requireAdmin();
    const parsed = activeSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Datos inválidos" };
    if (parsed.data.id === me.id && !parsed.data.active) {
      return { ok: false, error: "No puedes desactivarte a ti mismo" };
    }
    await db
      .update(users)
      .set({ active: parsed.data.active, updatedAt: new Date() })
      .where(eq(users.id, parsed.data.id));
    if (!parsed.data.active) {
      // Cierra todas sus sesiones activas.
      await db.delete(sessions).where(eq(sessions.userId, parsed.data.id));
    }
    invalidateSessionCache();
    revalidatePath("/settings/users");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}

/* =========================== Eliminar =========================== */

export async function deleteUserAction(input: { id: string }): Promise<Result> {
  try {
    const me = await requireAdmin();
    const id = z.string().uuid().safeParse(input.id);
    if (!id.success) return { ok: false, error: "ID inválido" };
    if (id.data === me.id) return { ok: false, error: "No puedes eliminarte a ti mismo" };

    // sessions tiene ON DELETE CASCADE.
    await db.delete(users).where(eq(users.id, id.data));
    invalidateSessionCache();
    revalidatePath("/settings/users");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}

/* =========================== Reset password (admin) =========================== */

const resetSchema = z.object({
  id: z.string().uuid(),
  newPassword: passwordSchema,
});

export async function resetPasswordAction(input: {
  id: string;
  newPassword: string;
}): Promise<Result> {
  try {
    await requireAdmin();
    const parsed = resetSchema.safeParse(input);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
    }
    const hash = await bcrypt.hash(parsed.data.newPassword, 10);
    await db
      .update(users)
      .set({
        passwordHash: hash,
        mustChangePassword: true,
        updatedAt: new Date(),
      })
      .where(eq(users.id, parsed.data.id));
    // Cierra sus sesiones para forzar relogin.
    await db.delete(sessions).where(eq(sessions.userId, parsed.data.id));
    invalidateSessionCache();
    revalidatePath("/settings/users");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}

/* =========================== Renombrar =========================== */

const nameSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
});

export async function updateUserNameAction(input: {
  id: string;
  name: string;
}): Promise<Result> {
  try {
    await requireAdmin();
    const parsed = nameSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Datos inválidos" };
    await db
      .update(users)
      .set({ name: parsed.data.name, updatedAt: new Date() })
      .where(eq(users.id, parsed.data.id));
    invalidateSessionCache();
    revalidatePath("/settings/users");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Error" };
  }
}
