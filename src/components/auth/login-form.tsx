"use client";

import Link from "next/link";
import { loginAction } from "@/server/actions/auth";
import { loginSchema } from "@/lib/validation/auth";
import { useZodAction } from "@/lib/hooks/use-zod-action";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/card";

export function LoginForm({ callbackUrl }: { callbackUrl?: string }) {
  const { state, formAction, pending, onSubmit, fieldError } = useZodAction(loginSchema, loginAction);
  return (
    <form action={formAction} onSubmit={onSubmit} className="space-y-4" noValidate>
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <input type="hidden" name="callbackUrl" value={callbackUrl ?? ""} />
      <Field label="Email" htmlFor="email" error={fieldError("email")}>
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required invalid={!!fieldError("email")} />
      </Field>
      <Field label="Contraseña" htmlFor="password" error={fieldError("password")}>
        <Input id="password" name="password" type="password" autoComplete="current-password" required invalid={!!fieldError("password")} />
      </Field>
      <Button type="submit" className="w-full" loading={pending}>
        Entrar
      </Button>
      <div className="flex justify-between text-sm">
        <Link href="/recuperar" className="text-brand hover:underline">
          ¿Olvidaste tu contraseña?
        </Link>
        <Link href="/registro" className="text-brand hover:underline">
          Crear cuenta
        </Link>
      </div>
    </form>
  );
}
