import Link from "next/link";
import { getBusiness } from "@/server/business";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const b = await getBusiness();
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <Link href="/" className="mb-6 flex items-center gap-2 text-lg font-bold text-zinc-900">
        {b.logoUrl && <img src={b.logoUrl} alt="" className="h-8 w-auto" />}
        {b.name}
      </Link>
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">{children}</div>
    </main>
  );
}
