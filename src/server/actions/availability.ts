"use server";

import { DateTime } from "luxon";
import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { assertStaff, canManageEmployee, ForbiddenError } from "@/server/auth/guards";
import { getBusiness } from "@/server/business";
import { exceptionSchema, timeBlockRangeSchema, timeBlockSchema, weeklyScheduleSchema } from "@/lib/validation/availability";
import { formDataToObject, fromZodError, type ActionState } from "@/lib/action-state";
import { timeToMinutes } from "@/lib/time";
import { guarded, UserError } from "./_utils";

const dbDate = (d: string) => new Date(`${d}T00:00:00.000Z`);

export async function saveWeeklyScheduleAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertStaff();
    const employeeId = String(fd.get("employeeId") ?? "");
    if (!canManageEmployee(user, employeeId)) throw new ForbiddenError();

    let raw: unknown;
    try {
      raw = JSON.parse(String(fd.get("blocks") ?? "[]"));
    } catch {
      throw new UserError("Datos de horario no válidos");
    }
    const parsed = weeklyScheduleSchema.safeParse(raw);
    if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Horario no válido" };

    await prisma.$transaction([
      prisma.weeklySchedule.deleteMany({ where: { employeeId } }),
      prisma.weeklySchedule.createMany({
        data: parsed.data.map((b) => ({ employeeId, weekday: b.weekday, startMin: timeToMinutes(b.start), endMin: timeToMinutes(b.end) })),
      }),
    ]);
    revalidatePath(`/panel/empleados/${employeeId}/horario`);
    return { ok: true, message: "Horario guardado" };
  });
}

export async function createExceptionAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertStaff();
    const parsed = exceptionSchema.safeParse(formDataToObject(fd));
    if (!parsed.success) return fromZodError(parsed.error);
    const d = parsed.data;
    // Excepciones de todo el negocio (feriados) solo para el administrador.
    if (d.employeeId === null && user.role !== "ADMIN") throw new ForbiddenError();
    if (d.employeeId && !canManageEmployee(user, d.employeeId)) throw new ForbiddenError();

    await prisma.scheduleException.create({
      data: {
        employeeId: d.employeeId,
        type: d.type,
        startDate: dbDate(d.startDate),
        endDate: dbDate(d.endDate),
        startMin: d.type === "CUSTOM_HOURS" && d.start ? timeToMinutes(d.start) : null,
        endMin: d.type === "CUSTOM_HOURS" && d.end ? timeToMinutes(d.end) : null,
        label: d.label ?? null,
      },
    });
    revalidatePath("/panel/disponibilidad");
    if (d.employeeId) revalidatePath(`/panel/empleados/${d.employeeId}/horario`);
    return { ok: true, message: "Excepción guardada" };
  });
}

export async function deleteExceptionAction(fd: FormData): Promise<void> {
  const user = await assertStaff();
  const id = String(fd.get("id") ?? "");
  const ex = await prisma.scheduleException.findUnique({ where: { id } });
  if (!ex) return;
  if (ex.employeeId === null ? user.role !== "ADMIN" : !canManageEmployee(user, ex.employeeId)) throw new ForbiddenError();
  await prisma.scheduleException.delete({ where: { id } });
  revalidatePath("/panel/disponibilidad");
  if (ex.employeeId) revalidatePath(`/panel/empleados/${ex.employeeId}/horario`);
}

export async function createTimeBlockAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertStaff();
    const parsed = timeBlockSchema.safeParse(formDataToObject(fd));
    if (!parsed.success) return fromZodError(parsed.error);
    const d = parsed.data;
    if (!canManageEmployee(user, d.employeeId)) throw new ForbiddenError();
    const { timezone } = await getBusiness();
    const day = DateTime.fromISO(d.date, { zone: timezone }).startOf("day");
    const startsAt = day.plus({ minutes: timeToMinutes(d.start) });
    const endsAt = day.plus({ minutes: timeToMinutes(d.end) });
    await prisma.timeBlock.create({
      data: { employeeId: d.employeeId, startsAt: startsAt.toJSDate(), endsAt: endsAt.toJSDate(), reason: d.reason ?? null, createdById: user.id },
    });
    revalidatePath(`/panel/empleados/${d.employeeId}/horario`);
    return { ok: true, message: "Bloqueo creado" };
  });
}

/** Crea un bloqueo con instantes exactos (desde el calendario). */
export async function createTimeBlockRange(input: unknown): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertStaff();
    const parsed = timeBlockRangeSchema.safeParse(input);
    if (!parsed.success) return fromZodError(parsed.error);
    const d = parsed.data;
    if (!canManageEmployee(user, d.employeeId)) throw new ForbiddenError();
    await prisma.timeBlock.create({
      data: { employeeId: d.employeeId, startsAt: new Date(d.startsAt), endsAt: new Date(d.endsAt), reason: d.reason || null, createdById: user.id },
    });
    revalidatePath("/panel/calendario");
    return { ok: true, message: "Bloqueo creado" };
  });
}

export async function deleteTimeBlockAction(fd: FormData): Promise<void> {
  const user = await assertStaff();
  const id = String(fd.get("id") ?? "");
  const block = await prisma.timeBlock.findUnique({ where: { id } });
  if (!block) return;
  if (!canManageEmployee(user, block.employeeId)) throw new ForbiddenError();
  await prisma.timeBlock.delete({ where: { id } });
  revalidatePath(`/panel/empleados/${block.employeeId}/horario`);
  revalidatePath("/panel/calendario");
}


/** Elimina un bloqueo desde el calendario. */
export async function deleteTimeBlockById(id: string): Promise<ActionState> {
  return guarded(async () => {
    const user = await assertStaff();
    const block = await prisma.timeBlock.findUnique({ where: { id: String(id) } });
    if (!block) throw new UserError("Bloqueo no encontrado");
    if (!canManageEmployee(user, block.employeeId)) throw new ForbiddenError();
    await prisma.timeBlock.delete({ where: { id: block.id } });
    revalidatePath(`/panel/empleados/${block.employeeId}/horario`);
    return { ok: true };
  });
}
