import "server-only";
import type { TemplateType } from "@prisma/client";
import { prisma } from "@/server/db";
import { appUrl, getBusiness } from "@/server/business";
import { fmtDate, fmtTime } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { buildIcs } from "@/lib/ics";
import { manageTokenFor } from "@/lib/manage-token";
import { STATUS_LABELS } from "@/lib/labels";
import type { TemplateVars } from "@/lib/template";
import { sendMail } from "./mailer";
import { renderEmail } from "./templates";
import { dispatchToExtraChannels } from "./channels";

export function manageUrl(appointmentId: string) {
  return appUrl(`/cita/${manageTokenFor(appointmentId)}`);
}

async function loadAppointment(id: string) {
  return prisma.appointment.findUnique({ where: { id }, include: { service: true, employee: true, customer: true } });
}

type Loaded = NonNullable<Awaited<ReturnType<typeof loadAppointment>>>;

export async function appointmentVars(appt: Loaded): Promise<TemplateVars> {
  const b = await getBusiness();
  return {
    cliente: appt.customer.name,
    servicio: appt.service.name,
    fecha: fmtDate(appt.startsAt, b.timezone, b.locale),
    hora: fmtTime(appt.startsAt, b.timezone, b.locale),
    profesional: appt.employee.displayName,
    enlace_gestion: manageUrl(appt.id),
    precio: formatMoney(appt.priceCents, b.currency, b.locale),
    estado: STATUS_LABELS[appt.status],
    notas: appt.customerNotes ?? "",
    enlace: appUrl("/reservar"),
  };
}

function icsFor(appt: Loaded, businessName: string, address: string | null, cancelled = false) {
  return buildIcs({
    uid: `${appt.id}@agenda`,
    start: appt.startsAt,
    end: appt.endsAt,
    summary: `${appt.service.name} – ${businessName}`,
    description: `Profesional: ${appt.employee.displayName}\nGestionar: ${manageUrl(appt.id)}`,
    location: address ?? undefined,
    cancelled,
    sequence: Math.floor(appt.updatedAt.getTime() / 1000),
  });
}

/**
 * Envía un correo de una cita y lo registra en NotificationLog.
 * Nunca lanza: un fallo de SMTP no debe romper la reserva.
 */
export async function sendAppointmentNotification(appointmentId: string, type: TemplateType): Promise<void> {
  try {
    const appt = await loadAppointment(appointmentId);
    if (!appt) return;
    const business = await getBusiness();
    const vars = await appointmentVars(appt);
    const toBusiness = type === "BUSINESS_NEW_BOOKING";
    if (toBusiness) vars.enlace = appUrl(`/panel/citas/${appt.id}`);
    const recipient = toBusiness ? business.email : appt.customer.email;

    const log = (status: "SENT" | "FAILED" | "SKIPPED", error?: string) =>
      prisma.notificationLog.create({
        data: { appointmentId: appt.id, channel: "EMAIL", templateType: type, recipient: recipient ?? "-", status, error: error ?? null },
      });

    if (!recipient) {
      await log("SKIPPED", "Sin email de destino");
    } else {
      const mail = await renderEmail(type, vars);
      if (!mail.enabled) {
        await log("SKIPPED", "Plantilla desactivada");
      } else {
        const withIcs = ["BOOKING_CONFIRMATION", "BOOKING_PENDING", "RESCHEDULED", "REMINDER", "CANCELLED"].includes(type);
        try {
          await sendMail({
            to: recipient,
            subject: mail.subject,
            html: mail.html,
            text: mail.text,
            replyTo: toBusiness ? (appt.customer.email ?? undefined) : (business.email ?? undefined),
            ...(withIcs
              ? { attachments: [{ filename: "cita.ics", content: icsFor(appt, business.name, business.address, type === "CANCELLED"), contentType: "text/calendar; charset=utf-8" }] }
              : {}),
          });
          await log("SENT");
        } catch (err) {
          await log("FAILED", err instanceof Error ? err.message.slice(0, 1000) : String(err));
        }
      }
    }

    if (!toBusiness) await dispatchToExtraChannels(appt, type, vars);
  } catch (err) {
    console.error("[notifications]", err);
  }
}

/** Correos tras una reserva nueva: al cliente y aviso al negocio. */
export async function notifyNewBooking(appointmentId: string, status: string) {
  await sendAppointmentNotification(appointmentId, status === "PENDING" ? "BOOKING_PENDING" : "BOOKING_CONFIRMATION");
  await sendAppointmentNotification(appointmentId, "BUSINESS_NEW_BOOKING");
}
