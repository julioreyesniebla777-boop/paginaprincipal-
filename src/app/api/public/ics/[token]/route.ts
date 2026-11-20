import { getBusiness, appUrl } from "@/server/business";
import { findByManageToken } from "@/server/services/appointments";
import { buildIcs } from "@/lib/ics";
import { hashToken } from "@/lib/tokens";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (token.length < 20 || token.length > 100) return new Response("No encontrado", { status: 404 });
  const appt = await findByManageToken(hashToken(token));
  if (!appt) return new Response("No encontrado", { status: 404 });
  const business = await getBusiness();
  const ics = buildIcs({
    uid: `${appt.id}@agenda`,
    start: appt.startsAt,
    end: appt.endsAt,
    summary: `${appt.service.name} – ${business.name}`,
    description: `Profesional: ${appt.employee.displayName}\nGestionar cita: ${appUrl(`/cita/${token}`)}`,
    location: business.address ?? undefined,
    url: appUrl(`/cita/${token}`),
    cancelled: appt.status === "CANCELLED",
    sequence: Math.floor(appt.updatedAt.getTime() / 1000),
  });
  return new Response(ics, {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'attachment; filename="cita.ics"',
      "Cache-Control": "no-store",
    },
  });
}
