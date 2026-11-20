"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import type { Role } from "@prisma/client";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "./nav-items";

export function PanelShell({
  businessName,
  user,
  logout,
  children,
}: {
  businessName: string;
  user: { name: string; role: Role };
  logout: () => Promise<void>;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = NAV_ITEMS.filter((i) => i.roles.includes(user.role));
  const isActive = (href: string) => (href === "/panel" ? pathname === "/panel" : pathname.startsWith(href));

  const nav = (
    <nav className="flex flex-col gap-1 p-3">
      {items.map((i) => (
        <Link
          key={i.href}
          href={i.href}
          onClick={() => setOpen(false)}
          className={cn(
            "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium",
            isActive(i.href) ? "bg-brand/10 text-brand" : "text-zinc-700 hover:bg-zinc-100",
          )}
        >
          <span aria-hidden>{i.icon}</span>
          {i.label}
        </Link>
      ))}
    </nav>
  );

  const footer = (
    <div className="border-t border-zinc-200 p-3 text-sm">
      <p className="truncate font-medium text-zinc-900">{user.name}</p>
      <p className="text-xs text-zinc-500">{user.role === "ADMIN" ? "Administrador" : "Profesional"}</p>
      <form action={logout} className="mt-2">
        <button className="text-sm text-red-600 hover:underline">Cerrar sesión</button>
      </form>
    </div>
  );

  return (
    <div className="min-h-dvh lg:flex">
      {/* Barra superior móvil */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-zinc-200 bg-white px-4 lg:hidden">
        <button onClick={() => setOpen(true)} aria-label="Abrir menú" className="-ml-2 rounded-lg p-2 hover:bg-zinc-100">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <span className="truncate font-semibold">{businessName}</span>
        <span className="w-8" />
      </header>

      {/* Cajón móvil */}
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal>
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 flex-col bg-white shadow-xl">
            <div className="flex h-14 items-center border-b border-zinc-200 px-4 font-semibold">{businessName}</div>
            <div className="flex-1 overflow-y-auto">{nav}</div>
            {footer}
          </aside>
        </div>
      )}

      {/* Barra lateral escritorio */}
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 flex-col border-r border-zinc-200 bg-white lg:flex">
        <div className="flex h-16 items-center px-5 text-lg font-bold">{businessName}</div>
        <div className="flex-1 overflow-y-auto">{nav}</div>
        {footer}
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
