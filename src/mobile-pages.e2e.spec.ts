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
  await expect(labelInput).toHaveValue("Mobile webhook");

  await dock.getByRole("button", { name: "Actions", exact: true }).click();
  await expect(layout).toHaveAttribute("data-mobile-sheet", "actions");
  await expect(layout.locator(':scope > [data-slot="workbench-toolbar"]')).toBeVisible();
});

test("keeps mobile chrome compact, exclusive and dismissible over a live canvas", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chrome", "Mobile Pages regression");

  await page.addInitScript(() => window.localStorage.clear());
  await page.goto("http://127.0.0.1:4175/");

  const layout = page.locator('[data-slot="workbench-layout"]');
  const dock = page.locator("[data-mobile-workbench-dock]");
  const nodes = page.locator('[data-slot="workflow-builder-node"]');
  const palette = page.locator('[data-slot="workflow-palette-overlay"]');
  const actions = layout.locator(':scope > [data-slot="workbench-toolbar"]');
  const documentBar = page.locator(
    '[data-testid="workflow-editor"] > [data-slot="workbench-toolbar"]',
  );
  const surface = page.locator('[data-slot="workflow-builder-surface"]');

  await expect(layout).toHaveAttribute("data-mobile-workbench", "true");
  await expect(nodes.first()).toBeVisible();

  // Compact document bar: one row inside the viewport with document, history and save state.
  await expect(documentBar).toBeVisible();
  await expect(documentBar.getByRole("button", { name: "Undo", exact: true })).toBeVisible();
  await expect(documentBar.getByRole("button", { name: "Redo", exact: true })).toBeVisible();
  await expect(documentBar).toContainText("Saved");
  const viewport = page.viewportSize();
  if (!viewport) {
    throw new Error("Mobile project must define a viewport");
  }
  const documentBarBox = await documentBar.boundingBox();
  expect(documentBarBox?.height ?? Infinity).toBeLessThanOrEqual(56);
  expect(
    await documentBar.evaluate((element) => element.scrollWidth <= element.clientWidth + 1),
  ).toBe(true);

  // The canvas keeps most of the phone height.
  const layoutBox = await layout.boundingBox();
  expect(layoutBox?.height ?? 0).toBeGreaterThan(viewport.height * 0.75);

  // Only one sheet at a time.
  await dock.getByRole("button", { name: "Nodes", exact: true }).click();
  await expect(layout).toHaveAttribute("data-mobile-sheet", "nodes");
  await expect(palette).toBeVisible();
  await dock.getByRole("button", { name: "Actions", exact: true }).click();
  await expect(layout).toHaveAttribute("data-mobile-sheet", "actions");
  await expect(palette).toBeHidden();
  await expect(actions).toBeVisible();

  // Arrange, group, delete and nested-workflow actions stay reachable.
  await Promise.all(
    ["Arrange all", "Arrange selection", "Group", "Delete", "Create nested workflow"].map((name) =>
      expect(actions.getByRole("button", { name, exact: true })).toBeVisible(),
    ),
  );

  // Tapping the canvas dismisses the sheet without changing the graph.
  const nodeCount = await nodes.count();
  const surfaceBox = await surface.boundingBox();
  if (!surfaceBox) {
    throw new Error("Workflow surface must be visible");
  }
  await page.mouse.click(surfaceBox.x + 24, surfaceBox.y + 24);
  await expect(layout).toHaveAttribute("data-mobile-sheet", "none");
  await expect(actions).toBeHidden();
  await expect(nodes).toHaveCount(nodeCount);

  // Pan remains available behind the closed chrome.
  const firstNode = nodes.first();
  const before = await firstNode.boundingBox();
  await page.mouse.move(surfaceBox.x + 40, surfaceBox.y + 40);
  await page.mouse.down();
  await page.mouse.move(surfaceBox.x + 120, surfaceBox.y + 100, { steps: 8 });
  await page.mouse.up();
  await expect
    .poll(async () => (await firstNode.boundingBox())?.x ?? before?.x)
    .toBeGreaterThan((before?.x ?? 0) + 40);
  await expect(nodes).toHaveCount(nodeCount);
});
