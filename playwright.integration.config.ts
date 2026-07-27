/**
 * Configuración de pruebas de integración front ↔ backend real (:3001).
 * A diferencia de playwright.config.ts (que mockea todo con page.route),
 * estas pruebas NO interceptan las peticiones — pegan al backend de verdad.
 *
 * Pre-requisitos:
 *  - Backend corriendo en http://localhost:3001 (npm run dev en rent-collector bot)
 *  - Base de datos sembrada (npm run seed en rent-collector bot)
 *  - Credenciales demo: carlos@rentdemo.com / SaveTime123!
 *
 * Notas:
 *  - Corren en serie (workers: 1) para evitar conflictos de estado en la BD.
 *  - F5 (WhatsApp) y F6 (CFDI externo) se marcan skip: requieren servicios
 *    externos no disponibles en entorno local sin credenciales de Meta/FacturaDigital.
 */
import { defineConfig, devices } from "@playwright/test";
import path from "path";

export default defineConfig({
  testDir: "./e2e/integration",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 20_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  globalSetup: path.join(__dirname, "e2e/integration/global-setup.ts"),
  use: {
    baseURL: "http://localhost:4000",
    locale: "es-MX",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev -- -p 4000",
    url: "http://localhost:4000",
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      // Usar IP explícita para evitar happy-eyeballs IPv4/IPv6 en Node fetch.
      BACKEND_URL: "http://127.0.0.1:3001",
    },
  },
});
