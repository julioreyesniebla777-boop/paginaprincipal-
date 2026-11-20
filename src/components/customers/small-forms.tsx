"use client";

import { useActionState } from "react";
import { mergeCustomersAction, toggleBlockCustomerAction, importCustomersAction } from "@/server/actions/customers";
import { initialActionState } from "@/lib/action-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/card";
import { FormStatus } from "@/components/forms/form-status";

export function BlockForm({ id, isBlocked, reason }: { id: string; isBlocked: boolean; reason: string | null }) {
  const [state, action, pending] = useActionState(toggleBlockCustomerAction, initialActionState);
  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="id" value={id} />
      {isBlocked ? (
        <Alert kind="error">Bloqueado para reservas en línea{reason ? `: ${reason}` : ""}.</Alert>
      ) : (
        <Input name="reason" placeholder="Motivo del bloqueo (opcional)" maxLength={190} />
      )}
      <Button type="submit" size="sm" variant={isBlocked ? "outline" : "danger"} loading={pending}>
        {isBlocked ? "Desbloquear" : "Bloquear reservas en línea"}
      </Button>
      <FormStatus state={state} />
    </form>
  );
}

export function MergeForm({ targetId, sourceId, label }: { targetId: string; sourceId: string; label: string }) {
  const [state, action, pending] = useActionState(mergeCustomersAction, initialActionState);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm("Se moverán las citas y etiquetas y se eliminará el duplicado. ¿Continuar?")) e.preventDefault();
      }}
      className="inline-flex flex-col gap-1"
    >
      <input type="hidden" name="targetId" value={targetId} />
      <input type="hidden" name="sourceId" value={sourceId} />
      <Button type="submit" size="sm" variant="outline" loading={pending}>
        {label}
      </Button>
      <FormStatus state={state} />
    </form>
  );
}

export function ImportForm() {
  const [state, action, pending] = useActionState(importCustomersAction, initialActionState as Awaited<ReturnType<typeof importCustomersAction>>);
  return (
    <form action={action} className="space-y-3">
      <input type="file" name="file" accept=".csv,text/csv" required className="block text-sm" />
      <Button type="submit" loading={pending}>
        Importar
      </Button>
      <FormStatus state={state} />
      {state.report && state.report.errors.length > 0 && (
        <div className="max-h-64 overflow-auto rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <p className="mb-1 font-medium">Filas con errores:</p>
          <ul className="list-inside list-disc">
            {state.report.errors.slice(0, 200).map((e, i) => (
              <li key={i}>
                Fila {e.row}: {e.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </form>
  );
}
