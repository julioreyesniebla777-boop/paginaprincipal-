import { z } from "zod";
import { colorSchema, optionalText, passwordSchema, phoneSchema } from "./common";

const bool = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());
const ids = z.preprocess((v) => (v == null || v === "" ? [] : Array.isArray(v) ? v : [v]), z.array(z.string().min(1).max(40)));

export const employeeSchema = z
  .object({
    displayName: z.string().trim().min(2, "El nombre es obligatorio").max(120),
    email: z.string().trim().toLowerCase().email("Email no válido").max(191).optional().or(z.literal("")).transform((v) => v || undefined),
    phone: phoneSchema.optional().transform((v) => v || undefined),
    bio: optionalText(1000),
    color: colorSchema,
    isActive: bool,
    serviceIds: ids,
    /** Crear o actualizar el acceso al panel. */
    enableLogin: bool,
    password: z.string().optional().transform((v) => v || undefined),
  })
  .superRefine((d, ctx) => {
    if (d.enableLogin && !d.email) ctx.addIssue({ code: "custom", path: ["email"], message: "El acceso al panel requiere email" });
    if (d.password) {
      const r = passwordSchema.safeParse(d.password);
      if (!r.success) ctx.addIssue({ code: "custom", path: ["password"], message: r.error.issues[0]!.message });
    }
  });

export type EmployeeInput = z.infer<typeof employeeSchema>;
