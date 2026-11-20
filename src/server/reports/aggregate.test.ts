import { describe, expect, it } from "vitest";
import { aggregateReport, pickGranularity, type ReportRow } from "./aggregate";

const TZ = "America/New_York";
const row = (iso: string, over: Partial<ReportRow> = {}): ReportRow => ({
  startsAt: new Date(iso),
  status: "COMPLETED",
  priceCents: 1000,
  customerId: "c1",
  serviceId: "s1",
  serviceName: "Corte",
  employeeId: "e1",
  employeeName: "Ana",
  ...over,
});

describe("aggregateReport", () => {
  it("elige la granularidad según el rango", () => {
    expect(pickGranularity("2026-01-01", "2026-01-31")).toBe("day");
    expect(pickGranularity("2026-01-01", "2026-03-31")).toBe("week");
    expect(pickGranularity("2026-01-01", "2026-12-31")).toBe("month");
  });

  it("agrupa por día local (no UTC) e incluye días vacíos", () => {
    // 2 de marzo 03:00 UTC = 1 de marzo 22:00 en Nueva York
    const r = aggregateReport([row("2026-03-02T03:00:00Z")], new Map(), { timezone: TZ, from: "2026-03-01", to: "2026-03-03" });
    expect(r.periods.map((p) => [p.key, p.total])).toEqual([["2026-03-01", 1], ["2026-03-02", 0], ["2026-03-03", 0]]);
    expect(r.heat[7]![22]).toBe(1); // domingo 22 h
  });

  it("ingresos excluyen canceladas e inasistencias; demanda excluye canceladas", () => {
    const rows = [
      row("2026-03-02T15:00:00Z"),
      row("2026-03-02T16:00:00Z", { status: "CANCELLED" }),
      row("2026-03-02T17:00:00Z", { status: "NO_SHOW" }),
      row("2026-03-02T18:00:00Z", { status: "CONFIRMED", serviceId: "s2", serviceName: "Tinte", priceCents: 5000 }),
    ];
    const r = aggregateReport(rows, new Map(), { timezone: TZ, from: "2026-03-02", to: "2026-03-02" });
    expect(r.totals.revenueCents).toBe(6000);
    expect(r.totals).toMatchObject({ appointments: 4, cancelled: 1, noShow: 1, completed: 1 });
    expect(r.byService[0]).toMatchObject({ id: "s1", count: 2, cancelled: 1 });
    expect(r.byService[1]).toMatchObject({ id: "s2", count: 1, revenueCents: 5000 });
  });

  it("distingue clientes nuevos y recurrentes", () => {
    const first = new Map([
      ["nuevo", new Date("2026-03-02T15:00:00Z")],
      ["viejo", new Date("2025-01-10T15:00:00Z")],
    ]);
    const rows = [row("2026-03-02T15:00:00Z", { customerId: "nuevo" }), row("2026-03-03T15:00:00Z", { customerId: "nuevo" }), row("2026-03-02T16:00:00Z", { customerId: "viejo" })];
    const r = aggregateReport(rows, first, { timezone: TZ, from: "2026-03-01", to: "2026-03-31" });
    expect(r.totals).toMatchObject({ newCustomers: 1, returningCustomers: 1, uniqueCustomers: 2 });
    const d2 = r.periods.find((p) => p.key === "2026-03-02")!;
    expect([d2.newCustomers, d2.returningCustomers]).toEqual([1, 1]);
    const d3 = r.periods.find((p) => p.key === "2026-03-03")!;
    expect([d3.newCustomers, d3.returningCustomers]).toEqual([0, 1]); // ya no es nuevo al día siguiente
  });
});
