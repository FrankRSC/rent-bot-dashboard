import { defineConfig, devices } from "@playwright/test";

/**
 * Pruebas E2E del dashboard. El backend NestJS (:3001) NO es necesario:
 * todas las peticiones a `/api/**` se interceptan y responden con mocks
 * (ver `e2e/support/mock-api.ts`).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://localhost:3000",
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
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Los fetch SSR (server-api.ts) apuntan aquí; con un puerto muerto fallan al
    // instante y las vistas caen al fetch de cliente (que los mocks del navegador
    // interceptan). Así los e2e no dependen del backend real.
    env: { BACKEND_URL: "http://127.0.0.1:59999" },
  },
});
