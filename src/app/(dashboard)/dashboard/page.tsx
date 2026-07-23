import { getServerMe, getServerTenants, getServerPayments, getServerProperties } from "@/lib/server-api";
import { DashboardView } from "./DashboardView";

export default async function DashboardPage() {
  const me = await getServerMe();
  const [tenants, payments, properties] = me
    ? await Promise.all([
        getServerTenants(me.id),
        getServerPayments(),
        getServerProperties(me.id),
      ])
    : [null, null, null];

  return (
    <DashboardView
      initialTenants={tenants}
      initialPayments={payments}
      initialProperties={properties}
    />
  );
}
