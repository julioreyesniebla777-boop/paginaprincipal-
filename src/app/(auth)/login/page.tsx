import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/guards";
import { LoginForm } from "@/components/auth/login-form";
import { Alert } from "@/components/ui/card";

export const metadata: Metadata = { title: "Iniciar sesión" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  if (await getCurrentUser()) redirect("/cuenta");
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">Iniciar sesión</h1>
      {sp.restablecido && <Alert kind="success" className="mb-4">Contraseña actualizada. Ya puedes entrar.</Alert>}
      {sp.registrado && <Alert kind="success" className="mb-4">Cuenta creada. Inicia sesión para continuar.</Alert>}
      <LoginForm callbackUrl={sp.callbackUrl} />
    </>
  );
}
