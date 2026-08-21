/**
 * Pruebas de integración E2E — front ↔ backend real (:3001).
 *
 * NO se usa mock-api.ts: todas las peticiones llegan al backend real vía el
 * BFF en /api/[...path]/route.ts → http://localhost:3001.
 *
 * Pre-requisitos (ver playwright.integration.config.ts):
 *  - Backend corriendo en :3001
 *  - Seed corrido: landlord test-landlord@rentdemo.com / SaveTime123!
 *    IDs de propiedades son dinámicos — no harcodear IDs en los tests.
 *    Inquilinos del seed: Daniela Ramírez, Luis Torres (en "Depto Roma 304")
 *
 * Flujos cubiertos:
 *  F1 — Login real + dashboard carga datos del landlord
 *  F2 — Crear inquilino → aparece en la lista
 *  F3 — Pago completo (Daniela $14,500) → estado Pagado
 *  F4 — Abono parcial (Luis Torres $5,000 de $13,000) → estado Parcial
 *  F5 — skip: requiere WhatsApp real (Meta)
 *  F6 — skip: requiere servicio CFDI externo (FacturaDigital sandbox no resuelve DNS)
 *  F9 — Abono parcial + ajuste de periodo → el saldo ajustado queda cubierto
 *  F10 — Intento rechazado a mano (PATCH .../review REJECT) → estado Rechazado
 *  F11 — pendiente: revisión manual (REVIEW) requiere sembrar el intento vía SQL
 *        del lado backend; ver rent-collector-sync.md (coordinado por ese canal,
 *        no se investiga el repo del backend directo desde este lado).
 *
 * F7 (verificado) y F8 (parcial) por WhatsApp real no son testeables en Playwright
 * black-box (confirmado por el backend en el sync): ya los cubren F3/F4 por el
 * mismo motor de decisión (`/payments/manual`), solo cambia `source`.
 */
import { test, expect, type Page } from "@playwright/test";
import { dbQueryOne } from "../support/db";

const CREDS = { email: "test-landlord@rentdemo.com", password: "SaveTime123!" };

async function login(page: Page): Promise<void> {
  await page.goto("/login");
  await page.getByPlaceholder("tucorreo@ejemplo.com").fill(CREDS.email);
  await page.getByPlaceholder("••••••••").fill(CREDS.password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL("**/dashboard", { timeout: 60_000 });
  await page.waitForLoadState("networkidle");
}

/**
 * Abre el diálogo de "Registrar pago" (`PaymentDialog.tsx`), elige el inquilino
 * y entra al formulario manual. Dos pasos desde el rediseño: fase "idle"
 * (elegir inquilino + adjuntar comprobante u optar por "Ingresar datos a mano")
 * → fase "manual" (monto, método, fecha, periodo). No llena el monto —
 * cada test lo hace porque el valor varía por escenario.
 */
async function openManualPayment(page: Page, tenantName: string) {
  await page.getByRole("button", { name: "Registrar pago" }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  await dialog.locator('[data-slot="select-trigger"]').first().click();
  await page.getByRole("option", { name: tenantName }).click();
  await dialog.getByRole("button", { name: "Ingresar datos a mano" }).click();

  return dialog;
}

// ── F1 ────────────────────────────────────────────────────────────────────────

test("F1: login real y dashboard carga datos del landlord", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();

  await page.getByPlaceholder("tucorreo@ejemplo.com").fill(CREDS.email);
  await page.getByPlaceholder("••••••••").fill(CREDS.password);
  await page.getByRole("button", { name: "Entrar" }).click();

  // Timeout extendido: primera llamada al backend tras el seed puede ser lenta.
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 60_000 });
  await page.waitForLoadState("networkidle");

  // Dashboard cargó con datos reales del landlord.
  // Se afirma sobre el encabezado y no sobre "Cobrado del mes": ese texto también
  // existe en el resumen de admin, así que no distinguiría un login de arrendador
  // de uno que cayó en /admin por tener el email en ADMIN_EMAILS.
  await expect(page.getByRole("heading", { name: "Resumen de cobranza" })).toBeVisible();
  // El sidebar muestra el nombre del landlord (Carlos Mendoza)
  await expect(page.getByText("Carlos Mendoza")).toBeVisible();
});

// ── F2 ────────────────────────────────────────────────────────────────────────

