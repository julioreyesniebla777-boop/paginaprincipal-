import type { Role } from "@prisma/client";

export type NavItem = { href: string; label: string; icon: string; roles: Role[] };

/** Navegación del panel. Cada fase añade sus secciones aquí. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/panel", label: "Inicio", icon: "🏠", roles: ["ADMIN", "EMPLOYEE"] },
];
