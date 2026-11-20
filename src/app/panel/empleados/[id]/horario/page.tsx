import { notFound } from "next/navigation";
import { prisma } from "@/server/db";
import { canManageEmployee, requireStaff } from "@/server/auth/guards";
import { getBusiness } from "@/server/business";
import { todayISO } from "@/lib/format";
import { deleteTimeBlockAction } from "@/server/actions/availability";
import { minutesToTime } from "@/lib/time";
import { fmtDateTime, fmtTime } from "@/lib/format";
import { WeeklyEditor } from "@/components/availability/weekly-editor";
import { ExceptionForm } from "@/components/availability/exception-form";
import { ExceptionList } from "@/components/availability/exception-list";
import { TimeBlockForm } from "@/components/availability/time-block-form";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";

export const metadata = { title: "Horario" };

export default async function SchedulePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaff();
  const { id } = await params;
  if (!canManageEmployee(user, id)) notFound();
  const business = await getBusiness();
  const today = new Date(todayISO(business.timezone) + "T00:00:00.000Z");

  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      schedules: { orderBy: [{ weekday: "asc" }, { startMin: "asc" }] },
      exceptions: { where: { endDate: { gte: today } }, orderBy: { startDate: "asc" } },
      timeBlocks: { where: { endsAt: { gte: new Date() } }, orderBy: { startsAt: "asc" }, take: 50 },
    },
  });
  if (!employee) notFound();

  const initial = employee.schedules.map((s) => ({ weekday: s.weekday, start: minutesToTime(s.startMin), end: minutesToTime(s.endMin) }));

  return (
    <>
      <PageHeader title={`Horario de ${employee.displayName}`} description={`Horas en la zona del negocio (${business.timezone}).`} />
      <div className="space-y-6">
        <Card>
          <CardHeader title="Horario semanal" description="Puedes definir varios bloques por día (ej. 9:00–12:00 y 14:00–18:00)." />
          <CardBody>
            <WeeklyEditor employeeId={employee.id} initial={initial} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Excepciones por fecha" description="Días libres, vacaciones u horarios especiales para un día concreto." />
          <CardBody className="space-y-4">
            <ExceptionForm employeeId={employee.id} />
            <ExceptionList items={employee.exceptions} locale={business.locale} />
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Bloqueos de tiempo" description="Almuerzo, reuniones u otras pausas puntuales. También puedes crearlos desde el calendario." />
          <CardBody className="space-y-4">
            <TimeBlockForm employeeId={employee.id} />
            {employee.timeBlocks.length === 0 ? (
              <p className="text-sm text-zinc-500">No hay bloqueos próximos.</p>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {employee.timeBlocks.map((b) => (
                  <li key={b.id} className="flex items-center gap-2 py-2 text-sm">
                    <span className="font-medium">
                      {fmtDateTime(b.startsAt, business.timezone, business.locale)} – {fmtTime(b.endsAt, business.timezone, business.locale)}
                    </span>
                    {b.reason && <span className="text-zinc-500">· {b.reason}</span>}
                    <form action={deleteTimeBlockAction} className="ml-auto">
                      <input type="hidden" name="id" value={b.id} />
                      <button className="rounded px-2 py-1 text-red-600 hover:bg-red-50">Eliminar</button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </>
  );
}
