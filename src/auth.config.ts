import type { NextAuthConfig } from "next-auth";
import Google from "next-auth/providers/google";

/**
 * Config Edge-safe (sin adapter ni acceso a DB).
 * Usado por el middleware. La versión completa con DB vive en src/auth.ts
 */
export const authConfig: NextAuthConfig = {
  trustHost: true,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      allowDangerousEmailAccountLinking: true,
    }),
  ],
  pages: { signIn: "/login" },
  callbacks: {
    authorized({ auth, request }) {
      const { pathname } = request.nextUrl;
      const isLogin = pathname === "/login";
      const isAuthApi = pathname.startsWith("/api/auth");
      if (isLogin || isAuthApi) return true;
      return !!auth?.user;
    },
  },
};
