// Constantes compartibles entre Edge (middleware) y Node (server actions).
// Mantener este archivo libre de imports pesados (DB, bcrypt, next/headers).
export const SESSION_COOKIE = "rrhh_session";
export const SESSION_TTL_DAYS = 30;
