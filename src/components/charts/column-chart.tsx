"use client";

import { useEffect, useRef, useState } from "react";
import { AXIS_TEXT, GRID } from "./chart-styles";
import { ChartTooltip, type Tip } from "./tooltip";

export type Series = { key: string; label: string; color: string };
export type Datum = { label: string; values: Record<string, number> };

function niceMax(v: number) {
  if (v <= 5) return 5;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * pow;
}

/**
 * Columnas verticales (una serie o apiladas). Un solo eje Y, rejilla tenue,
 * extremos redondeados de 4px, separación de 2px entre segmentos apilados,
 * tooltip por columna. Leyenda solo con ≥ 2 series.
 */
export function ColumnChart({
  data,
  series,
  format = (n) => String(n),
  height = 220,
  ariaLabel,
}: {
  data: Datum[];
  series: Series[];
  format?: (n: number) => string;
  height?: number;
  ariaLabel: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [width, setWidth] = useState(640);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e!.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  // Se dibuja al ancho real (texto a tamaño legible); con muchas columnas, desplazamiento horizontal.
  const W = Math.max(width, data.length * 14 + 52);
  const H = height;
  const pad = { l: 44, r: 8, t: 8, b: 28 };
  const innerW = W - pad.l - pad.r;
  const innerH = H - pad.t - pad.b;
  const totals = data.map((d) => series.reduce((s, x) => s + (d.values[x.key] ?? 0), 0));
  const max = niceMax(Math.max(0, ...totals));
  const step = innerW / Math.max(1, data.length);
  const barW = Math.max(4, Math.min(36, step * 0.6));
  const y = (v: number) => pad.t + innerH - (v / max) * innerH;
  const ticks = [0, 0.2, 0.4, 0.6, 0.8, 1].map((f) => f * max);
  const labelEvery = Math.ceil(data.length / Math.floor(innerW / 56));

  return (
    <div className="space-y-2">
      {series.length > 1 && (
        <div className="flex flex-wrap gap-4 text-xs text-zinc-600">
          {series.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
              {s.label}
            </span>
          ))}
        </div>
      )}
      <div ref={ref} className="relative overflow-x-auto" onMouseLeave={() => {
        setTip(null);
        setHover(null);
      }}>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block" role="img" aria-label={ariaLabel}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={W - pad.r} y1={y(t)} y2={y(t)} stroke={GRID} strokeWidth={1} />
              <text x={pad.l - 6} y={y(t)} textAnchor="end" dominantBaseline="middle" fontSize={11} fill={AXIS_TEXT}>
                {format(t)}
              </text>
            </g>
          ))}
          {data.map((d, i) => {
            const cx = pad.l + step * i + step / 2;
            let acc = 0;
            const segs = series.map((s, si) => {
              const v = d.values[s.key] ?? 0;
              const y0 = y(acc);
              acc += v;
              const y1 = y(acc);
              const isTop = series.slice(si + 1).every((x) => !(d.values[x.key] ?? 0));
              const h = Math.max(0, y0 - y1 - (si > 0 && v > 0 ? 2 : 0)); // 2px de separación
              if (v <= 0 || h <= 0) return null;
              const r = isTop ? Math.min(4, barW / 2, h) : 0;
              const x = cx - barW / 2;
              const top = y1;
              const path = `M${x},${top + h} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${top + h} Z`;
              return <path key={s.key} d={path} fill={s.color} opacity={hover === null || hover === i ? 1 : 0.55} />;
            });
            return (
              <g key={d.label + i}>
                {segs}
                {i % labelEvery === 0 && (
                  <text x={cx} y={H - 10} textAnchor="middle" fontSize={11} fill={AXIS_TEXT}>
                    {d.label}
                  </text>
                )}
                {/* zona de hover más grande que la marca */}
                <rect
                  x={cx - step / 2}
                  y={pad.t}
                  width={step}
                  height={innerH}
                  fill="transparent"
                  onMouseMove={(e) => {
                    const box = ref.current!.getBoundingClientRect();
                    setHover(i);
                    setTip({
                      x: e.clientX - box.left + ref.current!.scrollLeft,
                      y: e.clientY - box.top,
                      title: d.label,
                      lines: [
                        ...series.map((s) => ({ label: s.label, value: format(d.values[s.key] ?? 0), color: s.color })),
                        ...(series.length > 1 ? [{ label: "Total", value: format(totals[i]!) }] : []),
                      ],
                    });
                  }}
                />
              </g>
            );
          })}
          <line x1={pad.l} x2={W - pad.r} y1={y(0)} y2={y(0)} stroke="#a1a1aa" strokeWidth={1} />
        </svg>
        <ChartTooltip tip={tip} />
      </div>
    </div>
  );
}
