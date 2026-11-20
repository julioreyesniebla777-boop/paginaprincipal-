import { z } from "zod";
import { emailSchema, nameSchema, phoneSchema } from "./common";

export const panelAppointmentSchema = z
  .object({
    serviceId: z.string().min(1, "Elige un servicio").max(40),
    employeeId: z.string().min(1, "Elige un profesional").max(40),
    start: z.string().datetime({ offset: true, message: "Elige una hora" }),
    customerId: z.string().max(40).optional().transform((v) => v || undefined),
    newName: z.string().trim().optional().transform((v) => v || undefined),
    newEmail: z.string().trim().optional().transform((v) => v || undefined),
    newPhone: z.string().trim().optional().transform((v) => v || undefined),
    notes: z.string().trim().max(1000).optional().transform((v) => v || undefined),
    notify: z.boolean().default(true),
  })
  .superRefine((d, ctx) => {
    if (d.customerId) return;
    if (!nameSchema.safeParse(d.newName).success) ctx.addIssue({ code: "custom", path: ["newName"], message: "Indica el nombre del cliente" });
    if (d.newEmail && !emailSchema.safeParse(d.newEmail).success) ctx.addIssue({ code: "custom", path: ["newEmail"], message: "Email no válido" });
    if (d.newPhone && !phoneSchema.safeParse(d.newPhone).success) ctx.addIssue({ code: "custom", path: ["newPhone"], message: "Teléfono no válido" });
  });

export const statusChangeSchema = z.object({
  appointmentId: z.string().min(1).max(40),
  status: z.enum(["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"]),
  note: z.string().trim().max(300).optional(),
  notify: z.boolean().default(true),
});

export const panelRescheduleSchema = z.object({
  appointmentId: z.string().min(1).max(40),
  start: z.string().datetime({ offset: true }),
  employeeId: z.string().min(1).max(40).optional(),
  notify: z.boolean().default(true),
});

export const appointmentFiltersSchema = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(["PENDING", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"]).optional().or(z.literal("")).transform((v) => v || undefined),
  employeeId: z.string().max(40).optional().transform((v) => v || undefined),
  serviceId: z.string().max(40).optional().transform((v) => v || undefined),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")).transform((v) => v || undefined),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().or(z.literal("")).transform((v) => v || undefined),
  page: z.coerce.number().int().min(1).max(10000).default(1),
});
export type AppointmentFilters = z.infer<typeof appointmentFiltersSchema>;
