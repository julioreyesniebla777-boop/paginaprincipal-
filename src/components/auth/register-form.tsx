"use client";

import Link from "next/link";
import { registerAction } from "@/server/actions/auth";
import { registerSchema } from "@/lib/validation/auth";
import { useZodAction } from "@/lib/hooks/use-zod-action";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/card";

export function RegisterForm() {
  const { state, formAction, pending, onSubmit, fieldError } = useZodAction(registerSchema, registerAction);
  return (
    <form action={formAction} onSubmit={onSubmit} className="space-y-4" noValidate>
      {state.error && <Alert kind="error">{state.error}</Alert>}
      <Field label="Nombre completo" htmlFor="name" error={fieldError("name")}>
        <Input id="name" name="name" autoComplete="name" required />
      </Field>
      <Field label="Email" htmlFor="email" error={fieldError("email")} hint="Usa el mismo email de tus reservas para ver tus citas anteriores.">
        <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" required />
      </Field>
      <Field label="Teléfono (opcional)" htmlFor="phone" error={fieldError("phone")}>
        <Input id="phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" />
      </Field>
      <Field label="Contraseña" htmlFor="password" error={fieldError("password")} hint="Mínimo 8 caracteres, con letras y números.">
        <Input id="password" name="password" type="password" autoComplete="new-password" required />
      </Field>
      <Field label="Repite la contraseña" htmlFor="confirmPassword" error={fieldError("confirmPassword")}>
        <Input id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required />
      </Field>
      <Button type="submit" className="w-full" loading={pending}>
        Crear cuenta
      </Button>
      <p className="text-center text-sm">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="text-brand hover:underline">
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}
