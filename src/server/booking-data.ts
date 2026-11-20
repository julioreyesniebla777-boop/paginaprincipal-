import "server-only";
import { prisma } from "./db";
import { getBusiness } from "./business";
import { getCurrentUser } from "./auth/guards";
import type { BusinessInfo, PublicEmployee, PublicService } from "@/components/booking/booking-wizard";

/** Datos públicos para el asistente de reserva (sin información interna). */
export async function getBookingData() {
  const [business, services, employees, user] = await Promise.all([
    getBusiness(),
    prisma.service.findMany({
      where: { isActive: true, employees: { some: { employee: { isActive: true } } } },
      orderBy: [{ category: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
      include: { category: true, employees: { where: { employee: { isActive: true } }, select: { employeeId: true } } },
    }),
    prisma.employee.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, displayName: true, bio: true, color: true },
    }),
    getCurrentUser(),
  ]);

  const customer = user?.customerId ? await prisma.customer.findUnique({ where: { id: user.customerId } }) : null;

  const info: BusinessInfo = {
    name: business.name,
    timezone: business.timezone,
    locale: business.locale,
    currency: business.currency,
    maxDaysAhead: business.maxDaysAhead,
    policyText: business.policyText,
    cancelLimitHours: Math.round(business.cancelLimitMin / 60),
    autoConfirm: business.autoConfirm,
  };
  const publicServices: PublicService[] = services.map((s) => ({
    id: s.id,
    name: s.name,
    description: s.description,
    durationMin: s.durationMin,
    priceCents: s.priceCents,
    color: s.color,
    capacity: s.capacity,
    category: s.category?.name ?? null,
    employeeIds: s.employees.map((e) => e.employeeId),
  }));
  const publicEmployees: PublicEmployee[] = employees;
  const prefill = customer ? { name: customer.name, email: customer.email ?? user!.email, phone: customer.phone ?? "" } : null;

  return { business, info, services: publicServices, employees: publicEmployees, prefill, user };
}
