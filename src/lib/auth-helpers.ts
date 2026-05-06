import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { randomBytes } from "node:crypto";
import { cache } from "react";
import { eq, and, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, sessions, type Role } from "@/lib/db/schema";

export { SESSION_COOKIE, SESSION_TTL_DAYS } from "./auth-constants";
import { SESSION_COOKIE } from "./auth-constants";

export type { Role };

export type AppUser = {
  id: string;
  username: string;
  name: string;
  role: Role;
  active: boolean;
  mustChangePassword: boolean;
};

export class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}

export function newSessionToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Cache cross-request en memoria: evita golpear la BD en cada navegación.
 * TTL corto (30s). Si un admin desactiva un usuario, este sigue navegando
 * hasta 30s más; el panel admin invalida explícitamente al cambiar rol/active.
 */
const SESSION_CACHE_TTL_MS = 30_000;
const sessionCache = new Map<string, { user: AppUser | null; expires: number }>();

export function invalidateSessionCache(token?: string) {
  if (token) sessionCache.delete(token);
  else sessionCache.clear();
}

async function loadUserByToken(token: string): Promise<AppUser | null> {
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      name: users.name,
      role: users.role,
      active: users.active,
      mustChangePassword: users.mustChangePassword,
    })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
    .limit(1);

  const row = rows[0];
  if (!row || !row.active) return null;
  return row;
}

/**
 * Lee la cookie de sesión y devuelve el usuario actual.
 * - `React.cache` deduplica llamadas dentro del mismo request (layout + page).
 * - `sessionCache` reutiliza el resultado entre requests por 30s.
 */
export const getCurrentUser = cache(async (): Promise<AppUser | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const now = Date.now();
  const hit = sessionCache.get(token);
  if (hit && hit.expires > now) return hit.user;

  const user = await loadUserByToken(token);
  sessionCache.set(token, { user, expires: now + SESSION_CACHE_TTL_MS });
  return user;
});

export async function requireUser(): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("No autenticado");
  if (!user.active) throw new AuthError("Cuenta desactivada");
  return user;
}

export async function requireRole(...allowed: Role[]): Promise<AppUser> {
  const user = await requireUser();
  if (!allowed.includes(user.role)) {
    throw new AuthError(`Permiso denegado (requiere: ${allowed.join(" o ")})`);
  }
  return user;
}

export async function requireAdmin() {
  return requireRole("admin");
}
export async function requireRrhh() {
  return requireRole("admin", "rrhh");
}

/** En páginas (Server Components): si no hay sesión redirige a /login. */
export async function requireUserOrRedirect(from?: string): Promise<AppUser> {
  const user = await getCurrentUser();
  if (!user) {
    const url = from ? `/login?from=${encodeURIComponent(from)}` : "/login";
    redirect(url);
  }
  if (!user.active) redirect("/login?error=inactive");
  return user;
}

/** Para páginas que requieren un rol específico: redirige a "/" si no califica. */
export async function requireRoleOrRedirect(...allowed: Role[]): Promise<AppUser> {
  const user = await requireUserOrRedirect();
  if (!allowed.includes(user.role)) redirect("/");
  return user;
}
