import { describe, expect, it } from "vitest";
import { parseCsv, toCsv } from "@/lib/csv";

describe("CSV", () => {
  it("escapa comillas, comas y saltos de línea", () => {
    const csv = toCsv([{ a: 'Hola, "mundo"', b: "línea1\nlínea2" }], [
      { header: "A", value: (r) => r.a },
      { header: "B", value: (r) => r.b },
    ]);
    expect(csv).toBe('﻿A,B\r\n"Hola, ""mundo""","línea1\nlínea2"\r\n');
  });
  it("neutraliza fórmulas", () => {
    const csv = toCsv([{ a: "=HYPERLINK(1)" }], [{ header: "A", value: (r) => r.a }]);
    expect(csv).toContain("'=HYPERLINK(1)");
  });
  it("ida y vuelta", () => {
    const csv = toCsv([{ a: 'x,"y"', b: "ñ\nz" }], [
      { header: "A", value: (r) => r.a },
      { header: "B", value: (r) => r.b },
    ]);
    expect(parseCsv(csv)).toEqual([["A", "B"], ['x,"y"', "ñ\nz"]]);
  });
  it("detecta punto y coma como separador", () => {
    expect(parseCsv("nombre;email\nAna;a@x.com\n")).toEqual([["nombre", "email"], ["Ana", "a@x.com"]]);
  });
});
