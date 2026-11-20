import Link from "next/link";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/auth/guards";
import { getBusiness } from "@/server/business";
import { loadReport } from "@/server/reports/load";
import { REPORT_PRESETS, reportFiltersSchema, resolveRange } from "@/lib/validation/report";
import { fmtDbDate } from "@/lib/format";
import { ReportsView } from "@/components/charts/reports-view";
import { PageHeader } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { buttonClasses } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export const metadata = { title: "Reportes" };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const raw = await searchParams;
  const f = reportFiltersSchema.parse(raw);
  const b = await getBusiness();
  const { from, to } = resolveRange(f, b.timezone);
  const [report, employees, services] = await Promise.all([
    loadReport({ timezone: b.timezone, locale: b.locale, from, to, employeeId: f.employeeId, serviceId: f.serviceId }),
    prisma.employee.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, displayName: true } }),
    prisma.service.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  const exportQs = new URLSearchParams({ from, to, ...(f.employeeId ? { employeeId: f.employeeId } : {}), ...(f.serviceId ? { serviceId: f.serviceId } : {}) }).toString();
  const activePreset = f.from && f.to && !f.preset ? null : (f.preset ?? "mes");
  const presetHref = (p: string) => {
    const q = new URLSearchParams({ preset: p, ...(f.employeeId ? { employeeId: f.employeeId } : {}), ...(f.serviceId ? { serviceId: f.serviceId } : {}) });
    return `/panel/reportes?${q}`;
  };

  return (
    <>
      <PageHeader
        title="Reportes"
        description={`${fmtDbDate(new Date(from + "T00:00:00Z"), b.locale)} – ${fmtDbDate(new Date(to + "T00:00:00Z"), b.locale)}`}
      />
      {/* Filtros en una fila sobre los gráficos */}
      <div className="mb-6 space-y-3">
        <div className="flex flex-wrap gap-1">
          {Object.entries(REPORT_PRESETS).map(([k, v]) => (
            <Link key={k} href={presetHref(k)} className={cn("rounded-full px-3 py-1.5 text-sm", activePreset === k ? "bg-brand text-white" : "bg-white text-zinc-700 ring-1 ring-zinc-200 hover:bg-zinc-50")}>
              {v}
            </Link>
          ))}
        </div>
        <form method="get" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[auto_auto_1fr_1fr_auto]">
          <Input type="date" name="from" defaultValue={from} aria-label="Desde" />
          <Input type="date" name="to" defaultValue={to} aria-label="Hasta" />
          <Select name="employeeId" defaultValue={f.employeeId ?? ""} aria-label="Profesional">
            <option value="">Todos los profesionales</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.displayName}
              </option>
            ))}
          </Select>
          <Select name="serviceId" defaultValue={f.serviceId ?? ""} aria-label="Servicio">
            <option value="">Todos los servicios</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <button className={buttonClasses("secondary")}>Aplicar</button>
        </form>
      </div>
      <ReportsView r={report} currency={b.currency} locale={b.locale} exportQs={exportQs} />
    </>
  );
}
