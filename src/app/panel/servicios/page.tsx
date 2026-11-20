import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/auth/guards";
import { getBusiness } from "@/server/business";
import { toggleServiceAction, deleteCategoryAction } from "@/server/actions/services";
import { formatMoney } from "@/lib/money";
import { buttonClasses } from "@/components/ui/button";
import { Alert, Badge, Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";

export const metadata: Metadata = { title: "Servicios" };

export default async function ServicesPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  await requireAdmin();
  const sp = await searchParams;
  const [services, categories, business] = await Promise.all([
    prisma.service.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { category: true, employees: { include: { employee: { select: { displayName: true } } } } },
    }),
    prisma.serviceCategory.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { services: true } } } }),
    getBusiness(),
  ]);

  return (
    <>
      <PageHeader
        title="Servicios"
        description="Lo que tus clientes pueden reservar."
        actions={
          <Link href="/panel/servicios/nuevo" className={buttonClasses("primary")}>
            + Nuevo servicio
          </Link>
        }
      />
      {sp.ok && <Alert kind="success" className="mb-4">Servicio guardado.</Alert>}

      <div className="grid gap-3">
        {services.length === 0 && <p className="text-sm text-zinc-500">Todavía no hay servicios.</p>}
        {services.map((s) => (
          <Card key={s.id} className={s.isActive ? "" : "opacity-60"}>
            <CardBody className="flex flex-wrap items-center gap-3">
              <span className="h-10 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/panel/servicios/${s.id}`} className="font-semibold hover:underline">
                    {s.name}
                  </Link>
                  {s.category && <Badge>{s.category.name}</Badge>}
                  {s.capacity > 1 && <Badge color="#16a34a">Grupo · {s.capacity} plazas</Badge>}
                  {!s.isActive && <Badge color="#71717a">Inactivo</Badge>}
                </div>
                <p className="mt-0.5 text-sm text-zinc-500">
                  {s.durationMin} min · {formatMoney(s.priceCents, business.currency, business.locale)}
                  {(s.bufferBeforeMin > 0 || s.bufferAfterMin > 0) && ` · preparación ${s.bufferBeforeMin}/${s.bufferAfterMin} min`}
                </p>
                <p className="text-xs text-zinc-400">{s.employees.map((e) => e.employee.displayName).join(", ") || "Sin profesionales asignados"}</p>
              </div>
              <div className="flex gap-2">
                <form action={toggleServiceAction}>
                  <input type="hidden" name="id" value={s.id} />
                  <button className={buttonClasses("ghost", "sm")}>{s.isActive ? "Desactivar" : "Activar"}</button>
                </form>
                <Link href={`/panel/servicios/${s.id}`} className={buttonClasses("outline", "sm")}>
                  Editar
                </Link>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>

      {categories.length > 0 && (
        <Card className="mt-8">
          <CardHeader title="Categorías" description="Se crean desde el formulario del servicio." />
          <CardBody className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <form key={c.id} action={deleteCategoryAction} className="flex items-center gap-1 rounded-full bg-zinc-100 py-1 pl-3 pr-1 text-sm">
                {c.name} <span className="text-zinc-400">({c._count.services})</span>
                <input type="hidden" name="id" value={c.id} />
                <button aria-label={`Eliminar ${c.name}`} className="rounded-full px-2 text-zinc-500 hover:bg-zinc-200">
                  ×
                </button>
              </form>
            ))}
          </CardBody>
        </Card>
      )}
    </>
  );
}
