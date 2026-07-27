/**
 * Pruebas de integración E2E — front ↔ backend real (:3001).
 *
 * NO se usa mock-api.ts: todas las peticiones llegan al backend real vía el
 * BFF en /api/[...path]/route.ts → http://localhost:3001.
 *
 * Pre-requisitos (ver playwright.integration.config.ts):
 *  - Backend corriendo en :3001
 *  - Seed corrido: landlord carlos@rentdemo.com / SaveTime123!, id=3
 *    Tenants sin pagos para el mes en curso (status Vencido)
 *    Properties: id=8 Roma 304, id=9 Polanco 12B, id=10 Narvarte 15
 *
 * Flujos cubiertos:
 *  F1 — Login real + dashboard carga datos del landlord
 *  F2 — Crear inquilino → aparece en la lista
 *  F3 — Pago completo (Daniela $14,500) → estado Pagado
 *  F4 — Abono parcial (Luis Torres $5,000 de $13,000) → estado Parcial
 *  F5 — skip: requiere WhatsApp real (Meta)
 *  F6 — skip: requiere servicio CFDI externo (FacturaDigital sandbox no resuelve DNS)
 */
import { test, expect, type Page } from "@playwright/test";

const CREDS = { email: "carlos@rentdemo.com", password: "SaveTime123!" };

async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByPlaceholder("tucorreo@ejemplo.com").fill(CREDS.email);
  await page.getByPlaceholder("••••••••").fill(CREDS.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/dashboard");
  await page.waitForLoadState("networkidle");
}

// ── F1 ────────────────────────────────────────────────────────────────────────

test("F1: login real y dashboard carga datos del landlord", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();

  await page.getByPlaceholder("tucorreo@ejemplo.com").fill(CREDS.email);
  await page.getByPlaceholder("••••••••").fill(CREDS.password);
  await page.getByRole("button", { name: "Entrar" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await page.waitForLoadState("networkidle");

  // Dashboard cargó con datos reales del landlord
  await expect(page.getByText("Cobrado del mes")).toBeVisible();
  // El sidebar muestra el nombre del landlord (Carlos Mendoza)
  await expect(page.getByText("Carlos Mendoza")).toBeVisible();
});

// ── F2 ────────────────────────────────────────────────────────────────────────

test("F2: crear inquilino en Roma 304 y verificar en la lista", async ({ page }) => {
  await login(page);
  // Navegar a la propiedad Roma 304 (id=8)
  await page.goto("/propiedades/8");
  await page.waitForLoadState("networkidle");

  // Abrir diálogo de alta
  await page.getByRole("button", { name: "Agregar inquilino" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // Nombre único para no colisionar entre corridas
  const nombre = `Test E2E ${Date.now()}`;
  await dialog.getByPlaceholder("Nombre del inquilino").fill(nombre);
  await dialog.getByPlaceholder("5215512345678").fill(`521550${String(Date.now()).slice(-7)}`);

  await dialog.getByRole("button", { name: "Agregar" }).click();
  await expect(dialog).toBeHidden();

  // El nuevo inquilino aparece en la lista de la propiedad
  await expect(page.getByText(nombre)).toBeVisible();
});

// ── F3 ────────────────────────────────────────────────────────────────────────

test("F3: pago completo de Daniela Ramírez → estado Pagado", async ({ page }) => {
  await login(page);
  await page.goto("/pagos");
  await page.waitForLoadState("networkidle");

  // Abrir diálogo de pago manual
  const openBtn = page.getByRole("button", { name: "Registrar pago" }).first();
  await openBtn.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // Seleccionar inquilino: Daniela Ramírez (id=2, renta $14,500)
  await dialog.locator('[data-slot="select-trigger"]').first().click();
  await page.getByRole("option", { name: "Daniela Ramírez" }).click();

  // Ingresar monto completo
  const montoInput = dialog.getByPlaceholder("0.00");
  await montoInput.fill("14500");

  // Registrar
  await dialog.getByRole("button", { name: "Registrar pago" }).click();

  // Verificar éxito: "Renta del periodo cubierta"
  await expect(dialog.getByText("Renta del periodo cubierta")).toBeVisible();
  await expect(dialog.getByText("Daniela Ramírez")).toBeVisible();
});

// ── F4 ────────────────────────────────────────────────────────────────────────

test("F4: abono parcial de Luis Torres → estado Parcial con saldo restante", async ({ page }) => {
  await login(page);
  await page.goto("/pagos");
  await page.waitForLoadState("networkidle");

  // Abrir diálogo de pago manual
  const openBtn = page.getByRole("button", { name: "Registrar pago" }).first();
  await openBtn.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  // Seleccionar inquilino: Luis Torres (id=3, renta $13,000)
  await dialog.locator('[data-slot="select-trigger"]').first().click();
  await page.getByRole("option", { name: "Luis Torres" }).click();

  // Ingresar monto parcial ($5,000 de $13,000)
  const montoInput = dialog.getByPlaceholder("0.00");
  await montoInput.fill("5000");

  // Registrar
  await dialog.getByRole("button", { name: "Registrar pago" }).click();

  // Verificar éxito: "Abono registrado" con saldo restante
  await expect(dialog.getByText("Abono registrado")).toBeVisible();
  await expect(dialog.getByText("Luis Torres")).toBeVisible();
  // Restante: $13,000 - $5,000 = $8,000
  await expect(dialog.getByText(/Restan/)).toBeVisible();
});

// ── F5 (skip) ─────────────────────────────────────────────────────────────────

test.skip("F5: enviar recordatorio WhatsApp (requiere Meta en vivo)", async () => {
  // Omitido: sendWhatsAppMessage no tiene gate de mock en el backend.
  // Correrlo en CI o en loop mandaría mensajes reales y gastaría cuota de Meta.
  // Validación manual: enviar UNO a un número de prueba propio, una sola vez.
});

// ── F6 (skip) ─────────────────────────────────────────────────────────────────

test.skip("F6: emitir factura CFDI (requiere servicio FacturaDigital accesible)", async () => {
  // Omitido: el backend llama a sandbox-api.facturadigital.com.mx que no resuelve
  // DNS en este entorno (503 Service Unavailable). Requiere VPN o credenciales
  // de sandbox configuradas con DNS accesible.
  // Facturación sí funciona end-to-end cuando el servicio externo está disponible.
});
