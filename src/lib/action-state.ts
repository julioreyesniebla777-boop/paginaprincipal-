import type { ZodError } from "zod";

export type ActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export const initialActionState: ActionState = {};

export function fromZodError(error: ZodError, message = "Revisa los campos marcados"): ActionState {
  return { ok: false, error: message, fieldErrors: error.flatten().fieldErrors as ActionState["fieldErrors"] };
}

/** Convierte FormData en un objeto plano (los campos repetidos quedan como arreglo). */
export function formDataToObject(fd: FormData): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) {
    if (k.startsWith("$ACTION")) continue;
    const val = typeof v === "string" ? v : v;
    if (k in obj) {
      const prev = obj[k];
      obj[k] = Array.isArray(prev) ? [...prev, val] : [prev, val];
    } else obj[k] = val;
  }
  return obj;
}
