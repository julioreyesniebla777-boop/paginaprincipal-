import { requireAdmin } from "@/server/auth/guards";
import { ImportForm } from "@/components/customers/small-forms";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";

export const metadata = { title: "Importar clientes" };

export default async function ImportPage() {
  await requireAdmin();
  return (
    <>
      <PageHeader title="Importar clientes" description="Desde un archivo CSV (separado por comas o punto y coma, UTF-8)." />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Archivo" />
          <CardBody>
            <ImportForm />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Formato" />
          <CardBody className="space-y-3 text-sm text-zinc-600">
            <p>La primera fila debe tener los encabezados. Columnas reconocidas:</p>
            <ul className="list-inside list-disc">
              <li><strong>nombre</strong> (obligatorio)</li>
              <li>email</li>
              <li>telefono</li>
              <li>fecha_nacimiento (AAAA-MM-DD o DD/MM/AAAA)</li>
              <li>etiquetas (separadas por |)</li>
              <li>notas</li>
            </ul>
            <p>Si ya existe un cliente con el mismo email o teléfono, se completan sus datos vacíos y se añaden las etiquetas, en lugar de duplicarlo.</p>
            <pre className="overflow-x-auto rounded bg-zinc-100 p-2 text-xs">nombre,email,telefono,fecha_nacimiento,etiquetas,notas{"\n"}Ana Pérez,ana@mail.com,+1 407 555 0101,1990-05-14,VIP|Nuevo,Alergia al látex</pre>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
