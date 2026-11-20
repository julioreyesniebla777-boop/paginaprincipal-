import "server-only";
import type { TemplateType } from "@prisma/client";
import { prisma } from "@/server/db";
import { appUrl, getBusiness } from "@/server/business";
import { htmlToText, renderTemplate, type TemplateVars } from "@/lib/template";
import { DEFAULT_TEMPLATES } from "./default-templates";
import { emailLayout } from "./layout";
import { sanitizeEmailHtml } from "@/lib/sanitize";

export type RenderedEmail = { subject: string; html: string; text: string; enabled: boolean };

/** Carga la plantilla (o la predeterminada) y la renderiza con las variables. */
export async function renderEmail(type: TemplateType, vars: TemplateVars): Promise<RenderedEmail> {
  const [tpl, business] = await Promise.all([
    prisma.emailTemplate.findUnique({ where: { type } }),
    getBusiness(),
  ]);
  const source = tpl ?? { ...DEFAULT_TEMPLATES[type], enabled: true };
  const allVars: TemplateVars = { negocio: business.name, direccion: business.address ?? "", telefono_negocio: business.phone ?? "", ...vars };
  const body = renderTemplate(sanitizeEmailHtml(source.bodyHtml), allVars, { html: true });
  return {
    subject: renderTemplate(source.subject, allVars, { html: false }),
    html: emailLayout({ businessName: business.name, color: business.primaryColor, logoUrl: business.logoUrl?.startsWith("/") ? appUrl(business.logoUrl) : business.logoUrl, body }),
    text: htmlToText(body),
    enabled: source.enabled,
  };
}

/** Variables de ejemplo para la vista previa y el correo de prueba. */
export const SAMPLE_VARS: TemplateVars = {
  cliente: "Ana Pérez",
  servicio: "Limpieza facial",
  fecha: "lunes, 7 de diciembre de 2026",
  hora: "10:30",
  profesional: "Sofía Torres",
  enlace_gestion: "https://ejemplo.com/cita/abc123",
  precio: "$65.00",
  estado: "Confirmada",
  notas: "Primera visita",
  enlace: "https://ejemplo.com/reservar",
};

/** Renderiza un asunto/cuerpo arbitrario (vista previa sin guardar). */
export async function renderPreview(subject: string, bodyHtml: string) {
  const business = await getBusiness();
  const vars: TemplateVars = { negocio: business.name, direccion: business.address ?? "", telefono_negocio: business.phone ?? "", ...SAMPLE_VARS };
  const body = renderTemplate(sanitizeEmailHtml(bodyHtml), vars, { html: true });
  return {
    subject: renderTemplate(subject, vars, { html: false }),
    html: emailLayout({ businessName: business.name, color: business.primaryColor, logoUrl: business.logoUrl?.startsWith("/") ? appUrl(business.logoUrl) : business.logoUrl, body }),
    text: htmlToText(body),
  };
}
