/** "HH:MM" → minutos desde medianoche. */
export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

/** minutos → "HH:MM" (24:00 se muestra como 24:00). */
export function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export const WEEKDAYS = [
  { value: 1, label: "Lunes", short: "Lun" },
  { value: 2, label: "Martes", short: "Mar" },
  { value: 3, label: "Miércoles", short: "Mié" },
  { value: 4, label: "Jueves", short: "Jue" },
  { value: 5, label: "Viernes", short: "Vie" },
  { value: 6, label: "Sábado", short: "Sáb" },
  { value: 7, label: "Domingo", short: "Dom" },
] as const;

/** Comprueba que los bloques [start,end) no se solapen. */
export function hasOverlap(blocks: Array<{ startMin: number; endMin: number }>): boolean {
  const s = [...blocks].sort((a, b) => a.startMin - b.startMin);
  for (let i = 1; i < s.length; i++) if (s[i]!.startMin < s[i - 1]!.endMin) return true;
  return false;
}
