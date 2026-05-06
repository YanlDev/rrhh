"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { users, sessions } from "@/lib/db/schema";
import { SESSION_COOKIE, SESSION_TTL_DAYS } from "@/lib/auth-constants";
import { newSessionToken, getCurrentUser, invalidateSessionCache } from "@/lib/auth-helpers";

type Result = { ok: true } | { ok: false; error: string };

const loginSchema = z.object({
  username: z.string().trim().min(1, "Usuario requerido").max(60),
  password: z.string().min(1, "Contraseña requerida").max(200),
});

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
const attempts = new Map<string, { count: number; resetAt: number }>();

function checkRate(key: string): boolean {
  const now = Date.now();
  const e = attempts.get(key);
  if (!e || e.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  if (e.count >= RATE_LIMIT_MAX) return false;
  e.count++;
  return true;
}

export async function loginAction(input: {
  username: string;
  password: string;
}): Promise<Result> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const username = parsed.data.username.toLowerCase();

  if (!checkRate(`login:${username}`)) {
    return { ok: false, error: "Demasiados intentos. Espera un minuto." };
  }

  const found = await db.select().from(users).where(eq(users.username, username));
  const user = found[0];
  if (!user) return { ok: false, error: "Usuario o contraseña incorrectos" };
  if (!user.active) return { ok: false, error: "Cuenta desactivada" };

  const valid = await bcrypt.compare(parsed.data.password, user.passwordHash);
  if (!valid) return { ok: false, error: "Usuario o contraseña incorrectos" };

  const token = newSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  const h = await headers();
  await db.insert(sessions).values({
    token,
    userId: user.id,
    expiresAt,
    userAgent: h.get("user-agent")?.slice(0, 500) ?? null,
    ip: h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  invalidateSessionCache(token);
  return { ok: true };
}

export async function logoutAction(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.token, token));
    jar.delete(SESSION_COOKIE);
    invalidateSessionCache(token);
  }
  redirect("/login");
}

/* =========================== Cambio de password (usuario en sesión) =========================== */

const changeSchema = z.object({
  currentPassword: z.string().min(1, "Ingresa tu contraseña actual"),
  newPassword: z.string().min(8, "Mínimo 8 caracteres").max(200),
});

export async function changeOwnPasswordAction(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<Result> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "No autenticado" };

  const parsed = changeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const found = await db.select().from(users).where(eq(users.id, me.id));
  const user = found[0];
  if (!user) return { ok: false, error: "Usuario no encontrado" };

  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) return { ok: false, error: "Contraseña actual incorrecta" };

  const newHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await db
    .update(users)
    .set({
      passwordHash: newHash,
      mustChangePassword: false,
      updatedAt: new Date(),
    })
    .where(eq(users.id, me.id));

  invalidateSessionCache();
  return { ok: true };
}
