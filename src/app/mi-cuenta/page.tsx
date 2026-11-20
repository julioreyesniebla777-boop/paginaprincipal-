import Link from "next/link";
import { requireUser } from "@/server/auth/guards";
import { logoutAction } from "@/server/actions/auth";
import { buttonClasses } from "@/components/ui/button";

export const metadata = { title: "Mi cuenta", robots: { index: false } };

export default async function MyAccountPage() {
  const user = await requireUser();
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mis citas</h1>
        <form action={logoutAction}>
          <button className="text-sm text-red-600 hover:underline">Cerrar sesión</button>
        </form>
      </div>
      <p className="mb-4 text-zinc-600">Hola {user.name}. Aquí verás, reprogramarás y cancelarás tus citas.</p>
      <Link href="/reservar" className={buttonClasses("primary")}>
        Reservar nueva cita
      </Link>
    </main>
  );
}
