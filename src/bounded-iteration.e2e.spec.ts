// Independent acceptance for issue #64 (TECH-002, Decisions 2.1 / 2.6 / 2.8) in the real Pages
// workbench (examples/workbench). Authored before implementation from the issue's "Selection and
// first-slice contract" comment.
//
// P1 The library contains "Bounded Approximation (Newton √2)"; its iteration node face shows
//    "≤ 10 iterations · until converged".
// P2 Selecting "Refine square root" shows an inspector Iteration section with a number field
//    "Maximum iterations" and a text field "State type (TypeScript)". Invalid bounds (empty, 0) are
//    surfaced with their diagnostics after Apply; restoring a valid bound clears them.
// P3 A toolbar action "Compile workflow" shows a "Compiled contract" region with the v2 summary,
//    marked "not executed"; an invalid state type lists "iteration-state-type" in an alert.
// P4 Importing a workflow whose iteration body contains a cycle is rejected with a visible alert and
//    leaves the library unchanged.
// P5 An edited bound survives a reload.
// Runs on the chromium and mobile-chrome projects (mobile uses the Info and Actions dock buttons,
// desktop minimizes the palette overlay, as in src/binary-ports.e2e.spec.ts and
// src/mobile-pages.e2e.spec.ts).
import { expect, test, type Page, type TestInfo } from "@playwright/test";

const workbench = "http://127.0.0.1:4175/";
const storageKey = "moritzbrantner.workflow-editor.examples.v1";
const documentFormat = "@moritzbrantner/workflow-editor/document";
const exampleName = "Bounded Approximation (Newton √2)";
const iterationLabel = "Refine square root";

type StoredNode = {
  id: string;
  label: string;
  kind?: string;
  data?: { iteration?: { maxIterations?: unknown } };
  composition?: unknown;
};
type StoredEntry = { id: string; name: string; document: { nodes: StoredNode[] } };
type StoredLibrary = { documents: StoredEntry[] };

async function library(page: Page): Promise<StoredLibrary | null> {
  return page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? "null"), storageKey);
}

async function exampleEntry(page: Page) {
  return (await library(page))?.documents.find((entry) => entry.name === exampleName);
}

async function storedBound(page: Page) {
  const entry = await exampleEntry(page);
  return entry?.document.nodes.find((node) => node.kind === "control.iterate")?.data?.iteration
    ?.maxIterations;
}

async function waitForLibrary(page: Page) {
  await expect(page.locator('[data-slot="workflow-builder-node"]').first()).toBeVisible();
  await expect.poll(async () => (await library(page))?.documents.length ?? 0).toBeGreaterThan(0);
}

const isMobile = (testInfo: TestInfo) => testInfo.project.name === "mobile-chrome";

async function openDocumentMenu(page: Page) {
  // The active document title opens the document menu (Sales Data Pipeline is the default).
  await page
    .getByRole("button", { name: "Sales Data Pipeline", exact: true })
    .or(page.getByRole("button", { name: exampleName, exact: true }))
    .first()
    .click();
}

async function openExample(page: Page, testInfo: TestInfo) {
  await page.goto(workbench);
  await waitForLibrary(page);
  await expect.poll(async () => Boolean(await exampleEntry(page))).toBe(true);
  const entry = (await exampleEntry(page))!;

  await openDocumentMenu(page);
  await page.getByLabel("Workflow document", { exact: true }).selectOption(entry.id);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: exampleName, exact: true })).toBeVisible();

  if (!isMobile(testInfo)) {
    // Desktop precedent: the palette overlay covers part of the canvas.
    const minimize = page.getByRole("button", { name: "Minimize node palette", exact: true });
    if (await minimize.isVisible()) await minimize.click();
  }
  return entry;
}

async function selectIterationNode(page: Page, testInfo: TestInfo) {
  await page.getByRole("button", { name: iterationLabel, exact: true }).first().click();
  if (isMobile(testInfo)) {
    await page
      .locator("[data-mobile-workbench-dock]")
      .getByRole("button", { name: "Info", exact: true })
      .click();
  }
  await expect(page.getByLabel("Maximum iterations", { exact: true })).toBeVisible();
}

async function applyInspector(page: Page) {
  await page.getByRole("button", { name: "Apply", exact: true }).first().click();
}

async function setBound(page: Page, value: string) {
  const field = page.getByLabel("Maximum iterations", { exact: true });
  await field.fill(value);
  await applyInspector(page);
}

async function surfacedText(page: Page) {
  const alerts = await page.getByRole("alert").allInnerTexts();
  const validation = await page
    .getByLabel("Maximum iterations", { exact: true })
    .evaluate((element) => (element as HTMLInputElement).validationMessage ?? "");
  const described = await page
    .getByLabel("Maximum iterations", { exact: true })
    .evaluate((element) =>
      (element.getAttribute("aria-describedby") ?? "")
        .split(/\s+/)
        .filter(Boolean)
        .map((id) => document.getElementById(id)?.textContent ?? "")
        .join(" "),
    );
  return [...alerts, validation, described].join("\n");
}

async function compileWorkflow(page: Page, testInfo: TestInfo) {
  if (isMobile(testInfo)) {
    await page
      .locator("[data-mobile-workbench-dock]")
      .getByRole("button", { name: "Actions", exact: true })
      .click();
  }
  await page.getByRole("button", { name: "Compile workflow", exact: true }).click();
}

test("shows the Newton √2 example with its iteration bound on the node face", async ({
  page,
}, testInfo) => {
  const entry = await openExample(page, testInfo);

  const iteration = entry.document.nodes.find((node) => node.kind === "control.iterate");
  expect(iteration?.label).toBe(iterationLabel);
  expect(iteration?.data?.iteration?.maxIterations).toBe(10);
  expect(iteration?.composition).toBeTruthy();

  const nodes = page.locator('[data-slot="workflow-builder-node"]');
  await expect(nodes.getByText("≤ 10 iterations · until converged").first()).toBeVisible();
});

