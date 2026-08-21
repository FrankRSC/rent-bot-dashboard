import { test, expect } from "@playwright/test";
import { buildMockData, mockBackend } from "./support/mock-api";

test.describe("Dashboard", () => {
  test("muestra el resumen de cobranza del mes", async ({ page }) => {
    await mockBackend(page);
    await page.goto("/dashboard");

    await expect(page.getByText("Cobrado del mes")).toBeVisible();
    // Un pago VERIFIED de $8,500 este mes (el hero separa enteros y decimales)
    await expect(page.getByText("$8,500", { exact: true })).toBeVisible();
    await expect(page.getByText("En vivo")).toBeVisible();

    // Desglose bajo la barra de progreso: 1 Pagado / 1 Pendiente / 1 Vencido
    // (.first(): "1 vencido" también aparece como chip en "Estado de contratos")
    await expect(page.getByText("1 cobrado", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("1 pendiente", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("1 vencido", { exact: true }).first()).toBeVisible();
  });

  test("lista los contratos con su estado de pago", async ({ page }) => {
    await mockBackend(page);
    await page.goto("/dashboard");

    await expect(page.getByText("Estado de contratos")).toBeVisible();

    // Cada fila se renderiza dos veces (variante móvil oculta + escritorio),
    // por eso se filtra por visibilidad antes de tomar la primera coincidencia.
    for (const name of ["María López García", "Carlos Ramírez Soto", "Ana Torres Vega"]) {
      await expect(page.getByText(name).filter({ visible: true }).first()).toBeVisible();
    }
    // Escala de tres plazos desde 2026-08-16: el fixture tiene un Pagado (María),
    // un Vigente (Carlos) y un Atrasado (Ana, antes "Vencido").
    //
    // Se afirma sobre las etiquetas de MovimientosBadge y no sobre los valores del
    // enum: esta tabla usa la variante compacta, que renombra `Pagado` → "Cobrado"
    // y `Vigente` → "En plazo".
    for (const status of ["Cobrado", "En plazo", "⚠ Atrasado"]) {
      await expect(
        page.getByText(status, { exact: true }).filter({ visible: true }).first()
      ).toBeVisible();
    }
  });

  test("muestra el estado vacío cuando no hay contratos", async ({ page }) => {
    const data = buildMockData();
    data.properties = [];
    data.tenants = [];
    data.payments = [];
    await mockBackend(page, data);
    await page.goto("/dashboard");

    await expect(page.getByText("No hay contratos registrados")).toBeVisible();
    await expect(page.getByRole("link", { name: /Agregar propiedad/ })).toBeVisible();
  });
});
