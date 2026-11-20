"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { assertStaff, canManageEmployee, ForbiddenError, type CurrentUser } from "@/server/auth/guards";
import { BookingError, changeStatus, createBooking, rescheduleAppointment, type Actor } from "@/server/services/appointments";
import { sendAppointmentNotification } from "@/server/notifications/dispatch";
import { panelAppointmentSchema, panelRescheduleSchema, statusChangeSchema } from "@/lib/validation/appointment";
import type { ActionState } from "@/lib/action-state";

const actorOf = (u: CurrentUser): Actor => ({ type: u.role === "ADMIN" ? "ADMIN" : "EMPLOYEE", userId: u.id });

async function loadOwned(user: CurrentUser, appointmentId: string) {
  const appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!appt) throw new BookingError("Cita no encontrada", "NOT_FOUND");
  if (!canManageEmployee(user, appt.employeeId)) throw new ForbiddenError();
  return appt;
}

function fail(err: unknown): ActionState {
  if (err instanceof BookingError || err instanceof ForbiddenError) return { ok: false, error: err.message };
  console.error("[panel appointments]", err);
  return { ok: false, error: "Ocurrió un error inesperado" };
}

export async function createPanelAppointmentAction(input: unknown): Promise<ActionState & { id?: string }> {
  try {
    const user = await assertStaff();
    const parsed = panelAppointmentSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Revisa los campos", fieldErrors: parsed.error.flatten().fieldErrors };
    const d = parsed.data;
    if (!canManageEmployee(user, d.employeeId)) throw new ForbiddenError();

    const appt = await createBooking({
      serviceId: d.serviceId,
      employeeId: d.employeeId,
      start: new Date(d.start),
      customer: d.customerId ? { id: d.customerId } : { name: d.newName!, email: d.newEmail, phone: d.newPhone },
      internalNotes: d.notes,
      source: "PANEL",
      actor: actorOf(user),
      ignoreBookingWindow: true,
      status: "CONFIRMED",
    });
    if (d.notify) after(() => sendAppointmentNotification(appt.id, "BOOKING_CONFIRMATION"));
    revalidatePath("/panel", "layout");
    return { ok: true, id: appt.id, message: "Cita creada" };
  } catch (err) {
    return fail(err);
  }
}

export async function changeStatusAction(input: unknown): Promise<ActionState> {
  try {
    const user = await assertStaff();
    const parsed = statusChangeSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Datos no válidos" };
    const d = parsed.data;
    const before = await loadOwned(user, d.appointmentId);
    await changeStatus({ appointmentId: d.appointmentId, status: d.status, actor: actorOf(user), note: d.note });
    if (d.notify) {
      if (d.status === "CANCELLED") after(() => sendAppointmentNotification(d.appointmentId, "CANCELLED"));
      if (d.status === "CONFIRMED" && (before.status === "PENDING" || before.status === "CANCELLED")) {
        after(() => sendAppointmentNotification(d.appointmentId, "BOOKING_CONFIRMATION"));
      }
    }
    revalidatePath("/panel", "layout");
    return { ok: true, message: "Estado actualizado" };
  } catch (err) {
    return fail(err);
  }
}

export async function reschedulePanelAction(input: unknown): Promise<ActionState> {
  try {
    const user = await assertStaff();
    const parsed = panelRescheduleSchema.safeParse(input);
    if (!parsed.success) return { ok: false, error: "Datos no válidos" };
    const d = parsed.data;
    await loadOwned(user, d.appointmentId);
    if (d.employeeId && !canManageEmployee(user, d.employeeId)) throw new ForbiddenError("Solo puedes mover citas dentro de tu agenda");
    await rescheduleAppointment({ appointmentId: d.appointmentId, start: new Date(d.start), employeeId: d.employeeId, actor: actorOf(user), ignoreBookingWindow: true });
    if (d.notify) after(() => sendAppointmentNotification(d.appointmentId, "RESCHEDULED"));
    revalidatePath("/panel", "layout");
    return { ok: true, message: "Cita reprogramada" };
  } catch (err) {
    return fail(err);
  }
}

export async function updateInternalNotesAction(appointmentId: string, notes: string): Promise<ActionState> {
  try {
    const user = await assertStaff();
    await loadOwned(user, appointmentId);
    const text = String(notes ?? "").slice(0, 2000);
    await prisma.appointment.update({
      where: { id: appointmentId },
      data: {
        internalNotes: text || null,
        history: { create: { action: "UPDATED", actorType: actorOf(user).type, actorUserId: user.id, note: "Notas internas actualizadas" } },
      },
    });
    revalidatePath(`/panel/citas/${appointmentId}`);
    return { ok: true, message: "Notas guardadas" };
  } catch (err) {
    return fail(err);
  }
}

export async function resendConfirmationAction(appointmentId: string): Promise<ActionState> {
  try {
    const user = await assertStaff();
    const appt = await loadOwned(user, appointmentId);
    await sendAppointmentNotification(appt.id, appt.status === "PENDING" ? "BOOKING_PENDING" : "BOOKING_CONFIRMATION");
    revalidatePath(`/panel/citas/${appointmentId}`);
    return { ok: true, message: "Correo reenviado" };
  } catch (err) {
    return fail(err);
  }
}

