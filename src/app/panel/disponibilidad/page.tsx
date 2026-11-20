import Link from "next/link";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/auth/guards";
import { getBusiness } from "@/server/business";
import { todayISO } from "@/lib/format";
import { ExceptionForm } from "@/components/availability/exception-form";
import { ExceptionList } from "@/components/availability/exception-list";
import { minutesToTime, WEEKDAYS } from "@/lib/time";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";

export const metadata = { title: "Disponibilidad" };

export default async function AvailabilityPage() {
  await requireAdmin();
  const business = await getBusiness();
  const today = new Date(todayISO(business.timezone) + "T00:00:00.000Z");
  const [exceptions, employees] = await Promise.all([
    prisma.scheduleException.findMany({ where: { employeeId: null, endDate: { gte: today } }, orderBy: { startDate: "asc" } }),
    prisma.employee.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: "asc" },
      include: { schedules: { orderBy: [{ weekday: "asc" }, { startMin: "asc" }] } },
    }),
  ]);

  return (
    <>
      <PageHeader title="Disponibilidad" description={`Intervalo de franjas: cada ${business.slotIntervalMin} minutos (se cambia en Configuración).`} />
      <div className="space-y-6">
        <Card>
          <CardHeader title="Cierres y feriados del negocio" description="Aplican a todos los profesionales." />
          <CardBody className="space-y-4">
            <ExceptionForm businessWide />
            <ExceptionList items={exceptions} locale={business.locale} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Horarios por profesional" />
          <CardBody className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-zinc-500">
                  <th className="py-2 pr-3">Profesional</th>
                  {WEEKDAYS.map((d) => (
                    <th key={d.value} className="px-2 py-2">
                      {d.short}
                    </th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {employees.map((e) => (
                  <tr key={e.id}>
                    <td className="py-2 pr-3 font-medium">{e.displayName}</td>
                    {WEEKDAYS.map((d) => {
                      const blocks = e.schedules.filter((s) => s.weekday === d.value);
                      return (
                        <td key={d.value} className="px-2 py-2 align-top text-xs text-zinc-600">
                          {blocks.length ? blocks.map((b) => <div key={b.id}>{minutesToTime(b.startMin)}–{minutesToTime(b.endMin)}</div>) : <span className="text-zinc-300">—</span>}
                        </td>
                      );
                    })}
                    <td className="py-2 text-right">
                      <Link href={`/panel/empleados/${e.id}/horario`} className={buttonClasses("ghost", "sm")}>
                        Editar
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
