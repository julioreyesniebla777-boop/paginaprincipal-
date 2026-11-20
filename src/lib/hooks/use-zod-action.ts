"use client";

import { useActionState, useState, type FormEvent } from "react";
import type { ZodTypeAny } from "zod";
import { formDataToObject, initialActionState, type ActionState } from "@/lib/action-state";

/**
 * Valida el formulario con Zod en el cliente antes de llamar a la server
 * action (que vuelve a validar en el servidor con el mismo esquema).
 */
export function useZodAction(
  schema: ZodTypeAny | null,
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>,
) {
  const [state, formAction, pending] = useActionState(action, initialActionState);
  const [clientErrors, setClientErrors] = useState<ActionState["fieldErrors"]>();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    if (!schema) return;
    const parsed = schema.safeParse(formDataToObject(new FormData(e.currentTarget)));
    if (!parsed.success) {
      e.preventDefault();
      setClientErrors(parsed.error.flatten().fieldErrors as ActionState["fieldErrors"]);
    } else setClientErrors(undefined);
  }

  const errors = clientErrors ?? state.fieldErrors ?? {};
  const fieldError = (name: string) => errors[name]?.[0];
  return { state, formAction, pending, onSubmit, fieldError };
}
