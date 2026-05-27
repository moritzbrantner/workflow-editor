import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

type WorkflowDocumentSnapshot = {
  nodes: Array<{ id: string; label: string; x: number; y: number }>;
  edges: Array<{
    id: string;
    sourceNodeId: string;
    sourcePortId: string;
    targetNodeId: string;
    targetPortId: string;
  }>;
  viewport?: { x: number; y: number; zoom: number };
};

async function readDocument(page: Page) {
  return JSON.parse(
    await page.getByTestId("document-json").textContent(),
  ) as WorkflowDocumentSnapshot;
}

async function selectNode(page: Page, label: string) {
  await page
    .locator(
      `[data-slot="workflow-builder-node"] [data-slot="workflow-node-select"][aria-label="${label}"]:visible`,
    )
    .first()
    .evaluate(clickElement);
}

async function addNodeToSelection(page: Page, label: string) {
  await page
    .locator(
      `[data-slot="workflow-builder-node"] [data-slot="workflow-node-select"][aria-label="${label}"]:visible`,
    )
    .first()
    .evaluate((element) => {
      element.dispatchEvent(
        new PointerEvent("pointerdown", {
          bubbles: true,
          button: 0,
          buttons: 1,
          pointerId: 1,
          pointerType: "mouse",
          shiftKey: true,
        }),
      );
      element.dispatchEvent(new MouseEvent("click", { bubbles: true, shiftKey: true }));
      element.dispatchEvent(
        new PointerEvent("pointerup", {
          bubbles: true,
          button: 0,
          buttons: 0,
          pointerId: 1,
          pointerType: "mouse",
          shiftKey: true,
        }),
      );
    });
}

async function selectNodeById(page: Page, id: string) {
  await page
    .locator(`[data-slot="workflow-builder-node"][data-node-id="${id}"]:visible`)
    .locator('[data-slot="workflow-node-select"]')
    .evaluate(clickElement);
}

async function selectEdge(page: Page, id: string) {
  await page.getByRole("button", { name: `Connection ${id}`, exact: true }).evaluate(clickElement);
}

async function clickPort(page: Page, name: string) {
  await page.getByRole("button", { name }).first().evaluate(clickElement);
}

function clickElement(element: Element) {
  if (element instanceof HTMLElement) {
    element.click();
  }
}

async function clickAction(page: Page, name: string) {
  await page.getByRole("button", { name, exact: true }).first().click();
}

async function expectNodeCount(page: Page, count: number) {
  await expect(page.getByTestId("node-count")).toHaveText(String(count));
}

async function expectEdgeCount(page: Page, count: number) {
  await expect(page.getByTestId("edge-count")).toHaveText(String(count));
}

async function pressShortcut(page: Page, shortcut: string) {
  const modifier = process.platform === "darwin" ? "Meta" : "Control";
  await page.keyboard.press(shortcut.replace("Mod", modifier));
}

async function readSelection(page: Page) {
  return JSON.parse((await page.getByTestId("selection-json").textContent()) ?? "null") as unknown;
}

async function selectInspectorWorkflowReference(page: Page, label: string) {
  await page
    .locator('button[aria-label="Workflow document"]')
    .filter({ visible: true })
    .first()
    .click();
  await page.getByRole("option", { name: label, exact: true }).click();
}

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

