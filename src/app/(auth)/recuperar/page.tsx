import type { Metadata } from "next";
import { ForgotForm } from "@/components/auth/forgot-form";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function ForgotPage() {
  return (
    <>
      <h1 className="mb-1 text-xl font-semibold">Recuperar contraseña</h1>
      <p className="mb-4 text-sm text-zinc-500">Te enviaremos un enlace para crear una nueva.</p>
      <ForgotForm />
    </>
  );
}
