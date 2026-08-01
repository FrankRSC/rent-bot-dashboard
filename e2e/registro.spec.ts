import { test, expect } from "@playwright/test";
import { buildMockData, mockBackend } from "./support/mock-api";

// Helpers para rellenar campos con eventos de teclado reales (React 19 requiere
// pressSequentially en lugar de fill para disparar onChange correctamente).
async function fillForm(
  page: Parameters<typeof mockBackend>[0],
  data: { name?: string; email?: string; phone?: string; password?: string; confirm?: string }
) {
  if (data.name !== undefined) {
    await page.getByPlaceholder("Juan Pérez").click();
    await page.getByPlaceholder("Juan Pérez").pressSequentially(data.name);
  }
  if (data.email !== undefined) {
    await page.getByPlaceholder("tucorreo@ejemplo.com").click();
    await page.getByPlaceholder("tucorreo@ejemplo.com").pressSequentially(data.email);
  }
  if (data.phone !== undefined) {
    await page.getByPlaceholder("55 1234 5678").click();
    await page.getByPlaceholder("55 1234 5678").pressSequentially(data.phone);
  }
  if (data.password !== undefined) {
    await page.getByPlaceholder("Mínimo 8 caracteres").click();
    await page.getByPlaceholder("Mínimo 8 caracteres").pressSequentially(data.password);
  }
  if (data.confirm !== undefined) {
    await page.getByPlaceholder("Repite tu contraseña").click();
    await page.getByPlaceholder("Repite tu contraseña").pressSequentially(data.confirm);
  }
}

test.describe("Autoregistro de arrendadores (/registro)", () => {
  test("muestra el formulario con todos los campos", async ({ page }) => {
    await mockBackend(page, buildMockData(), { authenticated: false });
    await page.goto("/registro");

    await expect(page.getByRole("heading", { name: "Crear cuenta" })).toBeVisible();
    await expect(page.getByPlaceholder("Juan Pérez")).toBeVisible();
    await expect(page.getByPlaceholder("tucorreo@ejemplo.com")).toBeVisible();
    await expect(page.getByPlaceholder("55 1234 5678")).toBeVisible();
    await expect(page.getByPlaceholder("Mínimo 8 caracteres")).toBeVisible();
    await expect(page.getByPlaceholder("Repite tu contraseña")).toBeVisible();
  });

  test("el botón está deshabilitado con campos vacíos", async ({ page }) => {
    await mockBackend(page, buildMockData(), { authenticated: false });
    await page.goto("/registro");

    await expect(page.getByRole("button", { name: "Crear cuenta" })).toBeDisabled();
  });

  test("login page tiene link a /registro", async ({ page }) => {
    await mockBackend(page, buildMockData(), { authenticated: false });
    await page.goto("/login");

    await page.getByRole("link", { name: "Regístrate" }).click();
    await expect(page).toHaveURL(/\/registro$/);
  });

  test("registro page tiene link de vuelta a /login", async ({ page }) => {
    await mockBackend(page, buildMockData(), { authenticated: false });
    await page.goto("/registro");

    await page.getByRole("link", { name: "Inicia sesión" }).click();
    await expect(page).toHaveURL(/\/login$/);
  });

  test("contraseñas que no coinciden muestran error sin llamar al backend", async ({ page }) => {
    await mockBackend(page, buildMockData(), { authenticated: false });
    await page.goto("/registro");

    await fillForm(page, {
      name: "Juan Pérez",
      email: "juan@ejemplo.com",
      phone: "5512345678",
      password: "contrasena123",
      confirm: "otracontrasena",
    });
    await expect(page.getByRole("button", { name: "Crear cuenta" })).toBeEnabled();
    await page.getByRole("button", { name: "Crear cuenta" }).click();

    await expect(page.getByText("Las contraseñas no coinciden.")).toBeVisible();
    await expect(page).toHaveURL(/\/registro$/);
  });

  test("contraseña menor a 8 caracteres muestra error", async ({ page }) => {
    await mockBackend(page, buildMockData(), { authenticated: false });
    await page.goto("/registro");

    await fillForm(page, {
      name: "Juan Pérez",
      email: "juan@ejemplo.com",
      phone: "5512345678",
      password: "corta",
      confirm: "corta",
    });
    await expect(page.getByRole("button", { name: "Crear cuenta" })).toBeEnabled();
    await page.getByRole("button", { name: "Crear cuenta" }).click();

    await expect(page.getByText("La contraseña debe tener al menos 8 caracteres.")).toBeVisible();
    await expect(page).toHaveURL(/\/registro$/);
  });

  test("registro exitoso redirige a /login con banner de éxito", async ({ page }) => {
    await mockBackend(page, buildMockData(), { authenticated: false });
    await page.goto("/registro");

    await fillForm(page, {
      name: "Nuevo Arrendador",
      email: "nuevo@ejemplo.com",
      phone: "5598765432",
      password: "micontrasena123",
      confirm: "micontrasena123",
    });
    await expect(page.getByRole("button", { name: "Crear cuenta" })).toBeEnabled();
    await page.getByRole("button", { name: "Crear cuenta" }).click();

    await expect(page).toHaveURL(/\/login\?registered=1$/);
    await expect(page.getByText("Cuenta creada exitosamente")).toBeVisible();
  });

  test("email duplicado muestra error 409", async ({ page }) => {
    const data = buildMockData();
    await mockBackend(page, data, { authenticated: false });
    await page.goto("/registro");

    await fillForm(page, {
      name: "Copia",
      email: data.landlord.email,
      phone: "5500000000",
      password: "contrasena123",
      confirm: "contrasena123",
    });
    await expect(page.getByRole("button", { name: "Crear cuenta" })).toBeEnabled();
    await page.getByRole("button", { name: "Crear cuenta" }).click();

    await expect(page.getByText("Ya existe una cuenta con ese correo.")).toBeVisible();
    await expect(page).toHaveURL(/\/registro$/);
  });

  test("error de servidor muestra mensaje genérico", async ({ page }) => {
    const data = buildMockData();
    await mockBackend(page, data, { authenticated: false });

    await page.route("**/api/landlords", (route) => {
      if (route.request().method() === "POST") {
        route.fulfill({ status: 500, body: "Internal Server Error" });
      } else {
        route.fallback();
      }
    });

    await page.goto("/registro");
    await fillForm(page, {
      name: "Juan",
      email: "juan@ejemplo.com",
      phone: "5512345678",
      password: "contrasena123",
      confirm: "contrasena123",
    });
    await expect(page.getByRole("button", { name: "Crear cuenta" })).toBeEnabled();
    await page.getByRole("button", { name: "Crear cuenta" }).click();

    await expect(page.getByText("No se pudo crear la cuenta.")).toBeVisible();
    await expect(page).toHaveURL(/\/registro$/);
  });
});
