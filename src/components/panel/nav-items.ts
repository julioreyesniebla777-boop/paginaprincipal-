import type { Role } from "@prisma/client";

export type NavItem = { href: string; label: string; icon: string; roles: Role[] };

/** Navegación del panel. "__MY_SCHEDULE__" se sustituye por el horario propio del profesional. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/panel", label: "Inicio", icon: "🏠", roles: ["ADMIN", "EMPLOYEE"] },
  { href: "__MY_SCHEDULE__", label: "Mi horario", icon: "🕘", roles: ["EMPLOYEE"] },
  { href: "/panel/servicios", label: "Servicios", icon: "✂️", roles: ["ADMIN"] },
  { href: "/panel/empleados", label: "Profesionales", icon: "👥", roles: ["ADMIN"] },
  { href: "/panel/disponibilidad", label: "Disponibilidad", icon: "📆", roles: ["ADMIN"] },
  { href: "/panel/configuracion", label: "Configuración", icon: "⚙️", roles: ["ADMIN"] },
];
