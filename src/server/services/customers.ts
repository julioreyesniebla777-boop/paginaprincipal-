import "server-only";
import type { Prisma } from "@prisma/client";
import { normalizeEmail, normalizePhone } from "@/lib/utils";

type Tx = Prisma.TransactionClient;

/**
 * Busca el cliente por email (o, en su defecto, por teléfono) y lo crea si no
 * existe. Completa los datos de contacto que falten sin pisar los existentes.
 */
export async function findOrCreateCustomer(
  tx: Tx,
  data: { name: string; email?: string | null; phone?: string | null; userId?: string | null },
) {
  const email = normalizeEmail(data.email);
  const phoneNormalized = normalizePhone(data.phone);

  let customer = data.userId ? await tx.customer.findUnique({ where: { userId: data.userId } }) : null;
  if (!customer && email) customer = await tx.customer.findFirst({ where: { email }, orderBy: { createdAt: "asc" } });
  if (!customer && phoneNormalized) customer = await tx.customer.findFirst({ where: { phoneNormalized }, orderBy: { createdAt: "asc" } });

  if (!customer) {
    return tx.customer.create({
      data: { name: data.name, email, phone: data.phone || null, phoneNormalized, userId: data.userId ?? null },
    });
  }

  const patch: Prisma.CustomerUpdateInput = {};
  if (!customer.email && email) patch.email = email;
  if (!customer.phone && data.phone) {
    patch.phone = data.phone;
    patch.phoneNormalized = phoneNormalized;
  }
  if (data.userId && !customer.userId) patch.user = { connect: { id: data.userId } };
  return Object.keys(patch).length ? tx.customer.update({ where: { id: customer.id }, data: patch }) : customer;
}
