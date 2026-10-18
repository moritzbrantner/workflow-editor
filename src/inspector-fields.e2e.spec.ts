import { expect, test, type Page } from "@playwright/test";

// Schema-driven inspector fields (#23) in the Pages workbench: the Score lead template declares a
// scoring model and threshold; an edit validates, applies, undoes and survives a reload.

const workbench = "http://127.0.0.1:4175/";
const storageKey = "moritzbrantner.workflow-editor.examples.v1";

async function scoreData(page: Page) {
  return page.evaluate((key) => {
    const library = JSON.parse(window.localStorage.getItem(key) ?? "null");
    return library?.documents
      .find((entry: { id: string }) => entry.id === "lead-intake")
      ?.document.nodes.find((node: { id: string }) => node.id === "score")?.data as
      | Record<string, unknown>
      | undefined;
  }, storageKey);
}

async function openLeadIntake(page: Page) {
  const leadIntake = page.getByRole("button", { name: "Lead Intake Automation", exact: true });
  const anyTitle = page.locator('button[aria-haspopup="dialog"]').first();
  await expect(anyTitle).toBeVisible();
  if (!(await leadIntake.isVisible())) {
    await anyTitle.click();
    await page.getByLabel("Workflow document", { exact: true }).selectOption("lead-intake");
    await page.keyboard.press("Escape");
  }
  await expect(leadIntake).toBeVisible();
}

test("edits, validates, undoes and persists a schema-driven field", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Desktop inspector coverage");
  await page.goto(workbench);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await openLeadIntake(page);

  await page
    .locator('[data-slot="workflow-node-select"][aria-label="Score lead"]:visible')
    .first()
    .evaluate((element) => (element as HTMLElement).click());
  const threshold = page.getByLabel("Qualified at", { exact: true }).filter({ visible: true });
  await expect(threshold).toHaveValue("70");

  await threshold.fill("150");
  await expect(page.getByText("Qualified at must be at most 100.").first()).toBeVisible();
  await threshold.fill("85");
  await expect(page.getByText("Qualified at must be at most 100.")).toHaveCount(0);
  await page.getByRole("button", { name: "Apply" }).filter({ visible: true }).first().click();
  await expect.poll(async () => (await scoreData(page))?.threshold).toBe(85);

  await page.getByRole("button", { name: "Undo", exact: true }).click();
  await expect.poll(async () => (await scoreData(page))?.threshold).toBeUndefined();
  await page.getByRole("button", { name: "Redo", exact: true }).click();
  await expect.poll(async () => (await scoreData(page))?.threshold).toBe(85);

  await page.reload();
  await page
    .locator('[data-slot="workflow-node-select"][aria-label="Score lead"]:visible')
    .first()
    .evaluate((element) => (element as HTMLElement).click());
  await expect(
    page.getByLabel("Qualified at", { exact: true }).filter({ visible: true }),
  ).toHaveValue("85");
});
