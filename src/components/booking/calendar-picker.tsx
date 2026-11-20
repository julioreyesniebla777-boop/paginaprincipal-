"use client";

import { useEffect, useMemo, useState } from "react";
import { DateTime } from "luxon";
import { cn } from "@/lib/utils";

type Props = {
  timezone: string;
  locale: string;
  maxDaysAhead: number;
  selected: string | null;
  onSelect: (date: string) => void;
  /** Devuelve las fechas con disponibilidad en el rango. */
  loadDates: (from: string, to: string) => Promise<string[]>;
};

/** Calendario mensual que solo habilita los días con disponibilidad. */
export function CalendarPicker({ timezone, locale, maxDaysAhead, selected, onSelect, loadDates }: Props) {
  const today = useMemo(() => DateTime.now().setZone(timezone).startOf("day"), [timezone]);
  const lastDay = today.plus({ days: maxDaysAhead });
  const [month, setMonth] = useState(() => (selected ? DateTime.fromISO(selected, { zone: timezone }) : today).startOf("month"));
  const [available, setAvailable] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoAdvanced, setAutoAdvanced] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const from = DateTime.max(month, today).toISODate()!;
    const to = DateTime.min(month.endOf("month"), lastDay).toISODate()!;
    setLoading(true);
    setError(null);
    if (from > to) {
      setAvailable(new Set());
      setLoading(false);
      return;
    }
    loadDates(from, to)
      .then((dates) => {
        if (cancelled) return;
        setAvailable(new Set(dates));
        // Si el mes actual no tiene huecos, avanza automáticamente una vez.
        if (!dates.length && !autoAdvanced && !selected && month.plus({ months: 1 }) <= lastDay.startOf("month")) {
          setAutoAdvanced(true);
          setMonth((m) => m.plus({ months: 1 }));
        }
      })
      .catch((e: Error) => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month.toISODate(), loadDates]);

  const weeks = useMemo(() => {
    const start = month.startOf("week"); // lunes
    const end = month.endOf("month").endOf("week");
    const days: DateTime[] = [];
    for (let d = start; d <= end; d = d.plus({ days: 1 })) days.push(d);
    return days;
  }, [month]);

  const canPrev = month > today.startOf("month");
  const canNext = month.plus({ months: 1 }) <= lastDay.startOf("month");
  const weekdayNames = Array.from({ length: 7 }, (_, i) => today.startOf("week").plus({ days: i }).setLocale(locale).toFormat("ccc"));

  return (
    <div className="select-none">
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={() => setMonth((m) => m.minus({ months: 1 }))} disabled={!canPrev} className="rounded-lg p-2 hover:bg-zinc-100 disabled:opacity-30" aria-label="Mes anterior">
          ‹
        </button>
        <span className="font-semibold first-letter:uppercase">{month.setLocale(locale).toFormat("LLLL yyyy")}</span>
        <button type="button" onClick={() => setMonth((m) => m.plus({ months: 1 }))} disabled={!canNext} className="rounded-lg p-2 hover:bg-zinc-100 disabled:opacity-30" aria-label="Mes siguiente">
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium uppercase text-zinc-400">
        {weekdayNames.map((n) => (
          <div key={n} className="py-1">
            {n}
          </div>
        ))}
      </div>
      <div className={cn("grid grid-cols-7 gap-1", loading && "animate-pulse")} role="grid">
        {weeks.map((d) => {
          const iso = d.toISODate()!;
          const inMonth = d.month === month.month;
          const isAvailable = inMonth && available.has(iso);
          const isSelected = selected === iso;
          return (
            <button
              key={iso}
              type="button"
              disabled={!isAvailable}
              onClick={() => onSelect(iso)}
              aria-pressed={isSelected}
              aria-label={d.setLocale(locale).toLocaleString(DateTime.DATE_FULL)}
              className={cn(
                "aspect-square rounded-lg text-sm transition-colors",
                !inMonth && "invisible",
                isAvailable ? "bg-brand/10 font-semibold text-brand hover:bg-brand/20" : "text-zinc-300",
                isSelected && "!bg-brand !text-white",
                d.hasSame(today, "day") && !isSelected && "ring-1 ring-zinc-300",
              )}
            >
              {d.day}
            </button>
          );
        })}
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {!loading && !error && available.size === 0 && <p className="mt-3 text-center text-sm text-zinc-500">No hay disponibilidad este mes. Prueba el siguiente.</p>}
    </div>
  );
}
