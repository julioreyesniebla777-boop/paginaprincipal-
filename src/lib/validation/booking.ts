import { z } from "zod";
import { emailSchema, nameSchema, requiredPhoneSchema } from "./common";

export const customerDetailsSchema = z.object({
  name: nameSchema,
  phone: requiredPhoneSchema,
  email: emailSchema,
  notes: z.string().trim().max(1000, "Máximo 1000 caracteres").optional().transform((v) => v || undefined),
  acceptPolicies: z.literal(true, { errorMap: () => ({ message: "Debes aceptar las políticas para continuar" }) }),
});

export const bookingSchema = customerDetailsSchema.extend({
  serviceId: z.string().min(1).max(40),
  employeeId: z.string().min(1).max(40), // "any" = cualquiera disponible
  start: z.string().datetime({ offset: true }),
  /** Honeypot: debe llegar vacío. */
  website: z.string().max(0).optional().or(z.literal("")),
  /** Momento en que se mostró el formulario (ms), para detectar bots demasiado rápidos. */
  renderedAt: z.number().int().optional(),
});

export type BookingPayload = z.input<typeof bookingSchema>;

export const rescheduleSchema = z.object({
  start: z.string().datetime({ offset: true }),
});

export const cancelSchema = z.object({
  reason: z.string().trim().max(300).optional(),
});
