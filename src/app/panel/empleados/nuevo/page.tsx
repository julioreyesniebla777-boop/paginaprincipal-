import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/auth/guards";
import { EmployeeForm } from "@/components/forms/employee-form";
import { PageHeader } from "@/components/ui/card";

export const metadata = { title: "Nuevo profesional" };

export default async function NewEmployeePage() {
  await requireAdmin();
  const services = await prisma.service.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true, isActive: true } });
  return (
    <>
      <PageHeader title="Nuevo profesional" description="Se crea con horario de lunes a viernes de 9:00 a 17:00; luego puedes ajustarlo." />
      <EmployeeForm services={services} />
    </>
  );
}
