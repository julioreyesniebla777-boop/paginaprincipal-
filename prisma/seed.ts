/* Datos de ejemplo: 1 negocio, 3 empleados, 5 servicios, 20 clientes y citas en las próximas 2 semanas. */
import { PrismaClient, type AppointmentStatus, type TemplateType } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DateTime } from "luxon";
import { DEFAULT_TEMPLATES } from "../src/server/notifications/default-templates";
import { manageTokenHashFor, newAppointmentId } from "../src/lib/manage-token";

const prisma = new PrismaClient();
const TZ = "America/New_York";

// Generador pseudoaleatorio determinista para que el seed sea reproducible.
let seed = 42;
const rand = () => {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
};
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)]!;

async function main() {
  console.log("Limpiando datos…");
  await prisma.$transaction([
    prisma.notificationLog.deleteMany(),
    prisma.appointmentHistory.deleteMany(),
    prisma.appointment.deleteMany(),
    prisma.customerTag.deleteMany(),
    prisma.tag.deleteMany(),
    prisma.customer.deleteMany(),
    prisma.timeBlock.deleteMany(),
    prisma.scheduleException.deleteMany(),
    prisma.weeklySchedule.deleteMany(),
    prisma.serviceEmployee.deleteMany(),
    prisma.service.deleteMany(),
    prisma.serviceCategory.deleteMany(),
    prisma.employee.deleteMany(),
    prisma.passwordResetToken.deleteMany(),
    prisma.user.deleteMany(),
    prisma.emailTemplate.deleteMany(),
    prisma.rateLimit.deleteMany(),
    prisma.business.deleteMany(),
  ]);

  await prisma.business.create({
    data: {
      name: "Living River Spa",
      slug: "living-river",
      primaryColor: "#0e7490",
      secondaryColor: "#0f172a",
      address: "123 Main St, Orlando, FL 32801",
      phone: "+1 (407) 555-0100",
      email: "info@livingriverllc.com",
      timezone: TZ,
      locale: "es",
      currency: "USD",
      slotIntervalMin: 30,
      minNoticeMin: 120,
      maxDaysAhead: 60,
      cancelLimitMin: 24 * 60,
      autoConfirm: true,
      reminderHoursBefore: 24,
      policyText:
        "Puedes cancelar o reprogramar sin costo hasta 24 horas antes de tu cita. Si llegas más de 15 minutos tarde, es posible que debamos reprogramar.",
    },
  });

  for (const [type, t] of Object.entries(DEFAULT_TEMPLATES)) {
    await prisma.emailTemplate.create({ data: { type: type as TemplateType, subject: t.subject, bodyHtml: t.bodyHtml } });
  }

  console.log("Usuarios…");
  const adminHash = await bcrypt.hash("Admin12345", 12);
  const staffHash = await bcrypt.hash("Empleado123", 12);
  const clientHash = await bcrypt.hash("Cliente123", 12);

  await prisma.user.create({ data: { email: "admin@demo.com", name: "Laura Gómez", passwordHash: adminHash, role: "ADMIN" } });

  const employeesData = [
    { name: "Ana Martínez", email: "ana@demo.com", color: "#db2777" },
    { name: "Carlos Rivera", email: "carlos@demo.com", color: "#2563eb" },
    { name: "Sofía Torres", email: "sofia@demo.com", color: "#16a34a" },
  ];
  const employees = [];
  for (const [i, e] of employeesData.entries()) {
    const user = await prisma.user.create({ data: { email: e.email, name: e.name, passwordHash: staffHash, role: "EMPLOYEE" } });
    employees.push(
      await prisma.employee.create({
        data: { userId: user.id, displayName: e.name, email: e.email, color: e.color, sortOrder: i, bio: `Profesional con experiencia.` },
      }),
    );
  }
  const [ana, carlos, sofia] = employees as [(typeof employees)[0], (typeof employees)[0], (typeof employees)[0]];

  // Horarios: lun–vie 9–13 y 14–18; Sofía también sábados 9–14; Carlos martes solo tarde.
  const blocks: { employeeId: string; weekday: number; startMin: number; endMin: number }[] = [];
  for (const emp of employees) {
    for (let wd = 1; wd <= 5; wd++) {
      if (emp.id === carlos.id && wd === 2) {
        blocks.push({ employeeId: emp.id, weekday: wd, startMin: 12 * 60, endMin: 20 * 60 });
        continue;
      }
      blocks.push({ employeeId: emp.id, weekday: wd, startMin: 9 * 60, endMin: 13 * 60 });
      blocks.push({ employeeId: emp.id, weekday: wd, startMin: 14 * 60, endMin: 18 * 60 });
    }
  }
  blocks.push({ employeeId: sofia.id, weekday: 6, startMin: 9 * 60, endMin: 14 * 60 });
  await prisma.weeklySchedule.createMany({ data: blocks });

  const today = DateTime.now().setZone(TZ).startOf("day");
  const asDate = (d: DateTime) => new Date(`${d.toISODate()}T00:00:00.000Z`);
  // Día libre de Ana dentro de 5 días; feriado del negocio dentro de 10 días.
  await prisma.scheduleException.create({
    data: { employeeId: ana.id, type: "DAY_OFF", startDate: asDate(today.plus({ days: 5 })), endDate: asDate(today.plus({ days: 5 })), label: "Día personal" },
  });
  await prisma.scheduleException.create({
    data: { employeeId: null, type: "HOLIDAY", startDate: asDate(today.plus({ days: 10 })), endDate: asDate(today.plus({ days: 10 })), label: "Feriado" },
  });

  console.log("Servicios…");
  const catFacial = await prisma.serviceCategory.create({ data: { name: "Faciales", sortOrder: 0 } });
  const catBody = await prisma.serviceCategory.create({ data: { name: "Masajes", sortOrder: 1 } });
  const catClass = await prisma.serviceCategory.create({ data: { name: "Clases", sortOrder: 2 } });

  const servicesData = [
    { name: "Limpieza facial", categoryId: catFacial.id, durationMin: 60, priceCents: 6500, color: "#0891b2", bufferAfterMin: 15, emps: [ana, sofia] },
    { name: "Masaje relajante", categoryId: catBody.id, durationMin: 60, priceCents: 8000, color: "#7c3aed", bufferBeforeMin: 5, bufferAfterMin: 10, emps: [carlos, sofia] },
    { name: "Masaje descontracturante", categoryId: catBody.id, durationMin: 90, priceCents: 11000, color: "#9333ea", bufferAfterMin: 15, emps: [carlos] },
    { name: "Consulta de valoración", categoryId: catFacial.id, durationMin: 30, priceCents: 0, color: "#f59e0b", emps: [ana, carlos, sofia] },
    { name: "Clase de yoga", categoryId: catClass.id, durationMin: 60, priceCents: 2000, color: "#16a34a", capacity: 8, emps: [sofia] },
  ];
  const services = [];
  for (const [i, s] of servicesData.entries()) {
    const { emps, ...data } = s;
    services.push(
      await prisma.service.create({
        data: {
          ...data,
          sortOrder: i,
          description: `${s.name}: servicio de ${s.durationMin} minutos.`,
          employees: { create: emps.map((e) => ({ employeeId: e.id })) },
        },
        include: { employees: true },
      }),
    );
  }

  console.log("Clientes…");
  const firstNames = ["María", "José", "Lucía", "Juan", "Valentina", "Diego", "Camila", "Andrés", "Isabella", "Miguel", "Daniela", "Pedro", "Gabriela", "Luis", "Paula", "Jorge", "Elena", "Ricardo", "Natalia", "Fernando"];
  const lastNames = ["García", "López", "Hernández", "Pérez", "Sánchez", "Ramírez", "Flores", "Díaz", "Morales", "Ortiz"];
  const vip = await prisma.tag.create({ data: { name: "VIP", color: "#ca8a04" } });
  const nuevo = await prisma.tag.create({ data: { name: "Nuevo", color: "#2563eb" } });
  const customers = [];
  for (let i = 0; i < 20; i++) {
    const name = `${firstNames[i]} ${pick(lastNames)}`;
    const email = i === 0 ? "cliente@demo.com" : `cliente${i + 1}@ejemplo.com`;
    const phone = `+1 407 555 ${String(1000 + i).padStart(4, "0")}`;
    const user = i === 0 ? await prisma.user.create({ data: { email, name, passwordHash: clientHash, role: "CUSTOMER" } }) : null;
    customers.push(
      await prisma.customer.create({
        data: {
          userId: user?.id,
          name,
          email,
          phone,
          phoneNormalized: phone.replace(/\D/g, ""),
          birthDate: new Date(Date.UTC(1975 + Math.floor(rand() * 30), Math.floor(rand() * 12), 1 + Math.floor(rand() * 28))),
          internalNotes: i % 5 === 0 ? "Prefiere citas por la mañana." : null,
          tags: i % 6 === 0 ? { create: [{ tagId: vip.id }] } : i > 16 ? { create: [{ tagId: nuevo.id }] } : undefined,
        },
      }),
    );
  }

  console.log("Citas…");
  const statuses: AppointmentStatus[] = ["CONFIRMED", "CONFIRMED", "CONFIRMED", "PENDING"];
  let count = 0;
  // Pasado reciente (para reportes) y próximas 2 semanas.
  for (let offset = -14; offset <= 14; offset++) {
    const day = today.plus({ days: offset });
    if (offset === 10) continue; // feriado
    for (const emp of employees) {
      if (emp.id === ana.id && offset === 5) continue;
      // Los sábados quedan libres para la clase grupal.
      const dayBlocks = blocks.filter((b) => b.employeeId === emp.id && b.weekday === day.weekday && b.weekday !== 6);
      for (const b of dayBlocks) {
        let cursor = b.startMin;
        while (true) {
          const candidates = services.filter((s) => s.employees.some((se) => se.employeeId === emp.id) && s.capacity === 1);
          const svc = pick(candidates);
          cursor += pick([0, 0, 30, 60]);
          const start = cursor + svc.bufferBeforeMin;
          const end = start + svc.durationMin;
          if (end + svc.bufferAfterMin > b.endMin) break;
          if (rand() < 0.55) {
            const startsAt = day.set({ hour: Math.floor(start / 60), minute: start % 60 });
            const endsAt = startsAt.plus({ minutes: svc.durationMin });
            const past = endsAt < DateTime.now();
            const status: AppointmentStatus = past ? pick<AppointmentStatus>(["COMPLETED", "COMPLETED", "COMPLETED", "COMPLETED", "NO_SHOW", "CANCELLED"]) : pick(statuses);
            const id = newAppointmentId();
            await prisma.appointment.create({
              data: {
                id,
                serviceId: svc.id,
                employeeId: emp.id,
                customerId: pick(customers).id,
                startsAt: startsAt.toJSDate(),
                endsAt: endsAt.toJSDate(),
                occupiedStart: startsAt.minus({ minutes: svc.bufferBeforeMin }).toJSDate(),
                occupiedEnd: endsAt.plus({ minutes: svc.bufferAfterMin }).toJSDate(),
                status,
                source: rand() < 0.7 ? "ONLINE" : "PANEL",
                priceCents: svc.priceCents,
                manageTokenHash: manageTokenHashFor(id),
                cancelledAt: status === "CANCELLED" ? startsAt.minus({ days: 1 }).toJSDate() : null,
                history: { create: { action: "CREATED", toStatus: status, actorType: "SYSTEM", note: "Seed" } },
              },
            });
            count++;
          }
          cursor = end + svc.bufferAfterMin;
        }
      }
    }
  }

  // Clase de yoga grupal los sábados 10:00 con varias personas.
  const yoga = services.find((s) => s.capacity > 1)!;
  for (let offset = 0; offset <= 14; offset++) {
    const day = today.plus({ days: offset });
    if (day.weekday !== 6) continue;
    const startsAt = day.set({ hour: 10, minute: 0 });
    const attendees = customers.slice(0, 4 + Math.floor(rand() * 3));
    for (const c of attendees) {
      const id = newAppointmentId();
      await prisma.appointment.create({
        data: {
          id,
          serviceId: yoga.id,
          employeeId: sofia.id,
          customerId: c.id,
          startsAt: startsAt.toJSDate(),
          endsAt: startsAt.plus({ minutes: 60 }).toJSDate(),
          occupiedStart: startsAt.toJSDate(),
          occupiedEnd: startsAt.plus({ minutes: 60 }).toJSDate(),
          status: "CONFIRMED",
          priceCents: yoga.priceCents,
          manageTokenHash: manageTokenHashFor(id),
          history: { create: { action: "CREATED", toStatus: "CONFIRMED", actorType: "SYSTEM", note: "Seed" } },
        },
      });
      count++;
    }
  }

  console.log(`Listo: ${count} citas creadas.`);
  console.log("Accesos de prueba:");
  console.log("  Admin:     admin@demo.com / Admin12345");
  console.log("  Empleados: ana@demo.com, carlos@demo.com, sofia@demo.com / Empleado123");
  console.log("  Cliente:   cliente@demo.com / Cliente123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
