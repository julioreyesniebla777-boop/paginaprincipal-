"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { Slot } from "./api";

type Props = {
  timezone: string;
  locale: string;
  date: string;
  selected: string | null;
  onSelect: (slot: Slot) => void;
  loadSlots: (date: string) => Promise<Slot[]>;
  showSeats?: boolean;
};

export function TimeSlots({ timezone, locale, date, selected, onSelect, loadSlots, showSeats }: Props) {
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSlots(null);
    setError(null);
    loadSlots(date)
      .then((s) => !cancelled && setSlots(s))
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [date, loadSlots]);

  const fmt = new Intl.DateTimeFormat(locale, { timeZone: timezone, hour: "numeric", minute: "2-digit" });
  const hourOf = (iso: string) => Number(new Intl.DateTimeFormat("en-GB", { timeZone: timezone, hour: "2-digit", hourCycle: "h23" }).format(new Date(iso)));

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!slots)
    return (
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-11 animate-pulse rounded-lg bg-zinc-100" />
        ))}
      </div>
    );
  if (!slots.length) return <p className="text-sm text-zinc-500">No quedan horas libres este día. Elige otra fecha.</p>;

  const groups = [
    { label: "Mañana", items: slots.filter((s) => hourOf(s.start) < 12) },
    { label: "Tarde", items: slots.filter((s) => hourOf(s.start) >= 12 && hourOf(s.start) < 18) },
    { label: "Noche", items: slots.filter((s) => hourOf(s.start) >= 18) },
  ].filter((g) => g.items.length);

  return (
    <div className="space-y-4">
      {groups.map((g) => (
        <div key={g.label}>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">{g.label}</p>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {g.items.map((s) => {
              const seats = Math.max(...s.employees.map((e) => e.seatsLeft));
              return (
                <button
                  key={s.start}
                  type="button"
                  onClick={() => onSelect(s)}
                  aria-pressed={selected === s.start}
                  className={cn(
                    "flex h-11 flex-col items-center justify-center rounded-lg border text-sm font-medium transition-colors",
                    selected === s.start ? "border-brand bg-brand text-white" : "border-zinc-200 bg-white hover:border-brand hover:text-brand",
                  )}
                >
                  {fmt.format(new Date(s.start))}
                  {showSeats && <span className="text-[10px] font-normal opacity-80">{seats} {seats === 1 ? "plaza" : "plazas"}</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