test.describe("WorkflowWorkbench desktop", () => {
  test.skip(({ isMobile }) => isMobile, "Desktop-only interaction coverage");

  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      window.localStorage.clear();
    });
  });

  test("adds template nodes and keeps controlled document state in sync", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByTestId("node-count")).toHaveText("3");
    await expect(page.getByTestId("edge-count")).toHaveText("1");
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

  test("minimizes the node palette and adds template nodes by dragging", async ({ page }) => {
    await page.goto("/");

    const palette = page.locator('[data-slot="workflow-palette-overlay"]').first();
    await expect(palette).toContainText("Logic");
    await expect(palette).toContainText("Branches");
    const expandedPaletteBox = await palette.boundingBox();
    expect(expandedPaletteBox?.width).toBeGreaterThan(300);

    await page.getByRole("button", { name: "Minimize node palette", exact: true }).click();
    await expect(page.getByRole("button", { name: /Decision/ })).toHaveCount(0);
    const canvasBox = await page.locator('[data-slot="workbench-canvas"]').first().boundingBox();
    const minimizedPaletteBox = await palette.boundingBox();
    expect(minimizedPaletteBox).not.toBeNull();
    expect(canvasBox).not.toBeNull();
    expect(minimizedPaletteBox!.x - canvasBox!.x).toBeLessThan(32);
    expect(minimizedPaletteBox!.y - canvasBox!.y).toBeLessThan(32);
    await page.getByRole("button", { name: "Expand node palette", exact: true }).click();
    await expect(page.getByRole("button", { name: /Decision/ }).first()).toBeVisible();

    await page
      .getByRole("button", { name: /Decision/ })
      .first()
      .dragTo(page.locator('[data-slot="workflow-builder-viewport"]:visible').first(), {
        targetPosition: { x: 500, y: 260 },
      });

    await expect(page.getByTestId("node-count")).toHaveText("4");
    await expect(page.getByTestId("selection-json")).toContainText('"id":"decision"');

    const document = await readDocument(page);
    const decision = document.nodes.find((node) => node.id === "decision");
    expect(decision).toEqual(
      expect.objectContaining({
        label: "Decision",
        x: expect.any(Number),
        y: expect.any(Number),
      }),
    );
    expect(decision?.x).toBeGreaterThan(300);
  });

  test("selects, duplicates, edits, and deletes nodes", async ({ page }) => {
    await page.goto("/");
    await selectNode(page, "Input");

    await expect(page.getByTestId("selection-json")).toContainText('"id":"input"');
    await page.getByRole("button", { name: "Duplicate", exact: true }).click();
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

  test("multi-selects nodes and duplicates, copies, pastes, and deletes the selection", async ({
    page,
  }) => {
    await page.goto("/");

    await selectNode(page, "Input");
    await addNodeToSelection(page, "Transform");
    await expect(page.getByTestId("selection-count").first()).toHaveText("2 selected");

    await page.getByRole("button", { name: "Duplicate", exact: true }).click();
    await expect(page.getByTestId("node-count")).toHaveText("5");
    await expect(page.getByTestId("edge-count")).toHaveText("2");
    await expect(page.getByTestId("document-json")).toContainText("input-copy");
    await expect(page.getByTestId("document-json")).toContainText("transform-copy");

    await page.getByRole("button", { name: "Copy", exact: true }).click();
    await page.getByRole("button", { name: "Paste", exact: true }).click();
    await expect(page.getByTestId("node-count")).toHaveText("7");
    await expect(page.getByTestId("edge-count")).toHaveText("3");

    await page.getByRole("button", { name: "Delete", exact: true }).click();
    await expect(page.getByTestId("node-count")).toHaveText("5");
    await expect(page.getByTestId("edge-count")).toHaveText("2");
  });

  test("uses keyboard shortcuts for duplicate, clipboard, escape, and delete", async ({ page }) => {
    await page.goto("/");

    await selectNode(page, "Input");
    await addNodeToSelection(page, "Transform");
    await expect(page.getByTestId("selection-count").first()).toHaveText("2 selected");

    await pressShortcut(page, "Mod+D");
    await expectNodeCount(page, 5);
    await expectEdgeCount(page, 2);
    await expect(page.getByTestId("document-json")).toContainText("input-copy");

    await pressShortcut(page, "Mod+C");
    await pressShortcut(page, "Mod+V");
    await expectNodeCount(page, 7);
    await expectEdgeCount(page, 3);

    await page.keyboard.press("Delete");
    await expectNodeCount(page, 6);
    await expectEdgeCount(page, 2);

    await selectNodeById(page, "input");
    await expect(page.getByTestId("selected-node-id")).toHaveText('"input"');
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("selection-count").first()).toHaveText("0 selected");
    expect(await readSelection(page)).toBeNull();
  });

  test("does not run graph shortcuts while editing inspector fields", async ({ page }) => {
    await page.goto("/");
    await selectNode(page, "Input");

    const labelInput = page.locator('input[aria-label="Label"]:visible').first();
    await labelInput.focus();
    await page.keyboard.press("Backspace");
    await pressShortcut(page, "Mod+D");

    await expectNodeCount(page, 3);
    await expectEdgeCount(page, 1);
    await expect(page.getByTestId("selected-node-id")).toHaveText('"input"');
  });

  test("clears selection from the canvas background and marquee-selects nodes", async ({
    page,
  }) => {
    await page.goto("/");

    await selectNode(page, "Input");
    await expect(page.getByTestId("selected-node-id")).toHaveText('"input"');
    await page
      .locator('[data-slot="workflow-builder-surface"]:visible')
      .first()
      .click({ position: { x: 420, y: 420 } });
    await expect(page.getByTestId("selection-count").first()).toHaveText("0 selected");

    const inputBox = await page
      .locator('[data-slot="workflow-builder-node"][data-node-id="input"]:visible')
      .first()
      .boundingBox();
    const transformBox = await page
      .locator('[data-slot="workflow-builder-node"][data-node-id="transform"]:visible')
      .first()
      .boundingBox();
    expect(inputBox).not.toBeNull();
    expect(transformBox).not.toBeNull();
    const startX = Math.min(inputBox!.x, transformBox!.x) - 16;
    const startY =
      Math.max(inputBox!.y + inputBox!.height, transformBox!.y + transformBox!.height) + 16;
    const endX =
      Math.max(inputBox!.x + inputBox!.width, transformBox!.x + transformBox!.width) - 64;
    const endY = Math.min(inputBox!.y, transformBox!.y) - 16;

    const viewport = page.locator('[data-slot="workflow-builder-viewport"]:visible').first();
    await viewport.dispatchEvent("pointerdown", {
      bubbles: true,
      button: 0,
      buttons: 1,
      clientX: startX,
      clientY: startY,
      pointerId: 1,
      pointerType: "mouse",
      shiftKey: true,
    });
    await viewport.dispatchEvent("pointermove", {
      bubbles: true,
      button: 0,
      buttons: 1,
      clientX: endX,
      clientY: endY,
      pointerId: 1,
      pointerType: "mouse",
      shiftKey: true,
    });
    await viewport.dispatchEvent("pointerup", {
      bubbles: true,
      button: 0,
      buttons: 0,
      clientX: endX,
      clientY: endY,
      pointerId: 1,
      pointerType: "mouse",
      shiftKey: true,
    });

    await expect(page.getByTestId("selection-count").filter({ visible: true }).first()).toHaveText(
      "2 selected",
    );
  });

  test("selects edges, edits edge status, and deletes only the selected edge", async ({ page }) => {
    await page.goto("/");

    await selectEdge(page, "input-transform");
    await expect(page.getByTestId("selected-edge-id")).toHaveText('"input-transform"');
    await expect(
      page.getByRole("heading", { name: "Workflow edge" }).filter({ visible: true }),
    ).toBeVisible();

    await page.locator('input[aria-label="Status"]:visible').fill("success");
    await page.getByRole("button", { name: "Apply" }).click();
    await expect(page.getByTestId("document-json")).toContainText('"status":"success"');

    await page.keyboard.press("Delete");
    await expectNodeCount(page, 3);
    await expectEdgeCount(page, 0);
  });

  test("arranges all nodes and selected nodes", async ({ page }) => {
    await page.goto("/");
    await selectNode(page, "Input");
    await addNodeToSelection(page, "Transform");

    await page.getByRole("button", { name: "Arrange selection", exact: true }).click();
    const selectionLayout = await readDocument(page);
    const selectedInput = selectionLayout.nodes.find((node) => node.id === "input")!;
    const selectedTransform = selectionLayout.nodes.find((node) => node.id === "transform")!;
    const selectedOutput = selectionLayout.nodes.find((node) => node.id === "output")!;
    expect(selectedTransform.x).toBeGreaterThan(selectedInput.x);
    expect(selectedOutput).toEqual(expect.objectContaining({ x: 560, y: 0 }));

    await page.getByRole("button", { name: "Arrange all", exact: true }).click();
    const fullLayout = await readDocument(page);
    const input = fullLayout.nodes.find((node) => node.id === "input")!;
    const transform = fullLayout.nodes.find((node) => node.id === "transform")!;
    expect(transform.x).toBeGreaterThan(input.x);
  });

  test("zooms the workflow canvas with control wheel", async ({ page }) => {
    await page.goto("/");

    const surface = page.locator('[data-slot="workflow-builder-surface"]:visible').first();
    const surfaceBox = await surface.boundingBox();
    expect(surfaceBox).not.toBeNull();

    await page.mouse.move(surfaceBox!.x + surfaceBox!.width / 2, surfaceBox!.y + 160);
    await page.keyboard.down("Control");
    await page.mouse.wheel(0, -320);
    await page.keyboard.up("Control");

    await expect
      .poll(async () => (await readDocument(page)).viewport?.zoom ?? 1)
      .toBeGreaterThan(1);
  });

  test("pans the workflow canvas with drag and wheel", async ({ page }) => {
    await page.goto("/");

    const surface = page.locator('[data-slot="workflow-builder-surface"]:visible').first();
    const surfaceBox = await surface.boundingBox();
    expect(surfaceBox).not.toBeNull();

    const beforeDrag = (await readDocument(page)).viewport ?? { x: 0, y: 0, zoom: 1 };
    await page.mouse.move(surfaceBox!.x + surfaceBox!.width / 2, surfaceBox!.y + 340);
    await page.mouse.down();
    await page.mouse.move(surfaceBox!.x + surfaceBox!.width / 2 + 90, surfaceBox!.y + 400, {
      steps: 6,
    });
    await page.mouse.up();

    await expect
      .poll(async () => ((await readDocument(page)).viewport ?? { x: 0, y: 0, zoom: 1 }).x)
      .toBeGreaterThan(beforeDrag.x + 60);
    await expect
      .poll(async () => ((await readDocument(page)).viewport ?? { x: 0, y: 0, zoom: 1 }).y)
      .toBeGreaterThan(beforeDrag.y + 40);
    const afterDrag = (await readDocument(page)).viewport ?? { x: 0, y: 0, zoom: 1 };

    await page.mouse.move(surfaceBox!.x + surfaceBox!.width / 2, surfaceBox!.y + 340);
    await page.mouse.wheel(0, 120);
    await expect
      .poll(async () => ((await readDocument(page)).viewport ?? { x: 0, y: 0, zoom: 1 }).x)
      .toBeLessThan(afterDrag.x);
    const afterHorizontalWheel = (await readDocument(page)).viewport ?? { x: 0, y: 0, zoom: 1 };

    await page.keyboard.down("Shift");
    await page.mouse.wheel(0, 140);
    await page.keyboard.up("Shift");
    await expect
      .poll(async () => ((await readDocument(page)).viewport ?? { x: 0, y: 0, zoom: 1 }).y)
      .toBeLessThan(afterHorizontalWheel.y);
    const afterVerticalWheel = (await readDocument(page)).viewport ?? { x: 0, y: 0, zoom: 1 };
    expect(afterVerticalWheel.x).toBe(afterHorizontalWheel.x);

    await page.evaluate(() => {
      document.body.style.minHeight = "3000px";
      window.scrollTo(0, 180);
    });
    await expect.poll(async () => page.evaluate(() => window.scrollY)).toBe(180);
    const scrolledSurfaceBox = await surface.boundingBox();
    expect(scrolledSurfaceBox).not.toBeNull();

    await page.mouse.move(scrolledSurfaceBox!.x + scrolledSurfaceBox!.width / 2, 420);
    await page.mouse.wheel(0, 160);
    await expect.poll(async () => page.evaluate(() => window.scrollY)).toBe(180);
  });

  test("creates a valid edge through port interactions", async ({ page }) => {
    await page.goto("/");

    await clickPort(page, "Start Input Out");
    await clickPort(page, "Connect to Output In");

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

  test("snaps compatible ports together while dragging nodes", async ({ page }) => {
    await page.goto("/");

    const inputBox = await page
      .locator('[data-slot="workflow-builder-node"][data-node-id="input"]:visible')
      .first()
      .boundingBox();
    const outputBox = await page
      .locator('[data-slot="workflow-builder-node"][data-node-id="output"]:visible')
      .first()
      .boundingBox();
    expect(inputBox).not.toBeNull();
    expect(outputBox).not.toBeNull();

    const targetLeft = inputBox!.x + inputBox!.width + 20;
    await page.mouse.move(outputBox!.x + outputBox!.width / 2, outputBox!.y + 24);
    await page.mouse.down();
    await page.mouse.move(targetLeft + outputBox!.width / 2, inputBox!.y + 24, { steps: 8 });
    await page.mouse.up();

    await expect(page.getByTestId("edge-count")).toHaveText("2");
    await expect(page.getByTestId("summary-json")).toContainText("input:out->output:in");

    const document = await readDocument(page);
    const output = document.nodes.find((node) => node.id === "output");
    expect(output).toEqual(expect.objectContaining({ x: 248, y: 0 }));
    expect(document.edges).toContainEqual(
      expect.objectContaining({
        sourceNodeId: "input",
        sourcePortId: "out",
        targetNodeId: "output",
        targetPortId: "in",
      }),
    );
  });

  test("ignores duplicate connection attempts without changing selection or edge count", async ({
    page,
  }) => {
    await page.goto("/");
    await selectNode(page, "Input");

    await clickPort(page, "Start Input Out");
    await clickPort(page, "Connect to Transform In");

    await expectEdgeCount(page, 1);
    await expect(page.getByTestId("selected-node-id")).toHaveText('"input"');
  });

  test("blocks mutations in read-only mode", async ({ page }) => {
    await page.goto("/?readonly=1");
    await selectNode(page, "Input");

    await expect(page.getByRole("button", { name: /Decision/ }).first()).toBeDisabled();
    await expect(page.getByRole("button", { name: "Duplicate", exact: true })).toBeDisabled();
    await expect(page.getByRole("button", { name: "Delete", exact: true })).toBeDisabled();
    await expect(page.getByRole("textbox", { name: "Label" }).first()).toBeDisabled();

    await page.getByRole("button", { name: "Start Input Out" }).first().click({ force: true });
    await expect(page.getByTestId("node-count")).toHaveText("3");
    await expect(page.getByTestId("edge-count")).toHaveText("1");

    await page.keyboard.press("Delete");
    await pressShortcut(page, "Mod+D");
    await pressShortcut(page, "Mod+V");
    await expectNodeCount(page, 3);
    await expectEdgeCount(page, 1);

    await expect(page.getByRole("button", { name: "Export JSON" })).toBeEnabled();
  });

  test("creates, renames, duplicates, deletes, and persists documents", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "New" }).click();
    await expect(page.getByTestId("document-count")).toHaveText("2");
    await expect(page.getByTestId("node-count")).toHaveText("0");

    await page.getByRole("textbox", { name: "Document name" }).fill("Scratch Flow");
    await page.getByRole("button", { name: "Rename" }).click();
    await expect(page.getByTestId("active-document-name")).toHaveText("Scratch Flow");

    await page.getByRole("button", { name: "Duplicate document" }).click();
    await expect(page.getByTestId("document-count")).toHaveText("3");
    await expect(page.getByTestId("active-document-name")).toHaveText("Scratch Flow Copy");

    await page.getByRole("button", { name: "Delete document" }).click();
    await expect(page.getByTestId("document-count")).toHaveText("2");
    await page.waitForFunction(() =>
      window.localStorage.getItem("workflow-editor-playwright")?.includes("Scratch Flow"),
    );

    await page.reload();
    await expect(page.getByTestId("document-count")).toHaveText("2");
    await expect(page.getByTestId("library-json")).toContainText("Scratch Flow");
  });

  test("saves and restores explicit versions", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "Save version" }).click();
    await expect(page.getByTestId("version-count")).toHaveText("1");

    await page
      .getByRole("button", { name: /Decision/ })
      .first()
      .click();
    await expect(page.getByTestId("node-count")).toHaveText("4");

    await page.getByRole("button", { name: "Restore version" }).click();
    await expect(page.getByTestId("node-count")).toHaveText("3");
    await expect(page.getByTestId("document-json")).not.toContainText('"id":"decision"');
  });

  test("undoes and redoes document edits", async ({ page }) => {
    await page.goto("/");

    await page
      .getByRole("button", { name: /Decision/ })
      .first()
      .click();
    await expect(page.getByTestId("node-count")).toHaveText("4");

    await page.getByRole("button", { name: "Undo", exact: true }).click();
    await expect(page.getByTestId("node-count")).toHaveText("3");

    await page.getByRole("button", { name: "Redo", exact: true }).click();
    await expect(page.getByTestId("node-count")).toHaveText("4");
  });

  test("exports and imports workflow JSON files", async ({ page }) => {
    await page.goto("/");

    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Export JSON" }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/demo-workflow\.json$/);

    await page.locator('input[aria-label="Import workflow JSON"]').setInputFiles({
      name: "imported-workflow.json",
      mimeType: "application/json",
      buffer: Buffer.from(
        JSON.stringify({
          format: "@moritzbrantner/workflow-editor/document",
          version: 1,
          exportedAt: "2026-05-26T00:00:00.000Z",
          documentName: "Imported Flow",
          document: {
            nodes: [{ id: "imported", label: "Imported", x: 0, y: 0 }],
            edges: [],
          },
        }),
      ),
    });

    await expect(page.getByTestId("active-document-name")).toHaveText("Imported Flow");
    await expect(page.getByTestId("node-count")).toHaveText("1");
  });

  test("keeps the active document when importing invalid JSON", async ({ page }) => {
    await page.goto("/");

    await page.locator('input[aria-label="Import workflow JSON"]').setInputFiles({
      name: "invalid-workflow.json",
      mimeType: "application/json",
      buffer: Buffer.from("{"),
    });

    await expect(page.getByTestId("save-state")).toHaveText("Save error");
    await expect(page.getByTestId("active-document-name")).toHaveText("Demo Workflow");
    await expectNodeCount(page, 3);
    await expectEdgeCount(page, 1);
  });

  test("creates a nested workflow, opens it, and returns through breadcrumbs", async ({ page }) => {
    await page.goto("/");
    await selectNode(page, "Input");
    await clickAction(page, "Create nested workflow");

    await expect(page.getByTestId("document-count")).toHaveText("2");
    await expect(page.getByTestId("node-count")).toHaveText("0");
    await expect(page.getByTestId("active-document-name")).toHaveText("Input Workflow");
    await expect(page.getByTestId("document-path-json")).toContainText("demo-workflow");

    await page.getByRole("button", { name: "Demo Workflow" }).click();
    await expect(page.getByTestId("active-document-name")).toHaveText("Demo Workflow");
    await expect(page.getByTestId("node-count")).toHaveText("3");
    await expect(page.getByTestId("document-json")).toContainText('"workflowRef"');
  });

  test("assigns an existing workflow reference and drills into it", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: "New" }).click();
    await page.getByRole("textbox", { name: "Document name" }).fill("Child Flow");
    await page.getByRole("button", { name: "Rename" }).click();
    await page.getByLabel("Workflow document").first().selectOption({ label: "Demo Workflow" });
    await selectNode(page, "Input");
    await selectInspectorWorkflowReference(page, "Child Flow");
    await clickAction(page, "Apply");
    await clickAction(page, "Open workflow");

    await expect(page.getByTestId("active-document-name")).toHaveText("Child Flow");
    await expect(page.getByTestId("node-count")).toHaveText("0");
  });

  test("allows self-references until the nested workflow depth cap", async ({ page }) => {
    await page.goto("/?maxDepth=2");
    await selectNode(page, "Input");
    await selectInspectorWorkflowReference(page, "Demo Workflow");
    await clickAction(page, "Apply");
    await clickAction(page, "Open workflow");

    await expect(page.getByTestId("active-document-name")).toHaveText("Demo Workflow");
    await expect(page.getByTestId("document-path-json")).toContainText("demo-workflow");
    await selectNode(page, "Input");
    await expect(page.getByRole("button", { name: "Open workflow" }).first()).toBeDisabled();
  });

  test("preserves and surfaces missing workflow references", async ({ page }) => {
    await page.goto("/");
    await selectNode(page, "Input");
    await clickAction(page, "Create nested workflow");
    await expect(page.getByTestId("active-document-name")).toHaveText("Input Workflow");

    await page.getByRole("button", { name: "Demo Workflow" }).click();
    await page.getByLabel("Workflow document").first().selectOption({ label: "Input Workflow" });
    await page.getByRole("button", { name: "Delete document" }).click();
    await expect(page.getByTestId("active-document-name")).toHaveText("Demo Workflow");

    await selectNode(page, "Input");
    await expect(page.getByTestId("document-json")).toContainText('"workflowRef"');
    await expect(
      page.getByText(/Missing workflow document/).filter({ visible: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Open workflow" }).filter({ visible: true }).first(),
    ).toBeDisabled();
  });

  test("recovers from corrupt localStorage", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("workflow-editor-playwright", "{");
    });
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Workflow node" })).toHaveCount(0);
    await expect(page.getByTestId("document-count")).toHaveText("1");
    await expect(page.getByTestId("node-count")).toHaveText("3");
  });
});

