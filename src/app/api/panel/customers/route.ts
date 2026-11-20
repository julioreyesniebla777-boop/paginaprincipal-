import { NextResponse } from "next/server";
import { prisma } from "@/server/db";
import { getCurrentUser } from "@/server/auth/guards";
import { normalizePhone } from "@/lib/utils";

/** Búsqueda rápida de clientes para crear citas desde el panel. */
export async function GET(req: Request) {
  const user = await getCurrentUser();
  if (!user || (user.role !== "ADMIN" && user.role !== "EMPLOYEE")) return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  const term = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 100);
  if (term.length < 2) return NextResponse.json([]);
  const phone = normalizePhone(term);
  const customers = await prisma.customer.findMany({
    where: {
      OR: [{ name: { contains: term } }, { email: { contains: term } }, ...(phone && phone.length >= 3 ? [{ phoneNormalized: { contains: phone } }] : [])],
    },
    select: { id: true, name: true, email: true, phone: true, isBlocked: true },
    orderBy: { name: "asc" },
    take: 10,
  });
  return NextResponse.json(customers);
}
