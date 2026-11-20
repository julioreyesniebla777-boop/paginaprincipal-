import Link from "next/link";
import { notFound } from "next/navigation";
import { DateTime } from "luxon";
import { prisma } from "@/server/db";
import { canManageEmployee, requireStaff } from "@/server/auth/guards";
import { getBusiness } from "@/server/business";
import { fmtDate, fmtDateTime, fmtTime } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/labels";
import { TEMPLATE_LABELS } from "@/server/notifications/default-templates";
import { AppointmentActions } from "@/components/appointments/appointment-actions";
import { Alert, Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";

export const metadata = { title: "Detalle de cita" };

const ACTION_LABELS = { CREATED: "Creada", STATUS_CHANGED: "Cambio de estado", RESCHEDULED: "Reprogramada", UPDATED: "Actualizada", CANCELLED: "Cancelada" } as const;
const ACTOR_LABELS = { ADMIN: "Administrador", EMPLOYEE: "Profesional", CUSTOMER: "Cliente", GUEST: "Cliente (enlace)", SYSTEM: "Sistema" } as const;

export default async function AppointmentDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ creada?: string }> }) {
  const user = await requireStaff();
  const { id } = await params;
  const sp = await searchParams;
  const b = await getBusiness();
  const a = await prisma.appointment.findUnique({
    where: { id },
    include: {
      service: true,
      employee: true,
      customer: { include: { _count: { select: { appointments: true } } } },
      history: { orderBy: { createdAt: "desc" } },
      notifications: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!a || !canManageEmployee(user, a.employeeId)) notFound();

  const actorIds = [...new Set(a.history.map((h) => h.actorUserId).filter(Boolean))] as string[];
  const [actors, employees] = await Promise.all([
    prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } }),
    user.role === "ADMIN"
      ? prisma.service
          .findUnique({ where: { id: a.serviceId }, include: { employees: { include: { employee: { select: { id: true, displayName: true, isActive: true } } } } } })
          .then((s) => s?.employees.filter((e) => e.employee.isActive).map((e) => ({ id: e.employee.id, name: e.employee.displayName })) ?? [])
      : Promise.resolve(null),
  ]);
  const actorName = (uid: string | null) => actors.find((u) => u.id === uid)?.name;

  return (
    <>
      <PageHeader
        title={a.customer.name}
        description={`${a.service.name} · ${a.employee.displayName}`}
        actions={<Badge color={STATUS_COLORS[a.status]} className="text-sm">{STATUS_LABELS[a.status]}</Badge>}
      />
      {sp.creada && <Alert kind="success" className="mb-4">Cita creada correctamente.</Alert>}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Detalle" />
            <CardBody>
              <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 text-sm">
                <dt className="text-zinc-500">Fecha</dt>
                <dd className="font-medium first-letter:uppercase">{fmtDate(a.startsAt, b.timezone, b.locale)}</dd>
                <dt className="text-zinc-500">Hora</dt>
                <dd className="font-medium">
                  {fmtTime(a.startsAt, b.timezone, b.locale)} – {fmtTime(a.endsAt, b.timezone, b.locale)}
                </dd>
                <dt className="text-zinc-500">Servicio</dt>
                <dd>{a.service.name} ({a.service.durationMin} min)</dd>
                <dt className="text-zinc-500">Profesional</dt>
                <dd>{a.employee.displayName}</dd>
                <dt className="text-zinc-500">Precio</dt>
                <dd>{formatMoney(a.priceCents, b.currency, b.locale)}</dd>
                <dt className="text-zinc-500">Origen</dt>
                <dd>{a.source === "ONLINE" ? "Reserva en línea" : "Creada en el panel"}</dd>
                {a.customerNotes && (
                  <>
                    <dt className="text-zinc-500">Notas del cliente</dt>
                    <dd className="whitespace-pre-line">{a.customerNotes}</dd>
                  </>
                )}
                {a.cancelReason && (
                  <>
                    <dt className="text-zinc-500">Motivo de cancelación</dt>
                    <dd>{a.cancelReason}</dd>
                  </>
                )}
              </dl>
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Acciones" />
            <CardBody>
              <AppointmentActions
                id={a.id}
                status={a.status}
                serviceId={a.serviceId}
                employeeId={a.employeeId}
                date={DateTime.fromJSDate(a.startsAt, { zone: b.timezone }).toISODate()!}
                internalNotes={a.internalNotes ?? ""}
                timezone={b.timezone}
                locale={b.locale}
                employees={employees}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader title="Historial de cambios" />
            <CardBody>
              <ol className="relative space-y-4 border-l border-zinc-200 pl-4">
                {a.history.map((h) => (
                  <li key={h.id} className="text-sm">
                    <span className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border-2 border-white bg-brand" />
                    <p className="font-medium">
                      {ACTION_LABELS[h.action]}
                      {h.fromStatus && h.toStatus && ` · ${STATUS_LABELS[h.fromStatus]} → ${STATUS_LABELS[h.toStatus]}`}
                    </p>
                    {h.action === "RESCHEDULED" && h.fromStartsAt && h.toStartsAt && (
                      <p className="text-zinc-600">
                        {fmtDateTime(h.fromStartsAt, b.timezone, b.locale)} → {fmtDateTime(h.toStartsAt, b.timezone, b.locale)}
                      </p>
                    )}
                    {h.note && <p className="text-zinc-600">{h.note}</p>}
                    <p className="text-xs text-zinc-400">
                      {fmtDateTime(h.createdAt, b.timezone, b.locale)} · {actorName(h.actorUserId) ?? ACTOR_LABELS[h.actorType]}
                    </p>
                  </li>
                ))}
              </ol>
            </CardBody>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Cliente" />
            <CardBody className="space-y-1 text-sm">
              <p className="font-medium">{a.customer.name}</p>
              {a.customer.email && <p><a className="text-brand hover:underline" href={`mailto:${a.customer.email}`}>{a.customer.email}</a></p>}
              {a.customer.phone && <p><a className="text-brand hover:underline" href={`tel:${a.customer.phone}`}>{a.customer.phone}</a></p>}
              <p className="text-zinc-500">{a.customer._count.appointments} citas en total</p>
              {a.customer.isBlocked && <Badge color="#dc2626">Bloqueado</Badge>}
              {user.role === "ADMIN" && (
                <Link href={`/panel/clientes/${a.customer.id}`} className="inline-block pt-2 text-brand hover:underline">
                  Ver ficha completa →
                </Link>
              )}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Notificaciones" />
            <CardBody>
              {a.notifications.length === 0 ? (
                <p className="text-sm text-zinc-500">Sin envíos registrados.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {a.notifications.map((n) => (
                    <li key={n.id}>
                      <span className={n.status === "SENT" ? "text-green-700" : n.status === "FAILED" ? "text-red-600" : "text-zinc-500"}>
                        {n.status === "SENT" ? "✓" : n.status === "FAILED" ? "✗" : "–"}
                      </span>{" "}
                      {TEMPLATE_LABELS[n.templateType]} <span className="text-xs text-zinc-400">({n.channel.toLowerCase()})</span>
                      <p className="text-xs text-zinc-400">
                        {fmtDateTime(n.createdAt, b.timezone, b.locale)} · {n.recipient}
                        {n.error && ` · ${n.error}`}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  );
}
