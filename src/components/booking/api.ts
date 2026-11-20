"use client";

export type SlotEmployee = { employeeId: string; seatsLeft: number };
export type Slot = { start: string; end: string; employees: SlotEmployee[] };

type Query = { serviceId?: string; employeeId?: string; token?: string; from: string; to: string };

function qs(q: Query, mode: "dates" | "slots") {
  const p = new URLSearchParams({ from: q.from, to: q.to, mode });
  if (q.serviceId) p.set("serviceId", q.serviceId);
  if (q.employeeId && q.employeeId !== "any") p.set("employeeId", q.employeeId);
  if (q.token) p.set("token", q.token);
  return p.toString();
}

export async function fetchAvailableDates(q: Query): Promise<string[]> {
  const res = await fetch(`/api/public/slots?${qs(q, "dates")}`, { cache: "no-store" });
  if (!res.ok) throw new Error(res.status === 429 ? "Demasiadas solicitudes, espera un momento." : "No se pudo cargar la disponibilidad");
  return (await res.json()).dates as string[];
}

export async function fetchSlots(q: Query): Promise<Slot[]> {
  const res = await fetch(`/api/public/slots?${qs(q, "slots")}`, { cache: "no-store" });
  if (!res.ok) throw new Error(res.status === 429 ? "Demasiadas solicitudes, espera un momento." : "No se pudieron cargar los horarios");
  const data = (await res.json()) as { days: { date: string; slots: Slot[] }[] };
  return data.days[0]?.slots ?? [];
}
