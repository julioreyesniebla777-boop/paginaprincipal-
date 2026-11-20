import { z } from "zod";
import { hasOverlap, timeToMinutes } from "../time";

const time = z.string().regex(/^([01]\d|2[0-4]):[0-5]\d$/, "Hora no válida");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha no válida");

export const weeklyScheduleSchema = z
  .array(
    z.object({
      weekday: z.number().int().min(1).max(7),
      start: time,
      end: time,
    }),
  )
  .max(70)
  .superRefine((blocks, ctx) => {
    for (const [i, b] of blocks.entries()) {
      if (timeToMinutes(b.end) <= timeToMinutes(b.start)) ctx.addIssue({ code: "custom", path: [i], message: "La hora de fin debe ser posterior a la de inicio" });
      if (timeToMinutes(b.end) > 1440) ctx.addIssue({ code: "custom", path: [i], message: "Máximo 24:00" });
    }
    for (let wd = 1; wd <= 7; wd++) {
      const day = blocks.filter((b) => b.weekday === wd).map((b) => ({ startMin: timeToMinutes(b.start), endMin: timeToMinutes(b.end) }));
      if (hasOverlap(day)) ctx.addIssue({ code: "custom", path: [], message: "Hay bloques que se solapan el mismo día" });
    }
  });

export const exceptionSchema = z
  .object({
    employeeId: z.string().max(40).optional().transform((v) => v || null),
    type: z.enum(["DAY_OFF", "VACATION", "HOLIDAY", "CUSTOM_HOURS"]),
    startDate: date,
    endDate: date.optional().or(z.literal("")).transform((v) => v || undefined),
    start: time.optional().or(z.literal("")).transform((v) => v || undefined),
    end: time.optional().or(z.literal("")).transform((v) => v || undefined),
    label: z.string().trim().max(120).optional().transform((v) => v || undefined),
  })
  .transform((d) => ({ ...d, endDate: d.endDate ?? d.startDate }))
  .superRefine((d, ctx) => {
    if (d.endDate < d.startDate) ctx.addIssue({ code: "custom", path: ["endDate"], message: "La fecha final debe ser igual o posterior" });
    if (d.type === "CUSTOM_HOURS") {
      if (!d.start || !d.end) ctx.addIssue({ code: "custom", path: ["start"], message: "Indica el horario especial" });
      else if (timeToMinutes(d.end) <= timeToMinutes(d.start)) ctx.addIssue({ code: "custom", path: ["end"], message: "La hora de fin debe ser posterior" });
    }
  });

export const timeBlockSchema = z
  .object({
    employeeId: z.string().min(1).max(40),
    date,
    start: time,
    end: time,
    reason: z.string().trim().max(120).optional().transform((v) => v || undefined),
  })
  .refine((d) => timeToMinutes(d.end) > timeToMinutes(d.start), { path: ["end"], message: "La hora de fin debe ser posterior" });

/** Bloqueo creado desde el calendario (instantes ISO). */
export const timeBlockRangeSchema = z
  .object({
    employeeId: z.string().min(1).max(40),
    startsAt: z.string().datetime({ offset: true }),
    endsAt: z.string().datetime({ offset: true }),
    reason: z.string().trim().max(120).optional(),
  })
  .refine((d) => Date.parse(d.endsAt) > Date.parse(d.startsAt), { path: ["endsAt"], message: "El fin debe ser posterior" });
