import { expect, test, type Page } from "@playwright/test";

// Pages acceptance for human tasks (#105): the Approval Checklist example authors an approval with
// approve/reject branches and a typed correction step; static Pages compiles it (and the Incident
// Escalation workflow that references it) without claiming to run a task.

const workbench = "http://127.0.0.1:4175/";

async function openDocument(page: Page, id: string, name: string) {
  await page.getByRole("button", { name: "Sales Data Pipeline", exact: true }).click();
  await page.getByLabel("Workflow document", { exact: true }).selectOption(id);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
}

async function compile(page: Page) {
  await page.getByRole("button", { name: "Compile workflow", exact: true }).click();
  const region = page.getByRole("region", { name: "Compiled contract" });
  await expect(region).toBeVisible();
  const text = await region.innerText();
  await page.getByRole("button", { name: "Close compiled contract" }).click();
  return text;
}

test("authors and compiles approval and typed-input tasks on Pages", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Desktop Pages acceptance");
  await page.goto(workbench);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();

  await openDocument(page, "approval-checklist", "Approval Checklist");
  for (const port of ["Approve checklist Approved", "Approve checklist Rejected"]) {
    await expect(page.getByRole("button", { name: `Start ${port}`, exact: true })).toBeAttached();
  }
  await expect(
    page.locator('[data-slot="workflow-node-select"][aria-label="Request correction"]').first(),
  ).toBeAttached();
  expect(await compile(page)).toContain("Compiled contract v1");

  // The checklist's start/end interface matches the reference in Incident Escalation.
  await page.getByRole("button", { name: "Approval Checklist", exact: true }).click();
  await page.getByLabel("Workflow document", { exact: true }).selectOption("incident-escalation");
  await page.keyboard.press("Escape");
  expect(await compile(page)).toContain("Compiled contract v3");
});