test.describe("WorkflowWorkbench accessibility and responsive smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      window.localStorage.clear();
    });
  });

  test("passes automated accessibility checks in the initial and inspector states", async ({
    page,
  }) => {
    await expectNoAxeViolations(page);

    await page.getByRole("button", { name: "Input", exact: true }).click({ force: true });
    await expect(page.getByRole("heading", { name: "Workflow node" })).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test("activates node creation from keyboard focus", async ({ page }) => {
    const decisionButton = page.getByRole("button", { name: /Decision/ }).first();
    await decisionButton.focus();
    await page.keyboard.press("Enter");

    await expect(page.getByTestId("node-count")).toHaveText("4");
    await expect(page.getByTestId("selection-json")).toContainText('"id":"decision"');
  });

  test("loads and edits on a mobile viewport", async ({ page, isMobile }) => {
    test.skip(!isMobile, "Mobile smoke coverage");

    await expect(page.getByTestId("document-count")).toHaveText("1");
    await expect(page.getByTestId("node-count")).toHaveText("3");
    await page
      .getByRole("button", { name: /Decision/ })
      .first()
      .click();

    await expect(page.getByTestId("node-count")).toHaveText("4");

    await selectNode(page, "Input");
    await expect(page.getByRole("heading", { name: "Workflow node" })).toBeVisible();
    await page.locator('input[aria-label="Label"]:visible').fill("Mobile Input");
    await page
      .getByRole("button", { name: "Apply" })
      .filter({ visible: true })
      .first()
      .click({ force: true });
    await expect(
      page.locator('[data-slot="workflow-node-select"][aria-label="Mobile Input"]:visible'),
    ).toBeVisible();

    await page
      .getByRole("button", { name: "Duplicate", exact: true })
      .filter({ visible: true })
      .first()
      .click({ force: true });
    await expect(page.getByTestId("node-count")).toHaveText("5");
    await page
      .getByRole("button", { name: "Delete", exact: true })
      .filter({ visible: true })
      .first()
      .click({ force: true });
    await expect(page.getByTestId("node-count")).toHaveText("4");
  });
});
