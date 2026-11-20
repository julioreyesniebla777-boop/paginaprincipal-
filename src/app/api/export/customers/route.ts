import { prisma } from "@/server/db";
import { getCurrentUser } from "@/server/auth/guards";
import { getBusiness } from "@/server/business";
import { buildCustomerWhere, customerTotals } from "@/server/services/customer-crm";
import { customerFiltersSchema } from "@/lib/validation/customer";
import { csvResponse, toCsv } from "@/lib/csv";
import { DateTime } from "luxon";

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return new Response("No autorizado", { status: 401 });
  const parsed = customerFiltersSchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return new Response("Parámetros no válidos", { status: 400 });
  const b = await getBusiness();
  const customers = await prisma.customer.findMany({
    where: buildCustomerWhere(parsed.data),
    orderBy: { name: "asc" },
    include: { tags: { include: { tag: true } }, _count: { select: { appointments: true } } },
    take: 50000,
  });
  const totals = await customerTotals(customers.map((c) => c.id));
  const csv = toCsv(customers, [
    { header: "nombre", value: (c) => c.name },
    { header: "email", value: (c) => c.email },
    { header: "telefono", value: (c) => c.phone },
    { header: "fecha_nacimiento", value: (c) => c.birthDate?.toISOString().slice(0, 10) },
    { header: "etiquetas", value: (c) => c.tags.map((t) => t.tag.name).join("|") },
    { header: "notas", value: (c) => c.internalNotes },
    { header: "bloqueado", value: (c) => (c.isBlocked ? "sí" : "no") },
    { header: "citas", value: (c) => c._count.appointments },
    { header: `total_gastado_${b.currency}`, value: (c) => ((totals.get(c.id)?.spentCents ?? 0) / 100).toFixed(2) },
    { header: "inasistencias", value: (c) => totals.get(c.id)?.noShows ?? 0 },
    { header: "alta", value: (c) => DateTime.fromJSDate(c.createdAt, { zone: b.timezone }).toISODate() },
  ]);
  return csvResponse(csv, `clientes-${DateTime.now().setZone(b.timezone).toISODate()}.csv`);
}
