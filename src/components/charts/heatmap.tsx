"use client";

import { useRef, useState } from "react";
import { SEQ_RAMP } from "./chart-styles";
import { ChartTooltip, type Tip } from "./tooltip";

const DAYS = ["", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/** Mapa de calor día × hora con rampa secuencial de un solo tono. */
export function Heatmap({ heat }: { heat: number[][] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip>(null);
  const hours = [...Array(24).keys()].filter((h) => [1, 2, 3, 4, 5, 6, 7].some((d) => heat[d]![h]! > 0));
  if (!hours.length) return <p className="text-sm text-zinc-500">Sin datos en este período.</p>;
  const from = Math.min(...hours);
  const to = Math.max(...hours);
  const range = [...Array(to - from + 1).keys()].map((i) => from + i);
  const max = Math.max(1, ...[1, 2, 3, 4, 5, 6, 7].flatMap((d) => heat[d]!));
  const color = (v: number) => (v === 0 ? "#f4f4f5" : SEQ_RAMP[Math.min(SEQ_RAMP.length - 1, Math.floor((v / max) * (SEQ_RAMP.length - 1e-9)))]);

  return (
    <div className="space-y-2">
      <div ref={ref} className="relative overflow-x-auto" onMouseLeave={() => setTip(null)}>
        <table className="border-separate" style={{ borderSpacing: 2 }} aria-label="Citas por día de la semana y hora">
          <thead>
            <tr>
              <th />
              {range.map((h) => (
                <th key={h} className="w-8 text-center text-[10px] font-normal text-zinc-500">
                  {h}h
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[1, 2, 3, 4, 5, 6, 7].map((d) => (
              <tr key={d}>
                <th className="pr-2 text-right text-xs font-normal text-zinc-500">{DAYS[d]}</th>
                {range.map((h) => {
                  const v = heat[d]![h]!;
                  return (
                    <td
                      key={h}
                      className="h-7 w-8 rounded"
                      style={{ backgroundColor: color(v) }}
                      aria-label={`${DAYS[d]} ${h}:00 — ${v} citas`}
                      onMouseMove={(e) => {
                        const box = ref.current!.getBoundingClientRect();
                        setTip({ x: e.clientX - box.left + ref.current!.scrollLeft, y: e.clientY - box.top, title: `${DAYS[d]} · ${h}:00–${h + 1}:00`, lines: [{ label: "Citas", value: String(v) }] });
                      }}
                    />
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <ChartTooltip tip={tip} />
      </div>
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        Menos
        {SEQ_RAMP.map((c) => (
          <span key={c} className="h-3 w-5 rounded-sm" style={{ backgroundColor: c }} />
        ))}
        Más (máx. {max})
      </div>
    </div>
  );
}
