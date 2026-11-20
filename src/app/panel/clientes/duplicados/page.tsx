import Link from "next/link";
import { requireAdmin } from "@/server/auth/guards";
import { findDuplicateGroups } from "@/server/services/customer-crm";
import { MergeForm } from "@/components/customers/small-forms";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";

export const metadata = { title: "Clientes duplicados" };

export default async function DuplicatesPage() {
  await requireAdmin();
  const groups = await findDuplicateGroups();
  return (
    <>
      <PageHeader title="Clientes duplicados" description="Clientes que comparten email o teléfono. Fusiona para unificar su historial." />
      {groups.length === 0 && <p className="text-sm text-zinc-500">No se detectaron duplicados. 🎉</p>}
      <div className="space-y-4">
        {groups.map((g) => {
          const [first, ...rest] = g.customers;
          return (
            <Card key={`${g.kind}-${g.key}`}>
              <CardHeader title={g.kind === "email" ? `Email: ${g.key}` : `Teléfono: ${g.key}`} />
              <CardBody>
                <ul className="space-y-2 text-sm">
                  {g.customers.map((c) => (
                    <li key={c.id} className="flex flex-wrap items-center gap-2">
                      <Link href={`/panel/clientes/${c.id}`} className="font-medium text-brand hover:underline">
                        {c.name}
                      </Link>
                      <span className="text-zinc-500">
                        {[c.email, c.phone].filter(Boolean).join(" · ")} · {c._count.appointments} citas{c === first ? " · más antiguo" : ""}
                      </span>
                      {c !== first && first && <MergeForm targetId={first.id} sourceId={c.id} label={`Fusionar en ${first.name}`} />}
                    </li>
                  ))}
                </ul>
                {rest.length === 0 && null}
              </CardBody>
            </Card>
          );
        })}
      </div>
    </>
  );
}
