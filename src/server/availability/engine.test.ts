import { describe, expect, it } from "vitest";
import {
  computeSlots,
  availableDates,
  isSlotAvailable,
  localMinutesToInstant,
  pickEmployee,
  workingBlocksForDate,
  type ComputeSlotsInput,
  type EmployeeAvailabilityInput,
  type ServiceInput,
} from "./engine";

const TZ = "America/New_York";
const h = (hh: number, mm = 0) => hh * 60 + mm;

const weekdays = (blocks: Array<[number, number]>) =>
  [1, 2, 3, 4, 5].flatMap((weekday) => blocks.map(([startMin, endMin]) => ({ weekday, startMin, endMin })));

function emp(overrides: Partial<EmployeeAvailabilityInput> = {}): EmployeeAvailabilityInput {
  return {
    id: "e1",
    weekly: weekdays([[h(9), h(12)], [h(14), h(18)]]),
    exceptions: [],
    timeBlocks: [],
    appointments: [],
    ...overrides,
  };
}

const svc60: ServiceInput = { id: "s1", durationMin: 60, bufferBeforeMin: 0, bufferAfterMin: 0, capacity: 1 };

function input(overrides: Partial<ComputeSlotsInput> = {}): ComputeSlotsInput {
  return {
    settings: { timezone: TZ, slotIntervalMin: 60, minNoticeMin: 0, maxDaysAhead: 365 },
    service: svc60,
    employees: [emp()],
    // "Ahora" = domingo 1 de febrero 2026 00:00 en Nueva York (05:00 UTC)
    now: new Date("2026-02-01T05:00:00Z"),
    from: "2026-02-02", // lunes
    to: "2026-02-02",
    ...overrides,
  };
}

/** Horas locales (HH:mm) de las franjas de un día. */
function localTimes(res: ReturnType<typeof computeSlots>, date: string) {
  const day = res.find((d) => d.date === date);
  return (day?.slots ?? []).map((s) =>
    new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(s.start)),
  );
}

describe("horario semanal con varios bloques", () => {
  it("genera franjas en cada bloque y respeta el fin del bloque", () => {
    const res = computeSlots(input());
    expect(localTimes(res, "2026-02-02")).toEqual(["09:00", "10:00", "11:00", "14:00", "15:00", "16:00", "17:00"]);
  });

  it("guarda las franjas en UTC (EST = UTC−5 en invierno)", () => {
    const res = computeSlots(input());
    expect(res[0]!.slots[0]!.start).toBe("2026-02-02T14:00:00.000Z");
    expect(res[0]!.slots[0]!.end).toBe("2026-02-02T15:00:00.000Z");
  });

  it("intervalo de 30 minutos", () => {
    const res = computeSlots(input({ settings: { timezone: TZ, slotIntervalMin: 30, minNoticeMin: 0, maxDaysAhead: 365 } }));
    expect(localTimes(res, "2026-02-02").slice(0, 5)).toEqual(["09:00", "09:30", "10:00", "10:30", "11:00"]);
    expect(localTimes(res, "2026-02-02")).not.toContain("11:30"); // 11:30–12:30 se sale del bloque
  });

  it("intervalo de 15 minutos", () => {
    const res = computeSlots(input({ settings: { timezone: TZ, slotIntervalMin: 15, minNoticeMin: 0, maxDaysAhead: 365 } }));
    expect(localTimes(res, "2026-02-02").filter((t) => t < "12:00")).toHaveLength(9); // 9:00 … 11:00
  });

  it("sin horario el fin de semana", () => {
    const res = computeSlots(input({ from: "2026-02-07", to: "2026-02-08" }));
    expect(res).toEqual([]);
  });
});

