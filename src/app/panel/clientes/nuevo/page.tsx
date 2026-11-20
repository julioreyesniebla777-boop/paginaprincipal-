import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/auth/guards";
import { CustomerForm } from "@/components/customers/customer-form";
import { Card, CardBody, PageHeader } from "@/components/ui/card";

export const metadata = { title: "Nuevo cliente" };

export default async function NewCustomerPage() {
  await requireAdmin();
  const tags = await prisma.tag.findMany({ orderBy: { name: "asc" } });
  return (
    <>
      <PageHeader title="Nuevo cliente" />
      <Card>
        <CardBody>
          <CustomerForm tags={[]} allTags={tags.map((t) => t.name)} />
        </CardBody>
      </Card>
    </>
  );
}
