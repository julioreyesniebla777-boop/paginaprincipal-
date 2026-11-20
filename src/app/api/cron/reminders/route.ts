import { NextResponse } from "next/server";
import { runReminders } from "@/server/services/reminders";
import { safeEqual } from "@/lib/tokens";

export const dynamic = "force-dynamic";

/**
 * Endpoint para el cron job de Hostinger.
 *   curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://tu-dominio.com/api/cron/reminders
 * También acepta ?key=CRON_SECRET para paneles de cron que solo permiten una URL.
 */
async function handle(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return NextResponse.json({ error: "CRON_SECRET no configurado (mínimo 16 caracteres)" }, { status: 503 });
  const header = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const key = header || new URL(req.url).searchParams.get("key") || "";
  if (!safeEqual(key, secret)) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const started = Date.now();
  const result = await runReminders();
  return NextResponse.json({ ok: true, ...result, ms: Date.now() - started });
}

export const GET = handle;
export const POST = handle;
