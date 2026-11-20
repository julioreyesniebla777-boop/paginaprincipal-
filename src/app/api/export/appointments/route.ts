import { prisma } from "@/server/db";
import { getCurrentUser } from "@/server/auth/guards";
import { getBusiness } from "@/server/business";
import { buildAppointmentWhere } from "@/server/services/appointment-query";
import { appointmentFiltersSchema } from "@/lib/validation/appointment";
import { csvResponse, toCsv } from "@/lib/csv";
import { STATUS_LABELS } from "@/lib/labels";
import { DateTime } from "luxon";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "EMPLOYEE")) return new Response("No autorizado", { status: 401 });
  const parsed = appointmentFiltersSchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return new Response("Parámetros no válidos", { status: 400 });
  const b = await getBusiness();
  const rows = await prisma.appointment.findMany({
    where: buildAppointmentWhere(parsed.data, user, b.timezone),
    orderBy: { startsAt: "desc" },
    include: { service: true, employee: true, customer: true },
    take: 20000,
  });
  const local = (d: Date) => DateTime.fromJSDate(d, { zone: b.timezone });
  const csv = toCsv(rows, [
    { header: "ID", value: (r) => r.id },
    { header: "Fecha", value: (r) => local(r.startsAt).toISODate() },
    { header: "Hora inicio", value: (r) => local(r.startsAt).toFormat("HH:mm") },
    { header: "Hora fin", value: (r) => local(r.endsAt).toFormat("HH:mm") },
    { header: "Estado", value: (r) => STATUS_LABELS[r.status] },
    { header: "Servicio", value: (r) => r.service.name },
    { header: "Profesional", value: (r) => r.employee.displayName },
    { header: "Cliente", value: (r) => r.customer.name },
    { header: "Email", value: (r) => r.customer.email },
    { header: "Teléfono", value: (r) => r.customer.phone },
    { header: `Precio (${b.currency})`, value: (r) => (r.priceCents / 100).toFixed(2) },
    { header: "Origen", value: (r) => (r.source === "ONLINE" ? "En línea" : "Panel") },
    { header: "Notas del cliente", value: (r) => r.customerNotes },
    { header: "Creada", value: (r) => local(r.createdAt).toFormat("yyyy-MM-dd HH:mm") },
  ]);
  return csvResponse(csv, `citas-${DateTime.now().setZone(b.timezone).toISODate()}.csv`);
}
