"use server";

import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";
import { prisma } from "@/server/db";
import { assertAdmin } from "@/server/auth/guards";
import { getBusiness } from "@/server/business";
import { businessSchema } from "@/lib/validation/business";
import { formDataToObject, fromZodError, type ActionState } from "@/lib/action-state";
import { guarded, UserError } from "./_utils";

export async function updateBusinessAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    await assertAdmin();
    const parsed = businessSchema.safeParse(formDataToObject(fd));
    if (!parsed.success) return fromZodError(parsed.error);
    const d = parsed.data;
    const business = await getBusiness();
    await prisma.business.update({
      where: { id: business.id },
      data: {
        name: d.name,
        logoUrl: d.logoUrl,
        primaryColor: d.primaryColor,
        secondaryColor: d.secondaryColor,
        address: d.address ?? null,
        phone: d.phone ?? null,
        email: d.email ?? null,
        timezone: d.timezone,
        locale: d.locale,
        currency: d.currency,
        slotIntervalMin: d.slotIntervalMin,
        minNoticeMin: d.minNoticeHours * 60,
        maxDaysAhead: d.maxDaysAhead,
        cancelLimitMin: d.cancelLimitHours * 60,
        reminderHoursBefore: d.reminderHoursBefore,
        autoConfirm: d.autoConfirm,
        policyText: d.policyText ?? null,
      },
    });
    revalidatePath("/", "layout");
    return { ok: true, message: "Configuración guardada" };
  });
}

const ALLOWED_IMAGE_TYPES: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };

/** Firma de los primeros bytes para no confiar solo en el tipo MIME declarado. */
function sniffImage(buf: Buffer): string | null {
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP") return "webp";
  return null;
}

export async function uploadLogoAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  return guarded(async () => {
    await assertAdmin();
    const file = fd.get("logo");
    if (!(file instanceof File) || file.size === 0) throw new UserError("Selecciona una imagen");
    if (file.size > 1024 * 1024) throw new UserError("La imagen debe pesar menos de 1 MB");
    const ext = ALLOWED_IMAGE_TYPES[file.type];
    const buf = Buffer.from(await file.arrayBuffer());
    if (!ext || sniffImage(buf) !== ext) throw new UserError("Formato no permitido (usa PNG, JPG o WebP)");

    const dir = path.resolve(process.env.UPLOAD_DIR || "./uploads");
    await mkdir(dir, { recursive: true });
    const name = `logo-${randomBytes(8).toString("hex")}.${ext}`;
    await writeFile(path.join(dir, name), buf);

    const business = await getBusiness();
    await prisma.business.update({ where: { id: business.id }, data: { logoUrl: `/uploads/${name}` } });
    revalidatePath("/", "layout");
    return { ok: true, message: "Logo actualizado" };
  });
}
