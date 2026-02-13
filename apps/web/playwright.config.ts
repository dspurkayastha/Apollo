import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "html" : "list",
  timeout: 30_000,

  use: {
    baseURL: process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? "3000"}`,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [
    // Mobile-first: 375px (minimum responsive target)
    {
      name: "mobile",
      use: {
        ...devices["iPhone 13"],
        viewport: { width: 375, height: 812 },
      },
    },
    // Tablet: 768px
    {
      name: "tablet",
      use: {
        ...devices["iPad Mini"],
        viewport: { width: 768, height: 1024 },
      },
    },
    // Desktop: 1280px
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 720 },
      },
    },
  ],

  // Start local dev server for E2E tests
  webServer: {
    command: "pnpm dev",
    url: `http://localhost:${process.env.PORT ?? "3000"}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
