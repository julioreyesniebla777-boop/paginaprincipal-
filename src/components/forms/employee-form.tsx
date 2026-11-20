"use client";

import { useState } from "react";
import type { Employee } from "@prisma/client";
import { saveEmployeeAction } from "@/server/actions/employees";
import { employeeSchema } from "@/lib/validation/employee";
import { useZodAction } from "@/lib/hooks/use-zod-action";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/input";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FormStatus } from "./form-status";

type Props = {
  employee?: Employee & { services: { serviceId: string }[]; user: { isActive: boolean } | null };
  services: { id: string; name: string; isActive: boolean }[];
};

export function EmployeeForm({ employee, services }: Props) {
  const { state, formAction, pending, onSubmit, fieldError } = useZodAction(employeeSchema, saveEmployeeAction);
  const hasLogin = !!employee?.user?.isActive;
  const [login, setLogin] = useState(employee ? hasLogin : true);
  const assigned = new Set(employee?.services.map((s) => s.serviceId) ?? []);

  return (
    <form action={formAction} onSubmit={onSubmit} noValidate className="space-y-6">
      {employee && <input type="hidden" name="id" value={employee.id} />}
      <Card>
        <CardHeader title="Datos" />
        <CardBody className="grid gap-4 sm:grid-cols-2">
          <Field label="Nombre visible" htmlFor="displayName" error={fieldError("displayName")}>
            <Input id="displayName" name="displayName" defaultValue={employee?.displayName} required />
          </Field>
          <Field label="Email" htmlFor="email" error={fieldError("email")}>
            <Input id="email" name="email" type="email" defaultValue={employee?.email ?? ""} />
          </Field>
          <Field label="Teléfono" htmlFor="phone" error={fieldError("phone")}>
            <Input id="phone" name="phone" type="tel" defaultValue={employee?.phone ?? ""} />
          </Field>
          <Field label="Color en el calendario" htmlFor="color" error={fieldError("color")}>
            <Input id="color" name="color" type="color" defaultValue={employee?.color ?? "#10b981"} className="p-1" />
          </Field>
          <Field label="Descripción (visible al reservar)" htmlFor="bio" error={fieldError("bio")} className="sm:col-span-2">
            <Textarea id="bio" name="bio" rows={2} defaultValue={employee?.bio ?? ""} />
          </Field>
          <Checkbox name="isActive" defaultChecked={employee?.isActive ?? true} label="Activo (recibe reservas)" />
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Acceso al panel" description="El profesional verá y gestionará solo su agenda." />
        <CardBody className="space-y-4">
          <Checkbox name="enableLogin" checked={login} onChange={(e) => setLogin(e.target.checked)} label="Permitir que inicie sesión con su email" />
          {login && (
            <Field
              label={hasLogin ? "Nueva contraseña (déjalo vacío para no cambiarla)" : "Contraseña inicial"}
              htmlFor="password"
              error={fieldError("password")}
              hint="Mínimo 8 caracteres, con letras y números."
            >
              <Input id="password" name="password" type="password" autoComplete="new-password" />
            </Field>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Servicios que realiza" />
        <CardBody className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s) => (
            <Checkbox key={s.id} name="serviceIds" value={s.id} defaultChecked={assigned.has(s.id)} label={s.name + (s.isActive ? "" : " (inactivo)")} />
          ))}
        </CardBody>
      </Card>

      <div className="flex flex-col gap-3">
        <FormStatus state={state} />
        <Button type="submit" loading={pending} className="sm:self-end">
          {employee ? "Guardar cambios" : "Crear profesional"}
        </Button>
      </div>
    </form>
  );
}
