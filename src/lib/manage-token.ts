import { createHmac, randomBytes } from "node:crypto";
import { hashToken } from "./tokens";

/**
 * Enlace de gestión de citas (cancelar o reprogramar sin sesión).
 *
 * El token se deriva con HMAC-SHA256 del id de la cita y AUTH_SECRET, así se
 * puede volver a generar para cada correo (recordatorio, reprogramación…)
 * sin guardarlo en claro. En la base de datos solo queda su hash SHA-256.
 * Cambiar AUTH_SECRET invalida todos los enlaces existentes.
 */
function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET no está configurado (mínimo 16 caracteres)");
  return s;
}

export function newAppointmentId(): string {
  return "a" + randomBytes(12).toString("hex");
}

export function manageTokenFor(appointmentId: string): string {
  return createHmac("sha256", secret()).update(`manage:${appointmentId}`).digest("base64url");
}

export function manageTokenHashFor(appointmentId: string): string {
  return hashToken(manageTokenFor(appointmentId));
}
