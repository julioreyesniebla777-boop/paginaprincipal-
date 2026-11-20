import { prisma } from "@/server/db";
import { requireStaff } from "@/server/auth/guards";
import { getBusiness } from "@/server/business";
import { PanelCalendar } from "@/components/calendar/panel-calendar";
import { PageHeader } from "@/components/ui/card";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

export const metadata = { title: "Calendario" };

export default async function CalendarPage() {
  const user = await requireStaff();
  const [business, employees, services] = await Promise.all([
    getBusiness(),
    prisma.employee.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { id: true, displayName: true } }),
    prisma.service.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  return (
    <>
      <PageHeader
        title="Calendario"
        actions={
          <Link href="/panel/citas/nueva" className={buttonClasses("primary")}>
            + Nueva cita
          </Link>
        }
      />
      <PanelCalendar
        timezone={business.timezone}
        locale={business.locale}
        employees={employees.map((e) => ({ id: e.id, name: e.displayName }))}
        services={services}
        fixedEmployeeId={user.role === "EMPLOYEE" ? user.employeeId : null}
      />
    </>
  );
}
