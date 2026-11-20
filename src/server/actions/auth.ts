"use server";

import bcrypt from "bcryptjs";
import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { signIn, signOut } from "@/server/auth";
import { rateLimit } from "@/server/rate-limit";
import { getClientIp } from "@/server/request";
import { appUrl } from "@/server/business";
import { sendMail } from "@/server/notifications/mailer";
import { renderEmail } from "@/server/notifications/templates";
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from "@/lib/validation/auth";
import { formDataToObject, fromZodError, type ActionState } from "@/lib/action-state";
import { generateToken, hashToken } from "@/lib/tokens";
import { normalizePhone, safeRedirectPath } from "@/lib/utils";

const BCRYPT_ROUNDS = 12;
const TOO_MANY = "Demasiados intentos. Espera unos minutos y vuelve a intentarlo.";

export async function loginAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return fromZodError(parsed.error);
  const redirectTo = safeRedirectPath(parsed.data.callbackUrl, "/cuenta");
  try {
    await signIn("credentials", { email: parsed.data.email, password: parsed.data.password, redirectTo });
  } catch (err) {
    if (err instanceof AuthError) {
      const code = (err as AuthError & { code?: string }).code;
      if (code === "rate_limited") return { ok: false, error: TOO_MANY };
      return { ok: false, error: "Email o contraseña incorrectos" };
    }
    throw err; // redirección de éxito (NEXT_REDIRECT)
  }
  return { ok: true };
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" });
}

export async function registerAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const ip = await getClientIp();
  if (!(await rateLimit(`register:${ip}`, 5, 60 * 60)).ok) return { ok: false, error: TOO_MANY };

  const parsed = registerSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return fromZodError(parsed.error);
  const { name, email, phone, password } = parsed.data;

  const exists = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (exists) return { ok: false, fieldErrors: { email: ["Ya existe una cuenta con este email"] }, error: "Ya existe una cuenta con este email" };

  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({ data: { email, name, passwordHash, role: "CUSTOMER" } });
    // Vincula la ficha de cliente existente (reservas como invitado con el mismo email).
    const customer = await tx.customer.findFirst({ where: { email, userId: null }, orderBy: { createdAt: "asc" } });
    if (customer) {
      await tx.customer.update({
        where: { id: customer.id },
        data: {
          userId: user.id,
          ...(phone && !customer.phone ? { phone, phoneNormalized: normalizePhone(phone) } : {}),
        },
      });
    } else {
      await tx.customer.create({
        data: { userId: user.id, name, email, phone: phone || null, phoneNormalized: normalizePhone(phone) },
      });
    }
  });

  try {
    await signIn("credentials", { email, password, redirectTo: "/mi-cuenta" });
  } catch (err) {
    if (err instanceof AuthError) redirect("/login?registrado=1");
    throw err;
  }
  return { ok: true };
}

export async function forgotPasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = forgotPasswordSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return fromZodError(parsed.error);
  const { email } = parsed.data;

  const ip = await getClientIp();
  const [a, b] = await Promise.all([rateLimit(`forgot:ip:${ip}`, 10, 60 * 60), rateLimit(`forgot:email:${email}`, 3, 60 * 60)]);
  if (!a.ok || !b.ok) return { ok: false, error: TOO_MANY };

  const generic: ActionState = {
    ok: true,
    message: "Si el email está registrado, recibirás un enlace para restablecer tu contraseña en unos minutos.",
  };

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.isActive) return generic;

  const token = generateToken();
  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } }),
    prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 60 * 60 * 1000) },
    }),
  ]);

  try {
    const mail = await renderEmail("PASSWORD_RESET", { cliente: user.name, enlace: appUrl(`/restablecer/${token}`) });
    await sendMail({ to: user.email, subject: mail.subject, html: mail.html, text: mail.text });
  } catch (err) {
    console.error("[auth] No se pudo enviar el correo de recuperación", err);
  }
  return generic;
}

export async function resetPasswordAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = resetPasswordSchema.safeParse(formDataToObject(fd));
  if (!parsed.success) return fromZodError(parsed.error);

  const ip = await getClientIp();
  if (!(await rateLimit(`reset:${ip}`, 10, 60 * 60)).ok) return { ok: false, error: TOO_MANY };

  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hashToken(parsed.data.token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return { ok: false, error: "El enlace no es válido o ya venció. Solicita uno nuevo." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, BCRYPT_ROUNDS);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.passwordResetToken.deleteMany({ where: { userId: record.userId, usedAt: null } }),
  ]);
  redirect("/login?restablecido=1");
}
