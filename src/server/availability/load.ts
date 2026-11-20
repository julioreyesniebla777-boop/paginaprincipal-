import "server-only";
import { DateTime } from "luxon";
import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/server/db";
import { getBusiness } from "@/server/business";
import { computeSlots, type ComputeSlotsInput, type EmployeeAvailabilityInput, type DaySlots } from "./engine";

type Db = PrismaClient | Prisma.TransactionClient;

/** Estados que ocupan agenda. */
export const ACTIVE_STATUSES = ["PENDING", "CONFIRMED"] as const;

export const dateOnly = (d: Date) => d.toISOString().slice(0, 10);

export interface LoadOptions {
  serviceId: string;
  /** Limita a un empleado concreto (o undefined = todos los que ofrecen el servicio). */
  employeeId?: string;
  from: string;
  to: string;
  /** Cita que se está reprogramando: no cuenta como ocupada. */
  excludeAppointmentId?: string;
  ignoreBookingWindow?: boolean;
  /** Para reprogramar citas de un servicio que se desactivó después. */
  includeInactiveService?: boolean;
  db?: Db;
  now?: Date;
}

/** Carga desde la base de datos todo lo que necesita el motor. */
export async function loadAvailabilityInput(opts: LoadOptions): Promise<ComputeSlotsInput | null> {
  const db = opts.db ?? prisma;
  const business = await getBusiness();
  const zone = business.timezone;

  const service = await db.service.findFirst({
    where: { id: opts.serviceId, ...(opts.includeInactiveService ? {} : { isActive: true }) },
    include: {
      employees: {
        where: { employee: { isActive: true }, ...(opts.employeeId ? { employeeId: opts.employeeId } : {}) },
        include: { employee: { select: { id: true, sortOrder: true } } },
      },
    },
  });
  if (!service) return null;

  const employeeIds = service.employees.sort((a, b) => a.employee.sortOrder - b.employee.sortOrder).map((se) => se.employeeId);

  // Rango UTC con margen de un día para cubrir cambios de zona y buffers.
  const rangeStart = DateTime.fromISO(opts.from, { zone }).startOf("day").minus({ days: 1 }).toJSDate();
  const rangeEnd = DateTime.fromISO(opts.to, { zone }).endOf("day").plus({ days: 1 }).toJSDate();
  const fromDate = new Date(`${opts.from}T00:00:00.000Z`);
  const toDate = new Date(`${opts.to}T00:00:00.000Z`);

  const [schedules, exceptions, blocks, appointments] = employeeIds.length
    ? await Promise.all([
        db.weeklySchedule.findMany({ where: { employeeId: { in: employeeIds } } }),
        db.scheduleException.findMany({
          where: {
            OR: [{ employeeId: { in: employeeIds } }, { employeeId: null }],
            startDate: { lte: toDate },
            endDate: { gte: fromDate },
          },
        }),
        db.timeBlock.findMany({
          where: { employeeId: { in: employeeIds }, startsAt: { lt: rangeEnd }, endsAt: { gt: rangeStart } },
        }),
        db.appointment.findMany({
          where: {
            employeeId: { in: employeeIds },
            status: { in: [...ACTIVE_STATUSES] },
            occupiedStart: { lt: rangeEnd },
            occupiedEnd: { gt: rangeStart },
            ...(opts.excludeAppointmentId ? { id: { not: opts.excludeAppointmentId } } : {}),
          },
          select: { id: true, employeeId: true, serviceId: true, startsAt: true, occupiedStart: true, occupiedEnd: true },
        }),
      ])
    : [[], [], [], []];

  const employees: EmployeeAvailabilityInput[] = employeeIds.map((id) => ({
    id,
    weekly: schedules.filter((s) => s.employeeId === id),
    exceptions: exceptions
      .filter((e) => e.employeeId === id || e.employeeId === null)
      .map((e) => ({ type: e.type, startDate: dateOnly(e.startDate), endDate: dateOnly(e.endDate), startMin: e.startMin, endMin: e.endMin })),
    timeBlocks: blocks.filter((b) => b.employeeId === id),
    appointments: appointments.filter((a) => a.employeeId === id),
  }));

  return {
    settings: {
      timezone: zone,
      slotIntervalMin: business.slotIntervalMin,
      minNoticeMin: business.minNoticeMin,
      maxDaysAhead: business.maxDaysAhead,
    },
    service: {
      id: service.id,
      durationMin: service.durationMin,
      bufferBeforeMin: service.bufferBeforeMin,
      bufferAfterMin: service.bufferAfterMin,
      capacity: service.capacity,
    },
    employees,
    from: opts.from,
    to: opts.to,
    now: opts.now ?? new Date(),
    ignoreBookingWindow: opts.ignoreBookingWindow,
  };
}

export async function getSlots(opts: LoadOptions): Promise<DaySlots[]> {
  const input = await loadAvailabilityInput(opts);
  return input ? computeSlots(input) : [];
}
