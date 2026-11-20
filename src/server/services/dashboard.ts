import "server-only";
import { DateTime } from "luxon";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";

const REVENUE_STATUSES = ["PENDING", "CONFIRMED", "COMPLETED"] as const;

async function revenue(where: Prisma.AppointmentWhereInput, from: Date, to: Date) {
  const r = await prisma.appointment.aggregate({
    where: { ...where, status: { in: [...REVENUE_STATUSES] }, startsAt: { gte: from, lt: to } },
    _sum: { priceCents: true },
    _count: { _all: true },
  });
  return { cents: r._sum.priceCents ?? 0, count: r._count._all };
}

/** Métricas del dashboard, opcionalmente limitadas a un profesional. */
export async function getDashboardStats(timezone: string, employeeId?: string) {
  const base: Prisma.AppointmentWhereInput = employeeId ? { employeeId } : {};
  const now = DateTime.now().setZone(timezone);
  const day = [now.startOf("day"), now.endOf("day")] as const;
  const week = [now.startOf("week"), now.endOf("week")] as const;
  const month = [now.startOf("month"), now.endOf("month")] as const;
  const last30 = now.minus({ days: 30 }).toJSDate();

  const [today, upcoming, revDay, revWeek, revMonth, pendingCount, byStatus30] = await Promise.all([
    prisma.appointment.findMany({
      where: { ...base, startsAt: { gte: day[0].toJSDate(), lte: day[1].toJSDate() }, status: { not: "CANCELLED" } },
      orderBy: { startsAt: "asc" },
      include: { service: { select: { name: true, color: true } }, employee: { select: { displayName: true } }, customer: { select: { name: true, phone: true } } },
    }),
    prisma.appointment.findMany({
      where: { ...base, startsAt: { gt: day[1].toJSDate(), lte: now.plus({ days: 7 }).endOf("day").toJSDate() }, status: { in: ["PENDING", "CONFIRMED"] } },
      orderBy: { startsAt: "asc" },
      take: 8,
      include: { service: { select: { name: true } }, employee: { select: { displayName: true } }, customer: { select: { name: true } } },
    }),
    revenue(base, day[0].toJSDate(), day[1].toJSDate()),
    revenue(base, week[0].toJSDate(), week[1].toJSDate()),
    revenue(base, month[0].toJSDate(), month[1].toJSDate()),
    prisma.appointment.count({ where: { ...base, status: "PENDING", startsAt: { gte: new Date() } } }),
    prisma.appointment.groupBy({
      by: ["status"],
      where: { ...base, startsAt: { gte: last30, lte: new Date() } },
      _count: { _all: true },
    }),
  ]);

  const count = (s: string) => byStatus30.find((x) => x.status === s)?._count._all ?? 0;
  const total30 = byStatus30.reduce((acc, x) => acc + x._count._all, 0);
  const attendedOrNot = count("COMPLETED") + count("NO_SHOW");

  return {
    today,
    upcoming,
    revenue: { day: revDay, week: revWeek, month: revMonth },
    pendingCount,
    cancellationRate: total30 ? count("CANCELLED") / total30 : 0,
    noShowRate: attendedOrNot ? count("NO_SHOW") / attendedOrNot : 0,
    total30,
  };
}
