import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/server/db";
import { normalizeEmail, normalizePhone } from "@/lib/utils";
import type { CustomerFilters } from "@/lib/validation/customer";
import { parseCsv } from "@/lib/csv";

export function buildCustomerWhere(f: CustomerFilters): Prisma.CustomerWhereInput {
  const where: Prisma.CustomerWhereInput = {};
  if (f.q) {
    const phone = normalizePhone(f.q);
    where.OR = [{ name: { contains: f.q } }, { email: { contains: f.q } }, ...(phone && phone.length >= 3 ? [{ phoneNormalized: { contains: phone } }] : [])];
  }
  if (f.tag) where.tags = { some: { tagId: f.tag } };
  if (f.blocked) where.isBlocked = f.blocked === "1";
  return where;
}

/** Totales por cliente: gastado (citas completadas), inasistencias y número de citas. */
export async function customerTotals(ids: string[]) {
  if (!ids.length) return new Map<string, { spentCents: number; noShows: number; visits: number; last: Date | null }>();
  const rows = await prisma.appointment.groupBy({
    by: ["customerId", "status"],
    where: { customerId: { in: ids } },
    _sum: { priceCents: true },
    _count: { _all: true },
    _max: { startsAt: true },
  });
  const map = new Map<string, { spentCents: number; noShows: number; visits: number; last: Date | null }>();
  for (const id of ids) map.set(id, { spentCents: 0, noShows: 0, visits: 0, last: null });
  for (const r of rows) {
    const t = map.get(r.customerId)!;
    if (r.status === "COMPLETED") {
      t.spentCents += r._sum.priceCents ?? 0;
      t.visits += r._count._all;
      if (r._max.startsAt && (!t.last || r._max.startsAt > t.last)) t.last = r._max.startsAt;
    }
    if (r.status === "NO_SHOW") t.noShows += r._count._all;
  }
  return map;
}

/** Grupos de clientes que comparten email o teléfono. */
export async function findDuplicateGroups() {
  const [byEmail, byPhone] = await Promise.all([
    prisma.customer.groupBy({ by: ["email"], where: { email: { not: null } }, _count: { _all: true }, having: { email: { _count: { gt: 1 } } } }),
    prisma.customer.groupBy({ by: ["phoneNormalized"], where: { phoneNormalized: { not: null } }, _count: { _all: true }, having: { phoneNormalized: { _count: { gt: 1 } } } }),
  ]);
  const groups: Array<{ key: string; kind: "email" | "phone"; customers: Awaited<ReturnType<typeof loadGroup>> }> = [];
  async function loadGroup(where: Prisma.CustomerWhereInput) {
    return prisma.customer.findMany({ where, orderBy: { createdAt: "asc" }, include: { _count: { select: { appointments: true } } } });
  }
  for (const g of byEmail) groups.push({ key: g.email!, kind: "email", customers: await loadGroup({ email: g.email }) });
  for (const g of byPhone) groups.push({ key: g.phoneNormalized!, kind: "phone", customers: await loadGroup({ phoneNormalized: g.phoneNormalized }) });
  return groups;
}

export async function possibleDuplicatesOf(c: { id: string; email: string | null; phoneNormalized: string | null }) {
  const or: Prisma.CustomerWhereInput[] = [];
  if (c.email) or.push({ email: c.email });
  if (c.phoneNormalized) or.push({ phoneNormalized: c.phoneNormalized });
  if (!or.length) return [];
  return prisma.customer.findMany({ where: { id: { not: c.id }, OR: or }, include: { _count: { select: { appointments: true } } } });
}

/**
 * Fusiona `sourceId` dentro de `targetId`: mueve citas y etiquetas, completa
 * datos vacíos, concatena notas y borra el duplicado.
 */
export async function mergeCustomers(targetId: string, sourceId: string) {
  if (targetId === sourceId) throw new Error("No puedes fusionar un cliente consigo mismo");
  return prisma.$transaction(async (tx) => {
    const [target, source] = await Promise.all([
      tx.customer.findUnique({ where: { id: targetId }, include: { tags: true } }),
      tx.customer.findUnique({ where: { id: sourceId }, include: { tags: true } }),
    ]);
    if (!target || !source) throw new Error("Cliente no encontrado");
    if (target.userId && source.userId) throw new Error("Ambos clientes tienen cuenta de usuario; no se pueden fusionar automáticamente");

    await tx.appointment.updateMany({ where: { customerId: source.id }, data: { customerId: target.id } });
    const existing = new Set(target.tags.map((t) => t.tagId));
    const newTags = source.tags.filter((t) => !existing.has(t.tagId));
    await tx.customerTag.deleteMany({ where: { customerId: source.id } });
    if (newTags.length) await tx.customerTag.createMany({ data: newTags.map((t) => ({ customerId: target.id, tagId: t.tagId })) });

    const userId = target.userId ?? source.userId;
    await tx.customer.delete({ where: { id: source.id } });
    return tx.customer.update({
      where: { id: target.id },
      data: {
        email: target.email ?? source.email,
        phone: target.phone ?? source.phone,
        phoneNormalized: target.phoneNormalized ?? source.phoneNormalized,
        birthDate: target.birthDate ?? source.birthDate,
        internalNotes: [target.internalNotes, source.internalNotes].filter(Boolean).join("\n---\n") || null,
        isBlocked: target.isBlocked || source.isBlocked,
        blockedReason: target.blockedReason ?? source.blockedReason,
        userId,
      },
    });
  });
}

