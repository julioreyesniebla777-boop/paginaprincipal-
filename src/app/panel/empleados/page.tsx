import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/auth/guards";
import { buttonClasses } from "@/components/ui/button";
import { Alert, Badge, Card, CardBody, PageHeader } from "@/components/ui/card";

export const metadata: Metadata = { title: "Profesionales" };

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const employees = await prisma.employee.findMany({
    orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }],
    include: { user: { select: { isActive: true } }, _count: { select: { services: true } } },
  });
  return (
    <>
      <PageHeader
        title="Profesionales"
        actions={
          <Link href="/panel/empleados/nuevo" className={buttonClasses("primary")}>
            + Nuevo profesional
          </Link>
        }
      />
      {sp.ok && <Alert kind="success" className="mb-4">Profesional guardado.</Alert>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {employees.map((e) => (
          <Card key={e.id} className={e.isActive ? "" : "opacity-60"}>
            <CardBody className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: e.color }}>
                  {e.displayName.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{e.displayName}</p>
                  <p className="truncate text-sm text-zinc-500">{e.email ?? "Sin email"}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                <Badge>{e._count.services} servicios</Badge>
                {e.user?.isActive ? <Badge color="#2563eb">Con acceso</Badge> : <Badge color="#71717a">Sin acceso</Badge>}
                {!e.isActive && <Badge color="#dc2626">Inactivo</Badge>}
              </div>
              <div className="flex gap-2">
                <Link href={`/panel/empleados/${e.id}`} className={buttonClasses("outline", "sm")}>
                  Editar
                </Link>
                <Link href={`/panel/empleados/${e.id}/horario`} className={buttonClasses("secondary", "sm")}>
                  Horario
                </Link>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </>
  );
}
