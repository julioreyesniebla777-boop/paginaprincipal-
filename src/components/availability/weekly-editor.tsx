"use client";

import { useState } from "react";
import { saveWeeklyScheduleAction } from "@/server/actions/availability";
import { useZodAction } from "@/lib/hooks/use-zod-action";
import { WEEKDAYS } from "@/lib/time";
import { Button } from "@/components/ui/button";
import { FormStatus } from "@/components/forms/form-status";

type Block = { weekday: number; start: string; end: string };

export function WeeklyEditor({ employeeId, initial }: { employeeId: string; initial: Block[] }) {
  const [blocks, setBlocks] = useState<Block[]>(initial);
  const { state, formAction, pending } = useZodAction(null, saveWeeklyScheduleAction);

  const update = (idx: number, patch: Partial<Block>) => setBlocks((b) => b.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  const remove = (idx: number) => setBlocks((b) => b.filter((_, i) => i !== idx));
  const add = (weekday: number) => {
    const day = blocks.filter((b) => b.weekday === weekday);
    const last = day[day.length - 1];
    setBlocks((b) => [...b, last ? { weekday, start: last.end, end: last.end < "23:00" ? `${String(Number(last.end.slice(0, 2)) + 1).padStart(2, "0")}:${last.end.slice(3)}` : "24:00" } : { weekday, start: "09:00", end: "17:00" }]);
  };
  const copyToWeekdays = (weekday: number) => {
    const src = blocks.filter((b) => b.weekday === weekday);
    setBlocks((b) => [...b.filter((x) => x.weekday === weekday || x.weekday > 5), ...[1, 2, 3, 4, 5].filter((d) => d !== weekday).flatMap((d) => src.map((s) => ({ ...s, weekday: d })))]);
  };

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="blocks" value={JSON.stringify(blocks)} />
      <div className="divide-y divide-zinc-100">
        {WEEKDAYS.map((d) => {
          const dayBlocks = blocks.map((b, idx) => ({ ...b, idx })).filter((b) => b.weekday === d.value);
          return (
            <div key={d.value} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-start">
              <div className="w-28 shrink-0 pt-2 text-sm font-medium">{d.label}</div>
              <div className="flex flex-1 flex-col gap-2">
                {dayBlocks.length === 0 && <span className="pt-2 text-sm text-zinc-400">Cerrado</span>}
                {dayBlocks.map((b) => (
                  <div key={b.idx} className="flex items-center gap-2">
                    <input type="time" value={b.start} step={300} onChange={(e) => update(b.idx, { start: e.target.value })} className="h-10 rounded-lg border border-zinc-300 px-2 text-sm" aria-label="Inicio" />
                    <span className="text-zinc-400">–</span>
                    <input type="time" value={b.end === "24:00" ? "23:59" : b.end} step={300} onChange={(e) => update(b.idx, { end: e.target.value === "23:59" ? "24:00" : e.target.value })} className="h-10 rounded-lg border border-zinc-300 px-2 text-sm" aria-label="Fin" />
                    <button type="button" onClick={() => remove(b.idx)} className="rounded-lg px-2 py-1 text-sm text-red-600 hover:bg-red-50" aria-label="Quitar bloque">
                      Quitar
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={() => add(d.value)} className="rounded-lg px-2 py-1 text-sm text-brand hover:bg-brand/10">
                  + Bloque
                </button>
                {d.value <= 5 && dayBlocks.length > 0 && (
                  <button type="button" onClick={() => copyToWeekdays(d.value)} className="rounded-lg px-2 py-1 text-sm text-zinc-600 hover:bg-zinc-100" title="Copiar a lunes–viernes">
                    Copiar a L–V
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <FormStatus state={state} />
      <Button type="submit" loading={pending}>
        Guardar horario
      </Button>
    </form>
  );
}
