import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Axe coverage for the #18 states not covered in react.e2e.spec.ts: settings (Pages types and
// document menu), nested workflows and the mobile inspector. Focus after drill-in is checked too.

const workbench = "http://127.0.0.1:4175/";

async function expectNoAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page })
    .disableRules([
      "landmark-main-is-top-level",
      "landmark-no-duplicate-main",
      "landmark-unique",
      "landmark-complementary-is-top-level",
    ])
    .analyze();

  expect(results.violations).toEqual([]);
}

async function gotoPages(page: Page) {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto(workbench);
  await expect(page.locator('[data-slot="workflow-builder-node"]').first()).toBeVisible();
}

test("passes Axe with the Pages types settings and document menu open", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Desktop settings coverage");
  await gotoPages(page);

  const types = page.getByRole("button", { name: "Types", exact: true });
  await types.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("complementary", { name: "Workflow types", exact: true }),
  ).toBeVisible();
  await expectNoAxeViolations(page);

  await page.getByRole("button", { name: "Close types", exact: true }).first().click();
  const menuTrigger = page.locator('button[aria-haspopup="dialog"]').first();
  await menuTrigger.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Export JSON", exact: true })).toBeVisible();
  await expectNoAxeViolations(page);
});

test("passes Axe in a nested workflow and keeps focus in the workbench after drill-in", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Desktop nested-workflow coverage");
  await page.goto(`/?storageKey=a11y-nested-${testInfo.retry}&clearStorageKey=1`);

  await page
    .locator('[data-slot="workflow-node-select"][aria-label="Input"]:visible')
    .first()
    .focus();
  await page.keyboard.press("Enter");
  const create = page.getByRole("button", { name: "Create nested workflow", exact: true }).first();
  await create.focus();
  await page.keyboard.press("Enter");

  await expect(page.getByTestId("active-document-name")).toHaveText("Input Workflow");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const active = document.activeElement;
        return !!active && active !== document.body && !!active.closest("[data-slot]");
      }),
    )
    .toBe(true);
  await expectNoAxeViolations(page);
});

test("passes Axe with the mobile inspector open", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile-chrome", "Mobile inspector coverage");
  await gotoPages(page);

  const dock = page.locator("[data-mobile-workbench-dock]");
  await page
    .locator('[data-slot="workflow-builder-node"] [data-slot="workflow-node-select"]')
    .first()
    .evaluate((element) => (element as HTMLElement).click());
  await dock.getByRole("button", { name: "Info", exact: true }).click();
  await expect(page.locator('[data-slot="workflow-inspector-overlay"]')).toBeVisible();
  await expectNoAxeViolations(page);
});
