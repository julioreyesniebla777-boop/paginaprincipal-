"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Slot = { start: string; employees: { employeeId: string; seatsLeft: number }[] };

/** Selector de hora para el personal (ignora anticipación y días máximos). */
export function StaffSlotPicker({
  serviceId,
  employeeId,
  date,
  timezone,
  locale,
  excludeAppointmentId,
  value,
  onChange,
}: {
  serviceId: string;
  employeeId: string;
  date: string;
  timezone: string;
  locale: string;
  excludeAppointmentId?: string;
  value: string | null;
  onChange: (iso: string) => void;
}) {
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!serviceId || !employeeId || !date) return;
    let cancelled = false;
    setSlots(null);
    setError(null);
    const p = new URLSearchParams({ serviceId, employeeId, date });
    if (excludeAppointmentId) p.set("excludeAppointmentId", excludeAppointmentId);
    fetch(`/api/panel/slots?${p}`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error("No se pudieron cargar las horas");
        const data = (await r.json()) as { days: { slots: Slot[] }[] };
        if (!cancelled) setSlots(data.days[0]?.slots ?? []);
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [serviceId, employeeId, date, excludeAppointmentId]);

  if (!serviceId || !employeeId || !date) return <p className="text-sm text-zinc-500">Elige servicio, profesional y fecha.</p>;
  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!slots) return <p className="text-sm text-zinc-500">Cargando horas…</p>;
  if (!slots.length) return <p className="text-sm text-zinc-500">Sin horas libres ese día (revisa el horario y los bloqueos).</p>;

  const fmt = new Intl.DateTimeFormat(locale, { timeZone: timezone, hour: "numeric", minute: "2-digit" });
  return (
    <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
      {slots.map((s) => (
        <button
          key={s.start}
          type="button"
          onClick={() => onChange(s.start)}
          className={cn(
            "h-10 rounded-lg border text-sm",
            value === s.start ? "border-brand bg-brand text-white" : "border-zinc-200 hover:border-brand",
          )}
        >
          {fmt.format(new Date(s.start))}
        </button>
      ))}
    </div>
  );
}
