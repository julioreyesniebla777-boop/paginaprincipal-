import { notFound } from "next/navigation";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/auth/guards";
import { getBusiness } from "@/server/business";
import { deleteServiceAction } from "@/server/actions/services";
import { ServiceForm } from "@/components/forms/service-form";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { PageHeader } from "@/components/ui/card";

export const metadata = { title: "Editar servicio" };

export default async function EditServicePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const [service, categories, employees, business] = await Promise.all([
    prisma.service.findUnique({ where: { id }, include: { employees: { select: { employeeId: true } }, _count: { select: { appointments: true } } } }),
    prisma.serviceCategory.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.employee.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, displayName: true, isActive: true } }),
    getBusiness(),
  ]);
  if (!service) notFound();
  return (
    <>
      <PageHeader
        title={service.name}
        actions={
          <form action={deleteServiceAction}>
            <input type="hidden" name="id" value={service.id} />
            <ConfirmButton
              message={service._count.appointments > 0 ? "Este servicio tiene citas: se desactivará en lugar de borrarse. ¿Continuar?" : "¿Eliminar este servicio?"}
            >
              {service._count.appointments > 0 ? "Desactivar" : "Eliminar"}
            </ConfirmButton>
          </form>
        }
      />
      <ServiceForm service={service} categories={categories} employees={employees} currency={business.currency} />
    </>
  );
}
