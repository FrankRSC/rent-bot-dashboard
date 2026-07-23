import { test, expect } from "@playwright/test";
import { buildMockData, mockBackend, mockBackendDown } from "./support/mock-api";

test.describe("Navegación y shell", () => {
  test("la raíz redirige al dashboard", async ({ page }) => {
    await mockBackend(page);
    await page.goto("/");

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText("Cobrado del mes")).toBeVisible();
  });

  test("navega entre secciones con el sidebar", async ({ page }) => {
    await mockBackend(page);
    await page.goto("/dashboard");

    const sections = [
      { link: "Propiedades", heading: "Propiedades" },
      { link: "Pagos", heading: "Seguimiento de pagos" },
      { link: "Reportes", heading: "Reportes" },
      { link: "Recordatorios", heading: "Recordatorios" },
      { link: "Configuración", heading: "Configuración" },
    ];

    for (const { link, heading } of sections) {
      await page.getByRole("link", { name: link }).click();
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    }
  });

  test("muestra Facturas en el sidebar al hidratar el flag en el bootstrap", async ({ page }) => {
    // fetchLandlordSettings corre en DataBootstrap: el link aparece sin pasar
    // por Configuración (antes solo se hidrataba al visitar esa página).
    await mockBackend(page);
    await page.goto("/dashboard");

    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Facturas" })).toBeVisible();
  });

  test("oculta Facturas del sidebar cuando el flag está apagado", async ({ page }) => {
    const data = buildMockData();
    data.landlord.facturasEnabled = false;
    await mockBackend(page, data);
    await page.goto("/dashboard");

    await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Facturas" })).toHaveCount(0);
  });

  test("muestra el estado de error cuando el backend no responde", async ({ page }) => {
    await mockBackendDown(page);
    await page.goto("/dashboard");

    await expect(
      page.getByText("Algo salió mal al cargar los datos")
    ).toBeVisible();
    // El banner de conexión y el ApiErrorState del main tienen su propio botón
    await expect(
      page.getByRole("main").getByRole("button", { name: "Reintentar" })
    ).toBeVisible();
  });
});
