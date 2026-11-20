/** Ranking con barras horizontales finas y valor directo (una sola serie). */
export function BarList({ items, color, format = (n) => String(n) }: { items: Array<{ id: string; name: string; value: number; sub?: string }>; color: string; format?: (n: number) => string }) {
  const max = Math.max(1, ...items.map((i) => i.value));
  if (!items.length) return <p className="text-sm text-zinc-500">Sin datos en este período.</p>;
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.id} title={`${i.name}: ${format(i.value)}${i.sub ? ` · ${i.sub}` : ""}`}>
          <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate text-zinc-800">{i.name}</span>
            <span className="shrink-0 font-medium tabular-nums text-zinc-900">
              {format(i.value)}
              {i.sub && <span className="ml-1 text-xs font-normal text-zinc-500">{i.sub}</span>}
            </span>
          </div>
          <div className="h-2 rounded-full bg-zinc-100">
            <div className="h-2 rounded-full" style={{ width: `${(i.value / max) * 100}%`, backgroundColor: color, minWidth: i.value > 0 ? 4 : 0 }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
