import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getBusiness } from "@/server/business";
import { findByManageToken, withinCancelPolicy } from "@/server/services/appointments";
import { hashToken } from "@/lib/tokens";
import { googleCalendarUrl } from "@/lib/ics";
import { fmtDate, fmtTime } from "@/lib/format";
import { formatMoney } from "@/lib/money";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/labels";
import { ManageAppointment } from "@/components/booking/manage-appointment";
import { Alert, Badge, Card, CardBody } from "@/components/ui/card";
import { buttonClasses } from "@/components/ui/button";

export const metadata: Metadata = { title: "Mi cita", robots: { index: false, follow: false } };

export default async function ManagePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (token.length < 20 || token.length > 100) notFound();
  const appt = await findByManageToken(hashToken(token));
  if (!appt) notFound();
  const b = await getBusiness();

  const active = appt.status === "PENDING" || appt.status === "CONFIRMED";
  const upcoming = appt.startsAt > new Date();
  const inPolicy = withinCancelPolicy(appt.startsAt, b.cancelLimitMin);
  const canChange = active && upcoming && inPolicy;

  return (
    <div className="mx-auto max-w-xl space-y-4">
      <h1 className="text-2xl font-bold">Tu cita</h1>
      <Card>
        <CardBody className="space-y-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-lg font-semibold">{appt.service.name}</p>
              <p className="text-sm text-zinc-500">con {appt.employee.displayName}</p>
            </div>
            <Badge color={STATUS_COLORS[appt.status]}>{STATUS_LABELS[appt.status]}</Badge>
          </div>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-zinc-500">Fecha</dt>
            <dd className="font-medium first-letter:uppercase">{fmtDate(appt.startsAt, b.timezone, b.locale)}</dd>
            <dt className="text-zinc-500">Hora</dt>
            <dd className="font-medium">
              {fmtTime(appt.startsAt, b.timezone, b.locale)} – {fmtTime(appt.endsAt, b.timezone, b.locale)}
            </dd>
            <dt className="text-zinc-500">Precio</dt>
            <dd className="font-medium">{formatMoney(appt.priceCents, b.currency, b.locale)}</dd>
            <dt className="text-zinc-500">Cliente</dt>
            <dd className="font-medium">{appt.customer.name}</dd>
            {b.address && (
              <>
                <dt className="text-zinc-500">Dirección</dt>
                <dd className="font-medium">{b.address}</dd>
              </>
            )}
          </dl>
          {active && upcoming && (
            <div className="flex flex-wrap gap-2 pt-1">
              <a href={`/api/public/ics/${token}`} className={buttonClasses("outline", "sm")}>
                📅 Agregar a mi calendario
              </a>
              <a
                href={googleCalendarUrl({ start: appt.startsAt, end: appt.endsAt, summary: `${appt.service.name} – ${b.name}`, location: b.address ?? undefined })}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClasses("outline", "sm")}
              >
                Google Calendar
              </a>
            </div>
          )}
        </CardBody>
      </Card>

      {active && upcoming && !inPolicy && (
        <Alert kind="warning">
          Ya no es posible cancelar ni reprogramar en línea (plazo de {Math.round(b.cancelLimitMin / 60)} horas). Llámanos{b.phone ? ` al ${b.phone}` : ""} si necesitas ayuda.
        </Alert>
      )}
      {appt.status === "CANCELLED" && (
        <Alert kind="info">
          Esta cita está cancelada.{" "}
          <Link href="/reservar" className="font-medium underline">
            Reservar una nueva
          </Link>
        </Alert>
      )}

      <ManageAppointment token={token} canChange={canChange} timezone={b.timezone} locale={b.locale} maxDaysAhead={b.maxDaysAhead} />
    </div>
  );
}
