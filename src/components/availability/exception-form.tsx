"use client";

import { useRef, useState, useEffect } from "react";
import { createExceptionAction } from "@/server/actions/availability";
import { exceptionSchema } from "@/lib/validation/availability";
import { useZodAction } from "@/lib/hooks/use-zod-action";
import { Button } from "@/components/ui/button";
import { Field, Input, Select } from "@/components/ui/input";
import { FormStatus } from "@/components/forms/form-status";
import { EXCEPTION_LABELS } from "@/lib/labels";


export function ExceptionForm({ employeeId, businessWide }: { employeeId?: string; businessWide?: boolean }) {
  const { state, formAction, pending, onSubmit, fieldError } = useZodAction(exceptionSchema, createExceptionAction);
  const [type, setType] = useState<keyof typeof EXCEPTION_LABELS>(businessWide ? "HOLIDAY" : "DAY_OFF");
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);

  return (
    <form ref={ref} action={formAction} onSubmit={onSubmit} noValidate className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
      <input type="hidden" name="employeeId" value={employeeId ?? ""} />
      <Field label="Tipo" htmlFor="type" className="lg:col-span-1">
        <Select id="type" name="type" value={type} onChange={(e) => setType(e.target.value as keyof typeof EXCEPTION_LABELS)}>
          {Object.entries(EXCEPTION_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Desde" htmlFor="startDate" error={fieldError("startDate")}>
        <Input id="startDate" name="startDate" type="date" required />
      </Field>
      <Field label="Hasta (opcional)" htmlFor="endDate" error={fieldError("endDate")}>
        <Input id="endDate" name="endDate" type="date" />
      </Field>
      {type === "CUSTOM_HOURS" ? (
        <div className="grid grid-cols-2 gap-2 lg:col-span-2">
          <Field label="Abre" htmlFor="start" error={fieldError("start")}>
            <Input id="start" name="start" type="time" defaultValue="10:00" />
          </Field>
          <Field label="Cierra" htmlFor="end" error={fieldError("end")}>
            <Input id="end" name="end" type="time" defaultValue="14:00" />
          </Field>
        </div>
      ) : (
        <Field label="Motivo (opcional)" htmlFor="label" className="lg:col-span-2">
          <Input id="label" name="label" placeholder="Ej. Navidad" />
        </Field>
      )}
      <div className="flex items-end">
        <Button type="submit" loading={pending} className="w-full">
          Agregar
        </Button>
      </div>
      <div className="sm:col-span-2 lg:col-span-6">
        <FormStatus state={state} />
        {type === "CUSTOM_HOURS" && <p className="mt-1 text-xs text-zinc-500">Para varios bloques el mismo día, agrega uno por uno. Reemplazan el horario semanal.</p>}
      </div>
    </form>
  );
}
