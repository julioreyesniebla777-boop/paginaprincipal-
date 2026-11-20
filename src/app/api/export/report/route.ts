import { getCurrentUser } from "@/server/auth/guards";
import { getBusiness } from "@/server/business";
import { loadReport } from "@/server/reports/load";
import { reportFiltersSchema, resolveRange } from "@/lib/validation/report";
import { csvResponse, toCsv } from "@/lib/csv";

const DAYS = ["", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") return new Response("No autorizado", { status: 401 });
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const parsed = reportFiltersSchema.safeParse(params);
  const type = params.type ?? "period";
  if (!parsed.success || !["period", "service", "employee", "hours"].includes(type)) return new Response("Parámetros no válidos", { status: 400 });
  const b = await getBusiness();
  const { from, to } = resolveRange(parsed.data, b.timezone);
  const r = await loadReport({ timezone: b.timezone, locale: b.locale, from, to, employeeId: parsed.data.employeeId, serviceId: parsed.data.serviceId });
  const money = (c: number) => (c / 100).toFixed(2);

  let csv: string;
  if (type === "service" || type === "employee") {
    const rows = type === "service" ? r.byService : r.byEmployee;
    csv = toCsv(rows, [
      { header: type === "service" ? "Servicio" : "Profesional", value: (x) => x.name },
      { header: "Citas (no canceladas)", value: (x) => x.count },
      { header: "Completadas", value: (x) => x.completed },
      { header: "No asistió", value: (x) => x.noShow },
      { header: "Canceladas", value: (x) => x.cancelled },
      { header: `Ingresos estimados (${b.currency})`, value: (x) => money(x.revenueCents) },
    ]);
  } else if (type === "hours") {
    const rows = [1, 2, 3, 4, 5, 6, 7].flatMap((d) => [...Array(24).keys()].map((h) => ({ d, h, v: r.heat[d]![h]! }))).filter((x) => x.v > 0);
    csv = toCsv(rows, [
      { header: "Día", value: (x) => DAYS[x.d] },
      { header: "Hora", value: (x) => `${String(x.h).padStart(2, "0")}:00` },
      { header: "Citas", value: (x) => x.v },
    ]);
  } else {
    csv = toCsv(r.periods, [
      { header: "Inicio del período", value: (p) => p.key },
      { header: "Citas", value: (p) => p.total },
      { header: "Completadas", value: (p) => p.completed },
      { header: "Canceladas", value: (p) => p.cancelled },
      { header: "No asistió", value: (p) => p.noShow },
      { header: `Ingresos estimados (${b.currency})`, value: (p) => money(p.revenueCents) },
      { header: "Clientes nuevos", value: (p) => p.newCustomers },
      { header: "Clientes recurrentes", value: (p) => p.returningCustomers },
    ]);
  }
  return csvResponse(csv, `reporte-${type}-${from}_${to}.csv`);
}
