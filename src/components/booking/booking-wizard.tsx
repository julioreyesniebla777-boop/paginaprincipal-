"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import { DateTime } from "luxon";
import { createBookingAction, type BookingResult } from "@/server/actions/booking";
import { customerDetailsSchema } from "@/lib/validation/booking";
import { formatMoney } from "@/lib/money";
import { cn } from "@/lib/utils";
import { Button, buttonClasses } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/card";
import { CalendarPicker } from "./calendar-picker";
import { TimeSlots } from "./time-slots";
import { fetchAvailableDates, fetchSlots, type Slot } from "./api";

export type PublicService = {
  id: string;
  name: string;
  description: string | null;
  durationMin: number;
  priceCents: number;
  color: string;
  capacity: number;
  category: string | null;
  employeeIds: string[];
};
export type PublicEmployee = { id: string; displayName: string; bio: string | null; color: string };
export type BusinessInfo = {
  name: string;
  timezone: string;
  locale: string;
  currency: string;
  maxDaysAhead: number;
  policyText: string | null;
  cancelLimitHours: number;
  autoConfirm: boolean;
};
type Prefill = { name: string; email: string; phone: string } | null;

const STEPS = ["Servicio", "Profesional", "Fecha", "Hora", "Tus datos", "Listo"] as const;

