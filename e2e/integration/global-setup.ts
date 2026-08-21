/**
 * Configuración global para las pruebas de integración.
 * Limpia la BD de datos residuales de runs anteriores y ejecuta el seed.
 *
 * La limpieza previa usa docker exec psql para eliminar:
 *  - Facturas en estado ERROR (bloquean DELETE landlords)
 *  - Inquilinos creados por tests E2E (F2 crea uno con nombre "Test E2E …")
 *    que el seed no puede borrar porque no tienen los teléfonos del seed.
 *  - Ajustes de periodo (F9, `tenant_period_adjustments`) — sin esto, un id de
 *    tenant reutilizado entre corridas hereda el ajuste de la corrida anterior.
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
// Usa comillas simples para el argumento -c para evitar que el shell expanda
// $$ (que bash interpreta como el PID del proceso) dentro de la SQL.
// Silencia errores (p.ej. Docker no disponible o tabla inexistente).
function psql(sql: string): void {
  try {
    execSync(
      `docker exec rent_collector_db psql -U admin -d rent_collector -c '${sql}'`,
      { stdio: "pipe", timeout: 15_000 }
    );
  } catch {
    // Docker no disponible o error SQL — el seed lo detectará y continuará.
  }
}

// Emails de landlord que el seed ha usado (historial); se limpian todos para
// garantizar un estado limpio independientemente del email activo.
const SEED_LANDLORD_EMAILS = ["carlos@rentdemo.com", "test-landlord@rentdemo.com"];

function cleanLandlordByEmail(email: string): void {
  // Notar: las comillas simples del SQL están dentro de las comillas simples del
  // argumento -c → se escapan como '' (dos comillas simples seguidas).
  const e = email.replace(/'/g, "''");
  psql(
    "DELETE FROM payment_events WHERE attempt_id IN " +
    "(SELECT pa.id FROM payment_attempts pa " +
    " JOIN tenants t ON pa.tenant_phone = t.phone " +
    " JOIN properties p ON t.property_id = p.id " +
    " JOIN landlords l ON p.landlord_id = l.id " +
    ` WHERE l.email = '${e}')`
  );
  psql(
    "DELETE FROM payment_attempts WHERE tenant_phone IN " +
    "(SELECT t.phone FROM tenants t " +
    " JOIN properties p ON t.property_id = p.id " +
    " JOIN landlords l ON p.landlord_id = l.id " +
    ` WHERE l.email = '${e}')`
  );
  // Sin esto, un ajuste de periodo (F9) sobrevive al DELETE de tenants de abajo
  // (no hay cascade) y se filtra a la siguiente corrida si el id de tenant se
  // reutiliza tras el reseed — confirmado con el backend, rent-collector-sync.md
  // 2026-08-04T23:20 (un tenant nuevo "heredó" el ajuste de una corrida previa).
  psql(
    "DELETE FROM tenant_period_adjustments WHERE tenant_id IN " +
    "(SELECT t.id FROM tenants t " +
    " JOIN properties p ON t.property_id = p.id " +
    " JOIN landlords l ON p.landlord_id = l.id " +
    ` WHERE l.email = '${e}')`
  );
  psql(
    "DELETE FROM tenants WHERE property_id IN " +
    "(SELECT p.id FROM properties p " +
    " JOIN landlords l ON p.landlord_id = l.id " +
    ` WHERE l.email = '${e}')`
  );
  psql(`DELETE FROM properties WHERE landlord_id IN (SELECT id FROM landlords WHERE email = '${e}')`);
  psql(`DELETE FROM landlords WHERE email = '${e}'`);
}

function preclean(): void {
  // Limpiar TODOS los emails de landlord que el seed ha usado alguna vez.
  // Evita que un cambio de email deje inquilinos huérfanos con teléfonos en conflicto.
  for (const email of SEED_LANDLORD_EMAILS) {
    cleanLandlordByEmail(email);
  }
  // Eliminar facturas en ERROR que pudieran bloquear futuros DELETEs.
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
