import Link from "next/link";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/auth/guards";
import { getBusiness } from "@/server/business";
import { buildCustomerWhere, customerTotals } from "@/server/services/customer-crm";
import { customerFiltersSchema } from "@/lib/validation/customer";
import { formatMoney } from "@/lib/money";
import { fmtDate } from "@/lib/format";
import { Badge, Card, PageHeader } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/input";
import { buttonClasses } from "@/components/ui/button";

export const metadata = { title: "Clientes" };
const PAGE_SIZE = 30;

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  await requireAdmin();
  const raw = await searchParams;
  const f = customerFiltersSchema.parse({ ...raw, page: raw.page ?? 1 });
  const b = await getBusiness();
  const where = buildCustomerWhere(f);
  const [total, customers, tags] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (f.page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { tags: { include: { tag: true } }, _count: { select: { appointments: true } } },
    }),
    prisma.tag.findMany({ orderBy: { name: "asc" } }),
  ]);
  const totals = await customerTotals(customers.map((c) => c.id));
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qs = (extra: Record<string, string | number | undefined>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...raw, ...extra })) if (v !== undefined && v !== "") p.set(k, String(v));
    return p.toString();
  };

  return (
    <>
      <PageHeader
        title="Clientes"
        description={`${total} cliente${total === 1 ? "" : "s"}`}
        actions={
          <>
            <Link href="/panel/clientes/duplicados" className={buttonClasses("ghost")}>
              Duplicados
            </Link>
            <Link href="/panel/clientes/importar" className={buttonClasses("outline")}>
              Importar
            </Link>
            <a href={`/api/export/customers?${qs({ page: undefined })}`} className={buttonClasses("outline")}>
              Exportar CSV
            </a>
            <Link href="/panel/clientes/nuevo" className={buttonClasses("primary")}>
              + Nuevo
            </Link>
          </>
        }
      />
      <form method="get" className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
        <Input name="q" defaultValue={f.q} placeholder="Nombre, email o teléfono" aria-label="Buscar" />
        <Select name="tag" defaultValue={f.tag ?? ""} aria-label="Etiqueta">
          <option value="">Todas las etiquetas</option>
          {tags.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </Select>
        <Select name="blocked" defaultValue={f.blocked ?? ""} aria-label="Estado">
          <option value="">Todos</option>
          <option value="1">Bloqueados</option>
          <option value="0">No bloqueados</option>
        </Select>
        <button className={buttonClasses("secondary")}>Filtrar</button>
      </form>

      <Card className="overflow-hidden">
        <ul className="divide-y divide-zinc-100">
          {customers.map((c) => {
            const t = totals.get(c.id)!;
            return (
              <li key={c.id}>
                <Link href={`/panel/clientes/${c.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 hover:bg-zinc-50 sm:px-6">
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 font-medium">
                      {c.name}
                      {c.isBlocked && <Badge color="#dc2626">Bloqueado</Badge>}
                      {c.userId && <Badge color="#2563eb">Con cuenta</Badge>}
                      {c.tags.map((ct) => (
                        <Badge key={ct.tagId} color={ct.tag.color}>
                          {ct.tag.name}
                        </Badge>
                      ))}
                    </p>
                    <p className="truncate text-sm text-zinc-500">{[c.email, c.phone].filter(Boolean).join(" · ") || "Sin datos de contacto"}</p>
                  </div>
                  <div className="flex gap-4 text-right text-xs text-zinc-500">
                    <span>
                      <span className="block font-semibold text-zinc-800">{c._count.appointments}</span>citas
                    </span>
                    <span>
                      <span className="block font-semibold text-zinc-800">{formatMoney(t.spentCents, b.currency, b.locale)}</span>gastado
                    </span>
                    <span className="hidden sm:block">
                      <span className="block font-semibold text-zinc-800">{t.last ? fmtDate(t.last, b.timezone, b.locale, { day: "numeric", month: "short", year: "2-digit" }) : "—"}</span>última visita
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
        {customers.length === 0 && <p className="p-6 text-center text-sm text-zinc-500">No se encontraron clientes.</p>}
      </Card>
      {pages > 1 && (
        <nav className="mt-4 flex items-center justify-center gap-2 text-sm">
          {f.page > 1 && <Link href={`/panel/clientes?${qs({ page: f.page - 1 })}`} className={buttonClasses("outline", "sm")}>‹ Anterior</Link>}
          <span className="text-zinc-500">Página {f.page} de {pages}</span>
          {f.page < pages && <Link href={`/panel/clientes?${qs({ page: f.page + 1 })}`} className={buttonClasses("outline", "sm")}>Siguiente ›</Link>}
        </nav>
      )}
    </>
  );
}
