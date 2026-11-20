import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/auth/guards";
import { getBusiness } from "@/server/business";
import { ServiceForm } from "@/components/forms/service-form";
import { PageHeader } from "@/components/ui/card";

export const metadata = { title: "Nuevo servicio" };

export default async function NewServicePage() {
  await requireAdmin();
  const [categories, employees, business] = await Promise.all([
    prisma.serviceCategory.findMany({ orderBy: { sortOrder: "asc" } }),
    prisma.employee.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, displayName: true, isActive: true } }),
    getBusiness(),
  ]);
  return (
    <>
      <PageHeader title="Nuevo servicio" />
      <ServiceForm categories={categories} employees={employees} currency={business.currency} />
    </>
  );
}
