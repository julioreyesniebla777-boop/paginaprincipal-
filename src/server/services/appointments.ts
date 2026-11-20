import "server-only";
import { DateTime } from "luxon";
import { Prisma, type ActorType, type AppointmentSource, type AppointmentStatus } from "@prisma/client";
import { prisma } from "@/server/db";
import { getBusiness } from "@/server/business";
import { loadAvailabilityInput, ACTIVE_STATUSES } from "@/server/availability/load";
import { computeSlots, isSlotAvailable, pickEmployee } from "@/server/availability/engine";
import { manageTokenHashFor, newAppointmentId } from "@/lib/manage-token";
import { findOrCreateCustomer } from "./customers";

export class BookingError extends Error {
  constructor(
    message: string,
    public code: "SLOT_TAKEN" | "NOT_FOUND" | "BLOCKED" | "POLICY" | "INVALID" = "INVALID",
  ) {
    super(message);
    this.name = "BookingError";
  }
}

export type Actor = { type: ActorType; userId?: string | null };

const TX_OPTS = { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 15_000, maxWait: 10_000 };

/**
 * Bloquea las filas de los empleados (en orden para evitar interbloqueos).
 * Mientras dure la transacción, ninguna otra reserva para esos empleados
 * puede calcular disponibilidad ni insertar: así se evitan dobles reservas.
 */
async function lockEmployees(tx: Prisma.TransactionClient, ids: string[]) {
  const sorted = [...new Set(ids)].sort();
  if (!sorted.length) return;
  await tx.$queryRaw`SELECT id FROM Employee WHERE id IN (${Prisma.join(sorted)}) ORDER BY id FOR UPDATE`;
}

export interface CreateBookingInput {
  serviceId: string;
  employeeId: string | "any";
  start: Date;
  customer: { name: string; email?: string | null; phone?: string | null; userId?: string | null } | { id: string };
  customerNotes?: string | null;
  internalNotes?: string | null;
  source: AppointmentSource;
  actor: Actor;
  /** El personal puede saltarse la ventana de reserva (anticipación, días máximos). */
  ignoreBookingWindow?: boolean;
  /** Estado forzado (panel). Por defecto según autoConfirm. */
  status?: AppointmentStatus;
}

export async function createBooking(input: CreateBookingInput) {
  const business = await getBusiness();

  const service = await prisma.service.findFirst({
    where: { id: input.serviceId, isActive: true },
    include: { employees: { where: { employee: { isActive: true } }, select: { employeeId: true } } },
  });
  if (!service) throw new BookingError("El servicio no está disponible", "NOT_FOUND");
  const candidateIds =
    input.employeeId === "any"
      ? service.employees.map((e) => e.employeeId)
      : service.employees.some((e) => e.employeeId === input.employeeId)
        ? [input.employeeId]
        : [];
  if (!candidateIds.length) throw new BookingError("El profesional no realiza este servicio", "NOT_FOUND");

  const date = DateTime.fromJSDate(input.start, { zone: business.timezone }).toISODate()!;

  return prisma.$transaction(async (tx) => {
    await lockEmployees(tx, candidateIds);

    // Cliente
    const customer =
      "id" in input.customer
        ? await tx.customer.findUnique({ where: { id: input.customer.id } })
        : await findOrCreateCustomer(tx, input.customer);
    if (!customer) throw new BookingError("Cliente no encontrado", "NOT_FOUND");
    if (customer.isBlocked && input.source === "ONLINE") {
      throw new BookingError("No es posible reservar en línea. Por favor, contacta directamente con el negocio.", "BLOCKED");
    }

    // Verificación final de disponibilidad con datos leídos dentro de la transacción.
    const avail = await loadAvailabilityInput({
      serviceId: service.id,
      employeeId: input.employeeId === "any" ? undefined : input.employeeId,
      from: date,
      to: date,
      db: tx,
      ignoreBookingWindow: input.ignoreBookingWindow,
    });
    if (!avail) throw new BookingError("El servicio no está disponible", "NOT_FOUND");

    let employeeId: string | null = null;
    if (input.employeeId === "any") {
      const day = computeSlots(avail)[0];
      const slot = day?.slots.find((s) => s.start === input.start.toISOString());
      if (slot) {
        const load = await tx.appointment.groupBy({
          by: ["employeeId"],
          where: {
            employeeId: { in: slot.employees.map((e) => e.employeeId) },
            status: { in: [...ACTIVE_STATUSES] },
            startsAt: {
              gte: DateTime.fromISO(date, { zone: business.timezone }).startOf("day").toJSDate(),
              lt: DateTime.fromISO(date, { zone: business.timezone }).endOf("day").toJSDate(),
            },
          },
          _count: { _all: true },
        });
        employeeId = pickEmployee(slot.employees, Object.fromEntries(load.map((l) => [l.employeeId, l._count._all])));
      }
    } else if (isSlotAvailable(avail, input.employeeId, input.start)) {
      employeeId = input.employeeId;
    }
    if (!employeeId) throw new BookingError("Lo sentimos, esa hora acaba de ocuparse. Elige otra.", "SLOT_TAKEN");

    const startsAt = input.start;
    const endsAt = new Date(startsAt.getTime() + service.durationMin * 60_000);
    const status: AppointmentStatus = input.status ?? (business.autoConfirm || input.source === "PANEL" ? "CONFIRMED" : "PENDING");
    const id = newAppointmentId();

    const appointment = await tx.appointment.create({
      data: {
        id,
        serviceId: service.id,
        employeeId,
        customerId: customer.id,
        startsAt,
        endsAt,
        occupiedStart: new Date(startsAt.getTime() - service.bufferBeforeMin * 60_000),
        occupiedEnd: new Date(endsAt.getTime() + service.bufferAfterMin * 60_000),
        status,
        source: input.source,
        priceCents: service.priceCents,
        customerNotes: input.customerNotes ?? null,
        internalNotes: input.internalNotes ?? null,
        manageTokenHash: manageTokenHashFor(id),
        history: {
          create: { action: "CREATED", toStatus: status, toStartsAt: startsAt, actorType: input.actor.type, actorUserId: input.actor.userId ?? null },
        },
      },
    });
    return appointment;
  }, TX_OPTS);
}

