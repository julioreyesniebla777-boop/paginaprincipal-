import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/auth/guards";
import { deleteEmployeeAction } from "@/server/actions/employees";
import { EmployeeForm } from "@/components/forms/employee-form";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { buttonClasses } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/card";

export const metadata = { title: "Editar profesional" };

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const [employee, services] = await Promise.all([
    prisma.employee.findUnique({
      where: { id },
      include: { services: { select: { serviceId: true } }, user: { select: { isActive: true } }, _count: { select: { appointments: true } } },
    }),
    prisma.service.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true, isActive: true } }),
  ]);
  if (!employee) notFound();
  return (
    <>
      <PageHeader
        title={employee.displayName}
        actions={
          <>
            <Link href={`/panel/empleados/${employee.id}/horario`} className={buttonClasses("outline", "sm")}>
              Horario y bloqueos
            </Link>
            <form action={deleteEmployeeAction}>
              <input type="hidden" name="id" value={employee.id} />
              <ConfirmButton message={employee._count.appointments > 0 ? "Tiene citas: se desactivará en lugar de borrarse. ¿Continuar?" : "¿Eliminar este profesional?"}>
                {employee._count.appointments > 0 ? "Desactivar" : "Eliminar"}
              </ConfirmButton>
            </form>
          </>
        }
      />
      <EmployeeForm employee={employee} services={services} />
    </>
  );
}
