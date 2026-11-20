"use client";

import { resetPasswordAction } from "@/server/actions/auth";
import { resetPasswordSchema } from "@/lib/validation/auth";
import { useZodAction } from "@/lib/hooks/use-zod-action";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/card";

export function ResetForm({ token }: { token: string }) {
  const { state, formAction, pending, onSubmit, fieldError } = useZodAction(resetPasswordSchema, resetPasswordAction);
  return (
    <form action={formAction} onSubmit={onSubmit} className="space-y-4" noValidate>
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <input type="hidden" name="token" value={token} />
      <Field label="Nueva contraseña" htmlFor="password" error={fieldError("password")} hint="Mínimo 8 caracteres, con letras y números.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </Field>
      <Field label="Repite la contraseña" htmlFor="confirmPassword" error={fieldError("confirmPassword")}>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required />
      </Field>
      <Button type="submit" className="w-full" loading={pending}>
        Guardar contraseña
      </Button>
    </form>
  );
}
