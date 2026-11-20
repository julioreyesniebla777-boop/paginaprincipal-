"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createPanelAppointmentAction } from "@/server/actions/appointments";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { Alert, Card, CardBody, CardHeader } from "@/components/ui/card";
import { StaffSlotPicker } from "./staff-slot-picker";

type Service = { id: string; name: string; durationMin: number; employeeIds: string[] };
type Employee = { id: string; name: string };
type CustomerHit = { id: string; name: string; email: string | null; phone: string | null; isBlocked: boolean };

export function NewAppointmentForm({
  services,
  employees,
  timezone,
  locale,
  initial,
  fixedEmployeeId,
}: {
  services: Service[];
  employees: Employee[];
  timezone: string;
  locale: string;
  initial: { date: string; start?: string; employeeId?: string; customer?: CustomerHit };
  fixedEmployeeId: string | null;
}) {
  const router = useRouter();
  const [serviceId, setServiceId] = useState("");
  const [employeeId, setEmployeeId] = useState(fixedEmployeeId ?? initial.employeeId ?? "");
  const [date, setDate] = useState(initial.date);
  const [start, setStart] = useState<string | null>(initial.start ?? null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<CustomerHit[]>([]);
  const [customer, setCustomer] = useState<CustomerHit | null>(initial.customer ?? null);
  const [isNew, setIsNew] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[] | undefined>>({});
  const [pending, startTransition] = useTransition();

  const service = services.find((s) => s.id === serviceId);
  const availableEmployees = useMemo(
    () => employees.filter((e) => !service || service.employeeIds.includes(e.id)).filter((e) => !fixedEmployeeId || e.id === fixedEmployeeId),
    [employees, service, fixedEmployeeId],
  );

  useEffect(() => {
    if (query.trim().length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(async () => {
      const r = await fetch(`/api/panel/customers?q=${encodeURIComponent(query)}`);
      if (r.ok) setHits(await r.json());
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setError(null);
    startTransition(async () => {
      const res = await createPanelAppointmentAction({
        serviceId,
        employeeId,
        start: start ?? "",
        customerId: isNew ? undefined : customer?.id,
        newName: isNew ? String(fd.get("newName") ?? "") : undefined,
        newEmail: isNew ? String(fd.get("newEmail") ?? "") : undefined,
        newPhone: isNew ? String(fd.get("newPhone") ?? "") : undefined,
        notes: String(fd.get("notes") ?? ""),
        notify: fd.get("notify") === "on",
      });
      if (res.ok && res.id) router.push(`/panel/citas/${res.id}?creada=1`);
      else {
        setError(res.error ?? "Error");
        setFieldErrors(res.fieldErrors ?? {});
      }
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <Card>
        <CardHeader title="Cliente" />
        <CardBody className="space-y-3">
          {!isNew && customer && (
            <div className="flex items-center justify-between rounded-lg bg-zinc-50 p-3 text-sm">
              <div>
                <p className="font-medium">{customer.name}</p>
                <p className="text-zinc-500">{[customer.email, customer.phone].filter(Boolean).join(" · ")}</p>
                {customer.isBlocked && <p className="text-xs text-red-600">Cliente bloqueado para reservas en línea</p>}
              </div>
              <button type="button" className="text-sm text-brand hover:underline" onClick={() => setCustomer(null)}>
                Cambiar
              </button>
            </div>
          )}
          {!isNew && !customer && (
            <div className="relative">
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre, email o teléfono…" aria-label="Buscar cliente" />
              {hits.length > 0 && (
                <ul className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-lg border border-zinc-200 bg-white shadow-lg">
                  {hits.map((h) => (
                    <li key={h.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-50"
                        onClick={() => {
                          setCustomer(h);
                          setQuery("");
                          setHits([]);
                        }}
                      >
                        <span className="font-medium">{h.name}</span> <span className="text-zinc-500">{h.email ?? h.phone}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <Checkbox checked={isNew} onChange={(e) => setIsNew(e.target.checked)} label="Cliente nuevo" />
          {isNew && (
            <div className="grid gap-3 sm:grid-cols-3">
              <Field label="Nombre" htmlFor="newName" error={fieldErrors.newName}>
                <Input id="newName" name="newName" required />
              </Field>
              <Field label="Email" htmlFor="newEmail" error={fieldErrors.newEmail}>
                <Input id="newEmail" name="newEmail" type="email" />
              </Field>
              <Field label="Teléfono" htmlFor="newPhone" error={fieldErrors.newPhone}>
                <Input id="newPhone" name="newPhone" type="tel" />
              </Field>
            </div>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Servicio y hora" />
        <CardBody className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Servicio" htmlFor="serviceId">
              <Select id="serviceId" value={serviceId} onChange={(e) => { setServiceId(e.target.value); setStart(null); }} required>
                <option value="">Elegir…</option>
                {services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.durationMin} min)
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Profesional" htmlFor="employeeId">
              <Select id="employeeId" value={employeeId} onChange={(e) => { setEmployeeId(e.target.value); setStart(null); }} disabled={!!fixedEmployeeId} required>
                <option value="">Elegir…</option>
                {availableEmployees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Fecha" htmlFor="date">
              <Input id="date" type="date" value={date} onChange={(e) => { setDate(e.target.value); setStart(null); }} required />
            </Field>
          </div>
          <StaffSlotPicker serviceId={serviceId} employeeId={employeeId} date={date} timezone={timezone} locale={locale} value={start} onChange={setStart} />
          <Field label="Notas internas" htmlFor="notes">
            <Textarea id="notes" name="notes" rows={2} />
          </Field>
          <Checkbox name="notify" defaultChecked label="Enviar confirmación por email al cliente" />
        </CardBody>
      </Card>

      {error && <Alert kind="error">{error}</Alert>}
      <Button type="submit" loading={pending} disabled={!start || !serviceId || !employeeId || (!customer && !isNew)}>
        Crear cita
      </Button>
    </form>
  );
}
