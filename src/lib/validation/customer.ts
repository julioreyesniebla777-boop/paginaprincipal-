import { z } from "zod";
import { nameSchema, phoneSchema } from "./common";

const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(191)
  .optional()
  .transform((v) => v || undefined)
  .refine((v) => !v || z.string().email().safeParse(v).success, "Email no válido");

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((v) => v || undefined)
  .refine((v) => !v || (/^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && v >= "1900-01-01" && v <= new Date().toISOString().slice(0, 10)), "Fecha no válida");

export const customerSchema = z.object({
  name: nameSchema,
  email: optionalEmail,
  phone: phoneSchema.optional().transform((v) => v || undefined),
  birthDate: optionalDate,
  internalNotes: z.string().trim().max(5000).optional().transform((v) => v || undefined),
  tags: z
    .string()
    .optional()
    .transform((v) =>
      [...new Set((v ?? "").split(",").map((t) => t.trim()).filter(Boolean))].map((t) => t.slice(0, 40)).slice(0, 20),
    ),
});
export type CustomerInput = z.infer<typeof customerSchema>;

export const customerFiltersSchema = z.object({
  q: z.string().trim().max(100).optional(),
  tag: z.string().max(40).optional().transform((v) => v || undefined),
  blocked: z.enum(["1", "0"]).optional().or(z.literal("")).transform((v) => v || undefined),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});
export type CustomerFilters = z.infer<typeof customerFiltersSchema>;
