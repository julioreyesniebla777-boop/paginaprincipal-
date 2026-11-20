import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, canManageEmployee } from "@/server/auth/guards";
import { getSlots } from "@/server/availability/load";

const q = z.object({
  serviceId: z.string().min(1).max(40),
  employeeId: z.string().min(1).max(40),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  excludeAppointmentId: z.string().max(40).optional(),
});

/** Franjas para el personal: ignora anticipación mínima y máximo de días. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "EMPLOYEE")) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const parsed = q.safeParse(Object.fromEntries(new URL(req.url).searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Parámetros no válidos" }, { status: 400 });
  const p = parsed.data;
  if (!canManageEmployee(user, p.employeeId)) return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  const days = await getSlots({
    serviceId: p.serviceId,
    employeeId: p.employeeId,
    from: p.date,
    to: p.date,
    excludeAppointmentId: p.excludeAppointmentId,
    ignoreBookingWindow: true,
    includeInactiveService: true,
  });
  return NextResponse.json({ days }, { headers: { "Cache-Control": "no-store" } });
}
