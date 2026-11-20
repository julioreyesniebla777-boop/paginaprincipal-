import { DateTime } from "luxon";

/** Formateadores de fecha y hora en la zona y el idioma del negocio. */
export function fmtDate(d: Date | string, zone: string, locale = "es", opts: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long", year: "numeric" }) {
  const dt = typeof d === "string" ? DateTime.fromISO(d, { zone }) : DateTime.fromJSDate(d, { zone });
  return dt.setLocale(locale).toLocaleString(opts);
}

export function fmtTime(d: Date | string, zone: string, locale = "es") {
  const dt = typeof d === "string" ? DateTime.fromISO(d, { zone }) : DateTime.fromJSDate(d, { zone });
  return dt.setLocale(locale).toLocaleString({ hour: "numeric", minute: "2-digit" });
}

export function fmtDateTime(d: Date | string, zone: string, locale = "es") {
  return `${fmtDate(d, zone, locale, { weekday: "short", day: "numeric", month: "short", year: "numeric" })}, ${fmtTime(d, zone, locale)}`;
}

/** Fecha guardada como @db.Date (medianoche UTC) → texto, sin desplazamiento de zona. */
export function fmtDbDate(d: Date, locale = "es", opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  return DateTime.fromISO(d.toISOString().slice(0, 10), { zone: "UTC" }).setLocale(locale).toLocaleString(opts);
}

export function todayISO(zone: string) {
  return DateTime.now().setZone(zone).toISODate()!;
}
