import "server-only";
import { cache } from "react";
import type { Business } from "@prisma/client";
import { prisma } from "./db";

/** Devuelve la configuración del negocio (instalación de una sola empresa). */
export const getBusiness = cache(async (): Promise<Business> => {
  const existing = await prisma.business.findFirst({ orderBy: { createdAt: "asc" } });
  if (existing) return existing;
  return prisma.business.create({ data: { name: "Mi negocio", slug: "mi-negocio" } });
});

export function appUrl(path = ""): string {
  const base = (process.env.APP_URL ?? process.env.AUTH_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path}`;
}
