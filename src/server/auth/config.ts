import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

/**
 * Configuración compatible con el runtime Edge (sin Prisma ni bcrypt),
 * usada por el middleware para proteger rutas. La configuración completa
 * con el proveedor de credenciales está en ./index.ts.
 */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  trustHost: true,
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (typeof token.id === "string") session.user.id = token.id;
      if (token.role) session.user.role = token.role as Role;
      return session;
    },
    authorized({ auth, request }) {
      const { pathname, search } = request.nextUrl;
      const role = auth?.user?.role;
      const needsStaff = pathname.startsWith("/panel");
      const needsLogin = needsStaff || pathname.startsWith("/mi-cuenta") || pathname === "/cuenta";

      if (!needsLogin) return true;
      if (!auth?.user) {
        const url = new URL("/login", request.nextUrl);
        url.searchParams.set("callbackUrl", pathname + search);
        return Response.redirect(url);
      }
      if (needsStaff && role !== "ADMIN" && role !== "EMPLOYEE") {
        return Response.redirect(new URL("/mi-cuenta", request.nextUrl));
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
