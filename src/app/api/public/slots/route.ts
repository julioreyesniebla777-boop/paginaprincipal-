import { NextResponse } from "next/server";
import { z } from "zod";
import { DateTime } from "luxon";
import { getBusiness } from "@/server/business";
import { getSlots } from "@/server/availability/load";
import { rateLimit } from "@/server/rate-limit";
import { getClientIp } from "@/server/request";

const querySchema = z.object({
  serviceId: z.string().min(1).max(40),
  employeeId: z.string().max(40).optional(),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mode: z.enum(["dates", "slots"]).default("slots"),
});

/** Franjas libres (o solo los días con disponibilidad) para la reserva pública. */
export async function GET(req: Request) {
  const ip = await getClientIp(req.headers);
  if (!(await rateLimit(`slots:${ip}`, 120, 60)).ok) {
    return NextResponse.json({ error: "Demasiadas solicitudes" }, { status: 429 });
  }
  const params = Object.fromEntries(new URL(req.url).searchParams);
  const parsed = querySchema.safeParse({ ...params, employeeId: params.employeeId || undefined });
  if (!parsed.success) return NextResponse.json({ error: "Parámetros no válidos" }, { status: 400 });
  const q = parsed.data;

  // Máximo 62 días por consulta.
  const { timezone } = await getBusiness();
  const span = DateTime.fromISO(q.to, { zone: timezone }).diff(DateTime.fromISO(q.from, { zone: timezone }), "days").days;
  if (!(span >= 0 && span <= 62)) return NextResponse.json({ error: "Rango no válido" }, { status: 400 });

  const days = await getSlots({ serviceId: q.serviceId, employeeId: q.employeeId, from: q.from, to: q.to });
  const body = q.mode === "dates" ? { timezone, dates: days.map((d) => d.date) } : { timezone, days };
  return NextResponse.json(body, { headers: { "Cache-Control": "no-store" } });
}
