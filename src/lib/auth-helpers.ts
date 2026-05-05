import { auth } from "@/auth";
import type { Role } from "@/lib/db/schema";

export class AuthError extends Error {
  constructor(message: string) { super(message); this.name = "AuthError"; }
}

export async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new AuthError("No autenticado");
  if (session.user.active === false) throw new AuthError("Cuenta desactivada");
  return session.user;
}

export async function requireRole(...allowed: Role[]) {
  const user = await requireUser();
  if (!allowed.includes(user.role)) throw new AuthError(`Permiso denegado (requiere: ${allowed.join(" o ")})`);
  return user;
}

export async function requireAdmin() { return requireRole("admin"); }
export async function requireRrhh() { return requireRole("admin", "rrhh"); }
