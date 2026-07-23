import { test, expect, type Page } from "@playwright/test";
import { buildMockData, mockBackend } from "./support/mock-api";

/**
 * El flag `facturasEnabled` vive en el store (zustand) y solo se hidrata al
 * visitar /configuracion (GET /landlords/:id). Por eso el flujo entra por ahí
 * y navega a Facturas con el link del sidebar (navegación de cliente, sin
 * recargar la página).
 */
async function openFacturas(page: Page) {
  await page.goto("/configuracion");
  const facturasLink = page.getByRole("link", { name: "Facturas" });
  await expect(facturasLink).toBeVisible();
  await facturasLink.click();
  await expect(page.getByRole("heading", { name: "Facturas" })).toBeVisible();
}

test.describe("Facturas", () => {
  test("muestra el módulo desactivado cuando el flag está apagado", async ({ page }) => {
    const data = buildMockData();
    data.landlord.facturasEnabled = false;
    await mockBackend(page, data);
    await page.goto("/facturas");

    await expect(
      page.getByText("Módulo de facturación desactivado")
    ).toBeVisible();
  });

  test("lista las facturas cuando el flag está activo", async ({ page }) => {
    await mockBackend(page);
    await openFacturas(page);

    await expect(page.getByText("CFDI 4.0 emitidos a inquilinos")).toBeVisible();

    // Solo la factura de María está timbrada: total timbrado = $9,860.00.
    // Las filas tienen variante móvil oculta, por eso el filtro de visibilidad.
    await expect(page.getByText("$9,860.00").first()).toBeVisible();
    for (const text of ["Timbrada", "Borrador"]) {
      await expect(
        page.getByText(text, { exact: true }).filter({ visible: true }).first()
      ).toBeVisible();
    }
    for (const name of ["María López García", "Carlos Ramírez Soto"]) {
      await expect(page.getByText(name).filter({ visible: true }).first()).toBeVisible();
    }
  });

  test("emite una nueva factura", async ({ page }) => {
    await mockBackend(page);
    await openFacturas(page);

    await page.getByRole("button", { name: "Nueva factura" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Elegir inquilino; el monto se autollena con su renta mensual
    await dialog.locator('[data-slot="select-trigger"]').click();
    await page.getByRole("option", { name: "Ana Torres Vega" }).click();
    await expect(dialog.getByPlaceholder("0.00")).toHaveValue("12000");

    await dialog.getByRole("button", { name: "Emitir factura" }).click();
    await expect(dialog).toBeHidden();

    // La factura nueva encabeza la lista (2 mockeadas + 1 emitida)
    await expect(
      page.getByText("Ana Torres Vega").filter({ visible: true }).first()
    ).toBeVisible();
    await expect(page.getByText("3 facturas", { exact: true }).first()).toBeVisible();
  });

  test("cancela una factura timbrada", async ({ page }) => {
    await mockBackend(page);
    await openFacturas(page);

    // La fila de María es la única timbrada; su único botón es el de cancelar
    const row = page
      .locator("div.border-slate-50", { hasText: "María López García" })
      .first();
    await row.getByRole("button").click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByText("Cancelar factura")).toBeVisible();
    await dialog.getByRole("button", { name: "Confirmar" }).click();

    await expect(dialog).toBeHidden();
    await expect(
      page.getByText("Cancelada", { exact: true }).filter({ visible: true }).first()
    ).toBeVisible();
  });
});
