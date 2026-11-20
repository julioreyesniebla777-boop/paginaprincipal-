"use client";

import Link from "next/link";
import { forgotPasswordAction } from "@/server/actions/auth";
import { forgotPasswordSchema } from "@/lib/validation/auth";
import { useZodAction } from "@/lib/hooks/use-zod-action";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/card";

export function ForgotForm() {
  const { state, formAction, pending, onSubmit, fieldError } = useZodAction(forgotPasswordSchema, forgotPasswordAction);
  if (state.ok) return <Alert kind="success">{state.message}</Alert>;
  return (
    <form action={formAction} onSubmit={onSubmit} className="space-y-4" noValidate>
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <Field label="Email" htmlFor="email" error={fieldError("email")}>
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required />
      </Field>
      <Button type="submit" className="w-full" loading={pending}>
        Enviar enlace
      </Button>
      <p className="text-center text-sm">
        <Link href="/login" className="text-brand hover:underline">
          Volver a iniciar sesión
        </Link>
      </p>
    </form>
  );
}
