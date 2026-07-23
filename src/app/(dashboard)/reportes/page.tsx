import { getServerMe, getServerReport } from "@/lib/server-api";
import { ReportesView } from "./ReportesView";

// Server Component (Fase 4b): hace el fetch inicial del reporte en el servidor con
// la cookie httpOnly (4a) y entrega el dato ya resuelto a la vista cliente, que
// mantiene la interacción (navegación de mes). Si no hay sesión de servidor
// (p. ej. en e2e), `getServerReport` devuelve null y la vista hace el fetch cliente.
function currentYM() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export default async function ReportesPage() {
  const month = currentYM();
  const me = await getServerMe();
  const report = me ? await getServerReport(me.id, month) : null;

  return <ReportesView initialReport={report} initialMonth={month} />;
}