export async function setCustomerTags(tx: Prisma.TransactionClient, customerId: string, names: string[]) {
  await tx.customerTag.deleteMany({ where: { customerId } });
  for (const name of names) {
    const tag = await tx.tag.upsert({ where: { name }, update: {}, create: { name } });
    await tx.customerTag.create({ data: { customerId, tagId: tag.id } });
  }
}

// ───────────── Importación CSV ─────────────
const HEADER_ALIASES: Record<string, string> = {
  nombre: "name",
  name: "name",
  "nombre completo": "name",
  cliente: "name",
  email: "email",
  correo: "email",
  "correo electronico": "email",
  "correo electrónico": "email",
  telefono: "phone",
  teléfono: "phone",
  phone: "phone",
  celular: "phone",
  movil: "phone",
  móvil: "phone",
  "fecha de nacimiento": "birthDate",
  fecha_nacimiento: "birthDate",
  nacimiento: "birthDate",
  cumpleaños: "birthDate",
  birthdate: "birthDate",
  etiquetas: "tags",
  tags: "tags",
  notas: "notes",
  notes: "notes",
  "notas internas": "notes",
};

export type ImportReport = { created: number; updated: number; skipped: number; errors: Array<{ row: number; message: string }> };

function validDate(y: number, m: number, d: number): Date | null {
  const dt = new Date(Date.UTC(y, m - 1, d));
  // Rechaza fechas que JavaScript "desborda" (ej. 31/02 → 3 de marzo).
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  if (y < 1900 || dt > new Date()) return null;
  return dt;
}

export function parseBirthDate(v: string): Date | null {
  const s = v.trim();
  if (!s) return null;
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return validDate(+m[1]!, +m[2]!, +m[3]!);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/); // dd/mm/aaaa
  if (m) return validDate(+m[3]!, +m[2]!, +m[1]!);
  return null;
}

/**
 * Importa clientes desde CSV. Detecta duplicados por email o teléfono:
 * si existe, completa los campos vacíos y añade etiquetas; si no, lo crea.
 */
export async function importCustomersCsv(text: string): Promise<ImportReport> {
  const rows = parseCsv(text);
  const report: ImportReport = { created: 0, updated: 0, skipped: 0, errors: [] };
  if (rows.length < 2) {
    report.errors.push({ row: 1, message: "El archivo no tiene filas de datos" });
    return report;
  }
  const headers = rows[0]!.map((h) => HEADER_ALIASES[h.trim().toLowerCase()] ?? null);
  if (!headers.includes("name")) {
    report.errors.push({ row: 1, message: "Falta la columna 'nombre'" });
    return report;
  }
  if (rows.length > 5001) {
    report.errors.push({ row: 1, message: "Máximo 5000 filas por importación" });
    return report;
  }

  for (let i = 1; i < rows.length; i++) {
    const rec: Record<string, string> = {};
    rows[i]!.forEach((v, idx) => {
      const key = headers[idx];
      if (key) rec[key] = v.trim();
    });
    const rowNum = i + 1;
    const name = (rec.name ?? "").slice(0, 120);
    if (name.length < 2) {
      report.errors.push({ row: rowNum, message: "Nombre vacío o demasiado corto" });
      continue;
    }
    const email = normalizeEmail(rec.email);
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      report.errors.push({ row: rowNum, message: `Email no válido: ${email}` });
      continue;
    }
    const phone = rec.phone?.slice(0, 30) || null;
    const phoneNormalized = normalizePhone(phone);
    const birthDate = rec.birthDate ? parseBirthDate(rec.birthDate) : null;
    if (rec.birthDate && !birthDate) {
      report.errors.push({ row: rowNum, message: `Fecha no válida: ${rec.birthDate} (usa AAAA-MM-DD o DD/MM/AAAA)` });
      continue;
    }
    const tags = (rec.tags ?? "").split(/[|;,]/).map((t) => t.trim().slice(0, 40)).filter(Boolean);
    const notes = rec.notes?.slice(0, 5000) || null;

    try {
      await prisma.$transaction(async (tx) => {
        const existing =
          (email && (await tx.customer.findFirst({ where: { email } }))) ||
          (phoneNormalized && (await tx.customer.findFirst({ where: { phoneNormalized } }))) ||
          null;
        let id: string;
        if (existing) {
          const patch: Prisma.CustomerUpdateInput = {};
          if (!existing.email && email) patch.email = email;
          if (!existing.phone && phone) Object.assign(patch, { phone, phoneNormalized });
          if (!existing.birthDate && birthDate) patch.birthDate = birthDate;
          if (notes && !(existing.internalNotes ?? "").includes(notes)) patch.internalNotes = [existing.internalNotes, notes].filter(Boolean).join("\n");
          if (!Object.keys(patch).length && !tags.length) {
            report.skipped++;
            return;
          }
          await tx.customer.update({ where: { id: existing.id }, data: patch });
          id = existing.id;
          report.updated++;
        } else {
          const c = await tx.customer.create({ data: { name, email, phone, phoneNormalized, birthDate, internalNotes: notes } });
          id = c.id;
          report.created++;
        }
        for (const t of tags) {
          const tag = await tx.tag.upsert({ where: { name: t }, update: {}, create: { name: t } });
          await tx.customerTag.upsert({ where: { customerId_tagId: { customerId: id, tagId: tag.id } }, update: {}, create: { customerId: id, tagId: tag.id } });
        }
      });
    } catch (err) {
      report.errors.push({ row: rowNum, message: err instanceof Error ? err.message.slice(0, 200) : "Error" });
    }
  }
  return report;
}
