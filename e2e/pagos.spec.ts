import { test, expect } from "@playwright/test";
import { mockBackend } from "./support/mock-api";

test.describe("Pagos", () => {
  test("muestra los intentos de pago con su estado", async ({ page }) => {
    await mockBackend(page);
    await page.goto("/pagos");

    await expect(
      page.getByRole("heading", { name: "Seguimiento de pagos" })
    ).toBeVisible();

    // Total cobrado = único pago VERIFIED ($8,500.00)
    await expect(page.getByText("$8,500.00").first()).toBeVisible();

    // Badges de estado de los tres intentos mockeados. Cada fila existe en
    // variante móvil (oculta en escritorio) y de escritorio: filtrar visibles.
    for (const badge of ["Verificado", "Pendiente", "Revisión"]) {
      await expect(
        page.getByText(badge, { exact: true }).filter({ visible: true }).first()
      ).toBeVisible();
    }
  });

  test("filtra por estado de pago", async ({ page }) => {
    await mockBackend(page);
    await page.goto("/pagos");

    // Los tres intentos visibles antes de filtrar
    await expect(page.getByText("3 resultados")).toBeVisible();

    // Abrir el select de estado (tercer combobox del filter bar; el trigger
    // de Base UI muestra el valor crudo "todos", no la etiqueta) y elegir "Cobrado"
    await page.locator('[data-slot="select-trigger"]').nth(2).click();
    await page.getByRole("option", { name: "Cobrado" }).click();

    // Solo queda el intento verificado (el de María)
    await expect(page.getByText("1 resultado", { exact: true })).toBeVisible();
    await expect(
      page.getByText("María López García").filter({ visible: true }).first()
    ).toBeVisible();
    await expect(page.getByText("Carlos Ramírez Soto")).toHaveCount(0);
    await expect(page.getByText("Ana Torres Vega")).toHaveCount(0);
  });
});
