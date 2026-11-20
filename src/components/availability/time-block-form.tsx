"use client";

import { useEffect, useRef } from "react";
import { createTimeBlockAction } from "@/server/actions/availability";
import { timeBlockSchema } from "@/lib/validation/availability";
import { useZodAction } from "@/lib/hooks/use-zod-action";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/input";
import { FormStatus } from "@/components/forms/form-status";

export function TimeBlockForm({ employeeId }: { employeeId: string }) {
  const { state, formAction, pending, onSubmit, fieldError } = useZodAction(timeBlockSchema, createTimeBlockAction);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) ref.current?.reset();
  }, [state]);
  return (
    <form ref={ref} action={formAction} onSubmit={onSubmit} noValidate className="grid grid-cols-2 gap-3 lg:grid-cols-5">
      <input type="hidden" name="employeeId" value={employeeId} />
      <Field label="Fecha" htmlFor="tb-date" error={fieldError("date")} className="col-span-2 lg:col-span-1">
        <Input id="tb-date" name="date" type="date" required />
      </Field>
      <Field label="Desde" htmlFor="tb-start" error={fieldError("start")}>
        <Input id="tb-start" name="start" type="time" defaultValue="13:00" required />
      </Field>
      <Field label="Hasta" htmlFor="tb-end" error={fieldError("end")}>
        <Input id="tb-end" name="end" type="time" defaultValue="14:00" required />
      </Field>
      <Field label="Motivo" htmlFor="tb-reason" className="col-span-2 lg:col-span-1">
        <Input id="tb-reason" name="reason" placeholder="Almuerzo, reunión…" />
      </Field>
      <div className="col-span-2 flex items-end lg:col-span-1">
        <Button type="submit" loading={pending} className="w-full">
          Bloquear
        </Button>
      </div>
      <div className="col-span-2 lg:col-span-5">
        <FormStatus state={state} />
      </div>
    </form>
  );
}
