import { DateTime } from "luxon";
import { prisma } from "@/server/db";
import { requireStaff } from "@/server/auth/guards";
import { getBusiness } from "@/server/business";
import { NewAppointmentForm } from "@/components/appointments/new-appointment-form";
import { PageHeader } from "@/components/ui/card";

export const metadata = { title: "Nueva cita" };

export default async function NewAppointmentPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireStaff();
  const sp = await searchParams;
  const business = await getBusiness();
  const [services, employees, customer] = await Promise.all([
    prisma.service.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: { employees: { select: { employeeId: true } } },
    }),
    prisma.employee.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, displayName: true } }),
    sp.customerId ? prisma.customer.findUnique({ where: { id: sp.customerId }, select: { id: true, name: true, email: true, phone: true, isBlocked: true } }) : null,
  ]);
  const start = sp.start && !Number.isNaN(Date.parse(sp.start)) ? sp.start : undefined;
  const date = start ? DateTime.fromISO(start, { zone: business.timezone }).toISODate()! : DateTime.now().setZone(business.timezone).toISODate()!;

  return (
    <>
      <PageHeader title="Nueva cita" description="Las citas creadas desde el panel se confirman automáticamente." />
      <NewAppointmentForm
        services={services.map((s) => ({ id: s.id, name: s.name, durationMin: s.durationMin, employeeIds: s.employees.map((e) => e.employeeId) }))}
        employees={employees.map((e) => ({ id: e.id, name: e.displayName }))}
        timezone={business.timezone}
        locale={business.locale}
        initial={{ date, start: start ? new Date(start).toISOString() : undefined, employeeId: sp.employeeId, customer: customer ?? undefined }}
        fixedEmployeeId={user.role === "EMPLOYEE" ? user.employeeId : null}
      />
    </>
  );
}
