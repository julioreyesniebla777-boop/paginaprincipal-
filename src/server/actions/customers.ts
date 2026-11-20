"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { assertAdmin } from "@/server/auth/guards";
import { customerSchema } from "@/lib/validation/customer";
import { formDataToObject, fromZodError, type ActionState } from "@/lib/action-state";
import { normalizePhone } from "@/lib/utils";
import { importCustomersCsv, mergeCustomers, setCustomerTags, type ImportReport } from "@/server/services/customer-crm";
import { guarded, UserError } from "./_utils";

export async function saveCustomerAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    await assertAdmin();
    const id = String(fd.get("id") ?? "") || null;
    const parsed = customerSchema.safeParse(formDataToObject(fd));
    if (!parsed.success) return fromZodError(parsed.error);
    const d = parsed.data;
    const data = {
      name: d.name,
      email: d.email ?? null,
      phone: d.phone ?? null,
      phoneNormalized: normalizePhone(d.phone),
      birthDate: d.birthDate ? new Date(`${d.birthDate}T00:00:00.000Z`) : null,
      internalNotes: d.internalNotes ?? null,
    };
    const saved = await prisma.$transaction(async (tx) => {
      const c = id ? await tx.customer.update({ where: { id }, data }) : await tx.customer.create({ data });
      await setCustomerTags(tx, c.id, d.tags);
      return c;
    });
    revalidatePath("/panel/clientes");
    if (!id) redirect(`/panel/clientes/${saved.id}?creado=1`);
    revalidatePath(`/panel/clientes/${saved.id}`);
    return { ok: true, message: "Cliente guardado" };
  });
}

export async function toggleBlockCustomerAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    await assertAdmin();
    const id = String(fd.get("id") ?? "");
    const reason = String(fd.get("reason") ?? "").trim().slice(0, 190) || null;
    const c = await prisma.customer.findUnique({ where: { id } });
    if (!c) throw new UserError("Cliente no encontrado");
    await prisma.customer.update({ where: { id }, data: { isBlocked: !c.isBlocked, blockedReason: c.isBlocked ? null : reason } });
    revalidatePath(`/panel/clientes/${id}`);
    return { ok: true, message: c.isBlocked ? "Cliente desbloqueado" : "Cliente bloqueado para reservas en línea" };
  });
}

export async function deleteCustomerAction(fd: FormData): Promise<void> {
  await assertAdmin();
  const id = String(fd.get("id") ?? "");
  const count = await prisma.appointment.count({ where: { customerId: id } });
  if (count > 0) throw new UserError("El cliente tiene citas; no se puede eliminar");
  await prisma.customer.delete({ where: { id } });
  revalidatePath("/panel/clientes");
  redirect("/panel/clientes");
}

export async function mergeCustomersAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    await assertAdmin();
    const targetId = String(fd.get("targetId") ?? "");
    const sourceId = String(fd.get("sourceId") ?? "");
    try {
      await mergeCustomers(targetId, sourceId);
    } catch (err) {
      throw new UserError(err instanceof Error ? err.message : "No se pudo fusionar");
    }
    revalidatePath("/panel/clientes", "layout");
    return { ok: true, message: "Clientes fusionados" };
  });
}

export async function importCustomersAction(_prev: ActionState & { report?: ImportReport }, fd: FormData): Promise<ActionState & { report?: ImportReport }> {
  try {
    await assertAdmin();
    const file = fd.get("file");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Selecciona un archivo CSV" };
    if (file.size > 2 * 1024 * 1024) return { ok: false, error: "El archivo debe pesar menos de 2 MB" };
    const text = await file.text();
    const report = await importCustomersCsv(text);
    revalidatePath("/panel/clientes");
    return { ok: true, message: `Importación terminada: ${report.created} creados, ${report.updated} actualizados, ${report.skipped} sin cambios, ${report.errors.length} con errores.`, report };
  } catch (err) {
    if (err instanceof Error && err.name === "ForbiddenError") return { ok: false, error: err.message };
    console.error("[import]", err);
    return { ok: false, error: "No se pudo importar el archivo" };
  }
}
