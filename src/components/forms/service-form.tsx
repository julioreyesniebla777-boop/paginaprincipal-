"use client";

import type { Service, ServiceCategory } from "@prisma/client";
import { saveServiceAction } from "@/server/actions/services";
import { serviceSchema } from "@/lib/validation/service";
import { useZodAction } from "@/lib/hooks/use-zod-action";
import { centsToInput } from "@/lib/money";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/input";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FormStatus } from "./form-status";

type Props = {
  service?: Service & { employees: { employeeId: string }[] };
  categories: ServiceCategory[];
  employees: { id: string; displayName: string; isActive: boolean }[];
  currency: string;
};

export function ServiceForm({ service, categories, employees, currency }: Props) {
  const { state, formAction, pending, onSubmit, fieldError } = useZodAction(serviceSchema, saveServiceAction);
  const assigned = new Set(service?.employees.map((e) => e.employeeId) ?? employees.map((e) => e.id));

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="space-y-6">
      {service && <input type="hidden" name="id" value={service.id} />}
      <Card>
        <CardHeader title="Información" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre" htmlFor="name" error={fieldError("name")}>
            <Input id="name" name="name" defaultValue={service?.name} required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoría" htmlFor="categoryId">
              <Select id="categoryId" name="categoryId" defaultValue={service?.categoryId ?? ""}>
                <option value="">Sin categoría</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="…o nueva categoría" htmlFor="newCategory" error={fieldError("newCategory")}>
              <Input id="newCategory" name="newCategory" placeholder="Ej. Uñas" />
            </Field>
          </div>
          <Field label="Descripción" htmlFor="description" error={fieldError("description")} className="sm:col-span-2">
            <Textarea id="description" name="description" rows={3} defaultValue={service?.description ?? ""} />
          </Field>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Duración, precio y capacidad" />
        <CardBody className="grid grid-cols-2 gap-4 lg:grid-cols-3">
          <Field label="Duración (min)" htmlFor="durationMin" error={fieldError("durationMin")}>
            <Input id="durationMin" name="durationMin" type="number" min={5} step={5} defaultValue={service?.durationMin ?? 60} />
          </Field>
          <Field label={`Precio (${currency})`} htmlFor="price" error={fieldError("price")}>
            <Input id="price" name="price" inputMode="decimal" defaultValue={centsToInput(service?.priceCents ?? 0)} />
          </Field>
          <Field label="Color" htmlFor="color" error={fieldError("color")}>
            <Input id="color" name="color" type="color" defaultValue={service?.color ?? "#6366f1"} className="p-1" />
          </Field>
          <Field label="Preparación antes (min)" htmlFor="bufferBeforeMin" error={fieldError("bufferBeforeMin")}>
            <Input id="bufferBeforeMin" name="bufferBeforeMin" type="number" min={0} step={5} defaultValue={service?.bufferBeforeMin ?? 0} />
          </Field>
          <Field label="Preparación después (min)" htmlFor="bufferAfterMin" error={fieldError("bufferAfterMin")}>
            <Input id="bufferAfterMin" name="bufferAfterMin" type="number" min={0} step={5} defaultValue={service?.bufferAfterMin ?? 0} />
          </Field>
          <Field label="Capacidad por franja" htmlFor="capacity" error={fieldError("capacity")} hint="1 = individual; más de 1 = clase o grupo.">
            <Input id="capacity" name="capacity" type="number" min={1} defaultValue={service?.capacity ?? 1} />
          </Field>
          <div className="col-span-2 lg:col-span-3">
            <Checkbox name="isActive" defaultChecked={service?.isActive ?? true} label="Activo (visible para reservar)" />
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Profesionales que lo realizan" />
        <CardBody className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {employees.length === 0 && <p className="text-sm text-zinc-500">Aún no hay profesionales.</p>}
          {employees.map((e) => (
            <Checkbox
              key={e.id}
              name="employeeIds"
              value={e.id}
              defaultChecked={assigned.has(e.id)}
              label={
                <>
                  {e.displayName}
                  {!e.isActive && <span className="ml-1 text-xs text-zinc-400">(inactivo)</span>}
                </>
              }
            />
          ))}
        </CardBody>
      </Card>

      <div className="flex flex-col gap-3">
        <FormStatus state={state} />
        <Button type="submit" loading={pending} className="sm:self-end">
          {service ? "Guardar cambios" : "Crear servicio"}
        </Button>
      </div>
    </form>
  );
}