describe("citas que cruzan bloques", () => {
  it("no permite una cita que empiece en un bloque y termine en el siguiente", () => {
    const svc90 = { ...svc60, durationMin: 90 };
    const res = computeSlots(input({ service: svc90, settings: { timezone: TZ, slotIntervalMin: 30, minNoticeMin: 0, maxDaysAhead: 365 } }));
    const times = localTimes(res, "2026-02-02");
    expect(times).toContain("10:30"); // 10:30–12:00 cabe justo
    expect(times).not.toContain("11:00"); // 11:00–12:30 cruzaría la pausa
    expect(times).not.toContain("11:30");
    expect(times).toContain("14:00");
  });

  it("bloques contiguos no se fusionan: la cita debe caber en un único bloque", () => {
    const e = emp({ weekly: weekdays([[h(9), h(10)], [h(10), h(11)]]) });
    const res = computeSlots(input({ employees: [e], service: { ...svc60, durationMin: 90 }, settings: { timezone: TZ, slotIntervalMin: 30, minNoticeMin: 0, maxDaysAhead: 365 } }));
    expect(res).toEqual([]);
  });

  it("una cita existente que cruza el borde del bloque ocupa ambos lados", () => {
    // Cita creada manualmente 11:30–14:30 (se solapa con el final del bloque 1 y el inicio del bloque 2)
    const e = emp({
      appointments: [{ serviceId: "x", startsAt: "2026-02-02T16:30:00Z", occupiedStart: "2026-02-02T16:30:00Z", occupiedEnd: "2026-02-02T19:30:00Z" }],
    });
    const res = computeSlots(input({ employees: [e] }));
    expect(localTimes(res, "2026-02-02")).toEqual(["09:00", "10:00", "15:00", "16:00", "17:00"]);
  });
});

describe("buffers antes y después", () => {
  it("el buffer posterior de una cita bloquea la franja siguiente", () => {
    // Cita 10:00–11:00 con 15 min de limpieza → ocupado hasta 11:15
    const e = emp({
      appointments: [{ serviceId: "s1", startsAt: "2026-02-02T15:00:00Z", occupiedStart: "2026-02-02T15:00:00Z", occupiedEnd: "2026-02-02T16:15:00Z" }],
    });
    const res = computeSlots(input({ employees: [e], settings: { timezone: TZ, slotIntervalMin: 30, minNoticeMin: 0, maxDaysAhead: 365 } }));
    const times = localTimes(res, "2026-02-02");
    expect(times).not.toContain("11:00");
    expect(times).not.toContain("09:30"); // 9:30–10:30 choca con la cita
    expect(times).toContain("09:00");
  });

  it("el buffer previo del servicio solicitado también debe estar libre", () => {
    const svc = { ...svc60, bufferBeforeMin: 15 };
    // Cita ocupada 9:00–10:00: una franja 10:00 necesita 9:45–10:00 libre → no
    const e = emp({
      appointments: [{ serviceId: "s1", startsAt: "2026-02-02T14:00:00Z", occupiedStart: "2026-02-02T14:00:00Z", occupiedEnd: "2026-02-02T15:00:00Z" }],
    });
    const res = computeSlots(input({ service: svc, employees: [e], settings: { timezone: TZ, slotIntervalMin: 30, minNoticeMin: 0, maxDaysAhead: 365 } }));
    const times = localTimes(res, "2026-02-02");
    expect(times).not.toContain("10:00");
    expect(times).toContain("10:30");
  });

  it("los buffers pueden salir del horario laboral", () => {
    const svc = { ...svc60, bufferBeforeMin: 10, bufferAfterMin: 10 };
    const res = computeSlots(input({ service: svc }));
    const times = localTimes(res, "2026-02-02");
    expect(times[0]).toBe("09:00");
    expect(times).toContain("17:00");
  });
});

