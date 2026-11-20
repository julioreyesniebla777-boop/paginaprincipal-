import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = { title: "Crear cuenta" };

export default function RegisterPage() {
  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">Crear cuenta</h1>
      <p className="mb-4 text-sm text-zinc-500">Opcional: también puedes reservar como invitado.</p>
      <RegisterForm />
    </>
  );
}
