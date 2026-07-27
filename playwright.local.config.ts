/**
 * Configuración local para entornos donde el puerto 3000 está ocupado
 * por otro proceso (Docker, WSL relay, etc.). Usa el puerto 3002.
 * No commitear — es solo para desarrollo local.
 */
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testIgnore: ["**/integration/**"],
  fullyParallel: true,
  forbidOnly: false,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
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
    command: "npm run dev",
    url: "http://localhost:4000",
    reuseExistingServer: true,
    timeout: 120_000,
    env: { BACKEND_URL: "http://127.0.0.1:3001" },
  },
});