describe("excepciones por fecha", () => {
  it("día libre del empleado", () => {
    const e = emp({ exceptions: [{ type: "DAY_OFF", startDate: "2026-02-02", endDate: "2026-02-02" }] });
    expect(computeSlots(input({ employees: [e] }))).toEqual([]);
  });

  it("vacaciones en un rango de fechas", () => {
    const e = emp({ exceptions: [{ type: "VACATION", startDate: "2026-02-03", endDate: "2026-02-05" }] });
    const dates = availableDates(input({ employees: [e], from: "2026-02-02", to: "2026-02-06" }));
    expect(dates).toEqual(["2026-02-02", "2026-02-06"]);
  });

  it("horario especial reemplaza al semanal (incluso un sábado)", () => {
    const e = emp({
      exceptions: [
        { type: "CUSTOM_HOURS", startDate: "2026-02-07", endDate: "2026-02-07", startMin: h(10), endMin: h(12) },
        { type: "CUSTOM_HOURS", startDate: "2026-02-07", endDate: "2026-02-07", startMin: h(15), endMin: h(16) },
      ],
    });
    const res = computeSlots(input({ employees: [e], from: "2026-02-07", to: "2026-02-07" }));
    expect(localTimes(res, "2026-02-07")).toEqual(["10:00", "11:00", "15:00"]);
  });

  it("un cierre tiene prioridad sobre un horario especial", () => {
    const e = emp({
      exceptions: [
        { type: "CUSTOM_HOURS", startDate: "2026-02-02", endDate: "2026-02-02", startMin: h(10), endMin: h(12) },
        { type: "HOLIDAY", startDate: "2026-02-02", endDate: "2026-02-02" },
      ],
    });
    expect(computeSlots(input({ employees: [e] }))).toEqual([]);
  });

  it("workingBlocksForDate devuelve los bloques ordenados", () => {
    const blocks = workingBlocksForDate("2026-02-02", [{ weekday: 1, startMin: h(14), endMin: h(18) }, { weekday: 1, startMin: h(9), endMin: h(12) }], [], TZ);
    expect(blocks).toEqual([{ startMin: h(9), endMin: h(12) }, { startMin: h(14), endMin: h(18) }]);
  });
});

describe("bloqueos manuales", () => {
  it("un almuerzo bloqueado elimina las franjas que se solapan", () => {
    const e = emp({ timeBlocks: [{ startsAt: "2026-02-02T15:30:00Z", endsAt: "2026-02-02T16:00:00Z" }] }); // 10:30–11:00 local
    const times = localTimes(computeSlots(input({ employees: [e] })), "2026-02-02");
    expect(times).not.toContain("10:00");
    expect(times).toContain("09:00");
    expect(times).toContain("11:00");
  });
});

describe("capacidad de grupos", () => {
  const yoga: ServiceInput = { id: "yoga", durationMin: 60, bufferBeforeMin: 0, bufferAfterMin: 0, capacity: 3 };
  const at10 = { serviceId: "yoga", startsAt: "2026-02-02T15:00:00Z", occupiedStart: "2026-02-02T15:00:00Z", occupiedEnd: "2026-02-02T16:00:00Z" };

  it("informa las plazas libres de la clase", () => {
    const e = emp({ appointments: [at10, at10] });
    const res = computeSlots(input({ service: yoga, employees: [e] }));
    const slot = res[0]!.slots.find((s) => s.start === "2026-02-02T15:00:00.000Z")!;
    expect(slot.employees[0]!.seatsLeft).toBe(1);
    const free = res[0]!.slots.find((s) => s.start === "2026-02-02T14:00:00.000Z")!;
    expect(free.employees[0]!.seatsLeft).toBe(3);
  });

  it("una clase llena desaparece", () => {
    const e = emp({ appointments: [at10, at10, at10] });
    const times = localTimes(computeSlots(input({ service: yoga, employees: [e] })), "2026-02-02");
    expect(times).not.toContain("10:00");
  });

  it("no se puede abrir otra clase solapada con una existente a distinta hora", () => {
    const e = emp({ appointments: [at10] });
    const res = computeSlots(input({ service: yoga, employees: [e], settings: { timezone: TZ, slotIntervalMin: 30, minNoticeMin: 0, maxDaysAhead: 365 } }));
    const times = localTimes(res, "2026-02-02");
    expect(times).toContain("10:00");
    expect(times).not.toContain("09:30");
    expect(times).not.toContain("10:30");
  });

  it("una cita individual bloquea la clase en esa hora", () => {
    const e = emp({ appointments: [{ ...at10, serviceId: "s1" }] });
    const times = localTimes(computeSlots(input({ service: yoga, employees: [e] })), "2026-02-02");
    expect(times).not.toContain("10:00");
  });

  it("una clase con alumnos bloquea servicios individuales", () => {
    const e = emp({ appointments: [at10] });
    const times = localTimes(computeSlots(input({ service: svc60, employees: [e] })), "2026-02-02");
    expect(times).not.toContain("10:00");
  });
});

