import "server-only";
import { DateTime } from "luxon";
import { prisma } from "@/server/db";
import { aggregateReport, type ReportRow } from "./aggregate";

export async function loadReport(opts: { timezone: string; locale: string; from: string; to: string; employeeId?: string; serviceId?: string }) {
  const start = DateTime.fromISO(opts.from, { zone: opts.timezone }).startOf("day").toJSDate();
  const end = DateTime.fromISO(opts.to, { zone: opts.timezone }).endOf("day").toJSDate();
  const appts = await prisma.appointment.findMany({
    where: {
      startsAt: { gte: start, lte: end },
      ...(opts.employeeId ? { employeeId: opts.employeeId } : {}),
      ...(opts.serviceId ? { serviceId: opts.serviceId } : {}),
    },
    select: {
      startsAt: true,
      status: true,
      priceCents: true,
      customerId: true,
      serviceId: true,
      employeeId: true,
      service: { select: { name: true } },
      employee: { select: { displayName: true } },
    },
  });
  const customerIds = [...new Set(appts.map((a) => a.customerId))];
  const firsts = customerIds.length
    ? await prisma.appointment.groupBy({
        by: ["customerId"],
        where: { customerId: { in: customerIds }, status: { not: "CANCELLED" } },
        _min: { startsAt: true },
      })
    : [];
  const firstVisit = new Map(firsts.filter((f) => f._min.startsAt).map((f) => [f.customerId, f._min.startsAt!]));
  const rows: ReportRow[] = appts.map((a) => ({
    startsAt: a.startsAt,
    status: a.status,
    priceCents: a.priceCents,
    customerId: a.customerId,
    serviceId: a.serviceId,
    serviceName: a.service.name,
    employeeId: a.employeeId,
    employeeName: a.employee.displayName,
  }));
  return aggregateReport(rows, firstVisit, { timezone: opts.timezone, from: opts.from, to: opts.to, locale: opts.locale });
}
