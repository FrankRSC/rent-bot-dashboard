import { test, expect } from "@playwright/test";
import { mockBackend } from "./support/mock-api";

test.describe("Recordatorios", () => {
  test("envía un recordatorio real y refleja el estado del servidor", async ({ page }) => {
    await mockBackend(page);
    await page.goto("/recordatorios");

    // Carlos está "Vigente" y sin recordatorio: botón habilitado.
    const row = page.locator("div.grid", { hasText: "Carlos Ramírez Soto" });
    await expect(row.getByText("No enviado")).toBeVisible();

    const reminderPost = page.waitForRequest(
      (r) => r.method() === "POST" && /\/tenants\/2\/reminder$/.test(new URL(r.url()).pathname.replace(/^\/api/, ""))
    );
    await row.getByRole("button", { name: "Enviar ahora" }).click();
    await reminderPost;

    // El estado viene de tenant.lastReminderAt (servidor), no de una marca local.
    await expect(row.getByText("Enviado", { exact: true })).toBeVisible();
    await expect(row.getByRole("button", { name: "Reenviar" })).toBeVisible();
  });

  test("muestra el error y no marca enviado cuando el backend rechaza el envío", async ({ page }) => {
    await mockBackend(page);
    // El envío falla (p. ej. Meta rechaza la plantilla → 502); el resto de la
    // API sigue respondiendo con el mock normal.
    await page.route("**/tenants/*/reminder", (route) =>
      route.fulfill({
        status: 502,
        contentType: "application/json",
        body: JSON.stringify({ message: "Meta rechazó la plantilla" }),
      })
    );
    await page.goto("/recordatorios");

    const row = page.locator("div.grid", { hasText: "Carlos Ramírez Soto" });
    await row.getByRole("button", { name: "Enviar ahora" }).click();

    // Honestidad de la UI: error inline y NADA marcado como enviado.
    await expect(row.getByText("No se pudo enviar. Intenta de nuevo.")).toBeVisible();
    await expect(row.getByText("No enviado")).toBeVisible();
    await expect(row.getByRole("button", { name: "Enviar ahora" })).toBeEnabled();
  });

  test("no permite enviar recordatorio a un inquilino con renta pagada", async ({ page }) => {
    await mockBackend(page);
    await page.goto("/recordatorios");

    // María ya está "Pagado": el botón queda deshabilitado.
    const row = page.locator("div.grid", { hasText: "María López García" });
    await expect(row.getByRole("button", { name: "Enviar ahora" })).toBeDisabled();
  });

  test("persiste el toggle de recordatorios automáticos en el backend", async ({ page }) => {
    const data = await mockBackend(page);
    await page.goto("/recordatorios");
    // Esperar a que fetchLandlordSettings complete antes de interactuar;
    // si no, el GET /landlords/:id en vuelo puede sobrescribir el update optimista.
    await page.waitForLoadState("networkidle");

    const autoSwitch = page.getByRole("switch");
    await expect(autoSwitch).toBeChecked();

    const patch = page.waitForRequest(
      (r) => r.method() === "PATCH" && /\/landlords\/[^/]+$/.test(new URL(r.url()).pathname.replace(/^\/api/, ""))
    );
    await autoSwitch.click();
    const request = await patch;

    expect(request.postDataJSON()).toEqual({ autoRemindersEnabled: false });
    await expect(autoSwitch).not.toBeChecked();
    expect(data.landlord.autoRemindersEnabled).toBe(false);
  });
});
