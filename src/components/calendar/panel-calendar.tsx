"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import luxonPlugin from "@fullcalendar/luxon3";
import esLocale from "@fullcalendar/core/locales/es";
import type { DateSelectArg, EventClickArg, EventDropArg, EventSourceFuncArg, EventInput } from "@fullcalendar/core";
import { DateTime } from "luxon";
import { reschedulePanelAction } from "@/server/actions/appointments";
import { createTimeBlockRange, deleteTimeBlockById } from "@/server/actions/availability";
import { Button } from "@/components/ui/button";
import { Select, Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/card";

type Option = { id: string; name: string };

export function PanelCalendar({
  timezone,
  locale,
  employees,
  services,
  fixedEmployeeId,
}: {
  timezone: string;
  locale: string;
  employees: Option[];
  services: Option[];
  /** Para el rol EMPLOYEE: solo su agenda. */
  fixedEmployeeId: string | null;
}) {
  const router = useRouter();
  const ref = useRef<FullCalendar>(null);
  const [employeeId, setEmployeeId] = useState(fixedEmployeeId ?? "");
  const [serviceId, setServiceId] = useState("");
  const [showCancelled, setShowCancelled] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [selection, setSelection] = useState<{ start: Date; end: Date } | null>(null);
  const [blockReason, setBlockReason] = useState("");
  const [blockEmployee, setBlockEmployee] = useState(fixedEmployeeId ?? "");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const apply = () => setIsMobile(mq.matches);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    ref.current?.getApi().changeView(isMobile ? "listWeek" : "timeGridWeek");
  }, [isMobile]);

  useEffect(() => {
    ref.current?.getApi().refetchEvents();
  }, [employeeId, serviceId, showCancelled]);

  const fetchEvents = useCallback(
    async (info: EventSourceFuncArg): Promise<EventInput[]> => {
      const p = new URLSearchParams({ start: info.start.toISOString(), end: info.end.toISOString() });
      if (employeeId) p.set("employeeId", employeeId);
      if (serviceId) p.set("serviceId", serviceId);
      if (showCancelled) p.set("showCancelled", "1");
      const res = await fetch(`/api/panel/events?${p}`, { cache: "no-store" });
      if (!res.ok) throw new Error("No se pudieron cargar las citas");
      return res.json();
    },
    [employeeId, serviceId, showCancelled],
  );

  async function onMove(arg: EventDropArg) {
    const ev = arg.event;
    if (ev.extendedProps.kind !== "appointment" || !ev.start) return arg.revert();
    const when = DateTime.fromJSDate(ev.start, { zone: timezone }).setLocale(locale).toFormat("cccc d LLL, t");
    if (!confirm(`¿Mover la cita de ${ev.title} al ${when}? Se avisará al cliente por email.`)) return arg.revert();
    const res = await reschedulePanelAction({ appointmentId: ev.id, start: ev.start.toISOString(), notify: true });
    if (!res.ok) {
      arg.revert();
      setMsg({ kind: "error", text: res.error ?? "No se pudo mover la cita" });
    } else setMsg({ kind: "success", text: "Cita reprogramada" });
  }

  async function onEventClick(arg: EventClickArg) {
    arg.jsEvent.preventDefault();
    const props = arg.event.extendedProps;
    if (props.kind === "appointment") router.push(`/panel/citas/${arg.event.id}`);
    else if (props.kind === "block" && confirm("¿Eliminar este bloqueo?")) {
      const r = await deleteTimeBlockById(props.blockId as string);
      if (r.ok) arg.event.remove();
      else setMsg({ kind: "error", text: r.error ?? "Error" });
    }
  }

  function onSelect(arg: DateSelectArg) {
    setSelection({ start: arg.start, end: arg.end });
    setBlockEmployee(employeeId || fixedEmployeeId || "");
  }

  async function createBlock() {
    if (!selection || !blockEmployee) return;
    const r = await createTimeBlockRange({
      employeeId: blockEmployee,
      startsAt: selection.start.toISOString(),
      endsAt: selection.end.toISOString(),
      reason: blockReason || undefined,
    });
    if (r.ok) {
      setSelection(null);
      setBlockReason("");
      ref.current?.getApi().refetchEvents();
      setMsg({ kind: "success", text: "Tiempo bloqueado" });
    } else setMsg({ kind: "error", text: r.error ?? "Error" });
  }

  const newAppointmentHref = (start: Date) => {
    const p = new URLSearchParams({ start: start.toISOString() });
    if (employeeId || fixedEmployeeId) p.set("employeeId", employeeId || fixedEmployeeId!);
    return `/panel/citas/nueva?${p}`;
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-2">
        {!fixedEmployeeId && (
          <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="w-full sm:w-48" aria-label="Filtrar por profesional">
            <option value="">Todos los profesionales</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </Select>
        )}
        <Select value={serviceId} onChange={(e) => setServiceId(e.target.value)} className="w-full sm:w-48" aria-label="Filtrar por servicio">
          <option value="">Todos los servicios</option>
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
        <label className="flex h-10 items-center gap-2 text-sm text-zinc-600">
          <input type="checkbox" checked={showCancelled} onChange={(e) => setShowCancelled(e.target.checked)} /> Ver canceladas
        </label>
      </div>

      {msg && (
        <Alert kind={msg.kind} className="flex items-center justify-between">
          {msg.text}
          <button onClick={() => setMsg(null)} aria-label="Cerrar">
            ×
          </button>
        </Alert>
      )}

      {selection && (
        <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
          <p className="mb-2 text-sm font-medium">
            {DateTime.fromJSDate(selection.start, { zone: timezone }).setLocale(locale).toFormat("cccc d LLL, t")} –{" "}
            {DateTime.fromJSDate(selection.end, { zone: timezone }).setLocale(locale).toFormat("t")}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => router.push(newAppointmentHref(selection.start))}>
              + Nueva cita aquí
            </Button>
            <span className="text-sm text-zinc-400">o bloquear:</span>
            {!fixedEmployeeId && (
              <Select value={blockEmployee} onChange={(e) => setBlockEmployee(e.target.value)} className="!h-8 w-40 text-sm">
                <option value="">Profesional…</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </Select>
            )}
            <Input value={blockReason} onChange={(e) => setBlockReason(e.target.value)} placeholder="Motivo" className="!h-8 w-36 text-sm" maxLength={120} />
            <Button size="sm" variant="secondary" disabled={!blockEmployee} onClick={createBlock}>
              Bloquear
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelection(null)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <div className="panel-calendar rounded-xl border border-zinc-200 bg-white p-2 sm:p-4">
        <FullCalendar
          ref={ref}
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin, luxonPlugin]}
          locale={esLocale}
          timeZone={timezone}
          initialView="timeGridWeek"
          headerToolbar={{ left: "prev,next today", center: "title", right: "timeGridDay,timeGridWeek,dayGridMonth,listWeek" }}
          buttonText={{ today: "Hoy", day: "Día", week: "Semana", month: "Mes", list: "Lista" }}
          height="auto"
          slotMinTime="07:00:00"
          slotMaxTime="21:00:00"
          slotDuration="00:15:00"
          slotLabelInterval="01:00"
          allDaySlot={false}
          nowIndicator
          firstDay={1}
          editable
          eventDurationEditable={false}
          selectable
          selectMirror
          events={fetchEvents}
          eventDrop={onMove}
          eventClick={onEventClick}
          select={onSelect}
          dayMaxEvents={4}
          eventTimeFormat={{ hour: "numeric", minute: "2-digit", meridiem: "short" }}
          eventDidMount={(info) => {
            const p = info.event.extendedProps;
            if (p.kind === "appointment") info.el.title = `${info.event.title}\n${p.employee} · ${p.statusLabel}`;
          }}
        />
      </div>
      <p className="text-xs text-zinc-500">
        Consejo: arrastra una cita para reprogramarla; selecciona un rango vacío para crear una cita o bloquear tiempo. Horario en {timezone}.
      </p>
    </div>
  );
}
