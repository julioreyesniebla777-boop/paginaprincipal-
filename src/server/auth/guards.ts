import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import { prisma } from "@/server/db";
import { auth } from "./index";

export type CurrentUser = {
  id: string;
  email: string;
  name: string;
  role: Role;
  employeeId: string | null;
  customerId: string | null;
};

export class ForbiddenError extends Error {
  constructor(message = "No tienes permiso para realizar esta acción") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Usuario actual leído de la base de datos en cada petición (cacheado por
 * petición). Así un cambio de rol o una desactivación aplica de inmediato,
 * aunque el JWT siga vigente.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) return null;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      isActive: true,
      employee: { select: { id: true, isActive: true } },
      customer: { select: { id: true } },
    },
  });
  if (!user || !user.isActive) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    employeeId: user.employee?.isActive ? user.employee.id : null,
    customerId: user.customer?.id ?? null,
  };
});

/** Para páginas: redirige si no hay sesión o el rol no está permitido. */
export async function requireUser(roles?: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect(user.role === "CUSTOMER" ? "/mi-cuenta" : "/panel");
  return user;
}

export const requireStaff = () => requireUser(["ADMIN", "EMPLOYEE"]);
export const requireAdmin = () => requireUser(["ADMIN"]);

/** Para server actions y rutas API: lanza ForbiddenError en lugar de redirigir. */
export async function assertRole(roles: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user || !roles.includes(user.role)) throw new ForbiddenError();
  if (user.role === "EMPLOYEE" && !user.employeeId) throw new ForbiddenError("Tu perfil de empleado está inactivo");
  return user;
}

export const assertStaff = () => assertRole(["ADMIN", "EMPLOYEE"]);
export const assertAdmin = () => assertRole(["ADMIN"]);

/**
 * Filtro de alcance: un EMPLOYEE solo ve su propia agenda.
 * Devuelve el employeeId forzado o undefined (sin restricción) para ADMIN.
 */
export function scopedEmployeeId(user: CurrentUser): string | undefined {
  return user.role === "EMPLOYEE" ? (user.employeeId ?? "__none__") : undefined;
}

/** Comprueba que el usuario pueda actuar sobre la agenda del empleado indicado. */
export function canManageEmployee(user: CurrentUser, employeeId: string): boolean {
  return user.role === "ADMIN" || (user.role === "EMPLOYEE" && user.employeeId === employeeId);
}
