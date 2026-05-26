import { expect, test, type Page } from "@playwright/test";

type WorkflowDocumentSnapshot = {
  nodes: Array<{ id: string; label: string; x: number; y: number }>;
  edges: Array<{
    id: string;
    sourceNodeId: string;
    sourcePortId: string;
    targetNodeId: string;
    targetPortId: string;
  }>;
};

async function readDocument(page: Page) {
  return JSON.parse(
    await page.getByTestId("document-json").textContent(),
  ) as WorkflowDocumentSnapshot;
}

async function selectNode(page: Page, label: string) {
  await page.getByRole("button", { name: label, exact: true }).click();
}

test.describe("WorkflowWorkbench", () => {
  test("adds template nodes and keeps controlled document state in sync", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("3 nodes")).toBeVisible();
    await expect(page.getByText("1 edges")).toBeVisible();
    await page
      .getByRole("button", { name: /Decision/ })
      .first()
      .click();

    await expect(page.getByTestId("node-count")).toHaveText("4");
    await expect(page.getByTestId("summary-json")).toContainText("decision");
    await expect(page.getByTestId("selection-json")).toContainText('"id":"decision"');

    const document = await readDocument(page);
    expect(document.nodes).toContainEqual(
      expect.objectContaining({
        id: "decision",
        label: "Decision",
        x: 228,
        y: 204,
      }),
    );
  });

  test("selects, duplicates, edits, and deletes nodes", async ({ page }) => {
    await page.goto("/");
    await selectNode(page, "Input");

    await expect(page.getByTestId("selection-json")).toContainText('"id":"input"');
    await page.getByRole("button", { name: "Duplicate" }).click();
    await expect(page.getByTestId("node-count")).toHaveText("4");
    await expect(page.getByTestId("summary-json")).toContainText("input-copy");

    await page.locator('input[aria-label="Label"]:visible').fill("Source");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(
      page.locator('[data-slot="workflow-node-select"][aria-label="Source"]:visible'),
    ).toBeVisible();

    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByTestId("node-count")).toHaveText("3");
    await expect(page.getByTestId("edge-count")).toHaveText("0");
    await expect(page.getByTestId("selection-json")).toHaveText("null");

    const document = await readDocument(page);
    expect(document.nodes.map((node) => node.id)).not.toContain("input");
    expect(document.nodes.map((node) => node.id)).toContain("input-copy");
  });

  test("creates a valid edge through port interactions", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Start Input Out" }).first().click();
    await page.getByRole("button", { name: "Connect to Output In" }).first().click();

    await expect(page.getByTestId("edge-count")).toHaveText("2");
    await expect(page.getByTestId("summary-json")).toContainText("input:out->output:in");

    const document = await readDocument(page);
    expect(document.edges).toContainEqual(
      expect.objectContaining({
        id: "input:out->output:in",
        sourceNodeId: "input",
        sourcePortId: "out",
        targetNodeId: "output",
        targetPortId: "in",
      }),
    );
  });

  test("blocks mutations in read-only mode", async ({ page }) => {
    await page.goto("/?readonly=1");
    await selectNode(page, "Input");

    await expect(page.getByRole("button", { name: /Decision/ }).first()).toBeDisabled();
    await expect(page.getByRole("button", { name: "Duplicate" })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Delete", exact: true })).toBeDisabled();
    await expect(page.getByRole("textbox", { name: "Label" }).first()).toBeDisabled();

    await page.getByRole("button", { name: "Start Input Out" }).first().click({ force: true });
    await expect(page.getByTestId("node-count")).toHaveText("3");
    await expect(page.getByTestId("edge-count")).toHaveText("1");
  });
});
