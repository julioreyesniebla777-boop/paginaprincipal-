import { z } from "zod";
import { colorSchema, optionalText, phoneSchema } from "./common";

export const CURRENCIES = ["USD", "EUR", "MXN", "COP", "ARS", "CLP", "PEN", "DOP", "GTQ", "CRC", "PAB", "UYU", "BOB", "PYG", "HNL", "NIO", "VES", "CAD", "GBP"] as const;
export const LOCALES = [
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
] as const;

const intFromForm = (min: number, max: number, label: string) =>
  z.coerce.number({ invalid_type_error: `${label}: número no válido` }).int(`${label}: debe ser entero`).min(min, `${label}: mínimo ${min}`).max(max, `${label}: máximo ${max}`);

export const businessSchema = z.object({
  name: z.string().trim().min(2, "El nombre es obligatorio").max(120),
  logoUrl: z
    .string()
    .trim()
    .max(500)
    .refine((v) => !v || v.startsWith("/uploads/") || /^https:\/\//.test(v), "Debe ser una URL https o un archivo subido")
    .optional()
    .transform((v) => v || null),
  primaryColor: colorSchema,
  secondaryColor: colorSchema,
  address: optionalText(255),
  phone: phoneSchema.optional().transform((v) => v || undefined),
  email: z.string().trim().toLowerCase().email("Email no válido").max(191).optional().or(z.literal("")).transform((v) => v || undefined),
  timezone: z.string().refine((tz) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "Zona horaria no válida"),
  locale: z.enum(["es", "en"]),
  currency: z.enum(CURRENCIES),
  slotIntervalMin: z.coerce.number().refine((v) => [15, 30, 60].includes(v), "Debe ser 15, 30 o 60"),
  minNoticeHours: intFromForm(0, 720, "Anticipación mínima"),
  maxDaysAhead: intFromForm(1, 365, "Máximo de días"),
  cancelLimitHours: intFromForm(0, 720, "Plazo de cancelación"),
  reminderHoursBefore: intFromForm(1, 168, "Recordatorio"),
  autoConfirm: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
  policyText: optionalText(5000),
});

export type BusinessInput = z.infer<typeof businessSchema>;