/** ¿El cliente todavía puede cancelar o reprogramar según la política? */
export function withinCancelPolicy(startsAt: Date, cancelLimitMin: number, now = new Date()): boolean {
  return startsAt.getTime() - now.getTime() >= cancelLimitMin * 60_000;
}

const isCustomerActor = (a: Actor) => a.type === "CUSTOMER" || a.type === "GUEST";

export async function cancelAppointment(opts: { appointmentId: string; actor: Actor; reason?: string }) {
  const business = await getBusiness();
  return prisma.$transaction(async (tx) => {
    const appt = await tx.appointment.findUnique({ where: { id: opts.appointmentId } });
    if (!appt) throw new BookingError("Cita no encontrada", "NOT_FOUND");
    if (!(ACTIVE_STATUSES as readonly string[]).includes(appt.status)) throw new BookingError("Esta cita ya no se puede cancelar", "POLICY");
    if (isCustomerActor(opts.actor) && !withinCancelPolicy(appt.startsAt, business.cancelLimitMin)) {
      throw new BookingError(`Solo se puede cancelar hasta ${Math.round(business.cancelLimitMin / 60)} horas antes de la cita. Contacta con el negocio.`, "POLICY");
    }
    return tx.appointment.update({
      where: { id: appt.id },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
        cancelReason: opts.reason ?? null,
        history: {
          create: { action: "CANCELLED", fromStatus: appt.status, toStatus: "CANCELLED", actorType: opts.actor.type, actorUserId: opts.actor.userId ?? null, note: opts.reason ?? null },
        },
      },
    });
  });
}

export async function rescheduleAppointment(opts: {
  appointmentId: string;
  start: Date;
  employeeId?: string;
  actor: Actor;
  ignoreBookingWindow?: boolean;
  note?: string;
}) {
  const business = await getBusiness();
  const current = await prisma.appointment.findUnique({ where: { id: opts.appointmentId }, include: { service: true } });
  if (!current) throw new BookingError("Cita no encontrada", "NOT_FOUND");
  const employeeId = opts.employeeId ?? current.employeeId;

  return prisma.$transaction(async (tx) => {
    await lockEmployees(tx, [current.employeeId, employeeId]);
    const appt = await tx.appointment.findUnique({ where: { id: current.id } });
    if (!appt || !(ACTIVE_STATUSES as readonly string[]).includes(appt.status)) throw new BookingError("Esta cita ya no se puede reprogramar", "POLICY");
    if (isCustomerActor(opts.actor) && !withinCancelPolicy(appt.startsAt, business.cancelLimitMin)) {
      throw new BookingError(`Solo se puede reprogramar hasta ${Math.round(business.cancelLimitMin / 60)} horas antes de la cita. Contacta con el negocio.`, "POLICY");
    }

    const date = DateTime.fromJSDate(opts.start, { zone: business.timezone }).toISODate()!;
    // Se usa el servicio aunque esté inactivo: la cita ya existe.
    const svc = current.service;
    const avail = await loadAvailabilityInput({
      serviceId: svc.id,
      employeeId,
      from: date,
      to: date,
      db: tx,
      excludeAppointmentId: appt.id,
      ignoreBookingWindow: opts.ignoreBookingWindow,
      includeInactiveService: true,
    });
    if (!avail || !isSlotAvailable(avail, employeeId, opts.start)) {
      throw new BookingError("Esa hora no está disponible. Elige otra.", "SLOT_TAKEN");
    }
    const endsAt = new Date(opts.start.getTime() + svc.durationMin * 60_000);
    return tx.appointment.update({
      where: { id: appt.id },
      data: {
        startsAt: opts.start,
        endsAt,
        employeeId,
        occupiedStart: new Date(opts.start.getTime() - svc.bufferBeforeMin * 60_000),
        occupiedEnd: new Date(endsAt.getTime() + svc.bufferAfterMin * 60_000),
        reminderSentAt: null,
        history: {
          create: {
            action: "RESCHEDULED",
            fromStartsAt: appt.startsAt,
            toStartsAt: opts.start,
            actorType: opts.actor.type,
            actorUserId: opts.actor.userId ?? null,
            note: opts.note ?? (employeeId !== appt.employeeId ? "Cambio de profesional" : null),
          },
        },
      },
    });
  }, TX_OPTS);
}

/** Busca una cita por su token de gestión. */
export async function findByManageToken(tokenHash: string) {
  return prisma.appointment.findUnique({
    where: { manageTokenHash: tokenHash },
    include: { service: true, employee: true, customer: true },
  });
}