describe("cambio de horario de verano (America/New_York)", () => {
  it("las 9:00 locales son 14:00 UTC antes y 13:00 UTC después del cambio de marzo", () => {
    // 2026-03-08 (domingo) empieza el horario de verano. Trabaja todos los días 9–12.
    const e = emp({ weekly: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, startMin: h(9), endMin: h(12) })) });
    const res = computeSlots(input({ employees: [e], now: new Date("2026-03-01T05:00:00Z"), from: "2026-03-07", to: "2026-03-09" }));
    expect(res.find((d) => d.date === "2026-03-07")!.slots[0]!.start).toBe("2026-03-07T14:00:00.000Z");
    expect(res.find((d) => d.date === "2026-03-08")!.slots[0]!.start).toBe("2026-03-08T13:00:00.000Z");
    expect(res.find((d) => d.date === "2026-03-09")!.slots[0]!.start).toBe("2026-03-09T13:00:00.000Z");
    for (const d of res) expect(localTimes(res, d.date)).toEqual(["09:00", "10:00", "11:00"]);
  });

  it("noviembre: vuelve a UTC−5 tras el cambio", () => {
    const e = emp({ weekly: [1, 2, 3, 4, 5, 6, 7].map((weekday) => ({ weekday, startMin: h(9), endMin: h(10) })) });
    const res = computeSlots(input({ employees: [e], now: new Date("2026-10-25T05:00:00Z"), from: "2026-10-31", to: "2026-11-01" }));
    expect(res.find((d) => d.date === "2026-10-31")!.slots[0]!.start).toBe("2026-10-31T13:00:00.000Z");
    expect(res.find((d) => d.date === "2026-11-01")!.slots[0]!.start).toBe("2026-11-01T14:00:00.000Z");
  });

  it("un bloque nocturno en la noche del cambio de marzo dura una hora menos real", () => {
    // Bloque 00:00–04:00 local el 8 de marzo: a las 2:00 se salta a las 3:00 → solo 3 horas reales
    const e = emp({ weekly: [{ weekday: 7, startMin: 0, endMin: h(4) }] });
    const res = computeSlots(input({ employees: [e], now: new Date("2026-03-01T05:00:00Z"), from: "2026-03-08", to: "2026-03-08" }));
    expect(localTimes(res, "2026-03-08")).toEqual(["00:00", "01:00", "03:00"]);
  });

  it("un bloque nocturno en la noche del cambio de noviembre dura una hora más real", () => {
    const e = emp({ weekly: [{ weekday: 7, startMin: 0, endMin: h(3) }] });
    const res = computeSlots(input({ employees: [e], now: new Date("2026-10-25T05:00:00Z"), from: "2026-11-01", to: "2026-11-01" }));
    expect(res[0]!.slots).toHaveLength(4); // 00:00 EDT, 01:00 EDT, 01:00 EST, 02:00 EST
  });

  it("una cita que cruza el cambio de hora no se duplica", () => {
    expect(localMinutesToInstant("2026-03-08", h(3), TZ) - localMinutesToInstant("2026-03-08", h(1), TZ)).toBe(60 * 60_000);
  });
});

