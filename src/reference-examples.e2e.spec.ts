import { readFile } from "node:fs/promises";

import { expect, test, type Page } from "@playwright/test";

// Pages smoke for the reference applications (#22, Decision Atlas 5.1/5.2/5.4): first open lands in the
// editable data pipeline; each example loads, rejects its intentionally invalid connection, takes
// an edit, compiles without executing, exports and survives a reload.

const workbench = "http://127.0.0.1:4175/";
const storageKey = "moritzbrantner.workflow-editor.examples.v1";

const examples = [
  {
    id: "data-pipeline",
    name: "Sales Data Pipeline",
    node: "Validate records",
    invalid: { source: "Start Sales CSV Rows", target: "Load warehouse Records" },
  },
  {
    id: "media-pipeline",
    name: "Product Image Generation",
    node: "Resize for web",
    invalid: { source: "Start Style prompt Value", target: "Resize for web Image" },
  },
  {
    id: "agent-workflow",
    name: "Support Agent with Review",
    node: "Draft reply",
    invalid: { source: "Start Support request Request", target: "Final reply Reply" },
  },
  {
    id: "backend-orchestration",
    name: "Order Fulfillment Orchestration",
    node: "Confirm order",
    invalid: { source: "Start Charge payment Failure", target: "Confirm order Receipt" },
  },
  {
    id: "lead-intake",
    name: "Lead Intake Automation",
    node: "Score lead",
    invalid: { source: "Start Route by fit Nurture", target: "Create deal Qualified lead" },
  },
] as const;

async function storedDocument(page: Page, id: string) {
  return page.evaluate(
    ([key, documentId]) => {
      const library = JSON.parse(window.localStorage.getItem(key!) ?? "null");
      return library?.documents.find((entry: { id: string }) => entry.id === documentId)
        ?.document as { nodes: Array<{ id: string; label: string }> } | undefined;
    },
    [storageKey, id],
  );
}

async function openExample(page: Page, example: (typeof examples)[number]) {
  const defaultTitle = page.getByRole("button", { name: "Sales Data Pipeline", exact: true });
  await expect(defaultTitle).toBeVisible();
  if (example.id !== "data-pipeline") {
    await defaultTitle.click();
    await page.getByLabel("Workflow document", { exact: true }).selectOption(example.id);
    await page.keyboard.press("Escape");
  }
  await expect(page.getByRole("button", { name: example.name, exact: true })).toBeVisible();
}

test("opens first into the editable data pipeline", async ({ page }) => {
  await page.addInitScript(() => window.localStorage.clear());
  await page.goto(workbench);
  await expect(
    page.getByRole("button", { name: "Sales Data Pipeline", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('[data-slot="workflow-node-select"][aria-label="Load warehouse"]').first(),
  ).toBeAttached();
});

for (const example of examples) {
  test(`${example.name}: loads, validates, edits, compiles, exports and reloads`, async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Desktop example smoke");
    await page.goto(workbench);
    await page.evaluate(() => window.localStorage.clear());
    await page.reload();
    await openExample(page, example);

    // Validation: the intentionally invalid connection is listed but disabled.
    const port = page.getByRole("button", { name: example.invalid.source, exact: true });
    await port.focus();
    await port.press("Shift+F10");
    const menu = page.getByRole("menu", { name: /Possible inputs/ });
    await expect(menu).toBeVisible();
    await expect(
      menu.getByRole("menuitem", { name: example.invalid.target, exact: true }),
    ).toHaveAttribute("aria-disabled", "true");
    await page.keyboard.press("Escape");

    // Edit: rename a node through the inspector.
    await page
      .locator(`[data-slot="workflow-node-select"][aria-label="${example.node}"]:visible`)
      .first()
      .evaluate((element) => (element as HTMLElement).click());
    const label = page.locator('input[aria-label="Label"]:visible').first();
    await label.fill(`${example.node} (edited)`);
    await page.getByRole("button", { name: "Apply" }).filter({ visible: true }).first().click();
    await expect(
      page.locator(
        `[data-slot="workflow-node-select"][aria-label="${example.node} (edited)"]:visible`,
      ),
    ).toBeVisible();

    // Compile: the contract is produced but never executed.
    await page.getByRole("button", { name: "Compile workflow", exact: true }).click();
    await expect(page.getByRole("region", { name: "Compiled contract" })).toContainText(
      "not executed",
    );
    await page.getByRole("button", { name: "Close compiled contract" }).click();

    // Export the edited document.
    await page.getByRole("button", { name: example.name, exact: true }).click();
    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export JSON", exact: true }).click();
    const exported = JSON.parse(await readFile((await (await download).path())!, "utf8"));
    expect(exported.documentId).toBe(example.id);
    expect(JSON.stringify(exported.document)).toContain(`${example.node} (edited)`);
    await page.keyboard.press("Escape");

    // Reload keeps the edit and the selected example.
    await expect
      .poll(async () =>
        (await storedDocument(page, example.id))?.nodes.some(
          (node) => node.label === `${example.node} (edited)`,
        ),
      )
      .toBe(true);
    await page.reload();
    await expect(page.getByRole("button", { name: example.name, exact: true })).toBeVisible();
    await expect(
      page.locator(
        `[data-slot="workflow-node-select"][aria-label="${example.node} (edited)"]:visible`,
      ),
    ).toBeVisible();
  });
}
