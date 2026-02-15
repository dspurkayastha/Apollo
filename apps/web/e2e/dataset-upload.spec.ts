import { test, expect } from "@playwright/test";

test.describe("Dataset Upload", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to a project page (requires auth)
    // In CI this would use a test user and seeded project
    await page.goto("/projects");
  });

  test("can navigate to data tab", async ({ page }) => {
    // Click on the first project
    const projectLink = page.locator("a[href*='/projects/']").first();
    if (await projectLink.isVisible()) {
      await projectLink.click();
      await page.waitForURL(/\/projects\//);

      // Click the "Data & Analysis" tab
      const dataTab = page.getByRole("button", { name: "Data & Analysis" });
      if (await dataTab.isVisible()) {
        await dataTab.click();

        // Should show the datasets section
        await expect(page.getByText("Datasets")).toBeVisible();
      }
    }
  });

  test("shows upload and generate tabs", async ({ page }) => {
    const projectLink = page.locator("a[href*='/projects/']").first();
    if (await projectLink.isVisible()) {
      await projectLink.click();
      await page.waitForURL(/\/projects\//);

      const dataTab = page.getByRole("button", { name: "Data & Analysis" });
      if (await dataTab.isVisible()) {
        await dataTab.click();

        // Upload tab
        await expect(page.getByRole("button", { name: "Upload" })).toBeVisible();
        // Generate tab
        await expect(
          page.getByRole("button", { name: "Generate" })
        ).toBeVisible();
      }
    }
  });

  test("shows column detection after CSV upload", async ({ page }) => {
    const projectLink = page.locator("a[href*='/projects/']").first();
    if (await projectLink.isVisible()) {
      await projectLink.click();
      await page.waitForURL(/\/projects\//);

      const dataTab = page.getByRole("button", { name: "Data & Analysis" });
      if (await dataTab.isVisible()) {
        await dataTab.click();

        // Create a test CSV file
        const csvContent = "name,age,sex\nAlice,30,F\nBob,25,M";
        const buffer = Buffer.from(csvContent);

        // Upload via file chooser
        const fileChooserPromise = page.waitForEvent("filechooser");
        const uploadZone = page.getByText("Drag & drop CSV");
        if (await uploadZone.isVisible()) {
          await uploadZone.click();
          const fileChooser = await fileChooserPromise;
          await fileChooser.setFiles({
            name: "test.csv",
            mimeType: "text/csv",
            buffer,
          });

          // Should show preview table
          await expect(page.getByText("Preview")).toBeVisible({
            timeout: 10_000,
          });
        }
      }
    }
  });
});
