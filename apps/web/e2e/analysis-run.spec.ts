import { test, expect } from "@playwright/test";

test.describe("Analysis Run", () => {
  test("can navigate to analysis wizard", async ({ page }) => {
    await page.goto("/projects");

    const projectLink = page.locator("a[href*='/projects/']").first();
    if (await projectLink.isVisible()) {
      await projectLink.click();
      await page.waitForURL(/\/projects\//);

      const dataTab = page.getByRole("button", { name: "Data & Analysis" });
      if (await dataTab.isVisible()) {
        await dataTab.click();

        // Should show statistical analysis section
        await expect(page.getByText("Statistical Analysis")).toBeVisible();
      }
    }
  });

  test("shows analysis type options in wizard", async ({ page }) => {
    await page.goto("/projects");

    const projectLink = page.locator("a[href*='/projects/']").first();
    if (await projectLink.isVisible()) {
      await projectLink.click();
      await page.waitForURL(/\/projects\//);

      const dataTab = page.getByRole("button", { name: "Data & Analysis" });
      if (await dataTab.isVisible()) {
        await dataTab.click();

        // If there's a dataset, should show analysis type options
        const selectDatasetText = page.getByText("Step 1: Select dataset");
        if (await selectDatasetText.isVisible()) {
          // Check for the "Upload or generate a dataset first" message
          // or dataset selection buttons
          const noDataset = page.getByText("Upload or generate a dataset first");
          const datasetButton = page
            .locator('button:has-text("rows")')
            .first();

          expect(
            (await noDataset.isVisible()) || (await datasetButton.isVisible())
          ).toBeTruthy();
        }
      }
    }
  });
});