describe("anticipación mínima y máximo de días", () => {
  it("excluye franjas dentro de la anticipación mínima", () => {
    // Ahora: lunes 2/2 a las 9:30 local (14:30 UTC), anticipación 2 h → primera franja 11:30 o después
    const res = computeSlots(
      input({ now: new Date("2026-02-02T14:30:00Z"), settings: { timezone: TZ, slotIntervalMin: 60, minNoticeMin: 120, maxDaysAhead: 60 } }),
    );
    expect(localTimes(res, "2026-02-02")).toEqual(["14:00", "15:00", "16:00", "17:00"]);
  });

  it("no ofrece fechas más allá del máximo de días", () => {
    const dates = availableDates(
      input({ from: "2026-02-02", to: "2026-03-31", settings: { timezone: TZ, slotIntervalMin: 60, minNoticeMin: 0, maxDaysAhead: 7 } }),
    );
    expect(dates[dates.length - 1]).toBe("2026-02-06"); // hoy 1/2 + 7 = 8/2 (domingo); último laborable 6/2
  });

  it("no ofrece fechas pasadas", () => {
    const res = computeSlots(input({ from: "2026-01-26", to: "2026-02-02" }));
    expect(res.map((d) => d.date)).toEqual(["2026-02-02"]);
  });

  it("el panel puede ignorar la ventana de reserva", () => {
    const res = computeSlots(input({ from: "2026-01-30", to: "2026-01-30", ignoreBookingWindow: true }));
    expect(res).toHaveLength(1);
  });

  it("'hoy' se calcula en la zona del negocio, no en UTC", () => {
    // 3 de febrero 02:00 UTC = 2 de febrero 21:00 en Nueva York → aún es lunes allí
    const res = computeSlots(input({ now: new Date("2026-02-03T02:00:00Z"), from: "2026-02-02", to: "2026-02-03" }));
    expect(res.map((d) => d.date)).toEqual(["2026-02-03"]); // el lunes ya pasó entero, el martes está disponible
  });
});

describe("varios profesionales y 'cualquiera disponible'", () => {
  it("agrupa los profesionales disponibles por franja", () => {
    const e2 = emp({ id: "e2", weekly: weekdays([[h(10), h(12)]]) });
    const res = computeSlots(input({ employees: [emp(), e2] }));
    const slot10 = res[0]!.slots.find((s) => s.start === "2026-02-02T15:00:00.000Z")!;
    expect(slot10.employees.map((e) => e.employeeId).sort()).toEqual(["e1", "e2"]);
    const slot9 = res[0]!.slots.find((s) => s.start === "2026-02-02T14:00:00.000Z")!;
    expect(slot9.employees.map((e) => e.employeeId)).toEqual(["e1"]);
  });

  it("pickEmployee elige al de menor carga", () => {
    expect(pickEmployee([{ employeeId: "a", seatsLeft: 1 }, { employeeId: "b", seatsLeft: 1 }], { a: 3, b: 1 })).toBe("b");
    expect(pickEmployee([], {})).toBeNull();
  });
});

describe("isSlotAvailable (verificación final al confirmar)", () => {
  const base = { settings: { timezone: TZ, slotIntervalMin: 60, minNoticeMin: 0, maxDaysAhead: 365 }, service: svc60, now: new Date("2026-02-01T05:00:00Z") };

  it("acepta una franja libre", () => {
    expect(isSlotAvailable({ ...base, employees: [emp()] }, "e1", new Date("2026-02-02T14:00:00Z"))).toBe(true);
  });

  it("rechaza una franja ocupada por otra reserva (doble reserva)", () => {
    const e = emp({ appointments: [{ serviceId: "s1", startsAt: "2026-02-02T14:00:00Z", occupiedStart: "2026-02-02T14:00:00Z", occupiedEnd: "2026-02-02T15:00:00Z" }] });
    expect(isSlotAvailable({ ...base, employees: [e] }, "e1", new Date("2026-02-02T14:00:00Z"))).toBe(false);
  });

  it("rechaza horas no alineadas con el intervalo", () => {
    expect(isSlotAvailable({ ...base, employees: [emp()] }, "e1", new Date("2026-02-02T14:20:00Z"))).toBe(false);
  });

  it("rechaza un empleado que no está en la lista", () => {
    expect(isSlotAvailable({ ...base, employees: [emp()] }, "otro", new Date("2026-02-02T14:00:00Z"))).toBe(false);
  });
});
