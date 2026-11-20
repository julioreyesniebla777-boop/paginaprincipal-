/**
 * Pruebas de integración contra MySQL real (opcionales).
 * Se ejecutan con:  RUN_DB_TESTS=1 npm test
 * ⚠️ Usan la base de DATABASE_URL y crean/borran datos de prueba propios.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DateTime } from "luxon";
import { PrismaClient } from "@prisma/client";

const enabled = process.env.RUN_DB_TESTS === "1";
const d = enabled ? describe : describe.skip;

d("reservas concurrentes (MySQL)", () => {
  const prisma = new PrismaClient();
  let serviceId = "";
  let groupServiceId = "";
  let employeeId = "";
  const tag = `itest-${Date.now()}`;
  let start: Date;

  beforeAll(async () => {
    const business = await prisma.business.findFirst();
    if (!business) await prisma.business.create({ data: { name: "Test", slug: "test" } });
    const b = (await prisma.business.findFirst())!;
    const emp = await prisma.employee.create({
      data: {
        displayName: tag,
        schedules: { create: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, startMin: 0, endMin: 1440 })) },
      },
    });
    employeeId = emp.id;
    const svc = await prisma.service.create({
      data: { name: tag, durationMin: 60, employees: { create: [{ employeeId }] } },
    });
    serviceId = svc.id;
    const grp = await prisma.service.create({
      data: { name: `${tag}-grupo`, durationMin: 60, capacity: 3, employees: { create: [{ employeeId }] } },
    });
    groupServiceId = grp.id;
    // Dentro de 5 días a las 10:00 locales (alineado con cualquier intervalo).
    start = DateTime.now().setZone(b.timezone).plus({ days: 5 }).set({ hour: 10, minute: 0, second: 0, millisecond: 0 }).toJSDate();
  });

  afterAll(async () => {
    await prisma.appointment.deleteMany({ where: { employeeId } });
    await prisma.customer.deleteMany({ where: { email: { endsWith: `@${tag}.test` } } });
    await prisma.service.deleteMany({ where: { name: { startsWith: tag } } });
    await prisma.employee.deleteMany({ where: { id: employeeId } });
    await prisma.$disconnect();
  });

  it("de 8 reservas simultáneas para la misma franja solo una tiene éxito", async () => {
    const { createBooking } = await import("@/server/services/appointments");
    const results = await Promise.allSettled(
      Array.from({ length: 8 }, (_, i) =>
        createBooking({
          serviceId,
          employeeId,
          start,
          customer: { name: `Cliente ${i}`, email: `c${i}@${tag}.test`, phone: `555000${i}` },
          source: "ONLINE",
          actor: { type: "GUEST" },
        }),
      ),
    );
    const ok = results.filter((r) => r.status === "fulfilled");
    expect(ok).toHaveLength(1);
    const count = await prisma.appointment.count({ where: { employeeId, serviceId, startsAt: start } });
    expect(count).toBe(1);
  });

  it("un servicio grupal acepta exactamente su capacidad", async () => {
    const { createBooking } = await import("@/server/services/appointments");
    const groupStart = new Date(start.getTime() + 3 * 3600_000);
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, (_, i) =>
        createBooking({
          serviceId: groupServiceId,
          employeeId: "any",
          start: groupStart,
          customer: { name: `Alumno ${i}`, email: `g${i}@${tag}.test` },
          source: "ONLINE",
          actor: { type: "GUEST" },
        }),
      ),
    );
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
  });
});
