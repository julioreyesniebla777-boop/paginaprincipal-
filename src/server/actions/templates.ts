"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { assertAdmin } from "@/server/auth/guards";
import { rateLimit } from "@/server/rate-limit";
import { templateSchema, TEMPLATE_TYPES } from "@/lib/validation/template";
import { formDataToObject, fromZodError, type ActionState } from "@/lib/action-state";
import { sanitizeEmailHtml } from "@/lib/sanitize";
import { DEFAULT_TEMPLATES } from "@/server/notifications/default-templates";
import { renderPreview } from "@/server/notifications/templates";
import { sendMail } from "@/server/notifications/mailer";
import { guarded, UserError } from "./_utils";

export async function saveTemplateAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    await assertAdmin();
    const parsed = templateSchema.safeParse(formDataToObject(fd));
    if (!parsed.success) return fromZodError(parsed.error);
    const d = parsed.data;
    const bodyHtml = sanitizeEmailHtml(d.bodyHtml);
    await prisma.emailTemplate.upsert({
      where: { type: d.type },
      update: { subject: d.subject, bodyHtml, enabled: d.enabled },
      create: { type: d.type, subject: d.subject, bodyHtml, enabled: d.enabled },
    });
    revalidatePath("/panel/notificaciones");
    return { ok: true, message: "Plantilla guardada" };
  });
}

export async function resetTemplateAction(fd: FormData): Promise<void> {
  await assertAdmin();
  const type = String(fd.get("type"));
  if (!(TEMPLATE_TYPES as readonly string[]).includes(type)) return;
  const def = DEFAULT_TEMPLATES[type as (typeof TEMPLATE_TYPES)[number]];
  await prisma.emailTemplate.upsert({
    where: { type: type as (typeof TEMPLATE_TYPES)[number] },
    update: { subject: def.subject, bodyHtml: def.bodyHtml, enabled: true },
    create: { type: type as (typeof TEMPLATE_TYPES)[number], subject: def.subject, bodyHtml: def.bodyHtml },
  });
  revalidatePath("/panel/notificaciones");
  redirect(`/panel/notificaciones/${type}?r=${Date.now()}`);
}

export async function previewTemplateAction(subject: string, bodyHtml: string): Promise<{ subject: string; html: string }> {
  await assertAdmin();
  const r = await renderPreview(String(subject).slice(0, 190), String(bodyHtml).slice(0, 20000));
  return { subject: r.subject, html: r.html };
}

export async function sendTestEmailAction(subject: string, bodyHtml: string): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertAdmin();
    if (!(await rateLimit(`test-email:${user.id}`, 10, 3600)).ok) throw new UserError("Demasiados correos de prueba; espera un poco.");
    const r = await renderPreview(String(subject).slice(0, 190), String(bodyHtml).slice(0, 20000));
    try {
      await sendMail({ to: user.email, subject: `[Prueba] ${r.subject}`, html: r.html, text: r.text });
    } catch (err) {
      throw new UserError(`No se pudo enviar: ${err instanceof Error ? err.message : "error SMTP"}. Revisa la configuración SMTP del .env.`);
    }
    return { ok: true, message: `Correo de prueba enviado a ${user.email}` };
  });
}
