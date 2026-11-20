"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { getBusiness, appUrl } from "@/server/business";
import { getCurrentUser } from "@/server/auth/guards";
import { rateLimit } from "@/server/rate-limit";
import { getClientIp } from "@/server/request";
import { BookingError, cancelAppointment, createBooking, findByManageToken, rescheduleAppointment, type Actor } from "@/server/services/appointments";
import { notifyNewBooking, sendAppointmentNotification } from "@/server/notifications/dispatch";
import { bookingSchema, cancelSchema, rescheduleSchema } from "@/lib/validation/booking";
import { manageTokenFor } from "@/lib/manage-token";
import { googleCalendarUrl } from "@/lib/ics";
import { hashToken } from "@/lib/tokens";

export type BookingResult =
  | {
      ok: true;
      appointment: { id: string; start: string; end: string; status: string; serviceName: string; employeeName: string };
      manageUrl: string;
      icsUrl: string;
      googleUrl: string;
    }
  | { ok: false; error: string; code?: string; fieldErrors?: Record<string, string[] | undefined> };

const TOO_MANY = "Demasiadas solicitudes. Espera un momento y vuelve a intentarlo.";

export async function createBookingAction(payload: unknown): Promise<BookingResult> {
  const ip = await getClientIp();
  if (!(await rateLimit(`booking:ip:${ip}`, 10, 60 * 60)).ok) return { ok: false, error: TOO_MANY };

  const parsed = bookingSchema.safeParse(payload);
  if (!parsed.success) {
    // El honeypot relleno se trata como error genérico (no damos pistas al bot).
    return { ok: false, error: "Revisa los datos del formulario", fieldErrors: parsed.error.flatten().fieldErrors };
  }
  const d = parsed.data;
  if (d.renderedAt && Date.now() - d.renderedAt < 2500) return { ok: false, error: "Revisa los datos del formulario" };
  if (!(await rateLimit(`booking:email:${d.email}`, 5, 60 * 60)).ok) return { ok: false, error: TOO_MANY };

  const user = await getCurrentUser();
  const actor: Actor = user?.role === "CUSTOMER" ? { type: "CUSTOMER", userId: user.id } : { type: "GUEST" };

  try {
    const appt = await createBooking({
      serviceId: d.serviceId,
      employeeId: d.employeeId,
      start: new Date(d.start),
      customer: { name: d.name, email: d.email, phone: d.phone, userId: user?.role === "CUSTOMER" ? user.id : null },
      customerNotes: d.notes,
      source: "ONLINE",
      actor,
    });
    after(() => notifyNewBooking(appt.id, appt.status));
    revalidatePath("/panel", "layout");
    return buildResult(appt.id);
  } catch (err) {
    if (err instanceof BookingError) return { ok: false, error: err.message, code: err.code };
    console.error("[booking]", err);
    return { ok: false, error: "No pudimos completar la reserva. Inténtalo de nuevo." };
  }
}

async function buildResult(appointmentId: string): Promise<BookingResult> {
  const token = manageTokenFor(appointmentId);
  const appt = await findByManageToken(hashToken(token));
  if (!appt) return { ok: false, error: "Cita no encontrada" };
  const business = await getBusiness();
  return {
    ok: true,
    appointment: {
      id: appt.id,
      start: appt.startsAt.toISOString(),
      end: appt.endsAt.toISOString(),
      status: appt.status,
      serviceName: appt.service.name,
      employeeName: appt.employee.displayName,
    },
    manageUrl: appUrl(`/cita/${token}`),
    icsUrl: appUrl(`/api/public/ics/${token}`),
    googleUrl: googleCalendarUrl({
      start: appt.startsAt,
      end: appt.endsAt,
      summary: `${appt.service.name} – ${business.name}`,
      description: `Profesional: ${appt.employee.displayName}\nGestionar cita: ${appUrl(`/cita/${token}`)}`,
      location: business.address ?? undefined,
    }),
  };
}

async function tokenGuard(token: string) {
  const ip = await getClientIp();
  if (!(await rateLimit(`manage:${ip}`, 30, 60 * 60)).ok) throw new BookingError(TOO_MANY, "POLICY");
  if (typeof token !== "string" || token.length < 20 || token.length > 100) throw new BookingError("Enlace no válido", "NOT_FOUND");
  const appt = await findByManageToken(hashToken(token));
  if (!appt) throw new BookingError("Enlace no válido o cita inexistente", "NOT_FOUND");
  const user = await getCurrentUser();
  const actor: Actor = user && appt.customer.userId === user.id ? { type: "CUSTOMER", userId: user.id } : { type: "GUEST" };
  return { appt, actor };
}

export async function cancelByTokenAction(token: string, input: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const { appt, actor } = await tokenGuard(token);
    const parsed = cancelSchema.safeParse(input ?? {});
    if (!parsed.success) return { ok: false, error: "Motivo no válido" };
    await cancelAppointment({ appointmentId: appt.id, actor, reason: parsed.data.reason });
    after(() => sendAppointmentNotification(appt.id, "CANCELLED"));
    revalidatePath(`/cita/${token}`);
    return { ok: true };
  } catch (err) {
    if (err instanceof BookingError) return { ok: false, error: err.message };
    console.error("[cancel]", err);
    return { ok: false, error: "No se pudo cancelar la cita" };
  }
}

export async function rescheduleByTokenAction(token: string, input: unknown): Promise<{ ok: boolean; error?: string }> {
  try {
    const { appt, actor } = await tokenGuard(token);
    const parsed = rescheduleSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Hora no válida" };
    await rescheduleAppointment({ appointmentId: appt.id, start: new Date(parsed.data.start), actor });
    after(() => sendAppointmentNotification(appt.id, "RESCHEDULED"));
    revalidatePath(`/cita/${token}`);
    return { ok: true };
  } catch (err) {
    if (err instanceof BookingError) return { ok: false, error: err.message };
    console.error("[reschedule]", err);
    return { ok: false, error: "No se pudo reprogramar la cita" };
  }
}
