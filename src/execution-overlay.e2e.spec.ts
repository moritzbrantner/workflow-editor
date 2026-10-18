import { expect, test, type Page } from "@playwright/test";

// Host-supplied run snapshots (#20): live updates, a retry and switching to a past run, without
// the overlay ever entering the authored document.

async function nodeHeader(page: Page, label: string) {
  return page
    .locator('[data-slot="workflow-builder-node"]:visible')
    .filter({ has: page.locator(`[data-slot="workflow-node-select"][aria-label="${label}"]`) })
    .first();
}

async function showRun(page: Page, key: string) {
  await page.getByRole("button", { name: `Show ${key} run`, exact: true }).click();
}

test("updates live run state, shows a retry and switches runs without touching the document", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Desktop overlay coverage");
  await page.goto(`/?storageKey=execution-overlay-${testInfo.retry}&clearStorageKey=1&execution=1`);
  const documentBefore = await page.getByTestId("document-json").textContent();

  await page
    .locator('[data-slot="workflow-node-select"][aria-label="Transform"]:visible')
    .first()
    .evaluate((element) => (element as HTMLElement).click());
  const details = page.getByRole("region", { name: "Run details" });

  await showRun(page, "running");
  await expect(await nodeHeader(page, "Transform")).toContainText("Running");
  await expect(await nodeHeader(page, "Input")).toContainText("Succeeded");
  await expect(details).toContainText("Run run-1");
  await expect(details).toContainText("Attempt1");

  await showRun(page, "failed");
  await expect(await nodeHeader(page, "Transform")).toContainText("Failed");
  await expect(await nodeHeader(page, "Output")).toContainText("Skipped");
  await expect(details).toContainText("Upstream timeout");

  await showRun(page, "retrying");
  await expect(await nodeHeader(page, "Transform")).toContainText("Running");
  await expect(details).toContainText("Attempt2");

  await showRun(page, "previous");
  await expect(details).toContainText("Past run run-0");
  await expect(await nodeHeader(page, "Transform")).toContainText("Succeeded");

  await page.getByRole("button", { name: "Clear run", exact: true }).click();
  await expect(details).toHaveCount(0);
  await expect(await nodeHeader(page, "Transform")).not.toContainText("Succeeded");
  expect(await page.getByTestId("document-json").textContent()).toBe(documentBefore);
});