test("edits and validates the maximum iterations in the inspector", async ({ page }, testInfo) => {
  await openExample(page, testInfo);
  await selectIterationNode(page, testInfo);

  const bound = page.getByLabel("Maximum iterations", { exact: true });
  await expect(bound).toHaveValue("10");
  await expect(bound).toHaveAttribute("type", "number");
  await expect(page.getByLabel("State type (TypeScript)", { exact: true })).toBeVisible();

  await setBound(page, "");
  await expect.poll(() => surfacedText(page)).toMatch(/iteration-bound-required|required/i);

  await setBound(page, "0");
  await expect
    .poll(() => surfacedText(page))
    .toMatch(/iteration-bound-invalid|at least 1|positive|invalid/i);

  await setBound(page, "10");
  await expect.poll(() => surfacedText(page)).not.toMatch(/iteration-bound|at least 1|required/i);
  await expect.poll(() => storedBound(page)).toBe(10);
  await expect(page.getByRole("alert").filter({ hasText: /iteration-bound/ })).toHaveCount(0);
});

test("compiles the example to a v2 contract without executing it", async ({ page }, testInfo) => {
  await openExample(page, testInfo);
  await compileWorkflow(page, testInfo);

  const contract = page.getByRole("region", { name: "Compiled contract" });
  await expect(contract).toBeVisible();
  await expect(contract).toContainText("v2");
  await expect(contract).toContainText(/not executed/i);
  await expect(contract).toContainText(/max 10/i);
});

test("lists iteration-state-type when the body no longer produces the state", async ({
  page,
}, testInfo) => {
  await openExample(page, testInfo);
  await selectIterationNode(page, testInfo);

  await page.getByLabel("State type (TypeScript)", { exact: true }).fill("string");
  await applyInspector(page);

  await compileWorkflow(page, testInfo);
  await expect(page.getByRole("alert").filter({ hasText: "iteration-state-type" })).toBeVisible();
});

test("rejects an imported iteration body that contains a cycle", async ({ page }) => {
  // Self-contained: does not depend on the shipped example, so it exercises the import path alone.
  await page.goto(workbench);
  await waitForLibrary(page);
  const before = (await library(page))!;
  const num = { kind: "number" };
  const importedName = "Cyclic iteration body";
  const document = {
    viewport: { x: 0, y: 0, zoom: 1 },
    nodes: [
      {
        id: "loop",
        label: "Cyclic loop",
        kind: "control.iterate",
        x: 0,
        y: 0,
        inputs: [{ id: "state", label: "State", type: { kind: "typescript", source: "number" } }],
        outputs: [
          {
            id: "result",
            label: "Result",
            type: {
              kind: "typescript",
              source:
                '{ status: "converged" | "limit-exhausted"; value: number; iterations: number; maxIterations: number }',
            },
          },
        ],
        data: { iteration: { maxIterations: 5 } },
        composition: {
          nodes: [
            {
              id: "a",
              label: "A",
              kind: "math.step",
              x: 0,
              y: 0,
              inputs: [
                { id: "in", label: "In", type: num },
                { id: "back", label: "Back", type: num, optional: true },
              ],
              outputs: [{ id: "out", label: "Out", type: num }],
            },
            {
              id: "b",
              label: "B",
              kind: "math.step",
              x: 200,
              y: 0,
              inputs: [{ id: "in", label: "In", type: num }],
              outputs: [{ id: "out", label: "Out", type: num }],
            },
          ],
          edges: [
            {
              id: "ab",
              sourceNodeId: "a",
              sourcePortId: "out",
              targetNodeId: "b",
              targetPortId: "in",
            },
            {
              id: "cycle-back",
              sourceNodeId: "b",
              sourcePortId: "out",
              targetNodeId: "a",
              targetPortId: "back",
            },
          ],
          inputBoundaries: [{ wrapperPortId: "state", nodeId: "a", portId: "in" }],
          outputBoundaries: [{ wrapperPortId: "next", nodeId: "b", portId: "out" }],
        },
      },
    ],
    edges: [],
  };

  await openDocumentMenu(page);
  await page.getByLabel("Import workflow JSON", { exact: true }).setInputFiles({
    name: "cyclic-iteration-body.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        format: documentFormat,
        version: 1,
        exportedAt: "2026-10-17T00:00:00.000Z",
        documentName: importedName,
        document,
      }),
    ),
  });

  await expect(page.getByRole("alert").filter({ hasText: /cycl/i })).toBeVisible();
  const after = (await library(page))!;
  expect(after.documents.map((candidate) => candidate.id)).toEqual(
    before.documents.map((candidate) => candidate.id),
  );
  expect(JSON.stringify(after)).not.toContain(importedName);
  expect(JSON.stringify(after)).not.toContain("cycle-back");
});

test("keeps an edited bound after reload", async ({ page }, testInfo) => {
  await openExample(page, testInfo);
  await selectIterationNode(page, testInfo);
  await setBound(page, "12");
  await expect.poll(() => storedBound(page)).toBe(12);

  await page.reload();
  await waitForLibrary(page);
  await expect.poll(() => storedBound(page)).toBe(12);
  const entry = (await exampleEntry(page))!;
  await openDocumentMenu(page);
  await page.getByLabel("Workflow document", { exact: true }).selectOption(entry.id);
  await page.keyboard.press("Escape");
  await expect(
    page
      .locator('[data-slot="workflow-builder-node"]')
      .getByText("≤ 12 iterations · until converged")
      .first(),
  ).toBeVisible();
});
