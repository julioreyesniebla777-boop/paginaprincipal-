import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/server/db";
import { getCurrentUser, scopedEmployeeId } from "@/server/auth/guards";
import { STATUS_LABELS } from "@/lib/labels";

const q = z.object({
  start: z.string().datetime({ offset: true }),
  end: z.string().datetime({ offset: true }),
  employeeId: z.string().max(40).optional(),
  serviceId: z.string().max(40).optional(),
  showCancelled: z.enum(["0", "1"]).optional(),
});

/** Eventos para el calendario del panel (citas + bloqueos). */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "EMPLOYEE")) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const parsed = q.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Parámetros no válidos" }, { status: 400 });
  const p = parsed.data;
  const start = new Date(p.start);
  const end = new Date(p.end);
  if (end.getTime() - start.getTime() > 62 * 86400_000) return NextResponse.json({ error: "Rango demasiado grande" }, { status: 400 });

  const employeeId = scopedEmployeeId(user) ?? (p.employeeId || undefined);
  const [appointments, blocks] = await Promise.all([
    prisma.appointment.findMany({
      where: {
        startsAt: { lt: end },
        endsAt: { gt: start },
        ...(employeeId ? { employeeId } : {}),
        ...(p.serviceId ? { serviceId: p.serviceId } : {}),
        ...(p.showCancelled === "1" ? {} : { status: { notIn: ["CANCELLED"] } }),
      },
      include: {
        service: { select: { name: true, color: true } },
        employee: { select: { displayName: true, color: true } },
        customer: { select: { name: true } },
      },
      take: 2000,
    }),
    p.serviceId
      ? Promise.resolve([])
      : prisma.timeBlock.findMany({
          where: { startsAt: { lt: end }, endsAt: { gt: start }, ...(employeeId ? { employeeId } : {}) },
          include: { employee: { select: { displayName: true } } },
        }),
  ]);

  const events = [
    ...appointments.map((a) => ({
      id: a.id,
      title: `${a.customer.name} · ${a.service.name}`,
      start: a.startsAt.toISOString(),
      end: a.endsAt.toISOString(),
      backgroundColor: a.status === "CANCELLED" || a.status === "NO_SHOW" ? "#a1a1aa" : a.service.color,
      borderColor: a.employee.color,
      textColor: "#ffffff",
      classNames: [`status-${a.status.toLowerCase()}`],
      extendedProps: {
        kind: "appointment",
        status: a.status,
        statusLabel: STATUS_LABELS[a.status],
        employeeId: a.employeeId,
        employee: a.employee.displayName,
        service: a.service.name,
      },
    })),
    ...blocks.map((b) => ({
      id: `block-${b.id}`,
      title: `🔒 ${b.reason ?? "Bloqueado"}${employeeId ? "" : ` · ${b.employee.displayName}`}`,
      start: b.startsAt.toISOString(),
      end: b.endsAt.toISOString(),
      backgroundColor: "#e4e4e7",
      borderColor: "#a1a1aa",
      textColor: "#3f3f46",
      editable: false,
      extendedProps: { kind: "block", blockId: b.id, employeeId: b.employeeId },
    })),
  ];
  return NextResponse.json(events, { headers: { "Cache-Control": "no-store" } });
}
