import type { Metadata, Viewport } from "next";
import { getBusiness } from "@/server/business";
import "./globals.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const b = await getBusiness();
  return {
    title: { default: b.name, template: `%s · ${b.name}` },
    description: `Reserva tu cita en ${b.name}`,
    icons: b.logoUrl ? { icon: b.logoUrl } : undefined,
  };
}

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#ffffff" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const b = await getBusiness();
  const style = { "--brand": b.primaryColor, "--brand-dark": b.secondaryColor } as React.CSSProperties;
  return (
    <html lang={b.locale || "es"}>
      <body style={style} className="min-h-dvh antialiased">
        {children}
      </body>
    </html>
  );
}
