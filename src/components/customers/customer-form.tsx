"use client";

import type { Customer } from "@prisma/client";
import { saveCustomerAction } from "@/server/actions/customers";
import { customerSchema } from "@/lib/validation/customer";
import { useZodAction } from "@/lib/hooks/use-zod-action";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { FormStatus } from "@/components/forms/form-status";

export function CustomerForm({ customer, tags, allTags }: { customer?: Customer; tags: string[]; allTags: string[] }) {
  const { state, formAction, pending, onSubmit, fieldError } = useZodAction(customerSchema, saveCustomerAction);
  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="grid gap-4 sm:grid-cols-2">
      {customer && <input type="hidden" name="id" value={customer.id} />}
      <Field label="Nombre" htmlFor="name" error={fieldError("name")}>
        <Input id="name" name="name" defaultValue={customer?.name} required />
      </Field>
      <Field label="Email" htmlFor="email" error={fieldError("email")}>
        <Input id="email" name="email" type="email" defaultValue={customer?.email ?? ""} />
      </Field>
      <Field label="Teléfono" htmlFor="phone" error={fieldError("phone")}>
        <Input id="phone" name="phone" type="tel" defaultValue={customer?.phone ?? ""} />
      </Field>
      <Field label="Fecha de nacimiento" htmlFor="birthDate" error={fieldError("birthDate")}>
        <Input id="birthDate" name="birthDate" type="date" defaultValue={customer?.birthDate?.toISOString().slice(0, 10) ?? ""} />
      </Field>
      <Field label="Etiquetas (separadas por comas)" htmlFor="tags" error={fieldError("tags")} className="sm:col-span-2" hint={allTags.length ? `Existentes: ${allTags.join(", ")}` : undefined}>
        <Input id="tags" name="tags" defaultValue={tags.join(", ")} list="tag-list" placeholder="VIP, Nuevo…" />
      </Field>
      <datalist id="tag-list">
        {allTags.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
      <Field label="Notas internas" htmlFor="internalNotes" error={fieldError("internalNotes")} className="sm:col-span-2">
        <Textarea id="internalNotes" name="internalNotes" rows={4} defaultValue={customer?.internalNotes ?? ""} />
      </Field>
      <div className="flex flex-col gap-3 sm:col-span-2">
        <FormStatus state={state} />
        <Button type="submit" loading={pending} className="sm:self-start">
          {customer ? "Guardar cambios" : "Crear cliente"}
        </Button>
      </div>
    </form>
  );
}
