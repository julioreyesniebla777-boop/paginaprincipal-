export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function normalizeEmail(email: string | null | undefined): string | null {
  const e = email?.trim().toLowerCase();
  return e ? e : null;
}

/** Deja solo dígitos (y un + inicial se descarta). Sirve para detectar duplicados. */
export function normalizePhone(phone: string | null | undefined): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length ? digits : null;
}

/** Acepta solo rutas internas para evitar redirecciones abiertas. */
export function safeRedirectPath(path: unknown, fallback = "/cuenta"): string {
  if (typeof path !== "string") return fallback;
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\")) return fallback;
  return path;
}
