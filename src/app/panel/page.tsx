import Link from "next/link";
import { requireStaff } from "@/server/auth/guards";
import { getBusiness } from "@/server/business";
import { getDashboardStats } from "@/server/services/dashboard";
import { fmtDate, fmtTime } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/labels";
import { Alert, Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";

export const metadata = { title: "Inicio" };

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card>
      <CardBody className="py-3">
        <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
        {sub && <p className="text-xs text-zinc-500">{sub}</p>}
      </CardBody>
    </Card>
  );
}

export default async function Dashboard() {
  const user = await requireStaff();
  const b = await getBusiness();
  const s = await getDashboardStats(b.timezone, user.role === "EMPLOYEE" ? (user.employeeId ?? "__none__") : undefined);
  const money = (c: number) => formatMoney(c, b.currency, b.locale);
  const pct = (n: number) => `${(n * 100).toFixed(1)} %`;

  return (
    <>
      <PageHeader
        title={`Hola, ${user.name.split(" ")[0]}`}
        description={<span className="first-letter:uppercase">{fmtDate(new Date(), b.timezone, b.locale)}</span>}
        actions={
          <>
            <Link href="/panel/calendario" className={buttonClasses("outline")}>
              Calendario
            </Link>
            <Link href="/panel/citas/nueva" className={buttonClasses("primary")}>
              + Nueva cita
            </Link>
          </>
        }
      />

      {s.pendingCount > 0 && (
        <Alert kind="warning" className="mb-4">
          Tienes {s.pendingCount} {s.pendingCount === 1 ? "cita pendiente" : "citas pendientes"} de aprobación.{" "}
          <Link href="/panel/citas?status=PENDING" className="font-medium underline">
            Revisar
          </Link>
        </Alert>
      )}

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Stat label="Ingresos hoy" value={money(s.revenue.day.cents)} sub={`${s.revenue.day.count} citas`} />
        <Stat label="Esta semana" value={money(s.revenue.week.cents)} sub={`${s.revenue.week.count} citas`} />
        <Stat label="Este mes" value={money(s.revenue.month.cents)} sub={`${s.revenue.month.count} citas`} />
        <Stat label="Cancelaciones" value={pct(s.cancellationRate)} sub="últimos 30 días" />
        <Stat label="Inasistencias" value={pct(s.noShowRate)} sub="últimos 30 días" />
      </div>
      <p className="-mt-4 mb-6 text-xs text-zinc-400">Ingresos estimados: citas pendientes, confirmadas y completadas.</p>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title={`Citas de hoy (${s.today.length})`} />
          <div>
            {s.today.length === 0 ? (
              <p className="p-4 text-sm text-zinc-500 sm:px-6">No hay citas hoy.</p>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {s.today.map((a) => (
                  <li key={a.id}>
                    <Link href={`/panel/citas/${a.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 sm:px-6">
                      <span className="w-16 shrink-0 text-sm font-semibold tabular-nums">{fmtTime(a.startsAt, b.timezone, b.locale)}</span>
                      <span className="h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: a.service.color }} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{a.customer.name}</span>
                        <span className="block truncate text-xs text-zinc-500">
                          {a.service.name} · {a.employee.displayName}
                        </span>
                      </span>
                      <Badge color={STATUS_COLORS[a.status]}>{STATUS_LABELS[a.status]}</Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Próximas (7 días)" actions={<Link href="/panel/citas" className="text-sm text-brand hover:underline">Ver todas</Link>} />
          <div>
            {s.upcoming.length === 0 ? (
              <p className="p-4 text-sm text-zinc-500 sm:px-6">Sin citas próximas.</p>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {s.upcoming.map((a) => (
                  <li key={a.id}>
                    <Link href={`/panel/citas/${a.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 sm:px-6">
                      <span className="w-24 shrink-0 text-xs first-letter:uppercase">
                        {fmtDate(a.startsAt, b.timezone, b.locale, { weekday: "short", day: "numeric", month: "short" })}
                        <span className="block font-semibold">{fmtTime(a.startsAt, b.timezone, b.locale)}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{a.customer.name}</span>
                        <span className="block truncate text-xs text-zinc-500">
                          {a.service.name} · {a.employee.displayName}
                        </span>
                      </span>
                      {a.status === "PENDING" && <Badge color={STATUS_COLORS.PENDING}>Pendiente</Badge>}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>
    </>
  );
}
