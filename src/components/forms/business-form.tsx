"use client";

import type { Business } from "@prisma/client";
import { updateBusinessAction, uploadLogoAction } from "@/server/actions/business";
import { businessSchema, CURRENCIES, LOCALES } from "@/lib/validation/business";
import { useZodAction } from "@/lib/hooks/use-zod-action";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FormStatus } from "./form-status";

export function BusinessForm({ business, timezones }: { business: Business; timezones: string[] }) {
  const { state, formAction, pending, onSubmit, fieldError } = useZodAction(businessSchema, updateBusinessAction);
  const logo = useZodAction(null, uploadLogoAction);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Logo" description="PNG, JPG o WebP, máximo 1 MB." />
        <CardBody>
          <form action={logo.formAction} className="flex flex-wrap items-center gap-4">
            {business.logoUrl ? (
              <img src={business.logoUrl} alt="Logo" className="h-14 w-auto rounded border border-zinc-200 bg-white p-1" />
            ) : (
              <div className="flex h-14 w-14 items-center justify-center rounded border border-dashed border-zinc-300 text-xs text-zinc-400">Sin logo</div>
            )}
            <input type="file" name="logo" accept="image/png,image/jpeg,image/webp" required className="text-sm" />
            <Button type="submit" variant="outline" loading={logo.pending}>
              Subir logo
            </Button>
            <div className="w-full">
              <FormStatus state={logo.state} />
            </div>
          </form>
        </CardBody>
      </Card>

      <form action={formAction} onSubmit={onSubmit} noValidate className="space-y-6">
        <Card>
          <CardHeader title="Datos del negocio" />
          <CardBody className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre" htmlFor="name" error={fieldError("name")}>
              <Input id="name" name="name" defaultValue={business.name} required />
            </Field>
            <Field label="Email (recibe los avisos de reservas)" htmlFor="email" error={fieldError("email")}>
              <Input id="email" name="email" type="email" defaultValue={business.email ?? ""} />
            </Field>
            <Field label="Teléfono" htmlFor="phone" error={fieldError("phone")}>
              <Input id="phone" name="phone" type="tel" defaultValue={business.phone ?? ""} />
            </Field>
            <Field label="Dirección" htmlFor="address" error={fieldError("address")}>
              <Input id="address" name="address" defaultValue={business.address ?? ""} />
            </Field>
            <Field label="URL del logo (opcional)" htmlFor="logoUrl" error={fieldError("logoUrl")} hint="Se rellena al subir un archivo; también acepta una URL https.">
              <Input id="logoUrl" name="logoUrl" defaultValue={business.logoUrl ?? ""} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Color principal" htmlFor="primaryColor" error={fieldError("primaryColor")}>
                <Input id="primaryColor" name="primaryColor" type="color" defaultValue={business.primaryColor} className="p-1" />
              </Field>
              <Field label="Color secundario" htmlFor="secondaryColor" error={fieldError("secondaryColor")}>
                <Input id="secondaryColor" name="secondaryColor" type="color" defaultValue={business.secondaryColor} className="p-1" />
              </Field>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Región" />
          <CardBody className="grid gap-4 sm:grid-cols-3">
            <Field label="Zona horaria" htmlFor="timezone" error={fieldError("timezone")}>
              <Select id="timezone" name="timezone" defaultValue={business.timezone}>
                {timezones.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Idioma" htmlFor="locale" error={fieldError("locale")}>
              <Select id="locale" name="locale" defaultValue={business.locale}>
                {LOCALES.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Moneda" htmlFor="currency" error={fieldError("currency")}>
              <Select id="currency" name="currency" defaultValue={business.currency}>
                {CURRENCIES.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </Select>
            </Field>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Políticas de reserva" />
          <CardBody className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Intervalo de franjas" htmlFor="slotIntervalMin" error={fieldError("slotIntervalMin")}>
              <Select id="slotIntervalMin" name="slotIntervalMin" defaultValue={String(business.slotIntervalMin)}>
                <option value="15">Cada 15 minutos</option>
                <option value="30">Cada 30 minutos</option>
                <option value="60">Cada 60 minutos</option>
              </Select>
            </Field>
            <Field label="Anticipación mínima (horas)" htmlFor="minNoticeHours" error={fieldError("minNoticeHours")}>
              <Input id="minNoticeHours" name="minNoticeHours" type="number" min={0} defaultValue={Math.round(business.minNoticeMin / 60)} />
            </Field>
            <Field label="Máximo de días hacia adelante" htmlFor="maxDaysAhead" error={fieldError("maxDaysAhead")}>
              <Input id="maxDaysAhead" name="maxDaysAhead" type="number" min={1} defaultValue={business.maxDaysAhead} />
            </Field>
            <Field label="Plazo para cancelar/reprogramar (horas antes)" htmlFor="cancelLimitHours" error={fieldError("cancelLimitHours")}>
              <Input id="cancelLimitHours" name="cancelLimitHours" type="number" min={0} defaultValue={Math.round(business.cancelLimitMin / 60)} />
            </Field>
            <Field label="Recordatorio (horas antes)" htmlFor="reminderHoursBefore" error={fieldError("reminderHoursBefore")}>
              <Input id="reminderHoursBefore" name="reminderHoursBefore" type="number" min={1} defaultValue={business.reminderHoursBefore} />
            </Field>
            <div className="flex items-end pb-2">
              <Checkbox name="autoConfirm" defaultChecked={business.autoConfirm} label="Confirmar automáticamente las reservas en línea" />
            </div>
            <Field label="Texto de políticas (se muestra al reservar)" htmlFor="policyText" error={fieldError("policyText")} className="sm:col-span-2 lg:col-span-3">
              <Textarea id="policyText" name="policyText" rows={4} defaultValue={business.policyText ?? ""} />
            </Field>
          </CardBody>
        </Card>

        <div className="sticky bottom-0 -mx-4 flex flex-col gap-3 border-t border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur sm:mx-0 sm:rounded-xl sm:border">
          <FormStatus state={state} />
          <Button type="submit" loading={pending} className="sm:self-end">
            Guardar cambios
          </Button>
        </div>
      </form>
    </div>
  );
}
