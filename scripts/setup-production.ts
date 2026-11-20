/**
 * Configuración inicial segura para producción (NO borra datos).
 * - Crea el registro del negocio si no existe.
 * - Crea las plantillas de correo que falten.
 * - Crea (o restablece la contraseña de) un administrador.
 *
 * Uso:
 *   ADMIN_EMAIL=tu@correo.com ADMIN_PASSWORD='ClaveSegura123' ADMIN_NAME='Tu Nombre' \
 *   BUSINESS_NAME='Mi Negocio' npm run setup:prod
 */
import { PrismaClient, type TemplateType } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_TEMPLATES } from "../src/server/notifications/default-templates";

const prisma = new PrismaClient();

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || "Administrador";
  if (!email || !password) throw new Error("Define ADMIN_EMAIL y ADMIN_PASSWORD");
  if (password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new Error("ADMIN_PASSWORD debe tener al menos 10 caracteres, con letras y números");
  }

  if (!(await prisma.business.findFirst())) {
    await prisma.business.create({
      data: { name: process.env.BUSINESS_NAME?.trim() || "Mi negocio", slug: "negocio", email: process.env.BUSINESS_EMAIL?.trim() || email },
    });
    console.log("✓ Negocio creado (ajústalo en Panel → Configuración)");
  }

  for (const [type, t] of Object.entries(DEFAULT_TEMPLATES)) {
    const exists = await prisma.emailTemplate.findUnique({ where: { type: type as TemplateType } });
    if (!exists) await prisma.emailTemplate.create({ data: { type: type as TemplateType, subject: t.subject, bodyHtml: t.bodyHtml } });
  }
  console.log("✓ Plantillas de correo verificadas");

  const passwordHash = await bcrypt.hash(password, 12);
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({ where: { id: existing.id }, data: { passwordHash, role: "ADMIN", isActive: true, name } });
    console.log(`✓ Administrador actualizado: ${email}`);
  } else {
    await prisma.user.create({ data: { email, name, passwordHash, role: "ADMIN" } });
    console.log(`✓ Administrador creado: ${email}`);
  }
}

main()
  .catch((e) => {
    console.error("✗", e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
