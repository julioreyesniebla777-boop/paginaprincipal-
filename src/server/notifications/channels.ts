import "server-only";
import type { Appointment, Customer, TemplateType } from "@prisma/client";
import type { TemplateVars } from "@/lib/template";

/**
 * Integración preparada para SMS / WhatsApp (sin implementar).
 *
 * Para añadir un proveedor (Twilio, WhatsApp Cloud API, etc.):
 *  1. Implementa NotificationProvider en un archivo nuevo.
 *  2. Añádelo a PROVIDERS.
 *  3. Define sus variables de entorno (ej. TWILIO_ACCOUNT_SID) en .env.
 * dispatchToExtraChannels() ya se llama tras cada correo de cita y registra
 * el resultado en NotificationLog con el canal correspondiente.
 */
export interface OutgoingMessage {
  to: string;
  text: string;
  templateType: TemplateType;
}

export interface NotificationProvider {
  readonly channel: "SMS" | "WHATSAPP";
  readonly name: string;
  /** true cuando las credenciales están configuradas. */
  isConfigured(): boolean;
  send(msg: OutgoingMessage): Promise<void>;
}

/** Plantillas de texto corto para SMS/WhatsApp. */
export const SHORT_TEMPLATES: Partial<Record<TemplateType, string>> = {
  BOOKING_CONFIRMATION: "{negocio}: tu cita de {servicio} es el {fecha} a las {hora}. Gestionar: {enlace_gestion}",
  REMINDER: "{negocio}: recordatorio de tu cita de {servicio} el {fecha} a las {hora}.",
  RESCHEDULED: "{negocio}: tu cita se movió al {fecha} a las {hora}.",
  CANCELLED: "{negocio}: tu cita de {servicio} del {fecha} fue cancelada.",
};

class NotImplementedProvider implements NotificationProvider {
  constructor(
    readonly channel: "SMS" | "WHATSAPP",
    readonly name: string,
  ) {}
  isConfigured() {
    return false;
  }
  async send(): Promise<void> {
    throw new Error(`${this.name}: proveedor no implementado`);
  }
}

export const PROVIDERS: NotificationProvider[] = [new NotImplementedProvider("SMS", "SMS"), new NotImplementedProvider("WHATSAPP", "WhatsApp")];

export function extraChannelsStatus() {
  return PROVIDERS.map((p) => ({ channel: p.channel, name: p.name, configured: p.isConfigured() }));
}

export async function dispatchToExtraChannels(
  appt: Appointment & { customer: Customer },
  type: TemplateType,
  vars: TemplateVars,
): Promise<void> {
  const active = PROVIDERS.filter((p) => p.isConfigured());
  if (!active.length || !appt.customer.phone || !SHORT_TEMPLATES[type]) return;
  const { renderTemplate } = await import("@/lib/template");
  const { prisma } = await import("@/server/db");
  const text = renderTemplate(SHORT_TEMPLATES[type]!, vars, { html: false });
  for (const p of active) {
    try {
      await p.send({ to: appt.customer.phone, text, templateType: type });
      await prisma.notificationLog.create({ data: { appointmentId: appt.id, channel: p.channel, templateType: type, recipient: appt.customer.phone, status: "SENT" } });
    } catch (err) {
      await prisma.notificationLog.create({
        data: { appointmentId: appt.id, channel: p.channel, templateType: type, recipient: appt.customer.phone, status: "FAILED", error: String(err).slice(0, 1000) },
      });
    }
  }
}
