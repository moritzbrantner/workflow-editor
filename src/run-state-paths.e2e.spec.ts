import { expect, test, type Page } from "@playwright/test";
import { generateStatePaths } from "mobile-analysis/state-paths";
import { createMachine } from "xstate";

// A compact model of the host-owned execution overlay, not the editable workflow document.
const runStates = createMachine({
  id: "workflow-run-overlay",
  initial: "idle",
  states: {
    idle: { on: { SHOW_RUNNING: "running" } },
    running: { on: { SHOW_FAILED: "failed", SHOW_PREVIOUS: "previous", CLEAR: "idle" } },
    failed: { on: { SHOW_RETRYING: "retrying", CLEAR: "idle" } },
    retrying: { on: { SHOW_PREVIOUS: "previous", CLEAR: "idle" } },
    previous: { on: { CLEAR: "idle" } },
  },
});

const plan = generateStatePaths({
  id: "workflow-run-overlay",
  model: runStates,
  events: ["SHOW_RUNNING", "SHOW_FAILED", "SHOW_RETRYING", "SHOW_PREVIOUS", "CLEAR"],
  maxPaths: 12,
});

const buttonForEvent: Record<string, string> = {
  SHOW_RUNNING: "Show running run",
  SHOW_FAILED: "Show failed run",
  SHOW_RETRYING: "Show retrying run",
  SHOW_PREVIOUS: "Show previous run",
  CLEAR: "Clear run",
};

function nodeHeader(page: Page, label: string) {
  return page
    .locator('[data-slot="workflow-builder-node"]:visible')
    .filter({ has: page.locator(`[data-slot="workflow-node-select"][aria-label="${label}"]`) })
    .first();
}

async function expectRunState(page: Page, state: string) {
  const details = page.getByRole("region", { name: "Run details" });
  const transform = nodeHeader(page, "Transform");
  switch (state) {
    case "idle":
      await expect(details).toHaveCount(0);
      await expect(transform).not.toContainText("Running");
      await expect(transform).not.toContainText("Failed");
      return;
    case "running":
      await expect(transform).toContainText("Running");
      await expect(details).toContainText("Run run-1");
      await expect(details).toContainText("Attempt1");
      return;
    case "failed":
      await expect(transform).toContainText("Failed");
      await expect(details).toContainText("Upstream timeout");
      return;
    case "retrying":
      await expect(transform).toContainText("Running");
      await expect(details).toContainText("Attempt2");
      return;
    case "previous":
      await expect(transform).toContainText("Succeeded");
      await expect(details).toContainText("Past run run-0");
      return;
    default:
      throw new Error(`No assertion adapter for workflow state ${state}`);
  }
}

// Every generated path starts from an isolated document and asserts after each action.
for (const path of plan.paths) {
  test(`@state:workflow ${path.id}: ${path.name}`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Desktop execution overlay coverage");
    await page.goto(
      `/?storageKey=run-state-paths-${path.id}-${testInfo.retry}&clearStorageKey=1&execution=1`,
    );
    const documentBefore = await page.getByTestId("document-json").textContent();
    await page
      .locator('[data-slot="workflow-node-select"][aria-label="Transform"]:visible')
      .first()
      .evaluate((element) => (element as HTMLElement).click());
    await expectRunState(page, plan.initialState);

    // The browser actions and assertions intentionally follow the modeled transition order.
    /* oxlint-disable eslint/no-await-in-loop */
    for (const step of path.steps) {
      const label = buttonForEvent[step.event.type];
      if (!label) throw new Error(`No Playwright action for ${step.event.type}`);
      await page.getByRole("button", { name: label, exact: true }).click();
      await expectRunState(page, step.state);
      expect(await page.getByTestId("document-json").textContent()).toBe(documentBefore);
    }
    /* oxlint-enable eslint/no-await-in-loop */
  });
}
