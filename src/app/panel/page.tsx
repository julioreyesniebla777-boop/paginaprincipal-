import { requireStaff } from "@/server/auth/guards";
import { PageHeader, Card, CardBody } from "@/components/ui/card";

export default async function PanelHome() {
  const user = await requireStaff();
  return (
    <>
      <PageHeader title={`Hola, ${user.name.split(" ")[0]}`} description="Panel de gestión" />
      <Card>
        <CardBody>
          <p className="text-sm text-zinc-600">El dashboard se completa en la fase (d).</p>
        </CardBody>
      </Card>
    </>
  );
}
