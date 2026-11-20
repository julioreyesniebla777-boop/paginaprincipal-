import "server-only";
import type { TemplateType } from "@prisma/client";
import { prisma } from "@/server/db";
import { appUrl, getBusiness } from "@/server/business";
import { htmlToText, renderTemplate, type TemplateVars } from "@/lib/template";
import { DEFAULT_TEMPLATES } from "./default-templates";
import { emailLayout } from "./layout";

export type RenderedEmail = { subject: string; html: string; text: string; enabled: boolean };

/** Carga la plantilla (o la predeterminada) y la renderiza con las variables. */
export async function renderEmail(type: TemplateType, vars: TemplateVars): Promise<RenderedEmail> {
  const [tpl, business] = await Promise.all([
    prisma.emailTemplate.findUnique({ where: { type } }),
    getBusiness(),
  ]);
  const source = tpl ?? { ...DEFAULT_TEMPLATES[type], enabled: true };
  const allVars: TemplateVars = { negocio: business.name, direccion: business.address ?? "", telefono_negocio: business.phone ?? "", ...vars };
  const body = renderTemplate(source.bodyHtml, allVars, { html: true });
  return {
    subject: renderTemplate(source.subject, allVars, { html: false }),
    html: emailLayout({ businessName: business.name, color: business.primaryColor, logoUrl: business.logoUrl?.startsWith("/") ? appUrl(business.logoUrl) : business.logoUrl, body }),
    text: htmlToText(body),
    enabled: source.enabled,
  };
}
