"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { assertAdmin } from "@/server/auth/guards";
import { serviceSchema } from "@/lib/validation/service";
import { formDataToObject, fromZodError, type ActionState } from "@/lib/action-state";
import { guarded, UserError } from "./_utils";

export async function saveServiceAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    await assertAdmin();
    const id = String(fd.get("id") ?? "") || null;
    const parsed = serviceSchema.safeParse(formDataToObject(fd));
    if (!parsed.success) return fromZodError(parsed.error);
    const d = parsed.data;

    let categoryId = d.categoryId;
    if (d.newCategory) {
      const cat = await prisma.serviceCategory.upsert({ where: { name: d.newCategory }, update: {}, create: { name: d.newCategory } });
      categoryId = cat.id;
    }

    const validEmployees = await prisma.employee.findMany({ where: { id: { in: d.employeeIds } }, select: { id: true } });
    const data = {
      name: d.name,
      description: d.description ?? null,
      categoryId,
      durationMin: d.durationMin,
      priceCents: d.price,
      color: d.color,
      bufferBeforeMin: d.bufferBeforeMin,
      bufferAfterMin: d.bufferAfterMin,
      capacity: d.capacity,
      isActive: d.isActive,
    };

    await prisma.$transaction(async (tx) => {
      const svc = id ? await tx.service.update({ where: { id }, data }) : await tx.service.create({ data });
      await tx.serviceEmployee.deleteMany({ where: { serviceId: svc.id } });
      if (validEmployees.length) {
        await tx.serviceEmployee.createMany({ data: validEmployees.map((e) => ({ serviceId: svc.id, employeeId: e.id })) });
      }
    });
    revalidatePath("/panel/servicios");
    redirect("/panel/servicios?ok=1");
  });
}

export async function deleteServiceAction(fd: FormData): Promise<void> {
  await assertAdmin();
  const id = String(fd.get("id") ?? "");
  const count = await prisma.appointment.count({ where: { serviceId: id } });
  // Con historial de citas no se borra: se desactiva para conservar reportes.
  if (count > 0) await prisma.service.update({ where: { id }, data: { isActive: false } });
  else await prisma.service.delete({ where: { id } });
  revalidatePath("/panel/servicios");
  redirect("/panel/servicios");
}

export async function toggleServiceAction(fd: FormData): Promise<void> {
  await assertAdmin();
  const id = String(fd.get("id") ?? "");
  const svc = await prisma.service.findUnique({ where: { id }, select: { isActive: true } });
  if (!svc) throw new UserError("Servicio no encontrado");
  await prisma.service.update({ where: { id }, data: { isActive: !svc.isActive } });
  revalidatePath("/panel/servicios");
}

export async function deleteCategoryAction(fd: FormData): Promise<void> {
  await assertAdmin();
  const id = String(fd.get("id") ?? "");
  await prisma.serviceCategory.delete({ where: { id } }).catch(() => null);
  revalidatePath("/panel/servicios");
}
