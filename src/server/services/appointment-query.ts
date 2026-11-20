import "server-only";
import { DateTime } from "luxon";
import type { Prisma } from "@prisma/client";
import type { CurrentUser } from "@/server/auth/guards";
import { scopedEmployeeId } from "@/server/auth/guards";
import type { AppointmentFilters } from "@/lib/validation/appointment";
import { normalizePhone } from "@/lib/utils";

/** Construye el filtro de citas respetando el alcance del rol. */
export function buildAppointmentWhere(f: AppointmentFilters, user: CurrentUser, timezone: string): Prisma.AppointmentWhereInput {
  const scoped = scopedEmployeeId(user);
  const where: Prisma.AppointmentWhereInput = {};
  if (scoped) where.employeeId = scoped;
  else if (f.employeeId) where.employeeId = f.employeeId;
  if (f.status) where.status = f.status;
  if (f.serviceId) where.serviceId = f.serviceId;
  if (f.from || f.to) {
    where.startsAt = {
      ...(f.from ? { gte: DateTime.fromISO(f.from, { zone: timezone }).startOf("day").toJSDate() } : {}),
      ...(f.to ? { lte: DateTime.fromISO(f.to, { zone: timezone }).endOf("day").toJSDate() } : {}),
    };
  }
  if (f.q) {
    const phone = normalizePhone(f.q);
    where.customer = {
      OR: [
        { name: { contains: f.q } },
        { email: { contains: f.q } },
        ...(phone && phone.length >= 3 ? [{ phoneNormalized: { contains: phone } }] : []),
      ],
    };
  }
  return where;
}
