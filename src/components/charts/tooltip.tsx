"use client";

export type Tip = { x: number; y: number; title: string; lines: Array<{ label: string; value: string; color?: string }> } | null;

/** Tooltip posicionado sobre el contenedor relativo del gráfico. */
export function ChartTooltip({ tip }: { tip: Tip }) {
  if (!tip) return null;
  return (
    <div
      className="pointer-events-none absolute z-10 min-w-36 -translate-x-1/2 -translate-y-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-lg"
      style={{ left: tip.x, top: tip.y - 8 }}
      role="status"
    >
      <p className="mb-1 font-semibold text-zinc-900">{tip.title}</p>
      {tip.lines.map((l) => (
        <p key={l.label} className="flex items-center justify-between gap-3 text-zinc-600">
          <span className="flex items-center gap-1.5">
            {l.color && <span className="inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: l.color }} />}
            {l.label}
          </span>
          <span className="font-medium tabular-nums text-zinc-900">{l.value}</span>
        </p>
      ))}
    </div>
  );
}
