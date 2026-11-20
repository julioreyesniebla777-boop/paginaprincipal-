import { z } from "zod";

export const emailSchema = z
  .string({ required_error: "El email es obligatorio" })
  .trim()
  .toLowerCase()
  .min(1, "El email es obligatorio")
  .max(191, "Email demasiado largo")
  .email("Email no válido");

export const passwordSchema = z
  .string({ required_error: "La contraseña es obligatoria" })
  .min(8, "Mínimo 8 caracteres")
  .max(128, "Máximo 128 caracteres")
  .regex(/[A-Za-z]/, "Debe incluir al menos una letra")
  .regex(/[0-9]/, "Debe incluir al menos un número");

export const phoneSchema = z
  .string()
  .trim()
  .max(30, "Teléfono demasiado largo")
  .regex(/^[0-9+()\-.\s]*$/, "Teléfono no válido");

export const requiredPhoneSchema = phoneSchema.refine((v) => v.replace(/\D/g, "").length >= 7, {
  message: "Teléfono no válido",
});

export const nameSchema = z
  .string({ required_error: "El nombre es obligatorio" })
  .trim()
  .min(2, "El nombre es obligatorio")
  .max(120, "Nombre demasiado largo");

export const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Color no válido (#RRGGBB)");

export const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Máximo ${max} caracteres`)
    .optional()
    .transform((v) => (v ? v : undefined));
