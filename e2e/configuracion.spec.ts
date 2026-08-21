import { test, expect } from "@playwright/test";
import { mockBackend } from "./support/mock-api";

test.describe("Configuración", () => {
  test("persiste cada toggle de notificaciones en el backend", async ({ page }) => {
    const data = await mockBackend(page);
    await page.goto("/configuracion");

    const prefs = [
      { label: "Notificar al recibir pago", key: "notifyOnPayment" },
      { label: "Notificar pagos vencidos", key: "notifyOnOverdue" },
      { label: "Recordatorios automáticos", key: "autoRemindersEnabled" },
    ] as const;

    for (const { label, key } of prefs) {
      const row = page.locator("div.flex.justify-between", { hasText: label });
      const toggle = row.getByRole("switch");
      await expect(toggle).toBeChecked();

      const patch = page.waitForRequest(
        (r) =>
          r.method() === "PATCH" &&
          /\/landlords\/[^/]+$/.test(new URL(r.url()).pathname.replace(/^\/api/, ""))
      );
      await toggle.click();
      const request = await patch;

      // PATCH estricto: solo la preferencia tocada, sin campos extra.
      expect(request.postDataJSON()).toEqual({ [key]: false });
      await expect(toggle).not.toBeChecked();
      expect(data.landlord[key]).toBe(false);
    }
  });

  test("revierte el toggle si el backend rechaza el PATCH", async ({ page }) => {
    await mockBackend(page);
    await page.goto("/configuracion");

    const row = page.locator("div.flex.justify-between", {
      hasText: "Notificar al recibir pago",
    });
    const toggle = row.getByRole("switch");
    await expect(toggle).toBeChecked();

    // El PATCH falla (backend estricto → 400); los GET siguen al mock normal.
    await page.route("**/landlords/**", (route) =>
      route.request().method() === "PATCH"
        ? route.fulfill({
            status: 400,
            contentType: "application/json",
            body: JSON.stringify({ message: "property notifyOnPayment should not exist" }),
          })
        : route.fallback()
    );

    await toggle.click();

    // Rollback optimista: el switch vuelve a encendido y se avisa del error.
    await expect(toggle).toBeChecked();
    await expect(
      page.getByText("No se pudo guardar. Verifica tu conexión e intenta de nuevo.")
    ).toBeVisible();
  });
});
