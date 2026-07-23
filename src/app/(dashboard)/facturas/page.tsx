import { getServerMe, getServerFacturas } from "@/lib/server-api";
import { FacturasView } from "./FacturasView";

export default async function FacturasPage() {
  const me = await getServerMe();
  const facturas = me?.facturasEnabled ? await getServerFacturas(me.id) : null;
  return <FacturasView initialFacturas={facturas} />;
}
