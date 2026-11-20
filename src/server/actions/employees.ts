"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/server/db";
import { assertAdmin } from "@/server/auth/guards";
import { employeeSchema } from "@/lib/validation/employee";
import { formDataToObject, fromZodError, type ActionState } from "@/lib/action-state";
import { normalizeEmail } from "@/lib/utils";
import { guarded, UserError } from "./_utils";

export async function saveEmployeeAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    await assertAdmin();
    const id = String(fd.get("id") ?? "") || null;
    const parsed = employeeSchema.safeParse(formDataToObject(fd));
    if (!parsed.success) return fromZodError(parsed.error);
    const d = parsed.data;
    const email = normalizeEmail(d.email);

    const existing = id ? await prisma.employee.findUnique({ where: { id }, include: { user: true } }) : null;
    if (id && !existing) throw new UserError("Profesional no encontrado");

    // Acceso al panel
    let userId = existing?.userId ?? null;
    if (d.enableLogin && email) {
      const clash = await prisma.user.findUnique({ where: { email } });
      if (clash && clash.id !== userId) {
        return { ok: false, error: "Ese email ya pertenece a otro usuario", fieldErrors: { email: ["Ese email ya pertenece a otro usuario"] } };
      }
      if (!userId && !d.password) return { ok: false, error: "Indica una contraseña inicial", fieldErrors: { password: ["Indica una contraseña inicial"] } };
    }

    await prisma.$transaction(async (tx) => {
      if (d.enableLogin && email) {
        const passwordHash = d.password ? await bcrypt.hash(d.password, 12) : undefined;
        if (userId) {
          await tx.user.update({ where: { id: userId }, data: { email, name: d.displayName, isActive: d.isActive, ...(passwordHash ? { passwordHash } : {}) } });
        } else {
          const u = await tx.user.create({ data: { email, name: d.displayName, role: "EMPLOYEE", passwordHash: passwordHash! } });
          userId = u.id;
        }
      } else if (userId) {
        // Se quita el acceso: se desactiva el usuario (no se borra para conservar el historial).
        await tx.user.update({ where: { id: userId }, data: { isActive: false } });
      }

      const data = {
        displayName: d.displayName,
        email,
        phone: d.phone ?? null,
        bio: d.bio ?? null,
        color: d.color,
        isActive: d.isActive,
        userId,
      };
      const emp = id ? await tx.employee.update({ where: { id }, data }) : await tx.employee.create({ data });

      await tx.serviceEmployee.deleteMany({ where: { employeeId: emp.id } });
      const services = await tx.service.findMany({ where: { id: { in: d.serviceIds } }, select: { id: true } });
      if (services.length) await tx.serviceEmployee.createMany({ data: services.map((s) => ({ serviceId: s.id, employeeId: emp.id })) });

      // Horario por defecto para un profesional nuevo: lunes a viernes 9–17.
      if (!id) {
        await tx.weeklySchedule.createMany({
          data: [1, 2, 3, 4, 5].map((weekday) => ({ employeeId: emp.id, weekday, startMin: 540, endMin: 1020 })),
        });
      }
    });

    revalidatePath("/panel/empleados");
    redirect("/panel/empleados?ok=1");
  });
}

export async function deleteEmployeeAction(fd: FormData): Promise<void> {
  await assertAdmin();
  const id = String(fd.get("id") ?? "");
  const emp = await prisma.employee.findUnique({ where: { id }, include: { _count: { select: { appointments: true } } } });
  if (!emp) redirect("/panel/empleados");
  if (emp._count.appointments > 0) {
    await prisma.employee.update({ where: { id }, data: { isActive: false } });
    if (emp.userId) await prisma.user.update({ where: { id: emp.userId }, data: { isActive: false } });
  } else {
    await prisma.$transaction(async (tx) => {
      await tx.employee.delete({ where: { id } });
      if (emp.userId) await tx.user.delete({ where: { id: emp.userId } });
    });
  }
  revalidatePath("/panel/empleados");
  redirect("/panel/empleados");
}
