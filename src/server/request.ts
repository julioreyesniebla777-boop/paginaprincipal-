import "server-only";
import { headers } from "next/headers";

/** IP del cliente detrás del proxy de Hostinger. */
export async function getClientIp(h?: Headers): Promise<string> {
  const hdrs = h ?? (await headers());
  const fwd = hdrs.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return hdrs.get("x-real-ip") ?? "unknown";
}
