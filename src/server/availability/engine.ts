/**
 * Motor de cálculo de franjas libres.
 *
 * Es una FUNCIÓN PURA: no accede a la base de datos ni al reloj del sistema
 * (la hora actual llega como parámetro), de modo que se puede probar de forma
 * determinista. Todo el cálculo se hace con instantes UTC (milisegundos) y la
 * zona horaria del negocio solo se usa para interpretar los horarios locales
 * (horario semanal, excepciones por fecha y "hoy").
 *
 * Reglas:
 * - Día laborable: una excepción de cierre (DAY_OFF, VACATION, HOLIDAY) anula el
 *   día; si no la hay, las excepciones CUSTOM_HOURS reemplazan el horario semanal;
 *   si tampoco, se usa el horario semanal (varios bloques por día).
 * - El servicio [inicio, fin] debe caber completo dentro de un bloque laboral.
 *   Una cita no puede cruzar de un bloque a otro (ej. 12:30–13:30 con un bloque
 *   9–13 y otro 14–18 no es válida).
 * - El intervalo ocupado [inicio − buffer antes, fin + buffer después] no puede
 *   solaparse con bloqueos manuales ni con el intervalo ocupado de otras citas.
 *   Los buffers sí pueden salir del horario laboral (preparación antes de abrir
 *   o limpieza después de cerrar).
 * - Capacidad > 1 (grupos): varias citas del MISMO servicio que empiezan a la
 *   MISMA hora con el mismo profesional comparten la franja hasta llenar la
 *   capacidad. Cualquier otra cita que se solape la bloquea.
 * - Las franjas se generan cada `slotIntervalMin` minutos desde el inicio de
 *   cada bloque.
 * - Se excluyen las franjas que empiezan antes de `now + minNoticeMin` y las de
 *   fechas locales posteriores a hoy + `maxDaysAhead`.
 */
import { DateTime } from "luxon";

export type ExceptionKind = "DAY_OFF" | "VACATION" | "HOLIDAY" | "CUSTOM_HOURS";

export interface WeeklyBlock {
  weekday: number; // 1 = lunes … 7 = domingo (ISO)
  startMin: number; // minutos desde medianoche local
  endMin: number;
}

export interface DateException {
  type: ExceptionKind;
  startDate: string; // YYYY-MM-DD (fecha local, inclusive)
  endDate: string; // YYYY-MM-DD (fecha local, inclusive)
  startMin?: number | null;
  endMin?: number | null;
}

export interface BusyAppointment {
  id?: string;
  serviceId: string;
  startsAt: Date | string;
  occupiedStart: Date | string;
  occupiedEnd: Date | string;
}

export interface BusyBlock {
  startsAt: Date | string;
  endsAt: Date | string;
}

export interface EmployeeAvailabilityInput {
  id: string;
  weekly: WeeklyBlock[];
  /** Excepciones del empleado + excepciones de todo el negocio. */
  exceptions: DateException[];
  timeBlocks: BusyBlock[];
  /** Solo citas que ocupan agenda (pendientes y confirmadas). */
  appointments: BusyAppointment[];
}

export interface ServiceInput {
  id: string;
  durationMin: number;
  bufferBeforeMin: number;
  bufferAfterMin: number;
  capacity: number;
}

export interface EngineSettings {
  timezone: string;
  slotIntervalMin: number;
  minNoticeMin: number;
  maxDaysAhead: number;
}

export interface ComputeSlotsInput {
  settings: EngineSettings;
  service: ServiceInput;
  employees: EmployeeAvailabilityInput[];
  /** Fechas locales YYYY-MM-DD, inclusive. */
  from: string;
  to: string;
  now: Date;
  /**
   * Ignora los límites de anticipación mínima y días máximos (lo usa el panel
   * cuando el personal crea o mueve citas manualmente).
   */
  ignoreBookingWindow?: boolean;
}

export interface SlotEmployee {
  employeeId: string;
  seatsLeft: number;
}

export interface Slot {
  start: string; // ISO UTC
  end: string; // ISO UTC
  employees: SlotEmployee[];
}

export interface DaySlots {
  date: string; // YYYY-MM-DD local
  slots: Slot[];
}

const MIN = 60_000;

const toMs = (d: Date | string) => (typeof d === "string" ? Date.parse(d) : d.getTime());

/** Instante UTC (ms) de una fecha local + minutos desde medianoche local. */
export function localMinutesToInstant(date: string, minutes: number, zone: string): number {
  const base = DateTime.fromISO(date, { zone }).startOf("day");
  const dayOffset = Math.floor(minutes / 1440);
  const rem = minutes - dayOffset * 1440;
  const dt = base.plus({ days: dayOffset }).set({ hour: Math.floor(rem / 60), minute: rem % 60, second: 0, millisecond: 0 });
  return dt.toMillis();
}

/** Bloques laborables (en minutos locales) de una fecha concreta. */
export function workingBlocksForDate(
  date: string,
  weekly: WeeklyBlock[],
  exceptions: DateException[],
  zone: string,
): Array<{ startMin: number; endMin: number }> {
  const covering = exceptions.filter((e) => e.startDate <= date && date <= e.endDate);
  if (covering.some((e) => e.type !== "CUSTOM_HOURS")) return [];
  const custom = covering.filter((e) => e.type === "CUSTOM_HOURS" && e.startMin != null && e.endMin != null);
  const weekday = DateTime.fromISO(date, { zone }).weekday;
  const source = custom.length
    ? custom.map((e) => ({ startMin: e.startMin as number, endMin: e.endMin as number }))
    : weekly.filter((w) => w.weekday === weekday).map((w) => ({ startMin: w.startMin, endMin: w.endMin }));
  return source.filter((b) => b.endMin > b.startMin).sort((a, b) => a.startMin - b.startMin);
}

