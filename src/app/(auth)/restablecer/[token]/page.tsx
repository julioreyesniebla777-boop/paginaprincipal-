import type { Metadata } from "next";
import { ResetForm } from "@/components/auth/reset-form";

export const metadata: Metadata = { title: "Nueva contraseña", robots: { index: false } };

export default async function ResetPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <>
      <h1 className="mb-4 text-xl font-semibold">Crea una nueva contraseña</h1>
      <ResetForm token={token} />
    </>
  );
}
