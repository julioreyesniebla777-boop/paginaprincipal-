import Link from "next/link";
import { getBusiness } from "@/server/business";
import { buttonClasses } from "@/components/ui/button";

export default async function HomePage() {
  const b = await getBusiness();
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-6 px-4 text-center">
      {b.logoUrl && <img src={b.logoUrl} alt={b.name} className="h-16 w-auto" />}
      <h1 className="text-3xl font-bold">{b.name}</h1>
      {b.address && <p className="text-zinc-600">{b.address}</p>}
      <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
        <Link href="/reservar" className={buttonClasses("primary", "lg")}>
          Reservar una cita
        </Link>
        <Link href="/login" className={buttonClasses("outline", "lg")}>
          Iniciar sesión
        </Link>
      </div>
    </main>
  );
}
