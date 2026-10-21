// Issue #94 / Decision Atlas 5.25 in the real Pages workbench: an iteration body opens as its own
// tab "<workflow> › <iteration> body" with "↑ Parent", is rebuilt from scratch with ordinary graph
// gestures, gets its boundaries in the body's document settings, and survives a reload and compile.
import { expect, test, type Page } from "@playwright/test";

const workbench = "http://127.0.0.1:4175/";
const storageKey = "moritzbrantner.workflow-editor.examples.v1";
const exampleName = "Bounded Approximation (Newton √2)";
const iterationLabel = "Refine square root";
const bodyTab = `${exampleName} › ${iterationLabel} body`;

type Boundary = { wrapperPortId: string; nodeId: string; portId: string };
type StoredBody = {
  nodes: Array<{ id: string; kind?: string }>;
  edges: Array<{ sourceNodeId: string; targetNodeId: string }>;
  inputBoundaries: Boundary[];
  outputBoundaries: Boundary[];
};

async function storedBody(page: Page): Promise<StoredBody | undefined> {
  return page.evaluate(
    ({ key, name }) => {
      const library = JSON.parse(window.localStorage.getItem(key) ?? "null");
      const entry = library?.documents.find(
        (candidate: { name: string }) => candidate.name === name,
      );
      return entry?.document.nodes.find(
        (node: { kind?: string }) => node.kind === "control.iterate",
      )?.composition;
    },
    { key: storageKey, name: exampleName },
  );
}

async function addFromPalette(page: Page, label: string) {
  const expand = page.getByRole("button", { name: "Expand node palette", exact: true });
  if (await expand.isVisible()) await expand.click();
  const search = page
    .getByRole("textbox", { name: "Search node palette" })
    .filter({ visible: true })
    .first();
  await search.fill(label);
  await page
    .locator('[data-slot="workflow-palette-overlay"], [data-slot="workflow-palette"]')
    .getByText(label, { exact: true })
    .filter({ visible: true })
    .first()
    .click();
  await page.getByRole("button", { name: "Minimize node palette", exact: true }).click();
}

async function connect(page: Page, sourcePort: string, target: string) {
  const port = page.getByRole("button", { name: sourcePort, exact: true });
  await port.focus();
  await port.press("Shift+F10");
  const choice = page
    .getByRole("menu", { name: /Possible inputs/ })
    .getByRole("menuitem", { name: target, exact: true });
  await expect(choice).toHaveAttribute("aria-disabled", "false");
  await choice.focus();
  await choice.press("Enter");
}

async function deleteNode(page: Page, label: string) {
  await page.getByRole("button", { name: label, exact: true }).first().click();
  await expect(page.getByText("1 selected", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("button", { name: label, exact: true })).toHaveCount(0);
}

async function boundaries(page: Page) {
  await page.keyboard.press("Escape");
  const region = page.getByRole("region", { name: "Iteration boundaries" });
  if (!(await region.isVisible())) {
    await page.getByRole("button", { name: "Expand info panel" }).click();
  }
  await expect(region).toBeVisible();
  return region;
}

test("builds an iteration body from scratch in its own tab, then reloads and compiles", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name === "mobile-chrome", "desktop canvas gestures");
  await page.goto(workbench);
  await expect(page.locator('[data-slot="workflow-builder-node"]').first()).toBeVisible();
  await page.getByRole("button", { name: "Sales Data Pipeline", exact: true }).click();
  const exampleId = await page.evaluate(
    ({ key, name }) =>
      JSON.parse(window.localStorage.getItem(key) ?? "null")?.documents.find(
        (entry: { name: string }) => entry.name === name,
      )?.id,
    { key: storageKey, name: exampleName },
  );
  await page.getByLabel("Workflow document", { exact: true }).selectOption(exampleId);
  await page.keyboard.press("Escape");
  // The palette overlay covers part of the canvas (as in bounded-iteration.e2e.spec.ts).
  await page.getByRole("button", { name: "Minimize node palette", exact: true }).click();

  // Open the body from the selected iteration node.
  await page.getByRole("button", { name: iterationLabel, exact: true }).first().click();
  await page.getByRole("button", { name: "Open body", exact: true }).click();
  await expect(page.getByRole("button", { name: `Switch to ${bodyTab}` })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(
    page.getByRole("button", { name: `Open parent workflow: ${exampleName}` }),
  ).toBeVisible();

  // Start from scratch: remove the shipped body nodes.
  await deleteNode(page, "Newton step");
  await deleteNode(page, "Within tolerance");
  const settings = await boundaries(page);
  await expect(settings).toContainText("iteration-body-missing");

  // Rebuild it with ordinary palette and connection gestures.
  await addFromPalette(page, "Newton step");
  await addFromPalette(page, "Within tolerance");
  await connect(page, "Start Newton step Next", "Within tolerance Next");

  const region = await boundaries(page);
  await region.getByLabel("State feeds Newton step · Estimate", { exact: true }).check();
  await region.getByLabel("State feeds Within tolerance · Previous", { exact: true }).check();
  await region.getByLabel("Target feeds Newton step · Target", { exact: true }).check();
  await region
    .getByLabel("Next state", { exact: true })
    .selectOption({ label: "Newton step · Next" });
  await region
    .getByLabel("Converged (stop condition)", { exact: true })
    .selectOption({ label: "Within tolerance · Converged" });
  await expect(region.getByRole("status")).toHaveText("The iteration is valid.");

  // The body is saved inside the parent document and survives a reload.
  await expect.poll(async () => (await storedBody(page))?.outputBoundaries.length ?? 0).toBe(2);
  await page.reload();
  await expect(page.locator('[data-slot="workflow-builder-node"]').first()).toBeVisible();
  const body = (await storedBody(page))!;
  expect(body.nodes.map((node) => node.kind).sort()).toEqual([
    "math.compare.withinTolerance",
    "math.sqrt.newtonStep",
  ]);
  expect(body.edges).toHaveLength(1);
  expect(body.inputBoundaries).toHaveLength(3);
  expect(body.outputBoundaries.map((boundary) => boundary.wrapperPortId).sort()).toEqual([
    "converged",
    "next",
  ]);

  // The rebuilt workflow compiles to the v2 contract.
  await page.getByRole("button", { name: "Compile workflow", exact: true }).click();
  const contract = page.getByRole("region", { name: "Compiled contract" });
  await expect(contract).toContainText("v2");
  await expect(contract).toContainText(/max 10, stops when converged/i);
});
