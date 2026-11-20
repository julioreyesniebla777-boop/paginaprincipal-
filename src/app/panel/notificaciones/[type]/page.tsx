import { notFound } from "next/navigation";
import type { TemplateType } from "@prisma/client";
import { prisma } from "@/server/db";
import { requireAdmin } from "@/server/auth/guards";
import { DEFAULT_TEMPLATES, TEMPLATE_LABELS } from "@/server/notifications/default-templates";
import { resetTemplateAction } from "@/server/actions/templates";
import { TEMPLATE_TYPES } from "@/lib/validation/template";
import { TemplateEditor } from "@/components/notifications/template-editor";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { PageHeader } from "@/components/ui/card";

export const metadata = { title: "Editar plantilla" };

export default async function EditTemplatePage({ params, searchParams }: { params: Promise<{ type: string }>; searchParams: Promise<{ r?: string }> }) {
  await requireAdmin();
  const { type } = await params;
  const { r } = await searchParams;
  if (!(TEMPLATE_TYPES as readonly string[]).includes(type)) notFound();
  const t = type as TemplateType;
  const tpl = (await prisma.emailTemplate.findUnique({ where: { type: t } })) ?? { ...DEFAULT_TEMPLATES[t], enabled: true };
  return (
    <>
      <PageHeader
        title={TEMPLATE_LABELS[t]}
        description={t === "BUSINESS_NEW_BOOKING" ? "Se envía al email del negocio (Configuración)." : "Se envía al cliente."}
        actions={
          <form action={resetTemplateAction}>
            <input type="hidden" name="type" value={t} />
            <ConfirmButton variant="ghost" message="¿Restaurar el texto predeterminado? Se perderán tus cambios.">
              Restaurar predeterminada
            </ConfirmButton>
          </form>
        }
      />
      <TemplateEditor key={`${t}-${r ?? ""}`} type={t} subject={tpl.subject} bodyHtml={tpl.bodyHtml} enabled={tpl.enabled} />
    </>
  );
}
