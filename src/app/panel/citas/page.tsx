import Link from "next/link";
import { prisma } from "@/server/db";
import { requireStaff } from "@/server/auth/guards";
import { getBusiness } from "@/server/business";
import { buildAppointmentWhere } from "@/server/services/appointment-query";
import { appointmentFiltersSchema } from "@/lib/validation/appointment";
import { fmtDate, fmtTime } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/labels";
import { Badge, Card, PageHeader } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { buttonClasses } from "@/components/ui/button";

export const metadata = { title: "Citas" };
const PAGE_SIZE = 25;

export default async function AppointmentsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const user = await requireStaff();
  const raw = await searchParams;
  const f = appointmentFiltersSchema.parse({ ...raw, page: raw.page ?? 1 });
  const b = await getBusiness();
  const where = buildAppointmentWhere(f, user, b.timezone);

  const [total, rows, employees, services] = await Promise.all([
    prisma.appointment.count({ where }),
    prisma.appointment.findMany({
      where,
      orderBy: { startsAt: f.from || f.to ? "asc" : "desc" },
      skip: (f.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { service: { select: { name: true, color: true } }, employee: { select: { displayName: true } }, customer: { select: { name: true, phone: true } } },
    }),
    user.role === "ADMIN" ? prisma.employee.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, displayName: true } }) : [],
    prisma.service.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (extra: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...raw, ...extra })) if (v !== undefined && v !== "") p.set(k, String(v));
    return p.toString();
  };

  return (
    <>
      <PageHeader
        title="Citas"
        description={`${total} resultado${total === 1 ? "" : "s"}`}
        actions={
          <>
            <a href={`/api/export/appointments?${qs({ page: undefined })}`} className={buttonClasses("outline")}>
              Exportar CSV
            </a>
            <Link href="/panel/citas/nueva" className={buttonClasses("primary")}>
              + Nueva cita
            </Link>
          </>
        }
      />

      <form className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-6" method="get">
        <Input name="q" defaultValue={f.q} placeholder="Cliente, email o teléfono" className="lg:col-span-2" aria-label="Buscar" />
        <Select name="status" defaultValue={f.status ?? ""} aria-label="Estado">
          <option value="">Todos los estados</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
        {user.role === "ADMIN" && (
          <Select name="employeeId" defaultValue={f.employeeId ?? ""} aria-label="Profesional">
            <option value="">Todos los profesionales</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.displayName}
              </option>
            ))}
          </Select>
        )}
        <Select name="serviceId" defaultValue={f.serviceId ?? ""} aria-label="Servicio">
          <option value="">Todos los servicios</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <div className="flex gap-2 lg:col-span-2">
          <Input type="date" name="from" defaultValue={f.from} aria-label="Desde" />
          <Input type="date" name="to" defaultValue={f.to} aria-label="Hasta" />
        </div>
        <div className="flex gap-2">
          <button className={buttonClasses("secondary", "md", "flex-1")}>Filtrar</button>
          <Link href="/panel/citas" className={buttonClasses("ghost")}>
            Limpiar
          </Link>
        </div>
      </form>

      <Card className="overflow-hidden">
        {/* Móvil: tarjetas; escritorio: tabla */}
        <ul className="divide-y divide-zinc-100 md:hidden">
          {rows.map((a) => (
            <li key={a.id}>
              <Link href={`/panel/citas/${a.id}`} className="block p-3 hover:bg-zinc-50">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium">{a.customer.name}</span>
                  <Badge color={STATUS_COLORS[a.status]}>{STATUS_LABELS[a.status]}</Badge>
                </div>
                <p className="text-sm text-zinc-600 first-letter:uppercase">
                  {fmtDate(a.startsAt, b.timezone, b.locale, { weekday: "short", day: "numeric", month: "short" })} · {fmtTime(a.startsAt, b.timezone, b.locale)}
                </p>
                <p className="text-xs text-zinc-500">
                  {a.service.name} · {a.employee.displayName}
                </p>
              </Link>
            </li>
          ))}
        </ul>
        <table className="hidden w-full text-sm md:table">
          <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-4 py-2">Fecha</th>
              <th className="px-4 py-2">Cliente</th>
              <th className="px-4 py-2">Servicio</th>
              <th className="px-4 py-2">Profesional</th>
              <th className="px-4 py-2">Precio</th>
              <th className="px-4 py-2">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((a) => (
              <tr key={a.id} className="hover:bg-zinc-50">
                <td className="whitespace-nowrap px-4 py-2">
                  <Link href={`/panel/citas/${a.id}`} className="font-medium hover:underline first-letter:uppercase">
                    {fmtDate(a.startsAt, b.timezone, b.locale, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                  </Link>
                  <div className="text-xs text-zinc-500">{fmtTime(a.startsAt, b.timezone, b.locale)}</div>
                </td>
                <td className="px-4 py-2">
                  {a.customer.name}
                  <div className="text-xs text-zinc-500">{a.customer.phone}</div>
                </td>
                <td className="px-4 py-2">
                  <span className="mr-1 inline-block h-2 w-2 rounded-full" style={{ backgroundColor: a.service.color }} />
                  {a.service.name}
                </td>
                <td className="px-4 py-2">{a.employee.displayName}</td>
                <td className="px-4 py-2">{formatMoney(a.priceCents, b.currency, b.locale)}</td>
                <td className="px-4 py-2">
                  <Badge color={STATUS_COLORS[a.status]}>{STATUS_LABELS[a.status]}</Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className="p-6 text-center text-sm text-zinc-500">No hay citas con esos filtros.</p>}
      </Card>

      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-center gap-2 text-sm">
          {f.page > 1 && (
            <Link href={`/panel/citas?${qs({ page: f.page - 1 })}`} className={buttonClasses("outline", "sm")}>
              ‹ Anterior
            </Link>
          )}
          <span className="text-zinc-500">
            Página {f.page} de {pages}
          </span>
          {f.page < pages && (
            <Link href={`/panel/citas?${qs({ page: f.page + 1 })}`} className={buttonClasses("outline", "sm")}>
              Siguiente ›
            </Link>
          )}
        </nav>
      )}
    </>
  );
}
