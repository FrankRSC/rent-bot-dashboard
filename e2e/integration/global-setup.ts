/**
 * Configuración global para las pruebas de integración.
 * Limpia la BD de datos residuales de runs anteriores y ejecuta el seed.
 *
 * La limpieza previa usa docker exec psql para eliminar:
 *  - Facturas en estado ERROR (bloquean DELETE landlords)
 *  - Inquilinos creados por tests E2E (F2 crea uno con nombre "Test E2E …")
 *    que el seed no puede borrar porque no tienen los teléfonos del seed.
 */
import { execSync } from "child_process";
import path from "path";

// Calienta la conexión BFF→backend antes del primer test para evitar que el
// happy-eyeballs de Node.js falle en la primera llamada a localhost.
async function warmupBff(): Promise<void> {
  const url = "http://localhost:4000/api/health";
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) {
        console.log(`[setup] ✓ BFF calentado (${res.status}).\n`);
        return;
      }
    } catch {
      // ignorar — reintentar
    }
    await new Promise((r) => setTimeout(r, 500 * attempt));
  }
  console.warn("[setup] ⚠ No se pudo calentar el BFF (continúa de todas formas).\n");
}

// Ejecuta SQL en la BD del backend vía docker exec.
// Silencia errores (p.ej. Docker no disponible o tabla inexistente).
function psql(sql: string): void {
  try {
    execSync(
      `docker exec rent_collector_db psql -U admin -d rent_collector -c "${sql}"`,
      { stdio: "pipe", timeout: 15_000 }
    );
  } catch {
    // Docker no disponible o error SQL — el seed lo detectará y continuará.
  }
}

function preclean(): void {
  // 1. Eliminar pagos de inquilinos que no son del seed (creados por F2, F3, F4).
  //    El seed limpia pagos por teléfonos fijos; esto cubre los extras.
  psql(
    "DELETE FROM payment_events WHERE attempt_id IN " +
    "(SELECT pa.id FROM payment_attempts pa " +
    " JOIN tenants t ON pa.tenant_phone = t.phone " +
    " JOIN properties p ON t.property_id = p.id " +
    " JOIN landlords l ON p.landlord_id = l.id " +
    " WHERE l.email = $$carlos@rentdemo.com$$)"
  );
  psql(
    "DELETE FROM payment_attempts WHERE tenant_phone IN " +
    "(SELECT t.phone FROM tenants t " +
    " JOIN properties p ON t.property_id = p.id " +
    " JOIN landlords l ON p.landlord_id = l.id " +
    " WHERE l.email = $$carlos@rentdemo.com$$)"
  );
  // 2. Eliminar inquilinos extra creados por F2 (no están en la lista del seed).
  psql(
    "DELETE FROM tenants WHERE property_id IN " +
    "(SELECT p.id FROM properties p " +
    " JOIN landlords l ON p.landlord_id = l.id " +
    " WHERE l.email = $$carlos@rentdemo.com$$)"
  );
  // 3. Eliminar facturas en ERROR que bloquean DELETE landlords.
  psql("DELETE FROM facturas WHERE status = $$ERROR$$");
  console.log("[setup] ✓ Pre-limpieza de la BD completada.\n");
}

export default async function globalSetup(): Promise<void> {
  const backendDir = path.join(__dirname, "..", "..", "..", "rent-collector bot");
  await warmupBff();
  console.log("\n[setup] Limpiando datos residuales...");
  preclean();
  console.log("[setup] Ejecutando seed...");
  try {
    execSync("npm run seed", {
      cwd: backendDir,
      stdio: "pipe",
      timeout: 30_000,
    });
    console.log("[setup] ✓ Seed completado.\n");
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`[setup] ⚠ Seed falló: ${msg}\n`);
    console.warn("[setup]   Continuando con el estado actual.\n");
  }
}
