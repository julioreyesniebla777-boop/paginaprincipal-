import { z } from "zod";
import { colorSchema, optionalText } from "./common";
import { parseMoneyToCents } from "../money";

const bool = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());
const ids = z.preprocess((v) => (v == null || v === "" ? [] : Array.isArray(v) ? v : [v]), z.array(z.string().min(1).max(40)));

export const serviceSchema = z.object({
  name: z.string().trim().min(2, "El nombre es obligatorio").max(120),
  description: optionalText(2000),
  categoryId: z.string().max(40).optional().transform((v) => v || null),
  newCategory: optionalText(80),
  durationMin: z.coerce.number().int().min(5, "Mínimo 5 minutos").max(720, "Máximo 12 horas"),
  price: z
    .string()
    .trim()
    .default("0")
    .transform((v, ctx) => {
      const cents = parseMoneyToCents(v || "0");
      if (Number.isNaN(cents) || cents < 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Precio no válido (ej. 45.00)" });
        return z.NEVER;
      }
      return cents;
    }),
  color: colorSchema,
  bufferBeforeMin: z.coerce.number().int().min(0).max(240, "Máximo 240 minutos"),
  bufferAfterMin: z.coerce.number().int().min(0).max(240, "Máximo 240 minutos"),
  capacity: z.coerce.number().int().min(1, "Mínimo 1").max(500, "Máximo 500"),
  isActive: bool,
  employeeIds: ids,
});

export type ServiceInput = z.infer<typeof serviceSchema>;
