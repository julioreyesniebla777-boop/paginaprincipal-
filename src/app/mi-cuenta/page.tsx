import Link from "next/link";
import { prisma } from "@/server/db";
import { requireUser } from "@/server/auth/guards";
import { getBusiness } from "@/server/business";
import { logoutAction } from "@/server/actions/auth";
import { manageTokenFor } from "@/lib/manage-token";
import { fmtDateTime } from "@/lib/format";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/labels";
import { buttonClasses } from "@/components/ui/button";
import { Badge, Card, CardBody } from "@/components/ui/card";

export const metadata = { title: "Mi cuenta", robots: { index: false } };

export default async function MyAccountPage() {
  const user = await requireUser();
  const b = await getBusiness();
  const appointments = user.customerId
    ? await prisma.appointment.findMany({
        where: { customerId: user.customerId },
        orderBy: { startsAt: "desc" },
        include: { service: { select: { name: true } }, employee: { select: { displayName: true } } },
        take: 100,
      })
    : [];
  const now = new Date();
  const upcoming = appointments.filter((a) => a.startsAt >= now && (a.status === "PENDING" || a.status === "CONFIRMED")).reverse();
  const past = appointments.filter((a) => !upcoming.includes(a));

  const Item = ({ a }: { a: (typeof appointments)[number] }) => (
    <Card>
      <CardBody className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{a.service.name}</p>
          <p className="text-sm first-letter:uppercase text-zinc-600">{fmtDateTime(a.startsAt, b.timezone, b.locale)}</p>
          <p className="text-xs text-zinc-500">con {a.employee.displayName}</p>
        </div>
        <Badge color={STATUS_COLORS[a.status]}>{STATUS_LABELS[a.status]}</Badge>
        <Link href={`/cita/${manageTokenFor(a.id)}`} className={buttonClasses("outline", "sm")}>
          Ver / gestionar
        </Link>
      </CardBody>
    </Card>
  );

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <Link href="/" className="text-sm text-zinc-500 hover:underline">
            {b.name}
          </Link>
          <h1 className="text-2xl font-bold">Mis citas</h1>
        </div>
        <form action={logoutAction}>
          <button className="text-sm text-red-600 hover:underline">Cerrar sesión</button>
        </form>
      </div>
      <p className="mb-4 text-zinc-600">Hola {user.name.split(" ")[0]}.</p>
      <Link href="/reservar" className={buttonClasses("primary", "lg", "mb-8 w-full sm:w-auto")}>
        Reservar nueva cita
      </Link>

      <h2 className="mb-3 text-lg font-semibold">Próximas</h2>
      <div className="mb-8 space-y-3">{upcoming.length ? upcoming.map((a) => <Item key={a.id} a={a} />) : <p className="text-sm text-zinc-500">No tienes citas próximas.</p>}</div>

      {past.length > 0 && (
        <>
          <h2 className="mb-3 text-lg font-semibold">Historial</h2>
          <div className="space-y-3">{past.map((a) => <Item key={a.id} a={a} />)}</div>
        </>
      )}
    </main>
  );
}
