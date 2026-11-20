import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/auth/guards";
import { getBusiness } from "@/server/business";
import { customerTotals, possibleDuplicatesOf } from "@/server/services/customer-crm";
import { deleteCustomerAction } from "@/server/actions/customers";
import { fmtDateTime, fmtDbDate } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/labels";
import { CustomerForm } from "@/components/customers/customer-form";
import { BlockForm, MergeForm } from "@/components/customers/small-forms";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { Alert, Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";

export const metadata = { title: "Ficha de cliente" };

export default async function CustomerDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ creado?: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const b = await getBusiness();
  const c = await prisma.customer.findUnique({
    where: { id },
    include: {
      tags: { include: { tag: true } },
      user: { select: { email: true, lastLoginAt: true } },
      appointments: { orderBy: { startsAt: "desc" }, include: { service: { select: { name: true } }, employee: { select: { displayName: true } } } },
    },
  });
  if (!c) notFound();
  const [totals, dups, allTags] = await Promise.all([customerTotals([c.id]), possibleDuplicatesOf(c), prisma.tag.findMany({ orderBy: { name: "asc" } })]);
  const t = totals.get(c.id)!;
  const money = (x: number) => formatMoney(x, b.currency, b.locale);
  const upcoming = c.appointments.filter((a) => a.startsAt > new Date() && (a.status === "PENDING" || a.status === "CONFIRMED")).length;

  return (
    <>
      <PageHeader
        title={c.name}
        description={c.user ? `Tiene cuenta (${c.user.email})` : "Sin cuenta de usuario"}
        actions={
          <Link href={`/panel/citas/nueva?customerId=${c.id}`} className={buttonClasses("primary")}>
            + Nueva cita
          </Link>
        }
      />
      {sp.creado && <Alert kind="success" className="mb-4">Cliente creado.</Alert>}
      {dups.length > 0 && (
        <Alert kind="warning" className="mb-4">
          <p className="mb-2 font-medium">Posibles duplicados (mismo email o teléfono):</p>
          <ul className="space-y-2">
            {dups.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-2">
                <Link href={`/panel/clientes/${d.id}`} className="underline">
                  {d.name}
                </Link>
                <span className="text-xs">({[d.email, d.phone].filter(Boolean).join(" · ")}, {d._count.appointments} citas)</span>
                <MergeForm targetId={c.id} sourceId={d.id} label="Fusionar en esta ficha" />
              </li>
            ))}
          </ul>
        </Alert>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Total gastado", money(t.spentCents)],
          ["Visitas completadas", String(t.visits)],
          ["Inasistencias", String(t.noShows)],
          ["Próximas citas", String(upcoming)],
        ].map(([label, value]) => (
          <Card key={label}>
            <CardBody className="py-3">
              <p className="text-xs uppercase text-zinc-500">{label}</p>
              <p className="text-xl font-bold">{value}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Datos de contacto" description={c.birthDate ? `Cumpleaños: ${fmtDbDate(c.birthDate, b.locale, { day: "numeric", month: "long" })}` : undefined} />
            <CardBody>
              <CustomerForm customer={c} tags={c.tags.map((ct) => ct.tag.name)} allTags={allTags.map((x) => x.name)} />
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={`Historial de citas (${c.appointments.length})`} />
            <ul className="divide-y divide-zinc-100">
              {c.appointments.map((a) => (
                <li key={a.id}>
                  <Link href={`/panel/citas/${a.id}`} className="flex flex-wrap items-center gap-3 px-4 py-2 text-sm hover:bg-zinc-50 sm:px-6">
                    <span className="w-44 first-letter:uppercase">{fmtDateTime(a.startsAt, b.timezone, b.locale)}</span>
                    <span className="flex-1">
                      {a.service.name} · <span className="text-zinc-500">{a.employee.displayName}</span>
                    </span>
                    <span>{money(a.priceCents)}</span>
                    <Badge color={STATUS_COLORS[a.status]}>{STATUS_LABELS[a.status]}</Badge>
                  </Link>
                </li>
              ))}
              {c.appointments.length === 0 && <li className="px-6 py-4 text-sm text-zinc-500">Sin citas.</li>}
            </ul>
          </Card>
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Reservas en línea" />
            <CardBody>
              <BlockForm id={c.id} isBlocked={c.isBlocked} reason={c.blockedReason} />
            </CardBody>
          </Card>
          {c.appointments.length === 0 && (
            <Card>
              <CardHeader title="Eliminar" />
              <CardBody>
                <form action={deleteCustomerAction}>
                  <input type="hidden" name="id" value={c.id} />
                  <ConfirmButton message="¿Eliminar este cliente definitivamente?">Eliminar cliente</ConfirmButton>
                </form>
              </CardBody>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
