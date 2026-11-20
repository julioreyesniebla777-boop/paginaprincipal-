"use client";

import type { ReportResult } from "@/server/reports/aggregate";
import { formatMoney } from "@/lib/money";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { ColumnChart } from "./column-chart";
import { BarList } from "./bar-list";
import { Heatmap } from "./heatmap";
import { SERIES } from "./chart-styles";

function ExportLink({ href }: { href: string }) {
  return (
    <a href={href} className="text-sm text-brand hover:underline">
      CSV
    </a>
  );
}

export function ReportsView({ r, currency, locale, exportQs }: { r: ReportResult; currency: string; locale: string; exportQs: string }) {
  const money = (c: number) => formatMoney(c, currency, locale);
  const moneyShort = (c: number) => (c >= 100000 ? `${Math.round(c / 100000)}k` : money(c).replace(/\.00$/, ""));
  const int = (n: number) => String(Math.round(n));
  const pct = (a: number, b: number) => (b ? `${((a / b) * 100).toFixed(1)} %` : "—");
  const t = r.totals;
  const csv = (type: string) => `/api/export/report?type=${type}&${exportQs}`;
  const granLabel = { day: "día", week: "semana", month: "mes" }[r.granularity];

  const kpis: Array<[string, string, string?]> = [
    ["Citas", int(t.appointments), `${t.completed} completadas`],
    ["Ingresos estimados", money(t.revenueCents)],
    ["Cancelaciones", pct(t.cancelled, t.appointments), `${t.cancelled} citas`],
    ["Inasistencias", pct(t.noShow, t.completed + t.noShow), `${t.noShow} citas`],
    ["Clientes nuevos", int(t.newCustomers), `primera visita en el período (de ${t.uniqueCustomers})`],
    ["Recurrentes", int(t.returningCustomers), `ya eran clientes · ${pct(t.returningCustomers, t.uniqueCustomers)}`],
  ];

  return (
    <div className="min-w-0 space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {kpis.map(([label, value, sub]) => (
          <Card key={label}>
            <CardBody className="py-3">
              <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
              <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
              {sub && <p className="text-xs text-zinc-500">{sub}</p>}
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <CardHeader title={`Citas por ${granLabel}`} description="Todas las citas del período, por fecha de la cita." actions={<ExportLink href={csv("period")} />} />
          <CardBody>
            <ColumnChart ariaLabel="Citas por período" data={r.periods.map((p) => ({ label: p.label, values: { total: p.total } }))} series={[{ key: "total", label: "Citas", color: SERIES[0] }]} format={int} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title={`Ingresos estimados por ${granLabel}`} description="Citas pendientes, confirmadas y completadas." actions={<ExportLink href={csv("period")} />} />
          <CardBody>
            <ColumnChart
              ariaLabel="Ingresos estimados por período"
              data={r.periods.map((p) => ({ label: p.label, values: { revenue: p.revenueCents } }))}
              series={[{ key: "revenue", label: "Ingresos", color: SERIES[0] }]}
              format={moneyShort}
            />
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Clientes nuevos vs. recurrentes" description={`Clientes atendidos por ${granLabel}. "Nuevo" = su primera cita cae en ese período.`} actions={<ExportLink href={csv("period")} />} />
        <CardBody>
          <ColumnChart
            ariaLabel="Clientes nuevos y recurrentes por período"
            data={r.periods.map((p) => ({ label: p.label, values: { nuevos: p.newCustomers, recurrentes: p.returningCustomers } }))}
            series={[
              { key: "nuevos", label: "Nuevos", color: SERIES[0] },
              { key: "recurrentes", label: "Recurrentes", color: SERIES[1] },
            ]}
            format={int}
          />
        </CardBody>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2 [&>*]:min-w-0">
        <Card>
          <CardHeader title="Servicios más pedidos" description="Citas no canceladas e ingresos estimados." actions={<ExportLink href={csv("service")} />} />
          <CardBody>
            <BarList color={SERIES[0]} items={r.byService.map((s) => ({ id: s.id, name: s.name, value: s.count, sub: money(s.revenueCents) }))} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Por profesional" description="Citas no canceladas e ingresos estimados." actions={<ExportLink href={csv("employee")} />} />
          <CardBody>
            <BarList color={SERIES[0]} items={r.byEmployee.map((s) => ({ id: s.id, name: s.name, value: s.count, sub: money(s.revenueCents) }))} />
            {r.byEmployee.length > 0 && (
              <table className="mt-5 w-full text-sm">
                <thead className="text-left text-xs uppercase text-zinc-500">
                  <tr>
                    <th className="py-1">Profesional</th>
                    <th className="py-1 text-right">Completadas</th>
                    <th className="py-1 text-right">No asistió</th>
                    <th className="py-1 text-right">Canceladas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {r.byEmployee.map((e) => (
                    <tr key={e.id}>
                      <td className="py-1">{e.name}</td>
                      <td className="py-1 text-right tabular-nums">{e.completed}</td>
                      <td className="py-1 text-right tabular-nums">{e.noShow}</td>
                      <td className="py-1 text-right tabular-nums">{e.cancelled}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Horas más ocupadas" description="Citas no canceladas por día de la semana y hora de inicio." actions={<ExportLink href={csv("hours")} />} />
        <CardBody>
          <Heatmap heat={r.heat} />
        </CardBody>
      </Card>

      <Card>
        <details>
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium sm:px-6">Ver datos en tabla</summary>
          <div className="overflow-x-auto px-4 pb-4 sm:px-6">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="text-left text-xs uppercase text-zinc-500">
                <tr>
                  <th className="py-1">Período</th>
                  <th className="py-1 text-right">Citas</th>
                  <th className="py-1 text-right">Completadas</th>
                  <th className="py-1 text-right">Canceladas</th>
                  <th className="py-1 text-right">No asistió</th>
                  <th className="py-1 text-right">Ingresos</th>
                  <th className="py-1 text-right">Nuevos</th>
                  <th className="py-1 text-right">Recurrentes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 tabular-nums">
                {r.periods.map((p) => (
                  <tr key={p.key}>
                    <td className="py-1">{p.label}</td>
                    <td className="py-1 text-right">{p.total}</td>
                    <td className="py-1 text-right">{p.completed}</td>
                    <td className="py-1 text-right">{p.cancelled}</td>
                    <td className="py-1 text-right">{p.noShow}</td>
                    <td className="py-1 text-right">{money(p.revenueCents)}</td>
                    <td className="py-1 text-right">{p.newCustomers}</td>
                    <td className="py-1 text-right">{p.returningCustomers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </Card>
    </div>
  );
}
