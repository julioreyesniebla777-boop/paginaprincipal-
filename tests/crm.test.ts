import { describe, expect, it } from "vitest";
import { parseBirthDate } from "@/server/services/customer-crm";

describe("parseBirthDate (importación CSV)", () => {
  it("acepta AAAA-MM-DD y DD/MM/AAAA", () => {
    expect(parseBirthDate("1990-05-14")?.toISOString().slice(0, 10)).toBe("1990-05-14");
    expect(parseBirthDate("14/05/1990")?.toISOString().slice(0, 10)).toBe("1990-05-14");
    expect(parseBirthDate("4.5.1990")?.toISOString().slice(0, 10)).toBe("1990-05-04");
  });
  it("rechaza fechas imposibles o futuras", () => {
    expect(parseBirthDate("31-31-2020")).toBeNull();
    expect(parseBirthDate("31/02/2000")).toBeNull();
    expect(parseBirthDate("2999-01-01")).toBeNull();
    expect(parseBirthDate("ayer")).toBeNull();
  });
});
