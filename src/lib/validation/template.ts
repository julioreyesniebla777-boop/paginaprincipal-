import { z } from "zod";

export const TEMPLATE_TYPES = ["BOOKING_CONFIRMATION", "BOOKING_PENDING", "REMINDER", "RESCHEDULED", "CANCELLED", "BUSINESS_NEW_BOOKING", "PASSWORD_RESET"] as const;

export const templateSchema = z.object({
  type: z.enum(TEMPLATE_TYPES),
  subject: z.string().trim().min(3, "El asunto es obligatorio").max(190, "Máximo 190 caracteres"),
  bodyHtml: z.string().trim().min(10, "El contenido es obligatorio").max(20000, "Máximo 20.000 caracteres"),
  enabled: z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean()),
});
