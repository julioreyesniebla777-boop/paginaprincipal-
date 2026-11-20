import "server-only";
import { prisma } from "@/server/db";
import { getBusiness } from "@/server/business";
import { sendAppointmentNotification } from "@/server/notifications/dispatch";
import { purgeRateLimits } from "@/server/rate-limit";

/**
 * Envía los recordatorios pendientes. Pensado para ejecutarse cada 10–15 min.
 * Cada cita se "reclama" con un UPDATE condicional (reminderSentAt IS NULL),
 * así dos ejecuciones simultáneas nunca envían el mismo recordatorio.
 */
export async function runReminders(now = new Date(), batch = 100) {
  const b = await getBusiness();
  const windowEnd = new Date(now.getTime() + b.reminderHoursBefore * 3600_000);

  const due = await prisma.appointment.findMany({
    where: { status: "CONFIRMED", reminderSentAt: null, startsAt: { gt: now, lte: windowEnd } },
    orderBy: { startsAt: "asc" },
    take: batch,
    select: { id: true, createdAt: true, startsAt: true, updatedAt: true },
  });

  let sent = 0;
  let skipped = 0;
  for (const a of due) {
    const claimed = await prisma.appointment.updateMany({ where: { id: a.id, reminderSentAt: null }, data: { reminderSentAt: now } });
    if (claimed.count !== 1) continue;
    // Si se reservó (o reprogramó) ya dentro de la ventana del recordatorio,
    // el cliente acaba de recibir la confirmación: no se envía otro correo.
    const windowStart = new Date(a.startsAt.getTime() - b.reminderHoursBefore * 3600_000);
    if (a.createdAt > windowStart) {
      skipped++;
      continue;
    }
    await sendAppointmentNotification(a.id, "REMINDER");
    sent++;
  }

  // Mantenimiento ligero
  const [purged] = await Promise.all([
    purgeRateLimits(),
    prisma.passwordResetToken.deleteMany({ where: { OR: [{ expiresAt: { lt: new Date(now.getTime() - 86400_000) } }, { usedAt: { not: null } }] } }),
  ]);

  return { checked: due.length, sent, skipped, purgedRateLimits: purged, remaining: due.length === batch };
}
