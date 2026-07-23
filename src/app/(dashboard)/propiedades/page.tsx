import { getServerMe, getServerProperties, getServerTenants } from "@/lib/server-api";
import { PropiedadesView } from "./PropiedadesView";

export default async function PropiedadesPage() {
  const me = await getServerMe();
  const [properties, tenants] = me
    ? await Promise.all([getServerProperties(me.id), getServerTenants(me.id)])
    : [null, null];

  return <PropiedadesView initialProperties={properties} initialTenants={tenants} />;
}
