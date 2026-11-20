/**
 * Agregación de reportes (función pura: recibe filas ya cargadas).
 * Ingresos estimados = citas pendientes, confirmadas y completadas.
 * "Demanda" (servicios más pedidos, horas ocupadas) excluye las canceladas.
 */
import { DateTime } from "luxon";

export type ReportRow = {
  startsAt: Date;
  status: "PENDING" | "CONFIRMED" | "COMPLETED" | "CANCELLED" | "NO_SHOW";
  priceCents: number;
  customerId: string;
  serviceId: string;
  serviceName: string;
  employeeId: string;
  employeeName: string;
};

export type Granularity = "day" | "week" | "month";

export type PeriodStat = {
  key: string; // YYYY-MM-DD (inicio del período)
  label: string;
  total: number;
  completed: number;
  cancelled: number;
  noShow: number;
  revenueCents: number;
  newCustomers: number;
  returningCustomers: number;
};

export type GroupStat = { id: string; name: string; count: number; revenueCents: number; completed: number; noShow: number; cancelled: number };

export type ReportResult = {
  granularity: Granularity;
  periods: PeriodStat[];
  byService: GroupStat[];
  byEmployee: GroupStat[];
  /** heat[weekday 1..7][hour 0..23] */
  heat: number[][];
  totals: { appointments: number; revenueCents: number; completed: number; cancelled: number; noShow: number; newCustomers: number; returningCustomers: number; uniqueCustomers: number };
};

const REVENUE = new Set(["PENDING", "CONFIRMED", "COMPLETED"]);

export function pickGranularity(from: string, to: string): Granularity {
  const days = DateTime.fromISO(to).diff(DateTime.fromISO(from), "days").days + 1;
  return days <= 31 ? "day" : days <= 183 ? "week" : "month";
}

function periodStart(d: DateTime, g: Granularity): DateTime {
  return g === "day" ? d.startOf("day") : g === "week" ? d.startOf("week") : d.startOf("month");
}

function periodLabel(d: DateTime, g: Granularity, locale: string): string {
  const l = d.setLocale(locale);
  return g === "day" ? l.toFormat("d LLL") : g === "week" ? `Sem. ${l.toFormat("d LLL")}` : l.toFormat("LLL yyyy");
}

/**
 * @param firstVisit fecha de la primera cita (no cancelada) de cada cliente, en todo el historial.
 */
export function aggregateReport(
  rows: ReportRow[],
  firstVisit: Map<string, Date>,
  opts: { timezone: string; from: string; to: string; locale?: string; granularity?: Granularity },
): ReportResult {
  const zone = opts.timezone;
  const locale = opts.locale ?? "es";
  const g = opts.granularity ?? pickGranularity(opts.from, opts.to);

  // Períodos vacíos incluidos, para que el eje sea continuo.
  const periods = new Map<string, PeriodStat & { _new: Set<string>; _ret: Set<string> }>();
  const end = DateTime.fromISO(opts.to, { zone }).endOf("day");
  for (let d = periodStart(DateTime.fromISO(opts.from, { zone }), g); d <= end; d = d.plus(g === "day" ? { days: 1 } : g === "week" ? { weeks: 1 } : { months: 1 })) {
    const key = d.toISODate()!;
    periods.set(key, { key, label: periodLabel(d, g, locale), total: 0, completed: 0, cancelled: 0, noShow: 0, revenueCents: 0, newCustomers: 0, returningCustomers: 0, _new: new Set(), _ret: new Set() });
  }

  const services = new Map<string, GroupStat>();
  const employees = new Map<string, GroupStat>();
  const heat = Array.from({ length: 8 }, () => Array<number>(24).fill(0));
  const allNew = new Set<string>();
  const allRet = new Set<string>();
  const totals = { appointments: 0, revenueCents: 0, completed: 0, cancelled: 0, noShow: 0, newCustomers: 0, returningCustomers: 0, uniqueCustomers: 0 };

  const bump = (map: Map<string, GroupStat>, id: string, name: string, r: ReportRow) => {
    const s = map.get(id) ?? { id, name, count: 0, revenueCents: 0, completed: 0, noShow: 0, cancelled: 0 };
    if (r.status === "CANCELLED") s.cancelled++;
    else s.count++;
    if (REVENUE.has(r.status)) s.revenueCents += r.priceCents;
    if (r.status === "COMPLETED") s.completed++;
    if (r.status === "NO_SHOW") s.noShow++;
    map.set(id, s);
  };

  for (const r of rows) {
    const local = DateTime.fromJSDate(r.startsAt, { zone });
    const p = periods.get(periodStart(local, g).toISODate()!);
    if (!p) continue; // fuera de rango
    totals.appointments++;
    p.total++;
    if (r.status === "COMPLETED") {
      p.completed++;
      totals.completed++;
    }
    if (r.status === "CANCELLED") {
      p.cancelled++;
      totals.cancelled++;
    }
    if (r.status === "NO_SHOW") {
      p.noShow++;
      totals.noShow++;
    }
    if (REVENUE.has(r.status)) {
      p.revenueCents += r.priceCents;
      totals.revenueCents += r.priceCents;
    }
    bump(services, r.serviceId, r.serviceName, r);
    bump(employees, r.employeeId, r.employeeName, r);

    if (r.status !== "CANCELLED") {
      heat[local.weekday]![local.hour]!++;
      const first = firstVisit.get(r.customerId);
      const isNew = !!first && periodStart(DateTime.fromJSDate(first, { zone }), g).toISODate() === p.key;
      (isNew ? p._new : p._ret).add(r.customerId);
      const firstInRange = !!first && DateTime.fromJSDate(first, { zone }).toISODate()! >= opts.from;
      (firstInRange ? allNew : allRet).add(r.customerId);
    }
  }

  const periodList = [...periods.values()].map(({ _new, _ret, ...p }) => ({ ...p, newCustomers: _new.size, returningCustomers: [..._ret].filter((c) => !_new.has(c)).length }));
  totals.newCustomers = allNew.size;
  totals.returningCustomers = [...allRet].filter((c) => !allNew.has(c)).length;
  totals.uniqueCustomers = new Set([...allNew, ...allRet]).size;

  const sort = (m: Map<string, GroupStat>) => [...m.values()].sort((a, b) => b.count - a.count || b.revenueCents - a.revenueCents);
  return { granularity: g, periods: periodList, byService: sort(services), byEmployee: sort(employees), heat, totals };
}
