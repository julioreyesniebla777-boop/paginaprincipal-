import type { ScheduleException } from "@prisma/client";
import { deleteExceptionAction } from "@/server/actions/availability";
import { fmtDbDate } from "@/lib/format";
import { minutesToTime } from "@/lib/time";
import { Badge } from "@/components/ui/card";
import { EXCEPTION_LABELS } from "@/lib/labels";

export function ExceptionList({ items, locale }: { items: ScheduleException[]; locale: string }) {
  if (!items.length) return <p className="text-sm text-zinc-500">No hay excepciones próximas.</p>;
  return (
    <ul className="divide-y divide-zinc-100">
      {items.map((e) => (
        <li key={e.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
          <Badge color={e.type === "CUSTOM_HOURS" ? "#2563eb" : "#dc2626"}>{EXCEPTION_LABELS[e.type]}</Badge>
          <span className="font-medium">
            {fmtDbDate(e.startDate, locale)}
            {e.endDate.getTime() !== e.startDate.getTime() && ` → ${fmtDbDate(e.endDate, locale)}`}
          </span>
          {e.type === "CUSTOM_HOURS" && e.startMin != null && e.endMin != null && (
            <span className="text-zinc-600">
              {minutesToTime(e.startMin)}–{minutesToTime(e.endMin)}
            </span>
          )}
          {e.label && <span className="text-zinc-500">· {e.label}</span>}
          <form action={deleteExceptionAction} className="ml-auto">
            <input type="hidden" name="id" value={e.id} />
            <button className="rounded px-2 py-1 text-red-600 hover:bg-red-50">Eliminar</button>
          </form>
        </li>
      ))}
    </ul>
  );
}
