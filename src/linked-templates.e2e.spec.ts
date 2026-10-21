import { expect, test, type Page } from "@playwright/test";

// Pages acceptance for linked shared templates (#65): publish a composed node, link it into a
// second workflow, propagate a compatible revision, pin an incompatible one until an explicit
// upgrade, detach, and keep it all across a reload.

const workbench = "http://127.0.0.1:4175/";
const mod = process.platform === "darwin" ? "Meta" : "Control";

async function openDocument(page: Page, from: string, id: string, name: string) {
  await page.getByRole("button", { name: from, exact: true }).click();
  await page
    .locator('select[aria-label="Workflow document"]')
    .filter({ visible: true })
    .first()
    .selectOption(id);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
}

async function selectNode(page: Page, label: string) {
  await page
    .locator(`[data-slot="workflow-node-select"][aria-label="${label}"]:visible`)
    .first()
    .evaluate((element) => (element as HTMLElement).click());
}

async function composeAll(page: Page) {
  await page.locator('[data-slot="workflow-builder-surface"]').first().focus();
  await page.keyboard.press(`${mod}+A`);
  await page.getByRole("button", { name: "Compose", exact: true }).click();
}

const panel = (page: Page) =>
  page
    .getByRole("region", { name: "Shared template", exact: true })
    .filter({ visible: true })
    .first();

test("publishes, links, propagates, pins, upgrades and detaches shared templates", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Desktop Pages acceptance");
  await page.goto(workbench);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Sales Data Pipeline", exact: true }),
  ).toBeVisible();

  // Publish: compose the data pipeline and publish it as "Sales Batch".
  await composeAll(page);
  await panel(page).getByLabel("Shared template name").fill("Sales Batch");
  await panel(page).getByRole("button", { name: "Publish as shared template" }).click();
  await expect(panel(page)).toContainText("Linked to Sales Batch · revision 1");
  // The linked instance compiles through the catalog (composed nodes are inlined).
  await page.getByRole("button", { name: "Compile workflow", exact: true }).click();
  await expect(page.getByRole("region", { name: "Compiled contract" })).toContainText(
    /not executed/i,
  );
  await page.getByRole("button", { name: "Close compiled contract" }).click();

  // Link: insert the shared template into the media pipeline from the palette.
  await openDocument(page, "Sales Data Pipeline", "media-pipeline", "Product Image Generation");
  await page.getByLabel("Search node palette").fill("Sales Batch");
  await page
    .locator('[data-slot="workflow-palette-overlay"]')
    .getByRole("button", { name: /Sales Batch/ })
    .first()
    .click();
  await expect(panel(page)).toContainText("revision 1");
  await expect(panel(page).getByRole("list", { name: "Linked instances" })).toContainText(
    "Sales Data Pipeline",
  );
  // The template brought its TypeScript declarations (SalesRecord), so this document compiles.
  await page.getByRole("button", { name: "Compile workflow", exact: true }).click();
  await expect(page.getByRole("region", { name: "Compiled contract" })).toContainText(
    /not executed/i,
  );
  await page.getByRole("button", { name: "Close compiled contract" }).click();

  // Compatible revision: detach the original, restore, rename an inner node, recompose, publish.
  await openDocument(page, "Product Image Generation", "data-pipeline", "Sales Data Pipeline");
  await selectNode(page, "Sales Batch");
  await panel(page).getByRole("button", { name: "Detach to local copy" }).click();
  await page.getByRole("button", { name: "Restore composition", exact: true }).click();
  await selectNode(page, "Validate records");
  await page.locator('input[aria-label="Label"]:visible').first().fill("Validate batch");
  await page.getByRole("button", { name: "Apply" }).filter({ visible: true }).first().click();
  await composeAll(page);
  await panel(page).getByLabel("Publish as a revision of").selectOption("sales-batch");
  await panel(page).getByRole("button", { name: "Publish as new revision" }).click();
  await expect(panel(page)).toContainText("revision 2");

  await openDocument(page, "Sales Data Pipeline", "media-pipeline", "Product Image Generation");
  await selectNode(page, "Sales Batch");
  await expect(panel(page)).toContainText("Linked to Sales Batch · revision 2");

  // Incompatible revision: drop a node so the ports change, then publish revision 3.
  await openDocument(page, "Product Image Generation", "data-pipeline", "Sales Data Pipeline");
  const composed = page.locator('[data-slot="workflow-node-select"]:visible').first();
  await composed.evaluate((element) => (element as HTMLElement).click());
  await panel(page).getByRole("button", { name: "Detach to local copy" }).click();
  await page.getByRole("button", { name: "Restore composition", exact: true }).click();
  await selectNode(page, "Quarantine batch");
  await page.keyboard.press("Delete");
  await composeAll(page);
  await panel(page).getByLabel("Publish as a revision of").selectOption("sales-batch");
  await expect(panel(page)).toContainText("These ports differ from revision 2");
  await panel(page).getByRole("button", { name: "Publish as new revision" }).click();
  await expect(panel(page)).toContainText("revision 3");

  // The other consumer stays pinned on revision 2 until an explicit upgrade.
  await openDocument(page, "Sales Data Pipeline", "media-pipeline", "Product Image Generation");
  await selectNode(page, "Sales Batch");
  await expect(panel(page)).toContainText("revision 2");
  await expect(panel(page).getByRole("status")).toContainText("Revision 3 changes the ports");
  await panel(page).getByRole("button", { name: "Upgrade to revision 3" }).click();
  await expect(panel(page)).toContainText("Linked to Sales Batch · revision 3");

  // Reload keeps the catalog revisions and the upgraded link.
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Product Image Generation", exact: true }),
  ).toBeVisible();
  await selectNode(page, "Sales Batch");
  await expect(panel(page)).toContainText("Linked to Sales Batch · revision 3");

  // Detach makes a local copy that no longer follows the catalog.
  await panel(page).getByRole("button", { name: "Detach to local copy" }).click();
  await expect(
    panel(page).getByRole("button", { name: "Publish as shared template" }),
  ).toBeVisible();
});
