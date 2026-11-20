/** Etiquetas en español compartidas entre servidor y cliente. */
export const EXCEPTION_LABELS = {
  DAY_OFF: "Día libre",
  VACATION: "Vacaciones",
  HOLIDAY: "Feriado",
  CUSTOM_HOURS: "Horario especial",
} as const;

export const STATUS_LABELS = {
  PENDING: "Pendiente",
  CONFIRMED: "Confirmada",
  COMPLETED: "Completada",
  CANCELLED: "Cancelada",
  NO_SHOW: "No asistió",
} as const;

export const STATUS_COLORS = {
  PENDING: "#d97706",
  CONFIRMED: "#2563eb",
  COMPLETED: "#16a34a",
  CANCELLED: "#71717a",
  NO_SHOW: "#dc2626",
} as const;
