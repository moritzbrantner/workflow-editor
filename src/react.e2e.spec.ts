import { expect, test, type Page, type TestInfo } from "@playwright/test";
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
  groups?: Array<{ id: string; label: string; nodeIds: string[]; minimized?: boolean }>;
  viewport?: { x: number; y: number; zoom: number };
};

async function readDocument(page: Page) {
  return JSON.parse(
    (await page.getByTestId("document-json").textContent()) ?? "null",
  ) as WorkflowDocumentSnapshot;
}

function workflowEditorStorageKey(testInfo: TestInfo) {
  const titleSlug = testInfo.titlePath
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `workflow-editor-playwright-${testInfo.project.name}-${testInfo.workerIndex}-${testInfo.retry}-${titleSlug}`;
}

async function gotoWorkflowEditor(
  page: Page,
  testInfo: TestInfo,
  params: Record<string, string> = {},
) {
  const searchParams = new URLSearchParams(params);
  searchParams.set("storageKey", workflowEditorStorageKey(testInfo));
  searchParams.set("clearStorageKey", "1");

  await page.goto(`/?${searchParams}`);
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
  const edge = page.getByRole("button", { name: `Connection ${id}`, exact: true }).first();
  await edge.focus();
  await page.keyboard.press("Enter");
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

  test("adds template nodes and keeps controlled document state in sync", async ({
    page,
  }, testInfo) => {
    await gotoWorkflowEditor(page, testInfo);

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

  test("minimizes the node palette and adds template nodes by dragging", async ({
    page,
  }, testInfo) => {
    await gotoWorkflowEditor(page, testInfo);

    const palette = page.locator('[data-slot="workflow-palette-overlay"]').first();
    await expect(palette).toContainText("Logic");
    await expect(palette).toContainText("Branches");
    const canvasBox = await page.locator('[data-slot="workbench-canvas"]').first().boundingBox();
    const expandedPaletteBox = await palette.boundingBox();
    expect(expandedPaletteBox?.width).toBeGreaterThan(300);
    expect(canvasBox).not.toBeNull();
    expect(expandedPaletteBox).not.toBeNull();
    expect(expandedPaletteBox!.x - canvasBox!.x).toBeLessThan(32);
    expect(expandedPaletteBox!.y - canvasBox!.y).toBeLessThan(32);

    await page.getByRole("button", { name: "Minimize node palette", exact: true }).click();
    await expect(palette).toContainText("Node palette");
    await expect(page.getByRole("button", { name: /Decision/ })).toHaveCount(0);
    const minimizedPaletteBox = await palette.boundingBox();
    expect(minimizedPaletteBox).not.toBeNull();
    expect(minimizedPaletteBox!.x - canvasBox!.x).toBeLessThan(32);
    expect(minimizedPaletteBox!.y - canvasBox!.y).toBeLessThan(32);
    expect(minimizedPaletteBox!.width).toBeLessThan(expandedPaletteBox!.width);
    await page.getByRole("button", { name: "Expand node palette", exact: true }).click();
    await expect(page.getByLabel("Search node palette")).toBeVisible();

    const paletteHeader = page.locator('[data-slot="workflow-palette-header"]').first();
    const headerBox = await paletteHeader.boundingBox();
    expect(headerBox).not.toBeNull();
    await page.mouse.move(headerBox!.x + 48, headerBox!.y + headerBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(headerBox!.x + 188, headerBox!.y + headerBox!.height / 2 + 80, {
      steps: 8,
    });
    await page.mouse.up();
    const draggedPaletteBox = await palette.boundingBox();
    expect(draggedPaletteBox).not.toBeNull();
    expect(draggedPaletteBox!.x - expandedPaletteBox!.x).toBeGreaterThan(80);
    expect(draggedPaletteBox!.y - expandedPaletteBox!.y).toBeGreaterThan(40);

    await page.mouse.move(draggedPaletteBox!.x + 48, draggedPaletteBox!.y + 12);
    await page.mouse.down();
    await page.mouse.move(canvasBox!.x - 400, canvasBox!.y - 400, { steps: 8 });
    await page.mouse.up();
    const clampedPaletteBox = await palette.boundingBox();
    expect(clampedPaletteBox).not.toBeNull();
    expect(clampedPaletteBox!.x).toBeGreaterThanOrEqual(canvasBox!.x);
    expect(clampedPaletteBox!.y).toBeGreaterThanOrEqual(canvasBox!.y);

    await page.getByRole("button", { name: "Pin node palette", exact: true }).click();
    await page.getByRole("menuitem", { name: "Bottom right", exact: true }).click();
    const bottomRightPaletteBox = await palette.boundingBox();
    expect(bottomRightPaletteBox).not.toBeNull();
    expect(
      canvasBox!.x + canvasBox!.width - (bottomRightPaletteBox!.x + bottomRightPaletteBox!.width),
    ).toBeLessThan(40);
    expect(
      canvasBox!.y + canvasBox!.height - (bottomRightPaletteBox!.y + bottomRightPaletteBox!.height),
    ).toBeLessThan(40);

    const paletteSearch = page.getByLabel("Search node palette");
    await expect(paletteSearch).toBeVisible();
    await paletteSearch.fill("webhook");
    await expect(page.getByRole("button", { name: /Webhook/ }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: /Decision/ })).toHaveCount(0);
    await paletteSearch.fill("");
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

  test("minimizes and drags the info panel within the canvas", async ({ page }, testInfo) => {
    await gotoWorkflowEditor(page, testInfo);
    await selectNode(page, "Input");

    const canvasBox = await page.locator('[data-slot="workbench-canvas"]').first().boundingBox();
    const inspector = page.locator('[data-slot="workflow-inspector-overlay"]').first();
    const inspectorHeader = page.locator('[data-slot="workflow-inspector-header"]').first();
    await expect(inspector).toContainText("Info");
    await expect(inspector).toContainText("Workflow node");

    const expandedInspectorBox = await inspector.boundingBox();
    expect(canvasBox).not.toBeNull();
    expect(expandedInspectorBox).not.toBeNull();
    expect(expandedInspectorBox!.x).toBeGreaterThanOrEqual(canvasBox!.x);
    expect(expandedInspectorBox!.y).toBeGreaterThanOrEqual(canvasBox!.y);
    expect(expandedInspectorBox!.x + expandedInspectorBox!.width).toBeLessThanOrEqual(
      canvasBox!.x + canvasBox!.width,
    );
    expect(expandedInspectorBox!.y + expandedInspectorBox!.height).toBeLessThanOrEqual(
      canvasBox!.y + canvasBox!.height,
    );

    await page.getByRole("button", { name: "Minimize info panel", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Expand info panel", exact: true }),
    ).toBeVisible();
    await expect(inspector).toContainText("Info");
    await expect(inspector).not.toContainText("Workflow node");
    const minimizedInspectorBox = await inspector.boundingBox();
    expect(minimizedInspectorBox).not.toBeNull();
    expect(minimizedInspectorBox!.width).toBeLessThan(expandedInspectorBox!.width);

    await page.getByRole("button", { name: "Expand info panel", exact: true }).click();
    await expect(inspector).toContainText("Workflow node");

    const headerBox = await inspectorHeader.boundingBox();
    expect(headerBox).not.toBeNull();
    await page.mouse.move(headerBox!.x + 48, headerBox!.y + headerBox!.height / 2);
    await page.mouse.down();
    await page.mouse.move(canvasBox!.x + canvasBox!.width + 400, canvasBox!.y + 90, {
      steps: 8,
    });
    await page.mouse.up();
    const clampedInspectorBox = await inspector.boundingBox();
    expect(clampedInspectorBox).not.toBeNull();
    expect(clampedInspectorBox!.x + clampedInspectorBox!.width).toBeLessThanOrEqual(
      canvasBox!.x + canvasBox!.width,
    );
    expect(clampedInspectorBox!.y).toBeGreaterThanOrEqual(canvasBox!.y);
    expect(clampedInspectorBox!.y + clampedInspectorBox!.height).toBeLessThanOrEqual(
      canvasBox!.y + canvasBox!.height,
    );
  });

  test("keeps JSON primitive value controls visible while minimized", async ({
    page,
  }, testInfo) => {
    await gotoWorkflowEditor(page, testInfo);

    const palette = page.locator('[data-slot="workflow-palette-overlay"]').first();
    const paletteSearch = page.getByLabel("Search node palette");
    await paletteSearch.fill("string");
    await palette
      .getByRole("button", { name: /String/ })
      .first()
      .click();
    await expect(page.getByTestId("node-count")).toHaveText("4");

    const valueInput = page.getByLabel("String JSON value");
    await expect(valueInput).toBeVisible();

    await valueInput.fill("published");
    await expect(valueInput).toHaveValue("published");

    const menuButton = page.getByRole("button", { name: "String node actions" });
    await expect(menuButton).toBeVisible();
    const minimizedInputBox = await valueInput.boundingBox();
    const minimizedMenuBox = await menuButton.boundingBox();
    expect(minimizedInputBox).not.toBeNull();
    expect(minimizedMenuBox).not.toBeNull();
    expect(minimizedInputBox!.x + minimizedInputBox!.width).toBeLessThanOrEqual(
      minimizedMenuBox!.x,
    );

    await page.getByRole("button", { name: "Expand String", exact: true }).click();
    await expect(valueInput).toBeVisible();
    const outputCard = page.getByRole("button", { name: "Start String Value" });
    await expect(
      page.locator(
        '[data-slot="workflow-builder-node"][data-node-id="json-string"] [data-slot="workflow-node"]:not([data-minimized="true"]) [data-slot="workflow-node-port"][data-port-direction="output"][data-port-id="value"] > div > span:nth-of-type(2)',
      ),
    ).toHaveCSS("display", "none");
    const expandedInputBox = await valueInput.boundingBox();
    const outputCardBox = await outputCard.boundingBox();
    expect(expandedInputBox).not.toBeNull();
    expect(outputCardBox).not.toBeNull();
    expect(expandedInputBox!.x + expandedInputBox!.width / 2).toBeGreaterThan(outputCardBox!.x);
    expect(expandedInputBox!.x + expandedInputBox!.width / 2).toBeLessThan(
      outputCardBox!.x + outputCardBox!.width,
    );
    expect(expandedInputBox!.y + expandedInputBox!.height / 2).toBeGreaterThan(outputCardBox!.y);
    expect(expandedInputBox!.y + expandedInputBox!.height / 2).toBeLessThan(
      outputCardBox!.y + outputCardBox!.height,
    );

    await page.getByRole("button", { name: "Minimize String", exact: true }).click();
    await expect(valueInput).toBeVisible();
    const reminimizedInputBox = await valueInput.boundingBox();
    const reminimizedMenuBox = await menuButton.boundingBox();
    expect(reminimizedInputBox).not.toBeNull();
    expect(reminimizedMenuBox).not.toBeNull();
    expect(reminimizedInputBox!.x + reminimizedInputBox!.width).toBeLessThanOrEqual(
      reminimizedMenuBox!.x,
    );
  });

  test("hides object constructor expression controls while minimized", async ({
    page,
  }, testInfo) => {
    await gotoWorkflowEditor(page, testInfo);

    const palette = page.locator('[data-slot="workflow-palette-overlay"]').first();
    const paletteSearch = page.getByLabel("Search node palette");
    await paletteSearch.fill("object");
    await palette
      .getByRole("button", { name: /Object/ })
      .first()
      .click();
    await expect(page.getByTestId("node-count")).toHaveText("4");

    const expressionInput = page.getByLabel("Object object expression");
    await expect(expressionInput).toBeVisible();

    await page.getByRole("button", { name: "Minimize Object", exact: true }).click();
    await expect(expressionInput).toHaveCount(0);

    await page.getByRole("button", { name: "Expand Object", exact: true }).click();
    await expect(expressionInput).toBeVisible();
  });

  test("selects, duplicates, edits, and deletes nodes", async ({ page }, testInfo) => {
    await gotoWorkflowEditor(page, testInfo);
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

  test("renames nodes inline from the canvas", async ({ page }, testInfo) => {
    await gotoWorkflowEditor(page, testInfo);
    await page.getByRole("button", { name: "Minimize node palette", exact: true }).click();

    const inputSelect = page
      .locator(
        '[data-slot="workflow-builder-node"][data-node-id="input"] [data-slot="workflow-node-select"][aria-label="Input"]:visible',
      )
      .first();
    await inputSelect.dblclick();

    const inputName = page.getByLabel("Input node name");
    await expect(inputName).toBeVisible();
    await inputName.fill("Source");
    await page.keyboard.press("Enter");

    await expect(page.getByTestId("document-json")).toContainText('"label":"Source"');
    await expect(
      page.locator('[data-slot="workflow-node-select"][aria-label="Source"]:visible'),
    ).toBeVisible();

    const renamedDocument = await readDocument(page);
    expect(renamedDocument.nodes.find((node) => node.id === "input")).toEqual(
      expect.objectContaining({ id: "input", label: "Source" }),
    );

    const transformSelect = page
      .locator(
        '[data-slot="workflow-builder-node"][data-node-id="transform"] [data-slot="workflow-node-select"][aria-label="Transform"]:visible',
      )
      .first();
    await transformSelect.dblclick();
    const transformName = page.getByLabel("Transform node name");
    await expect(transformName).toBeVisible();
    await transformName.fill("Pending");
    await page.keyboard.press("Escape");

    await expect(page.getByTestId("document-json")).not.toContainText('"label":"Pending"');
    const cancelledDocument = await readDocument(page);
    expect(cancelledDocument.nodes.find((node) => node.id === "transform")).toEqual(
      expect.objectContaining({ id: "transform", label: "Transform" }),
    );
  });

  test("multi-selects nodes and duplicates, copies, pastes, and deletes the selection", async ({
    page,
  }, testInfo) => {
    await gotoWorkflowEditor(page, testInfo);

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

  test("groups, moves, minimizes, expands, and ungroups nodes", async ({ page }, testInfo) => {
    await gotoWorkflowEditor(page, testInfo);
    await page.getByRole("button", { name: "Minimize node palette", exact: true }).click();

    await selectNode(page, "Input");
    await addNodeToSelection(page, "Transform");
    await pressShortcut(page, "Mod+G");
    await expect(
      page.locator('[data-slot="workflow-group"][data-group-id="group-1"]'),
    ).toBeVisible();
    await expect(page.getByTestId("selection-count").first()).toHaveText("1 selected");

    const beforeMove = await readDocument(page);
    const beforeInput = beforeMove.nodes.find((node) => node.id === "input")!;
    const beforeTransform = beforeMove.nodes.find((node) => node.id === "transform")!;
    const groupDragHandle = page
      .locator(
        '[data-slot="workflow-group"][data-group-id="group-1"] [data-slot="workflow-group-drag-handle"]',
      )
      .first();
    const groupDragHandleBox = await groupDragHandle.boundingBox();
    expect(groupDragHandleBox).not.toBeNull();
    await groupDragHandle.dispatchEvent("pointerdown", {
      bubbles: true,
      button: 0,
      buttons: 1,
      clientX: groupDragHandleBox!.x + 4,
      clientY: groupDragHandleBox!.y + 4,
      pointerId: 1,
      pointerType: "mouse",
    });
    await page.dispatchEvent("body", "pointermove", {
      bubbles: true,
      button: 0,
      buttons: 1,
      clientX: groupDragHandleBox!.x + 54,
      clientY: groupDragHandleBox!.y + 34,
      pointerId: 1,
      pointerType: "mouse",
    });
    await page.dispatchEvent("body", "pointerup", {
      bubbles: true,
      button: 0,
      buttons: 0,
      clientX: groupDragHandleBox!.x + 54,
      clientY: groupDragHandleBox!.y + 34,
      pointerId: 1,
      pointerType: "mouse",
    });

    const afterMove = await readDocument(page);
    const afterInput = afterMove.nodes.find((node) => node.id === "input")!;
    const afterTransform = afterMove.nodes.find((node) => node.id === "transform")!;
    expect(afterInput.x - beforeInput.x).toBe(afterTransform.x - beforeTransform.x);
    expect(afterInput.y - beforeInput.y).toBe(afterTransform.y - beforeTransform.y);
    expect(afterInput.x).not.toBe(beforeInput.x);

    await page.getByRole("button", { name: "Minimize Group 1 group", exact: true }).click();
    await expect(page.locator('[data-slot="workflow-group"][data-minimized="true"]')).toBeVisible();
    await expect(
      page.locator('[data-slot="workflow-builder-node"][data-node-id="input"][data-hidden="true"]'),
    ).toHaveCount(1);

    await page.getByRole("button", { name: "Expand Group 1 group", exact: true }).click();
    await expect(page.locator('[data-slot="workflow-group"][data-minimized="true"]')).toHaveCount(
      0,
    );

    await pressShortcut(page, "Shift+Mod+G");
    await expect(page.locator('[data-slot="workflow-group"][data-group-id="group-1"]')).toHaveCount(
      0,
    );
    expect((await readDocument(page)).groups).toBeUndefined();
  });

  test("uses keyboard shortcuts for duplicate, clipboard, escape, and delete", async ({
    page,
  }, testInfo) => {
    await gotoWorkflowEditor(page, testInfo);

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
    await expectNodeCount(page, 5);
    await expectEdgeCount(page, 2);

    await selectNodeById(page, "input");
    await expect(page.getByTestId("selected-node-id")).toHaveText('"input"');
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("selection-count").first()).toHaveText("0 selected");
    expect(await readSelection(page)).toBeNull();
  });

  test("does not run graph shortcuts while editing inspector fields", async ({
    page,
  }, testInfo) => {
    await gotoWorkflowEditor(page, testInfo);
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
  }, testInfo) => {
    await gotoWorkflowEditor(page, testInfo);

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

  test("selects edges, edits edge status, and deletes only the selected edge", async ({
    page,
  }, testInfo) => {
    await gotoWorkflowEditor(page, testInfo);

    await page.getByRole("button", { name: "Minimize node palette", exact: true }).click();
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

  test("arranges all nodes and selected nodes", async ({ page }, testInfo) => {
    await gotoWorkflowEditor(page, testInfo);
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

  test("zooms the workflow canvas with control wheel", async ({ page }, testInfo) => {
    await gotoWorkflowEditor(page, testInfo);

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

  test("pans the workflow canvas with drag and wheel", async ({ page }, testInfo) => {
    await gotoWorkflowEditor(page, testInfo);

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

  test("creates a valid edge through port interactions", async ({ page }, testInfo) => {
    await gotoWorkflowEditor(page, testInfo);

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

  test("snaps compatible ports together while dragging nodes", async ({ page }, testInfo) => {
    await gotoWorkflowEditor(page, testInfo);

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
    expect(output?.y).toBe(0);
    expect(output?.x).toBeLessThan(560);
    expect(output?.x).toBeGreaterThanOrEqual(inputBox!.width);
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
  }, testInfo) => {
    await gotoWorkflowEditor(page, testInfo);
    await selectNode(page, "Input");

    await clickPort(page, "Start Input Out");
    await clickPort(page, "Connect to Transform In");

    await expectEdgeCount(page, 1);
    await expect(page.getByTestId("selected-node-id")).toHaveText('"input"');
  });

  test("blocks mutations in read-only mode", async ({ page }, testInfo) => {
    await gotoWorkflowEditor(page, testInfo, { readonly: "1" });
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

  test("creates, renames, duplicates, deletes, and persists documents", async ({
    page,
  }, testInfo) => {
    const storageKey = workflowEditorStorageKey(testInfo);
    await gotoWorkflowEditor(page, testInfo);

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
    await page.waitForFunction(
      (key) => window.localStorage.getItem(key)?.includes("Scratch Flow"),
      storageKey,
    );

    await page.reload();
    await expect(page.getByTestId("document-count")).toHaveText("2");
    await expect(page.getByTestId("library-json")).toContainText("Scratch Flow");
  });

  test("saves and restores explicit versions", async ({ page }, testInfo) => {
    await gotoWorkflowEditor(page, testInfo);

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

  test("undoes and redoes document edits", async ({ page }, testInfo) => {
    await gotoWorkflowEditor(page, testInfo);

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

  test("exports and imports workflow JSON files", async ({ page }, testInfo) => {
    await gotoWorkflowEditor(page, testInfo);

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

  test("keeps the active document when importing invalid JSON", async ({ page }, testInfo) => {
    await gotoWorkflowEditor(page, testInfo);

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

  test("creates a nested workflow, opens it, and returns through breadcrumbs", async ({
    page,
  }, testInfo) => {
    await gotoWorkflowEditor(page, testInfo);
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

  test("assigns an existing workflow reference and drills into it", async ({ page }, testInfo) => {
    await gotoWorkflowEditor(page, testInfo);

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

  test("allows self-references until the nested workflow depth cap", async ({ page }, testInfo) => {
    await gotoWorkflowEditor(page, testInfo, { maxDepth: "2" });
    await selectNode(page, "Input");
    await selectInspectorWorkflowReference(page, "Demo Workflow");
    await clickAction(page, "Apply");
    await clickAction(page, "Open workflow");

    await expect(page.getByTestId("active-document-name")).toHaveText("Demo Workflow");
    await expect(page.getByTestId("document-path-json")).toContainText("demo-workflow");
    await selectNode(page, "Input");
    await expect(page.getByRole("button", { name: "Open workflow" }).first()).toBeDisabled();
  });

  test("preserves and surfaces missing workflow references", async ({ page }, testInfo) => {
    await gotoWorkflowEditor(page, testInfo);
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

  test("recovers from corrupt localStorage", async ({ page }, testInfo) => {
    const storageKey = workflowEditorStorageKey(testInfo);
    await page.addInitScript((key) => {
      window.localStorage.setItem(key, "{");
    }, storageKey);
    const searchParams = new URLSearchParams({ storageKey });
    await page.goto(`/?${searchParams}`);

    await expect(page.getByRole("heading", { name: "Workflow node" })).toHaveCount(0);
    await expect(page.getByTestId("document-count")).toHaveText("1");
    await expect(page.getByTestId("node-count")).toHaveText("3");
  });
});

test.describe("WorkflowWorkbench accessibility and responsive smoke", () => {
  test("passes automated accessibility checks in the initial and inspector states", async ({
    page,
  }, testInfo) => {
    await gotoWorkflowEditor(page, testInfo);
    await expectNoAxeViolations(page);

    await selectNode(page, "Input");
    await expect(page.getByRole("heading", { name: "Workflow node" })).toBeVisible();
    await expectNoAxeViolations(page);
  });

  test("activates node creation from keyboard focus", async ({ page }, testInfo) => {
    await gotoWorkflowEditor(page, testInfo);
    const decisionButton = page.getByRole("button", { name: /Decision/ }).first();
    await decisionButton.focus();
    await page.keyboard.press("Enter");

    await expect(page.getByTestId("node-count")).toHaveText("4");
    await expect(page.getByTestId("selection-json")).toContainText('"id":"decision"');
  });

  test("loads and edits on a mobile viewport", async ({ page, isMobile }, testInfo) => {
    test.skip(!isMobile, "Mobile smoke coverage");
    await gotoWorkflowEditor(page, testInfo);

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
