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
    await expect(page.getByText("cobrado este mes")).toBeVisible();
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

// ── Olvidé mi contraseña ───────────────────────────────────────────────────────

test.describe("Recuperar contraseña", () => {
  test("A01: página carga directamente en /recuperar-contrasena", async ({ page }) => {
    await mockBackend(page, undefined, { authenticated: false });
    await page.goto("/recuperar-contrasena");

    // Diagnóstico: loguear el HTML si el heading no aparece
    const heading = page.getByRole("heading", { name: "Recuperar contraseña" });
    await expect(heading).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel("Correo electrónico")).toBeVisible();
    await expect(page.getByRole("button", { name: "Enviar enlace" })).toBeVisible();
  });

  test("A02: logo Save Time visible en la página de auth", async ({ page }) => {
    await mockBackend(page, undefined, { authenticated: false });
    await page.goto("/login");

    // El layout de escritorio muestra el logo en el panel izquierdo;
    // el panel móvil está oculto → filtramos por el primer logo visible.
    const logo = page.locator('img[alt="Save Time"]').first();
    await expect(logo).toBeVisible({ timeout: 10_000 });
    // Verifica que tenga dimensiones reales (no imagen rota)
    const box = await logo.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(20);
    expect(box!.height).toBeGreaterThan(10);
  });

  test("A03: link '¿Olvidaste tu contraseña?' navega a /recuperar-contrasena", async ({ page }) => {
    await mockBackend(page, undefined, { authenticated: false });
    await page.goto("/login");

    await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
    await page.getByRole("link", { name: "¿Olvidaste tu contraseña?" }).click();

    await expect(page).toHaveURL(/\/recuperar-contrasena$/, { timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "Recuperar contraseña" })).toBeVisible({ timeout: 10_000 });
  });

  test("A04: enviar el formulario muestra confirmación con el correo capturado", async ({ page }) => {
    await mockBackend(page, undefined, { authenticated: false });
    await page.goto("/recuperar-contrasena");

    await expect(page.getByLabel("Correo electrónico")).toBeVisible();
    await page.getByLabel("Correo electrónico").fill("prueba@ejemplo.com");
    await page.getByRole("button", { name: "Enviar enlace" }).click();

    await expect(page.getByText("Revisa tu correo")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("prueba@ejemplo.com")).toBeVisible();
    await expect(page.getByRole("link", { name: /Volver al inicio de sesión/ })).toBeVisible();
    await expect(page.getByRole("button", { name: "Intentar con otro correo" })).toBeVisible();
  });

  test("A05: 'Intentar con otro correo' regresa al formulario vacío", async ({ page }) => {
    await mockBackend(page, undefined, { authenticated: false });
    await page.goto("/recuperar-contrasena");

    await page.getByLabel("Correo electrónico").fill("prueba@ejemplo.com");
    await page.getByRole("button", { name: "Enviar enlace" }).click();
    await expect(page.getByText("Revisa tu correo")).toBeVisible();

    await page.getByRole("button", { name: "Intentar con otro correo" }).click();

    await expect(page.getByRole("heading", { name: "Recuperar contraseña" })).toBeVisible();
    await expect(page.getByLabel("Correo electrónico")).toHaveValue("");
  });

  test("A06: 'Volver al inicio de sesión' navega a /login", async ({ page }) => {
    await mockBackend(page, undefined, { authenticated: false });
    await page.goto("/recuperar-contrasena");

    await page.getByRole("link", { name: /Volver al inicio de sesión/ }).click();

    await expect(page).toHaveURL(/\/login$/, { timeout: 10_000 });
  });
});
