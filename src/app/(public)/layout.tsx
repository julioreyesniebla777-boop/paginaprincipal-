import Link from "next/link";
import { getBusiness } from "@/server/business";
import { getCurrentUser } from "@/server/auth/guards";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const [b, user] = await Promise.all([getBusiness(), getCurrentUser()]);
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2 font-bold">
            {b.logoUrl && <img src={b.logoUrl} alt="" className="h-8 w-auto" />}
            <span className="truncate">{b.name}</span>
          </Link>
          <Link href={user ? "/cuenta" : "/login"} className="text-sm text-zinc-600 hover:text-zinc-900">
            {user ? "Mi cuenta" : "Iniciar sesión"}
          </Link>
        </div>
      </header>
      <main className="flex-1 px-4 py-6">{children}</main>
      <footer className="border-t border-zinc-200 bg-white py-4 text-center text-xs text-zinc-500">
        {b.name}
        {b.address && ` · ${b.address}`}
        {b.phone && ` · ${b.phone}`}
      </footer>
    </div>
  );
}
