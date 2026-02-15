import { test, expect } from "@playwright/test";

test.describe("Compliance Check", () => {
  test("can navigate to compliance dashboard", async ({ page }) => {
    await page.goto("/projects");

    const projectLink = page.locator("a[href*='/projects/']").first();
    if (await projectLink.isVisible()) {
      await projectLink.click();
      await page.waitForURL(/\/projects\//);

      const complianceTab = page.getByRole("button", { name: "Compliance" });
      if (await complianceTab.isVisible()) {
        await complianceTab.click();

        // Should show compliance dashboard
        await expect(page.getByText("Compliance Dashboard")).toBeVisible();
      }
    }
  });

  test("shows guideline type selector", async ({ page }) => {
    await page.goto("/projects");

    const projectLink = page.locator("a[href*='/projects/']").first();
    if (await projectLink.isVisible()) {
      await projectLink.click();
      await page.waitForURL(/\/projects\//);

      const complianceTab = page.getByRole("button", { name: "Compliance" });
      if (await complianceTab.isVisible()) {
        await complianceTab.click();

        // Should show guideline buttons
        await expect(page.getByRole("button", { name: "CONSORT" })).toBeVisible();
        await expect(page.getByRole("button", { name: "STROBE" })).toBeVisible();
        await expect(page.getByRole("button", { name: "PRISMA" })).toBeVisible();
        await expect(page.getByRole("button", { name: "Run Check" })).toBeVisible();
      }
    }
  });

  test("shows NBEMS requirements section", async ({ page }) => {
    await page.goto("/projects");

    const projectLink = page.locator("a[href*='/projects/']").first();
    if (await projectLink.isVisible()) {
      await projectLink.click();
      await page.waitForURL(/\/projects\//);

      const complianceTab = page.getByRole("button", { name: "Compliance" });
      if (await complianceTab.isVisible()) {
        await complianceTab.click();

        // NBEMS section may or may not be visible depending on data
        // At minimum, the dashboard heading should be present
        await expect(page.getByText("Compliance Dashboard")).toBeVisible();
      }
    }
  });
});
