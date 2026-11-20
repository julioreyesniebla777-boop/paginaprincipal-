import { z } from "zod";
import { DateTime } from "luxon";

export const REPORT_PRESETS = {
  "7d": "Últimos 7 días",
  "30d": "Últimos 30 días",
  mes: "Este mes",
  "mes-anterior": "Mes anterior",
  "90d": "Últimos 90 días",
  anio: "Este año",
} as const;

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const reportFiltersSchema = z.object({
  preset: z.enum(Object.keys(REPORT_PRESETS) as [keyof typeof REPORT_PRESETS, ...Array<keyof typeof REPORT_PRESETS>]).optional().or(z.literal("")).transform((v) => v || undefined),
  from: date.optional().or(z.literal("")).transform((v) => v || undefined),
  to: date.optional().or(z.literal("")).transform((v) => v || undefined),
  employeeId: z.string().max(40).optional().transform((v) => v || undefined),
  serviceId: z.string().max(40).optional().transform((v) => v || undefined),
});

/** Resuelve el rango (máximo 366 días) en la zona del negocio. */
export function resolveRange(f: z.infer<typeof reportFiltersSchema>, zone: string): { from: string; to: string } {
  const today = DateTime.now().setZone(zone).startOf("day");
  let from: DateTime;
  let to: DateTime;
  if (f.from && f.to && !f.preset) {
    from = DateTime.fromISO(f.from, { zone });
    to = DateTime.fromISO(f.to, { zone });
    if (to < from) [from, to] = [to, from];
  } else {
    switch (f.preset ?? "mes") {
      case "7d":
        from = today.minus({ days: 6 });
        to = today;
        break;
      case "30d":
        from = today.minus({ days: 29 });
        to = today;
        break;
      case "90d":
        from = today.minus({ days: 89 });
        to = today;
        break;
      case "mes-anterior":
        from = today.minus({ months: 1 }).startOf("month");
        to = today.minus({ months: 1 }).endOf("month");
        break;
      case "anio":
        from = today.startOf("year");
        to = today.endOf("year");
        break;
      default:
        from = today.startOf("month");
        to = today.endOf("month");
    }
  }
  if (to.diff(from, "days").days > 366) from = to.minus({ days: 366 });
  return { from: from.toISODate()!, to: to.toISODate()! };
}
