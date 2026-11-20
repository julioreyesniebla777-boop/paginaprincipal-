"use client";

import type { ActionState } from "@/lib/action-state";
import { Alert } from "@/components/ui/card";

export function FormStatus({ state }: { state: ActionState }) {
  if (state.error) return <Alert kind="error">{state.error}</Alert>;
  if (state.ok && state.message) return <Alert kind="success">{state.message}</Alert>;
  return null;
}
