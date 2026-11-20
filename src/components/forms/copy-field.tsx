"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyField({ value, multiline }: { value: string; multiline?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
      {multiline ? (
        <textarea readOnly value={value} rows={3} className="w-full rounded-lg border border-zinc-300 bg-zinc-50 p-2 font-mono text-xs" />
      ) : (
        <input readOnly value={value} className="h-10 w-full rounded-lg border border-zinc-300 bg-zinc-50 px-3 font-mono text-sm" />
      )}
      <Button type="button" variant="outline" onClick={copy} className="shrink-0">
        {copied ? "¡Copiado!" : "Copiar"}
      </Button>
    </div>
  );
}
