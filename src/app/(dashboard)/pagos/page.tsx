import { getServerPayments } from "@/lib/server-api";
import { PagosView } from "./PagosView";

export default async function PagosPage() {
  const payments = await getServerPayments();
  return <PagosView initialPayments={payments} />;
}
