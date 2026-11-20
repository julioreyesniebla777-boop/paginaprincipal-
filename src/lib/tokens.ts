import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Token aleatorio apto para URL (256 bits). */
export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

/** Hash SHA-256 en hex. Solo se guarda el hash del token en la base de datos. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Comparación en tiempo constante de dos cadenas. */
export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}
