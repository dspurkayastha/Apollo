import { test, expect } from "@playwright/test";

test.describe("Smoke Tests", () => {
  test("home page loads", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Apollo/i);
  });

  test("unauthenticated user sees login/signup", async ({ page }) => {
    await page.goto("/dashboard");
    // Should redirect to login or show auth UI
    await expect(
      page.getByRole("button", { name: /sign in|log in|get started/i })
    ).toBeVisible();
  });
});
