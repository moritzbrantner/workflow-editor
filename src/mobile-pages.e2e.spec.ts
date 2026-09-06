import { expect, test } from "@playwright/test";

test("keeps the Pages workbench interactive on a phone", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chrome", "Mobile Pages regression");

  await page.addInitScript(() => window.localStorage.clear());
  await page.goto("http://127.0.0.1:4175/");

  const layout = page.locator('[data-slot="workbench-layout"]');
  const nodes = page.locator('[data-slot="workflow-builder-node"]');
  const dock = page.locator("[data-mobile-workbench-dock]");

  await expect(layout).toHaveAttribute("data-mobile-workbench", "true");
  await expect(dock).toBeVisible();
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);

  const initialNodeCount = await nodes.count();
  await dock.getByRole("button", { name: "Nodes", exact: true }).click();
  await expect(page.locator('[data-slot="workflow-palette-overlay"]')).toBeVisible();
  await page
    .locator('[data-slot="workflow-palette-overlay"]')
    .getByRole("button", { name: /Webhook trigger/ })
    .click();
  await expect(nodes).toHaveCount(initialNodeCount + 1);

  await dock.getByRole("button", { name: "Nodes", exact: true }).click();
  await page
    .locator(
      '[data-slot="workflow-builder-node"] [data-slot="workflow-node-select"][aria-label="Webhook trigger"]',
    )
    .last()
    .evaluate((element) => (element as HTMLElement).click());

  const infoButton = dock.getByRole("button", { name: "Info", exact: true });
  await expect(infoButton).toBeEnabled();
  await infoButton.click();

  const inspector = page.locator('[data-slot="workflow-inspector-overlay"]');
  await expect(inspector).toBeVisible();
  const labelInput = inspector.getByLabel("Label", { exact: true });
  await labelInput.fill("Mobile webhook");
  await labelInput.blur();

  await expect(
    page.locator(
      '[data-slot="workflow-builder-node"] [data-slot="workflow-node-select"][aria-label="Mobile webhook"]',
    ),
  ).toHaveCount(1);

  await dock.getByRole("button", { name: "Actions", exact: true }).click();
  await expect(layout).toHaveAttribute("data-mobile-sheet", "actions");
  await expect(layout.locator(':scope > [data-slot="workbench-toolbar"]')).toBeVisible();
});
