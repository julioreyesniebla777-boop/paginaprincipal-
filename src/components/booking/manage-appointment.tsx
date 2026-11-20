"use client";

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DateTime } from "luxon";
import { cancelByTokenAction, rescheduleByTokenAction } from "@/server/actions/booking";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/card";
import { CalendarPicker } from "./calendar-picker";
import { TimeSlots } from "./time-slots";
import { fetchAvailableDates, fetchSlots, type Slot } from "./api";

type Props = {
  token: string;
  canChange: boolean;
  timezone: string;
  locale: string;
  maxDaysAhead: number;
};

export function ManageAppointment({ token, canChange, timezone, locale, maxDaysAhead }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"idle" | "reschedule" | "cancel">("idle");
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [reason, setReason] = useState("");
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const loadDates = useCallback((from: string, to: string) => fetchAvailableDates({ token, from, to }), [token]);
  const loadSlots = useCallback((d: string) => fetchSlots({ token, from: d, to: d }), [token]);

  if (!canChange) return null;

  const doCancel = () =>
    start(async () => {
      const r = await cancelByTokenAction(token, { reason: reason || undefined });
      if (r.ok) {
        setMsg({ kind: "success", text: "Tu cita fue cancelada." });
        setMode("idle");
        router.refresh();
      } else setMsg({ kind: "error", text: r.error ?? "Error" });
    });

  const doReschedule = () =>
    start(async () => {
      if (!slot) return;
      const r = await rescheduleByTokenAction(token, { start: slot.start });
      if (r.ok) {
        setMsg({ kind: "success", text: "¡Listo! Tu cita fue reprogramada. Te enviamos la confirmación por email." });
        setMode("idle");
        setSlot(null);
        setDate(null);
        router.refresh();
      } else setMsg({ kind: "error", text: r.error ?? "Error" });
    });

  return (
    <div className="space-y-4">
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
      {mode === "idle" && (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button onClick={() => { setMode("reschedule"); setMsg(null); }} className="flex-1">
            Reprogramar
          </Button>
          <Button variant="outline" onClick={() => { setMode("cancel"); setMsg(null); }} className="flex-1 text-red-600">
            Cancelar cita
          </Button>
        </div>
      )}

      {mode === "cancel" && (
        <div className="space-y-3 rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="font-medium text-red-800">¿Seguro que quieres cancelar tu cita?</p>
          <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Motivo (opcional)" rows={2} maxLength={300} />
          <div className="flex gap-2">
            <Button variant="danger" loading={pending} onClick={doCancel}>
              Sí, cancelar
            </Button>
            <Button variant="ghost" onClick={() => setMode("idle")}>
              Volver
            </Button>
          </div>
        </div>
      )}

      {mode === "reschedule" && (
        <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4">
          <p className="font-medium">Elige un nuevo día y hora</p>
          <CalendarPicker timezone={timezone} locale={locale} maxDaysAhead={maxDaysAhead} selected={date} loadDates={loadDates} onSelect={(d) => { setDate(d); setSlot(null); }} />
          {date && <TimeSlots timezone={timezone} locale={locale} date={date} selected={slot?.start ?? null} loadSlots={loadSlots} onSelect={setSlot} />}
          {slot && (
            <Alert kind="info">
              Nueva hora: <strong className="first-letter:uppercase">{DateTime.fromISO(slot.start, { zone: timezone }).setLocale(locale).toFormat("cccc d 'de' LLLL, t")}</strong>
            </Alert>
          )}
          <div className="flex gap-2">
            <Button disabled={!slot} loading={pending} onClick={doReschedule}>
              Confirmar cambio
            </Button>
            <Button variant="ghost" onClick={() => setMode("idle")}>
              Volver
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