function eachDate(from: string, to: string, zone: string): string[] {
  const out: string[] = [];
  let d = DateTime.fromISO(from, { zone }).startOf("day");
  const end = DateTime.fromISO(to, { zone }).startOf("day");
  // Límite de seguridad: como mucho un año de fechas.
  for (let i = 0; d <= end && i < 366; i++) {
    out.push(d.toISODate()!);
    d = d.plus({ days: 1 });
  }
  return out;
}

const overlaps = (aStart: number, aEnd: number, bStart: number, bEnd: number) => aStart < bEnd && bStart < aEnd;

/** Plazas libres de un empleado para una franja, o 0 si no está disponible. */
function seatsForCandidate(
  start: number,
  service: ServiceInput,
  busyBlocks: Array<[number, number]>,
  appts: Array<{ serviceId: string; start: number; oStart: number; oEnd: number }>,
): number {
  const end = start + service.durationMin * MIN;
  const oStart = start - service.bufferBeforeMin * MIN;
  const oEnd = end + service.bufferAfterMin * MIN;

  for (const [bs, be] of busyBlocks) if (overlaps(oStart, oEnd, bs, be)) return 0;

  let sameGroup = 0;
  for (const a of appts) {
    if (!overlaps(oStart, oEnd, a.oStart, a.oEnd)) continue;
    if (service.capacity > 1 && a.serviceId === service.id && a.start === start) {
      sameGroup++;
      continue;
    }
    return 0;
  }
  return Math.max(0, service.capacity - sameGroup);
}

/** Calcula las franjas libres por fecha local. */
export function computeSlots(input: ComputeSlotsInput): DaySlots[] {
  const { settings, service, employees, now } = input;
  const zone = settings.timezone;
  const interval = Math.max(5, settings.slotIntervalMin) * MIN;
  const nowMs = now.getTime();

  const today = DateTime.fromMillis(nowMs, { zone }).toISODate()!;
  const lastDate = DateTime.fromISO(today, { zone }).plus({ days: settings.maxDaysAhead }).toISODate()!;
  const earliest = input.ignoreBookingWindow ? -Infinity : nowMs + settings.minNoticeMin * MIN;

  let from = input.from;
  let to = input.to;
  if (!input.ignoreBookingWindow) {
    if (from < today) from = today;
    if (to > lastDate) to = lastDate;
  }
  if (from > to || service.durationMin <= 0 || service.capacity < 1) return [];

  const dates = eachDate(from, to, zone);

  // Pre-procesa los datos ocupados de cada empleado.
  const prepared = employees.map((e) => ({
    id: e.id,
    weekly: e.weekly,
    exceptions: e.exceptions,
    busyBlocks: e.timeBlocks.map((b) => [toMs(b.startsAt), toMs(b.endsAt)] as [number, number]),
    appts: e.appointments.map((a) => ({
      serviceId: a.serviceId,
      start: toMs(a.startsAt),
      oStart: toMs(a.occupiedStart),
      oEnd: toMs(a.occupiedEnd),
    })),
  }));

  const result: DaySlots[] = [];
  for (const date of dates) {
    const byStart = new Map<number, SlotEmployee[]>();
    for (const emp of prepared) {
      const blocks = workingBlocksForDate(date, emp.weekly, emp.exceptions, zone);
      for (const b of blocks) {
        const blockStart = localMinutesToInstant(date, b.startMin, zone);
        const blockEnd = localMinutesToInstant(date, b.endMin, zone);
        for (let start = blockStart; start + service.durationMin * MIN <= blockEnd; start += interval) {
          if (start < earliest) continue;
          const seats = seatsForCandidate(start, service, emp.busyBlocks, emp.appts);
          if (seats <= 0) continue;
          const list = byStart.get(start) ?? [];
          if (!list.some((x) => x.employeeId === emp.id)) list.push({ employeeId: emp.id, seatsLeft: seats });
          byStart.set(start, list);
        }
      }
    }
    const slots: Slot[] = [...byStart.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([start, emps]) => ({
        start: new Date(start).toISOString(),
        end: new Date(start + service.durationMin * MIN).toISOString(),
        employees: emps,
      }));
    if (slots.length) result.push({ date, slots });
  }
  return result;
}

/** Fechas (YYYY-MM-DD) que tienen al menos una franja libre. */
export function availableDates(input: ComputeSlotsInput): string[] {
  return computeSlots(input).map((d) => d.date);
}

/**
 * Verifica si un empleado concreto puede atender el servicio a esa hora.
 * Usa exactamente las mismas reglas que computeSlots (la usa la transacción
 * de reserva como verificación final).
 */
export function isSlotAvailable(input: Omit<ComputeSlotsInput, "from" | "to">, employeeId: string, start: Date): boolean {
  const date = DateTime.fromJSDate(start, { zone: input.settings.timezone }).toISODate()!;
  const days = computeSlots({
    ...input,
    employees: input.employees.filter((e) => e.id === employeeId),
    from: date,
    to: date,
  });
  const iso = start.toISOString();
  return days.some((d) => d.slots.some((s) => s.start === iso && s.employees.some((e) => e.employeeId === employeeId)));
}

/**
 * Elige un profesional para "cualquiera disponible": el que tenga menos citas
 * ese día (reparto equilibrado); en empate, el orden recibido.
 */
export function pickEmployee(candidates: SlotEmployee[], loadByEmployee: Record<string, number>): string | null {
  if (!candidates.length) return null;
  return [...candidates].sort((a, b) => (loadByEmployee[a.employeeId] ?? 0) - (loadByEmployee[b.employeeId] ?? 0))[0]!.employeeId;
}
