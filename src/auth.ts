import NextAuth from "next-auth";
import { DrizzleAdapter } from "@auth/drizzle-adapter";
import { db } from "@/lib/db";
import { accounts, sessions, users, verificationTokens, type Role } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { authConfig } from "./auth.config";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      image?: string | null;
      role: Role;
      active: boolean;
    };
  }
}

const adapter = DrizzleAdapter(db, {
  usersTable: users,
  accountsTable: accounts,
  sessionsTable: sessions,
  verificationTokensTable: verificationTokens,
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter,
  session: { strategy: "database" },
  callbacks: {
    ...authConfig.callbacks,
    async session({ session, user }) {
      if (!session.user) return session;
      const dbUser = (await db.select().from(users).where(eq(users.id, user.id)))[0];
      if (!dbUser) return session;
      session.user.id = dbUser.id;
      session.user.role = dbUser.role;
      session.user.active = dbUser.active;
      return session;
    },
  },
  events: {
    async createUser({ user }) {
      if (!user?.id) return;
      const count = (await db.select({ id: users.id }).from(users)).length;
      if (count === 1) {
        await db.update(users).set({ role: "admin" }).where(eq(users.id, user.id));
      }
    },
  },
});
