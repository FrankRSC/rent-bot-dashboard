import { test, expect } from "@playwright/test";
import { buildMockData, mockBackend, VALID_PASSWORD } from "./support/mock-api";

test.describe("Autenticación (§2.9)", () => {
  test("sin sesión, el dashboard redirige a /login", async ({ page }) => {
    await mockBackend(page, undefined, { authenticated: false });
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
  });

  test("login con credenciales válidas lleva al dashboard", async ({ page }) => {
    const data = buildMockData();
    await mockBackend(page, data, { authenticated: false });
    await page.goto("/login");

    await page.getByPlaceholder("tucorreo@ejemplo.com").fill(data.landlord.email);
    await page.getByPlaceholder("••••••••").fill(VALID_PASSWORD);
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText("Cobrado del mes")).toBeVisible();
  });

  test("login con credenciales inválidas muestra error", async ({ page }) => {
    await mockBackend(page, undefined, { authenticated: false });
    await page.goto("/login");

    await page.getByPlaceholder("tucorreo@ejemplo.com").fill("francisco@ejemplo.com");
    await page.getByPlaceholder("••••••••").fill("password-incorrecto");
    await page.getByRole("button", { name: "Entrar" }).click();

    await expect(page.getByText("Correo o contraseña incorrectos.")).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });
});
