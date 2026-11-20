import "server-only";
import { Prisma } from "@prisma/client";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { ForbiddenError } from "@/server/auth/guards";
import type { ActionState } from "@/lib/action-state";

export class UserError extends Error {}

/** Envuelve una server action: traduce errores conocidos a mensajes para el usuario. */
export async function guarded(fn: () => Promise<ActionState>): Promise<ActionState> {
  try {
    return await fn();
  } catch (err) {
    if (isRedirectError(err)) throw err;
    if (err instanceof ForbiddenError || err instanceof UserError) return { ok: false, error: err.message };
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { ok: false, error: "Ya existe un registro con esos datos (valor duplicado)" };
    }
    console.error("[action]", err);
    return { ok: false, error: "Ocurrió un error inesperado. Inténtalo de nuevo." };
  }
}
