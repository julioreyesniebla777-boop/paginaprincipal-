"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { previewTemplateAction, saveTemplateAction, sendTestEmailAction } from "@/server/actions/templates";
import { templateSchema } from "@/lib/validation/template";
import { useZodAction } from "@/lib/hooks/use-zod-action";
import { TEMPLATE_VARIABLES } from "@/lib/template";
import { Button } from "@/components/ui/button";
import { Checkbox, Field, Input, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/card";
import { FormStatus } from "@/components/forms/form-status";

export function TemplateEditor({ type, subject, bodyHtml, enabled }: { type: string; subject: string; bodyHtml: string; enabled: boolean }) {
  const { state, formAction, pending, onSubmit, fieldError } = useZodAction(templateSchema, saveTemplateAction);
  const [subj, setSubj] = useState(subject);
  const [body, setBody] = useState(bodyHtml);
  const [preview, setPreview] = useState<{ subject: string; html: string } | null>(null);
  const [testMsg, setTestMsg] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [testing, startTest] = useTransition();
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const lastFocused = useRef<"subject" | "body">("body");

  useEffect(() => {
    const t = setTimeout(() => previewTemplateAction(subj, body).then(setPreview).catch(() => null), 400);
    return () => clearTimeout(t);
  }, [subj, body]);

  function insertVar(v: string) {
    const token = `{${v}}`;
    if (lastFocused.current === "subject") {
      setSubj((s) => s + token);
      return;
    }
    const el = bodyRef.current;
    if (!el) return setBody((b) => b + token);
    const { selectionStart: s, selectionEnd: e } = el;
    const next = body.slice(0, s) + token + body.slice(e);
    setBody(next);
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + token.length, s + token.length);
    });
  }

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <form action={formAction} onSubmit={onSubmit} noValidate className="space-y-4">
        <input type="hidden" name="type" value={type} />
        <Field label="Asunto" htmlFor="subject" error={fieldError("subject")}>
          <Input id="subject" name="subject" value={subj} onChange={(e) => setSubj(e.target.value)} onFocus={() => (lastFocused.current = "subject")} />
        </Field>
        <div>
          <p className="mb-1 text-sm font-medium text-zinc-700">Variables (clic para insertar)</p>
          <div className="flex flex-wrap gap-1">
            {TEMPLATE_VARIABLES.map((v) => (
              <button key={v} type="button" onClick={() => insertVar(v)} className="rounded-md bg-zinc-100 px-2 py-1 font-mono text-xs text-zinc-700 hover:bg-brand/10 hover:text-brand">
                {`{${v}}`}
              </button>
            ))}
          </div>
        </div>
        <Field label="Contenido (HTML sencillo)" htmlFor="bodyHtml" error={fieldError("bodyHtml")} hint="Etiquetas permitidas: p, br, strong, em, a, ul, li, table, h1–h4, img… Los scripts se eliminan al guardar.">
          <Textarea id="bodyHtml" name="bodyHtml" ref={bodyRef} rows={16} value={body} onChange={(e) => setBody(e.target.value)} onFocus={() => (lastFocused.current = "body")} className="font-mono text-xs" />
        </Field>
        <Checkbox name="enabled" defaultChecked={enabled} label="Envío activado" />
        <FormStatus state={state} />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" loading={pending}>
            Guardar plantilla
          </Button>
          <Button
            type="button"
            variant="outline"
            loading={testing}
            onClick={() => startTest(async () => {
              const r = await sendTestEmailAction(subj, body);
              setTestMsg(r.ok ? { kind: "success", text: r.message! } : { kind: "error", text: r.error! });
            })}
          >
            Enviarme una prueba
          </Button>
        </div>
        {testMsg && <Alert kind={testMsg.kind}>{testMsg.text}</Alert>}
      </form>

      <div>
        <p className="mb-1 text-sm font-medium text-zinc-700">Vista previa (datos de ejemplo)</p>
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <div className="border-b border-zinc-100 px-4 py-2 text-sm">
            <span className="text-zinc-500">Asunto:</span> <strong>{preview?.subject ?? "…"}</strong>
          </div>
          {/* sandbox sin scripts: el HTML no puede ejecutar código */}
          <iframe title="Vista previa" sandbox="" srcDoc={preview?.html ?? ""} className="h-[560px] w-full" />
        </div>
      </div>
    </div>
  );
}
