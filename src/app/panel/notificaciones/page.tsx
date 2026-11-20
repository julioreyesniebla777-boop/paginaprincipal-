import Link from "next/link";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/auth/guards";
import { getBusiness, appUrl } from "@/server/business";
import { TEMPLATE_LABELS } from "@/server/notifications/default-templates";
import { extraChannelsStatus } from "@/server/notifications/channels";
import { TEMPLATE_TYPES } from "@/lib/validation/template";
import { fmtDateTime } from "@/lib/format";
import { Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { CopyField } from "@/components/forms/copy-field";

export const metadata = { title: "Notificaciones" };

export default async function NotificationsPage() {
  await requireAdmin();
  const b = await getBusiness();
  const [templates, logs, stats] = await Promise.all([
    prisma.emailTemplate.findMany(),
    prisma.notificationLog.findMany({ orderBy: { createdAt: "desc" }, take: 50, include: { appointment: { select: { id: true } } } }),
    prisma.notificationLog.groupBy({ by: ["status"], where: { createdAt: { gte: new Date(Date.now() - 30 * 86400_000) } }, _count: { _all: true } }),
  ]);
  const byType = new Map(templates.map((t) => [t.type, t]));
  const smtpConfigured = !!process.env.SMTP_HOST && process.env.MAIL_DRY_RUN !== "true";
  const stat = (s: string) => stats.find((x) => x.status === s)?._count._all ?? 0;

  return (
    <>
      <PageHeader title="Notificaciones" description="Correos automáticos, recordatorios y canales adicionales." />
      <div className="space-y-6">
        <Card>
          <CardHeader title="Estado del envío" />
          <CardBody className="grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <p className="text-zinc-500">Correo (SMTP)</p>
              <p className="font-medium">
                {smtpConfigured ? <Badge color="#16a34a">Configurado</Badge> : <Badge color="#d97706">{process.env.MAIL_DRY_RUN === "true" ? "Modo prueba (solo consola)" : "Sin configurar"}</Badge>}
              </p>
              <p className="mt-1 text-xs text-zinc-500">Remitente: {process.env.MAIL_FROM || "info@livingriverllc.com"}</p>
            </div>
            <div>
              <p className="text-zinc-500">Recordatorio</p>
              <p className="font-medium">{b.reminderHoursBefore} h antes de la cita</p>
              <p className="mt-1 text-xs text-zinc-500">Se cambia en Configuración.</p>
            </div>
            <div>
              <p className="text-zinc-500">Últimos 30 días</p>
              <p className="font-medium">
                {stat("SENT")} enviados · {stat("FAILED")} fallidos · {stat("SKIPPED")} omitidos
              </p>
            </div>
            <div className="sm:col-span-3">
              <p className="mb-1 text-zinc-500">Comando para el cron job (cada 15 minutos):</p>
              <CopyField value={`curl -fsS -H "Authorization: Bearer TU_CRON_SECRET" ${appUrl("/api/cron/reminders")}`} />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Plantillas de correo" />
          <ul className="divide-y divide-zinc-100">
            {TEMPLATE_TYPES.map((t) => {
              const tpl = byType.get(t);
              return (
                <li key={t}>
                  <Link href={`/panel/notificaciones/${t}`} className="flex items-center gap-3 px-4 py-3 hover:bg-zinc-50 sm:px-6">
                    <span className="flex-1">
                      <span className="block font-medium">{TEMPLATE_LABELS[t]}</span>
                      <span className="block truncate text-xs text-zinc-500">{tpl?.subject ?? "Plantilla predeterminada"}</span>
                    </span>
                    {tpl && !tpl.enabled ? <Badge color="#71717a">Desactivada</Badge> : <Badge color="#16a34a">Activa</Badge>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>

        <Card>
          <CardHeader title="SMS y WhatsApp" description="Integración preparada para añadirla más adelante." />
          <CardBody className="space-y-2 text-sm">
            {extraChannelsStatus().map((c) => (
              <div key={c.channel} className="flex items-center justify-between rounded-lg border border-zinc-200 p-3">
                <span className="font-medium">{c.name}</span>
                <Badge color="#71717a">{c.configured ? "Activo" : "No configurado"}</Badge>
              </div>
            ))}
            <p className="text-xs text-zinc-500">
              Para activarlo, un desarrollador implementa un proveedor (por ejemplo, Twilio o WhatsApp Cloud API) en <code>src/server/notifications/channels.ts</code>. Los envíos ya se registran en el historial con su canal.
            </p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Últimos envíos" />
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-zinc-50 text-left text-xs uppercase text-zinc-500">
                <tr>
                  <th className="px-4 py-2">Fecha</th>
                  <th className="px-4 py-2">Tipo</th>
                  <th className="px-4 py-2">Destinatario</th>
                  <th className="px-4 py-2">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td className="whitespace-nowrap px-4 py-2">{fmtDateTime(l.createdAt, b.timezone, b.locale)}</td>
                    <td className="px-4 py-2">
                      {l.appointment ? <Link href={`/panel/citas/${l.appointment.id}`} className="text-brand hover:underline">{TEMPLATE_LABELS[l.templateType]}</Link> : TEMPLATE_LABELS[l.templateType]}
                      <span className="ml-1 text-xs text-zinc-400">{l.channel.toLowerCase()}</span>
                    </td>
                    <td className="px-4 py-2">{l.recipient}</td>
                    <td className="px-4 py-2">
                      <Badge color={l.status === "SENT" ? "#16a34a" : l.status === "FAILED" ? "#dc2626" : "#71717a"}>
                        {l.status === "SENT" ? "Enviado" : l.status === "FAILED" ? "Fallido" : "Omitido"}
                      </Badge>
                      {l.error && <span className="ml-2 text-xs text-zinc-500">{l.error.slice(0, 80)}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {logs.length === 0 && <p className="p-6 text-center text-sm text-zinc-500">Todavía no hay envíos.</p>}
          </div>
        </Card>
      </div>
    </>
  );
}
