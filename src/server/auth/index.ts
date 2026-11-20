import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/server/db";
import { rateLimit } from "@/server/rate-limit";
import { loginSchema } from "@/lib/validation/auth";
import { authConfig } from "./config";

class RateLimitedError extends CredentialsSignin {
  code = "rate_limited";
}

// Hash ficticio para igualar tiempos cuando el usuario no existe.
const DUMMY_HASH = "$2b$12$OXB4mnwlTjv7N8f6XehBQe0SRFJyoHBnGYewoXIjiH5m8ARkPzAIK";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: { email: {}, password: {} },
      async authorize(raw, request) {
        const parsed = loginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const h = request?.headers;
        const ip = h?.get?.("x-forwarded-for")?.split(",")[0]?.trim() || h?.get?.("x-real-ip") || "unknown";

        const [byIp, byEmail] = await Promise.all([
          rateLimit(`login:ip:${ip}`, 30, 15 * 60),
          rateLimit(`login:email:${email}`, 8, 15 * 60),
        ]);
        if (!byIp.ok || !byEmail.ok) throw new RateLimitedError();

        const user = await prisma.user.findUnique({ where: { email } });
        const valid = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
        if (!user || !valid || !user.isActive) return null;

        await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        return { id: user.id, email: user.email, name: user.name, role: user.role };
      },
    }),
  ],
});
