import type { Metadata } from "next";
import { requireAdmin } from "@/server/auth/guards";
import { appUrl, getBusiness } from "@/server/business";
import { BusinessForm } from "@/components/forms/business-form";
import { CopyField } from "@/components/forms/copy-field";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";

export const metadata: Metadata = { title: "Configuración" };

export default async function SettingsPage() {
  await requireAdmin();
  const business = await getBusiness();
  const timezones = Intl.supportedValuesOf("timeZone");
  const publicUrl = appUrl("/reservar");
  const embed = `<iframe src="${appUrl("/embed/reservar")}" style="width:100%;min-height:760px;border:0" title="Reservar cita" loading="lazy"></iframe>`;

  return (
    <>
      <PageHeader title="Configuración del negocio" description="Datos, región y políticas de reserva." />
      <div className="space-y-6">
        <Card>
          <CardHeader title="Reservas en línea" description="Comparte el enlace o incrusta el formulario en tu sitio web." />
          <CardBody className="space-y-4">
            <div>
              <p className="mb-1 text-sm font-medium text-zinc-700">URL pública</p>
              <CopyField value={publicUrl} />
            </div>
            <div>
              <p className="mb-1 text-sm font-medium text-zinc-700">Código para incrustar (iframe)</p>
              <CopyField value={embed} multiline />
            </div>
          </CardBody>
        </Card>
        <BusinessForm business={business} timezones={timezones} />
      </div>
    </>
  );
}