export function BookingWizard({
  business,
  services,
  employees,
  prefill,
}: {
  business: BusinessInfo;
  services: PublicService[];
  employees: PublicEmployee[];
  prefill: Prefill;
}) {
  const [step, setStep] = useState(0);
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState<string>("any");
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<Slot | null>(null);
  const [result, setResult] = useState<Extract<BookingResult, { ok: true }> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});
  const [pending, startTransition] = useTransition();
  const [renderedAt] = useState(() => Date.now());

  const service = services.find((s) => s.id === serviceId) ?? null;
  const serviceEmployees = useMemo(() => employees.filter((e) => service?.employeeIds.includes(e.id)), [employees, service]);
  const employeeName = (id: string) => employees.find((e) => e.id === id)?.displayName ?? "";
  const money = (c: number) => (c > 0 ? formatMoney(c, business.currency, business.locale) : "Gratis");
  const tz = business.timezone;

  const loadDates = useCallback(
    (from: string, to: string) => fetchAvailableDates({ serviceId: serviceId!, employeeId, from, to }),
    [serviceId, employeeId],
  );
  const loadSlots = useCallback((d: string) => fetchSlots({ serviceId: serviceId!, employeeId, from: d, to: d }), [serviceId, employeeId]);

  const categories = useMemo(() => {
    const map = new Map<string, PublicService[]>();
    for (const s of services) {
      const key = s.category ?? "Servicios";
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return [...map.entries()];
  }, [services]);

  function chooseService(id: string) {
    setServiceId(id);
    setDate(null);
    setSlot(null);
    const emps = employees.filter((e) => services.find((s) => s.id === id)?.employeeIds.includes(e.id));
    // Con un solo profesional se salta el paso 2.
    if (emps.length === 1) {
      setEmployeeId(emps[0]!.id);
      setStep(2);
    } else {
      setEmployeeId("any");
      setStep(1);
    }
  }

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const details = {
      name: String(fd.get("name") ?? ""),
      phone: String(fd.get("phone") ?? ""),
      email: String(fd.get("email") ?? ""),
      notes: String(fd.get("notes") ?? ""),
      acceptPolicies: fd.get("acceptPolicies") === "on",
    };
    const parsed = customerDetailsSchema.safeParse(details);
    if (!parsed.success) {
      const fe = parsed.error.flatten().fieldErrors;
      setFieldErrors(Object.fromEntries(Object.entries(fe).map(([k, v]) => [k, v?.[0]])));
      return;
    }
    setFieldErrors({});
    setError(null);
    startTransition(async () => {
      const res = await createBookingAction({
        ...details,
        serviceId,
        employeeId,
        start: slot!.start,
        website: String(fd.get("website") ?? ""),
        renderedAt,
      });
      if (res.ok) {
        setResult(res);
        setStep(5);
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        setError(res.error);
        if (res.fieldErrors) setFieldErrors(Object.fromEntries(Object.entries(res.fieldErrors).map(([k, v]) => [k, v?.[0]])));
        if (res.code === "SLOT_TAKEN") {
          setSlot(null);
          setStep(3);
        }
      }
    });
  }

  const back = () => {
    setError(null);
    if (step === 2 && serviceEmployees.length === 1) setStep(0);
    else setStep((s) => Math.max(0, s - 1));
  };

  const startLocal = slot ? DateTime.fromISO(slot.start, { zone: tz }).setLocale(business.locale) : null;

  return (
    <div className="mx-auto w-full max-w-xl">
      {/* Progreso */}
      {step < 5 && (
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between text-sm">
            {step > 0 ? (
              <button type="button" onClick={back} className="flex items-center gap-1 text-zinc-600 hover:text-zinc-900">
                ‹ Atrás
              </button>
            ) : (
              <span />
            )}
            <span className="text-zinc-500">
              Paso {step + 1} de 5 · <span className="font-medium text-zinc-800">{STEPS[step]}</span>
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200">
            <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${((step + 1) / 5) * 100}%` }} />
          </div>
        </div>
      )}

      {/* Resumen de la selección */}
      {step > 0 && step < 5 && service && (
        <div className="mb-4 rounded-xl border border-zinc-200 bg-white p-3 text-sm">
          <p className="font-semibold">{service.name}</p>
          <p className="text-zinc-500">
            {service.durationMin} min · {money(service.priceCents)}
            {step > 1 && ` · ${employeeId === "any" ? "Cualquier profesional" : employeeName(employeeId)}`}
            {startLocal && step > 3 && ` · ${startLocal.toFormat("cccc d 'de' LLLL, t")}`}
          </p>
        </div>
      )}

      {/* Paso 1: servicio */}
      {step === 0 && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold">¿Qué servicio quieres reservar?</h2>
          {services.length === 0 && <Alert kind="info">Por ahora no hay servicios disponibles para reservar en línea.</Alert>}
          {categories.map(([cat, list]) => (
            <section key={cat}>
              {categories.length > 1 && <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">{cat}</h3>}
              <div className="space-y-2">
                {list.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => chooseService(s.id)}
                    className="flex w-full items-start gap-3 rounded-xl border border-zinc-200 bg-white p-4 text-left transition hover:border-brand hover:shadow-sm"
                  >
                    <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{s.name}</span>
                      {s.description && <span className="mt-0.5 block text-sm text-zinc-500">{s.description}</span>}
                      <span className="mt-1 block text-sm text-zinc-600">
                        {s.durationMin} min{s.capacity > 1 && ` · grupo de hasta ${s.capacity}`}
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold">{money(s.priceCents)}</span>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Paso 2: profesional */}
      {step === 1 && service && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">¿Con quién?</h2>
          {[{ id: "any", displayName: "Cualquiera disponible", bio: "Te asignamos el primer profesional libre.", color: "#71717a" }, ...serviceEmployees].map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => {
                setEmployeeId(e.id);
                setDate(null);
                setSlot(null);
                setStep(2);
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-xl border bg-white p-4 text-left transition hover:border-brand",
                employeeId === e.id ? "border-brand" : "border-zinc-200",
              )}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white" style={{ backgroundColor: e.color }}>
                {e.id === "any" ? "★" : e.displayName.split(" ").map((p) => p[0]).slice(0, 2).join("")}
              </span>
              <span className="min-w-0">
                <span className="block font-semibold">{e.displayName}</span>
                {e.bio && <span className="block text-sm text-zinc-500">{e.bio}</span>}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Paso 3: fecha */}
      {step === 2 && service && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Elige el día</h2>
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <CalendarPicker
              key={`${serviceId}-${employeeId}`}
              timezone={tz}
              locale={business.locale}
              maxDaysAhead={business.maxDaysAhead}
              selected={date}
              loadDates={loadDates}
              onSelect={(d) => {
                setDate(d);
                setSlot(null);
                setStep(3);
              }}
            />
          </div>
          <p className="text-xs text-zinc-500">Horario en {tz.replace("_", " ")}.</p>
        </div>
      )}

      {/* Paso 4: hora */}
      {step === 3 && service && date && (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold first-letter:uppercase">{DateTime.fromISO(date, { zone: tz }).setLocale(business.locale).toFormat("cccc d 'de' LLLL")}</h2>
          {error && <Alert kind="error">{error}</Alert>}
          <TimeSlots
            timezone={tz}
            locale={business.locale}
            date={date}
            selected={slot?.start ?? null}
            loadSlots={loadSlots}
            showSeats={service.capacity > 1}
            onSelect={(s) => {
              setSlot(s);
              setError(null);
              setStep(4);
            }}
          />
          <button type="button" onClick={() => setStep(2)} className="text-sm text-brand hover:underline">
            Cambiar de día
          </button>
        </div>
      )}

      {/* Paso 5: datos */}
      {step === 4 && service && slot && (
        <form onSubmit={submit} noValidate className="space-y-4">
          <h2 className="text-lg font-semibold">Tus datos</h2>
          {error && <Alert kind="error">{error}</Alert>}
          <Field label="Nombre completo" htmlFor="name" error={fieldErrors.name}>
            <Input id="name" name="name" autoComplete="name" defaultValue={prefill?.name} required />
          </Field>
          <Field label="Teléfono" htmlFor="phone" error={fieldErrors.phone}>
            <Input id="phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" defaultValue={prefill?.phone} required />
          </Field>
          <Field label="Email" htmlFor="email" error={fieldErrors.email} hint="Te enviaremos la confirmación y un enlace para gestionar tu cita.">
            <Input id="email" name="email" type="email" autoComplete="email" inputMode="email" defaultValue={prefill?.email} required />
          </Field>
          <Field label="Notas (opcional)" htmlFor="notes" error={fieldErrors.notes}>
            <Textarea id="notes" name="notes" rows={3} placeholder="¿Algo que debamos saber?" />
          </Field>
          {/* Honeypot: oculto a personas, visible para bots */}
          <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
            <label>
              Sitio web
              <input type="text" name="website" tabIndex={-1} autoComplete="off" />
            </label>
          </div>
          <div className="rounded-lg bg-zinc-50 p-3 text-sm text-zinc-600">
            {business.policyText && <p className="mb-2 whitespace-pre-line">{business.policyText}</p>}
            <p>Puedes cancelar o reprogramar hasta {business.cancelLimitHours} horas antes desde el enlace del correo.</p>
          </div>
          <Checkbox name="acceptPolicies" label="Acepto las políticas de reserva y cancelación" />
          {fieldErrors.acceptPolicies && <p className="text-sm text-red-600">{fieldErrors.acceptPolicies}</p>}
          <Button type="submit" size="lg" className="w-full" loading={pending}>
            Confirmar reserva
          </Button>
        </form>
      )}

      {/* Paso 6: confirmación */}
      {step === 5 && result && (
        <div className="space-y-5 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl text-green-600">✓</div>
          <div>
            <h2 className="text-2xl font-bold">{result.appointment.status === "PENDING" ? "¡Solicitud recibida!" : "¡Cita confirmada!"}</h2>
            <p className="mt-1 text-zinc-600">
              {result.appointment.status === "PENDING"
                ? "Te avisaremos por email cuando el negocio la confirme."
                : "Te enviamos la confirmación por email."}
            </p>
          </div>
          <div className="rounded-xl border border-zinc-200 bg-white p-4 text-left text-sm">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
              <dt className="text-zinc-500">Servicio</dt>
              <dd className="font-medium">{result.appointment.serviceName}</dd>
              <dt className="text-zinc-500">Profesional</dt>
              <dd className="font-medium">{result.appointment.employeeName}</dd>
              <dt className="text-zinc-500">Fecha</dt>
              <dd className="font-medium first-letter:uppercase">{DateTime.fromISO(result.appointment.start, { zone: tz }).setLocale(business.locale).toFormat("cccc d 'de' LLLL yyyy")}</dd>
              <dt className="text-zinc-500">Hora</dt>
              <dd className="font-medium">
                {DateTime.fromISO(result.appointment.start, { zone: tz }).setLocale(business.locale).toFormat("t")} –{" "}
                {DateTime.fromISO(result.appointment.end, { zone: tz }).setLocale(business.locale).toFormat("t")}
              </dd>
              <dt className="text-zinc-500">Lugar</dt>
              <dd className="font-medium">{business.name}</dd>
            </dl>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
            <a href={result.icsUrl} className={buttonClasses("outline")}>
              📅 Agregar a mi calendario (.ics)
            </a>
            <a href={result.googleUrl} target="_blank" rel="noopener noreferrer" className={buttonClasses("outline")}>
              Google Calendar
            </a>
          </div>
          <p className="text-sm text-zinc-500">
            ¿Necesitas cambiar algo?{" "}
            <a href={result.manageUrl} className="text-brand hover:underline">
              Gestionar mi cita
            </a>
          </p>
          <button
            type="button"
            onClick={() => {
              setStep(0);
              setServiceId(null);
              setSlot(null);
              setDate(null);
              setResult(null);
            }}
            className="text-sm text-zinc-500 hover:underline"
          >
            Reservar otra cita
          </button>
        </div>
      )}
    </div>
  );
}
