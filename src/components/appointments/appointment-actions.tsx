"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { AppointmentStatus } from "@prisma/client";
import { changeStatusAction, reschedulePanelAction, resendConfirmationAction, updateInternalNotesAction } from "@/server/actions/appointments";
import { STATUS_LABELS } from "@/lib/labels";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/card";
import { StaffSlotPicker } from "./staff-slot-picker";

const TRANSITIONS: Record<AppointmentStatus, AppointmentStatus[]> = {
  PENDING: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["COMPLETED", "NO_SHOW", "CANCELLED", "PENDING"],
  COMPLETED: ["CONFIRMED", "NO_SHOW"],
  NO_SHOW: ["COMPLETED", "CONFIRMED"],
  CANCELLED: ["CONFIRMED", "PENDING"],
};
const VERB: Record<AppointmentStatus, string> = {
  PENDING: "Marcar pendiente",
  CONFIRMED: "Confirmar",
  COMPLETED: "Marcar completada",
  NO_SHOW: "No asistió",
  CANCELLED: "Cancelar cita",
};

type Props = {
  id: string;
  status: AppointmentStatus;
  serviceId: string;
  employeeId: string;
  date: string;
  internalNotes: string;
  timezone: string;
  locale: string;
  employees: { id: string; name: string }[] | null;
};

export function AppointmentActions(p: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [notify, setNotify] = useState(true);
  const [showMove, setShowMove] = useState(false);
  const [moveEmployee, setMoveEmployee] = useState(p.employeeId);
  const [moveDate, setMoveDate] = useState(p.date);
  const [moveStart, setMoveStart] = useState<string | null>(null);
  const [notes, setNotes] = useState(p.internalNotes);

  const run = (fn: () => Promise<{ ok?: boolean; error?: string; message?: string }>) =>
    start(async () => {
      const r = await fn();
      setMsg(r.ok ? { kind: "success", text: r.message ?? "Hecho" } : { kind: "error", text: r.error ?? "Error" });
      if (r.ok) router.refresh();
    });

  return (
    <div className="space-y-5">
      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}

      <div>
        <p className="mb-2 text-sm font-medium text-zinc-700">Cambiar estado</p>
        <div className="flex flex-wrap gap-2">
          {TRANSITIONS[p.status].map((s) => (
            <Button
              key={s}
              size="sm"
              variant={s === "CANCELLED" || s === "NO_SHOW" ? "outline" : s === "CONFIRMED" || s === "COMPLETED" ? "primary" : "secondary"}
              className={s === "CANCELLED" ? "text-red-600" : ""}
              disabled={pending}
              onClick={() => {
                if (s === "CANCELLED" && !confirm("¿Cancelar esta cita?")) return;
                run(() => changeStatusAction({ appointmentId: p.id, status: s, notify }));
              }}
            >
              {VERB[s]}
            </Button>
          ))}
        </div>
        <Checkbox className="mt-2" checked={notify} onChange={(e) => setNotify(e.target.checked)} label="Avisar al cliente por email" />
        <p className="mt-1 text-xs text-zinc-500">Estado actual: {STATUS_LABELS[p.status]}</p>
      </div>

      {(p.status === "PENDING" || p.status === "CONFIRMED") && (
        <div>
          {!showMove ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => setShowMove(true)}>
                Reprogramar
              </Button>
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => resendConfirmationAction(p.id))}>
                Reenviar confirmación
              </Button>
            </div>
          ) : (
            <div className="space-y-3 rounded-lg border border-zinc-200 p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                {p.employees && (
                  <Field label="Profesional" htmlFor="mv-emp">
                    <Select id="mv-emp" value={moveEmployee} onChange={(e) => { setMoveEmployee(e.target.value); setMoveStart(null); }}>
                      {p.employees.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )}
                <Field label="Fecha" htmlFor="mv-date">
                  <Input id="mv-date" type="date" value={moveDate} onChange={(e) => { setMoveDate(e.target.value); setMoveStart(null); }} />
                </Field>
              </div>
              <StaffSlotPicker serviceId={p.serviceId} employeeId={moveEmployee} date={moveDate} timezone={p.timezone} locale={p.locale} excludeAppointmentId={p.id} value={moveStart} onChange={setMoveStart} />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={!moveStart}
                  loading={pending}
                  onClick={() =>
                    run(async () => {
                      const r = await reschedulePanelAction({ appointmentId: p.id, start: moveStart!, employeeId: moveEmployee, notify });
                      if (r.ok) setShowMove(false);
                      return r;
                    })
                  }
                >
                  Guardar nueva hora
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setShowMove(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <div>
        <Field label="Notas internas (no las ve el cliente)" htmlFor="notes">
          <Textarea id="notes" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
        </Field>
        <Button size="sm" variant="secondary" className="mt-2" disabled={pending || notes === p.internalNotes} onClick={() => run(() => updateInternalNotesAction(p.id, notes))}>
          Guardar notas
        </Button>
      </div>
    </div>
  );
}
