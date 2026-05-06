import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth-constants";

const PUBLIC_PREFIXES = ["/login", "/_next", "/favicon"];

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;
  const isPublic = PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
  const hasSession = !!request.cookies.get(SESSION_COOKIE)?.value;

  // Cookie inválida marcada por el layout: limpiarla y mostrar login limpio.
  if (pathname === "/login" && searchParams.get("stale") === "1") {
    const url = request.nextUrl.clone();
    url.searchParams.delete("stale");
    const res = NextResponse.redirect(url);
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }

  if (!isPublic && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    if (pathname !== "/") url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  if (pathname === "/login" && hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = request.nextUrl.searchParams.get("from") ?? "/";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Propaga el pathname para que server components puedan leerlo vía headers().
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg|jpeg|gif|webp)$).*)",
  ],
};