test("F2: crear inquilino en Depto Roma 304 y verificar en la lista", async ({ page }) => {
  await login(page);
  // Navegar a propiedades y entrar a "Depto Roma 304" por nombre (ID dinámico)
  await page.goto("/propiedades");
  await page.waitForLoadState("networkidle");
  await page.getByRole("link", { name: /Depto Roma 304/i }).first().click();
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

  // Seleccionar inquilino: Daniela Ramírez (renta $14,500)
  const dialog = await openManualPayment(page, "Daniela Ramírez");

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

  // Seleccionar inquilino: Luis Torres (renta $13,000)
  const dialog = await openManualPayment(page, "Luis Torres");

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

// ── F9 ────────────────────────────────────────────────────────────────────────

test("F9: abono parcial + ajuste de periodo → el saldo ajustado queda cubierto", async ({ page }) => {
  await login(page);

  // Inquilino nuevo con renta de $10,000 en Depto Roma 304 (no colisiona con F3/F4)
  await page.goto("/propiedades");
  await page.waitForLoadState("networkidle");
  await page.getByRole("link", { name: /Depto Roma 304/i }).first().click();
  await page.waitForLoadState("networkidle");

  const tenantName = `Ajuste E2E ${Date.now()}`;
  await page.getByRole("button", { name: "Agregar inquilino" }).click();
  const addDialog = page.getByRole("dialog");
  await addDialog.getByPlaceholder("Nombre del inquilino").fill(tenantName);
  await addDialog.getByPlaceholder("5215512345678").fill(`521552${String(Date.now()).slice(-7)}`);
  await addDialog.getByPlaceholder("$0.00").first().fill("10000"); // Renta mensual
  await addDialog.getByRole("button", { name: "Agregar" }).click();
  await expect(addDialog).toBeHidden();
  await expect(page.getByText(tenantName)).toBeVisible();

  // Abono parcial: $9,150 de $10,000 → queda "Parcial"
  await page.goto("/pagos");
  await page.waitForLoadState("networkidle");
  const payDialog = await openManualPayment(page, tenantName);
  await payDialog.getByPlaceholder("0.00").fill("9150");
  await payDialog.getByRole("button", { name: "Registrar pago" }).click();
  await expect(payDialog.getByText("Abono registrado")).toBeVisible();

  // Confirmar "Parcial" en la tarjeta del inquilino antes del ajuste
  await page.goto("/propiedades");
  await page.waitForLoadState("networkidle");
  await page.getByRole("link", { name: /Depto Roma 304/i }).first().click();
  await page.waitForLoadState("networkidle");

  const nameEl = page.getByText(tenantName, { exact: true });
  const card = nameEl.locator(
    "xpath=ancestor::div[contains(@class,'rounded-2xl') and contains(@class,'overflow-hidden')][1]"
  );
  await expect(card.getByText("Parcial", { exact: true })).toBeVisible();

  // Ajuste puntual del mes: la renta esperada baja a $9,150 (ya cubierto por el abono)
  await card.getByRole("button", { name: "Ajuste de mes" }).click();
  const adjustDialog = page.getByRole("dialog");
  await expect(adjustDialog).toBeVisible();
  await adjustDialog.locator('input[type="number"]').fill("9150");
  await adjustDialog.getByRole("button", { name: "Guardar ajuste" }).click();
  await expect(adjustDialog).toBeHidden();

  // paymentStatus se recalcula contra el monto ajustado, sin tocar nada más → "Pagado"
  await expect(card.getByText("Pagado", { exact: true })).toBeVisible();
  await expect(card.getByText(/Renta ajustada este mes: \$9,150/)).toBeVisible();
});

// ── F10 ───────────────────────────────────────────────────────────────────────

test("F10: intento rechazado a mano → detalle del pago muestra Rechazado", async ({ page }) => {
  await login(page);

  // Inquilino nuevo, independiente de otros tests
  await page.goto("/propiedades");
  await page.waitForLoadState("networkidle");
  await page.getByRole("link", { name: /Depto Roma 304/i }).first().click();
  await page.waitForLoadState("networkidle");

  const tenantName = `Rechazo E2E ${Date.now()}`;
  await page.getByRole("button", { name: "Agregar inquilino" }).click();
  const addDialog = page.getByRole("dialog");
  await addDialog.getByPlaceholder("Nombre del inquilino").fill(tenantName);
  await addDialog.getByPlaceholder("5215512345678").fill(`521553${String(Date.now()).slice(-7)}`);
  await addDialog.getByPlaceholder("$0.00").first().fill("7000");
  await addDialog.getByRole("button", { name: "Agregar" }).click();
  await expect(addDialog).toBeHidden();

  // Registrar cualquier intento — el estado inicial no importa, lo vamos a rechazar a mano
  await page.goto("/pagos");
  await page.waitForLoadState("networkidle");
  const payDialog = await openManualPayment(page, tenantName);
  await payDialog.getByPlaceholder("0.00").fill("7000");
  await payDialog.getByRole("button", { name: "Registrar pago" }).click();
  await expect(payDialog.getByText("Renta del periodo cubierta")).toBeVisible();

  // Ir al detalle del intento desde la tabla de Pagos — el row completo es un <a> clicable
  await page.goto("/pagos");
  await page.waitForLoadState("networkidle");
  const row = page.getByText(tenantName, { exact: true }).first().locator(
    "xpath=ancestor::a[contains(@class,'border-b')][1]"
  );
  await row.click();
  await page.waitForURL(/\/pagos\/[^/]+$/);
  await page.waitForLoadState("networkidle");

  // Override del arrendador: rechazar el intento a mano (PATCH .../review REJECT)
  await page.getByRole("button", { name: "Rechazar" }).click();
  const reviewDialog = page.getByRole("dialog");
  await expect(reviewDialog).toBeVisible();
  await reviewDialog.getByRole("button", { name: "Rechazar" }).click();
  await expect(reviewDialog).toBeHidden();

  await expect(page.getByText("Rechazado", { exact: true })).toBeVisible();
});

// ── F11 ───────────────────────────────────────────────────────────────────────

test("F11: revisión manual (REVIEW) → arrendador aprueba a mano → Pagado (manual)", async ({ page }) => {
  await login(page);

  // Inquilino nuevo en Depto Roma 304
  await page.goto("/propiedades");
  await page.waitForLoadState("networkidle");
  await page.getByRole("link", { name: /Depto Roma 304/i }).first().click();
  await page.waitForLoadState("networkidle");

  const tenantName = `Revision E2E ${Date.now()}`;
  // 12 dígitos ya en formato final "52XXXXXXXXXX" (evita la normalización de
  // teléfonos del backend — ver §2.3 CONTRATOS_API.md — que recortaría un
  // "521..." de 13 dígitos y rompería el SELECT por phone de abajo).
  const phone = `52155${String(Date.now()).slice(-7)}`;
  await page.getByRole("button", { name: "Agregar inquilino" }).click();
  const addDialog = page.getByRole("dialog");
  await addDialog.getByPlaceholder("Nombre del inquilino").fill(tenantName);
  await addDialog.getByPlaceholder("5215512345678").fill(phone);
  await addDialog.getByPlaceholder("$0.00").first().fill("8000");
  await addDialog.getByRole("button", { name: "Agregar" }).click();
  await expect(addDialog).toBeHidden();
  await expect(page.getByText(tenantName)).toBeVisible();

  // REVIEW solo lo asigna el bot real (rama intrabancaria ambigua, whatsapp.service.ts
  // escalateToReview) — no hay endpoint para forzarlo. Se siembra el intento directo
  // por SQL con la misma forma que produce ese camino (acordado en rent-collector-sync.md
  // 2026-08-04T20:20, incluye ocr_data para que pase el guard de ownership).
  const tenantId = dbQueryOne(`SELECT id FROM tenants WHERE phone = '${phone}';`);
  const billingPeriod = new Date().toISOString().slice(0, 7);
  const amount = 8000;
  const attemptId = dbQueryOne(`
    INSERT INTO payment_attempts (
      tenant_phone, tenant_id, status, source, amount, billing_period,
      ocr_data, verified_on_first_try, completed_at, created_at
    ) VALUES (
      '${phone}', '${tenantId}', 'REVIEW', 'WHATSAPP', ${amount}, '${billingPeriod}',
      '{"bancoEmisor":"BBVA","bancoReceptor":"BBVA","isIntrabancario":true,"ocrLast4Destino":"1111","monto":"${amount}"}',
      false, now(), now()
    ) RETURNING id;
  `);

  await page.goto(`/pagos/${attemptId}`);
  await page.waitForLoadState("networkidle");
  await expect(page.locator("span").filter({ hasText: "Revisión" })).toBeVisible();

  // Aprobación manual del arrendador (PATCH .../review APPROVE) → MANUAL_VERIFIED
  await page.getByRole("button", { name: "Aprobar" }).click();
  const reviewDialog = page.getByRole("dialog");
  await expect(reviewDialog).toBeVisible();
  await reviewDialog.getByRole("button", { name: "Aprobar" }).click();
  await expect(reviewDialog).toBeHidden();

  await expect(page.getByText("Pagado (manual)", { exact: true })).toBeVisible();
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
