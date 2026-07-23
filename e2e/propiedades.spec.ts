import { test, expect } from "@playwright/test";
import { buildMockData, mockBackend } from "./support/mock-api";

test.describe("Propiedades", () => {
  test("lista las propiedades con sus métricas", async ({ page }) => {
    await mockBackend(page);
    await page.goto("/propiedades");

    await expect(page.getByRole("heading", { name: "Propiedades" })).toBeVisible();
    await expect(page.getByText("2 propiedades registradas")).toBeVisible();
    await expect(page.getByText("Departamento 201").first()).toBeVisible();
    await expect(page.getByText("Casa Roma Norte").first()).toBeVisible();

    // Renta mensual esperada: 8,500 + 9,500 + 12,000 (el strip recorta decimales)
    await expect(page.getByText("$30,000", { exact: true })).toBeVisible();
  });

  test("crea una propiedad desde el diálogo", async ({ page }) => {
    await mockBackend(page);
    await page.goto("/propiedades");

    // .first(): mientras cargan las propiedades el estado vacío también
    // muestra un botón "Nueva propiedad"; ambos abren el mismo diálogo
    await page.getByRole("button", { name: "Nueva propiedad" }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();

    await page.getByPlaceholder("Ej. Departamento 201").fill("Loft Centro");
    await page.getByRole("button", { name: "Guardar" }).click();

    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.getByText("Loft Centro").first()).toBeVisible();
    await expect(page.getByText("3 propiedades registradas")).toBeVisible();
  });

  test("muestra el estado vacío sin propiedades", async ({ page }) => {
    const data = buildMockData();
    data.properties = [];
    data.tenants = [];
    await mockBackend(page, data);
    await page.goto("/propiedades");

    await expect(page.getByText("Sin propiedades aún")).toBeVisible();
    await expect(
      page.getByText("Agrega tu primera propiedad para comenzar")
    ).toBeVisible();
  });
});
