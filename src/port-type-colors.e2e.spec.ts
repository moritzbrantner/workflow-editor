// Independent acceptance (issue #60) — authored before implementation by a separate
// acceptance agent/context. Authority: docs/DECISION-ATLAS.md 3.1 and 1.1.
// Contract details (mapping location, type identity, precedence) are documented at the top of
// src/port-type-colors.acceptance.unit.test.ts. Browser-level contract added here:
//
// E1 In the real Pages workbench (examples/workbench), the "Types" panel offers one color
//    control per displayed port type of the active workflow: an <input type="color"> whose
//    accessible name is `Color for type <displayed TypeScript type>` (e.g.
//    "Color for type Customer").
// E2 Changing it recolors every port of that type (source and target ports, including ports of
//    minimized nodes) and the connections leaving those ports; other types keep their colors.
// E3 The workbench host persists the user's mapping: after saving and reopening (page reload)
//    the configured colors and control values are restored.
// E4 Type names stay visible as text and TypeScript diagnostics still reject an incompatible
//    connection even when both types are configured to the identical color.
import { expect, test, type Locator, type Page } from "@playwright/test";

const workbench = "http://127.0.0.1:4175/";
const documentName = "Port color acceptance";
const red = { hex: "#e11d48", rgb: "rgb(225, 29, 72)" };
const blue = { hex: "#2563eb", rgb: "rgb(37, 99, 235)" };

const value = (type: string) => ({ kind: "typescript", source: type });
const importedFile = {
  format: "@moritzbrantner/workflow-editor/document",
  version: 1,
  exportedAt: "2026-10-15T00:00:00.000Z",
  documentName,
  document: {
    typeDeclarations: "type Customer = { id: string; name?: string };",
    viewport: { x: 40, y: 40, zoom: 0.6 },
    nodes: [
      {
        id: "customer-a",
        label: "Customer A",
        kind: "data.value",
        x: 0,
        y: 0,
        outputs: [{ id: "value", label: "Value", type: value("Customer") }],
      },
      {
        id: "customer-b",
        label: "Customer B",
        kind: "data.value",
        x: 0,
        y: 220,
        minimized: true,
        outputs: [{ id: "value", label: "Value", type: value("Customer") }],
      },
      {
        id: "sink-a",
        label: "Customer sink A",
        kind: "data.input",
        x: 380,
        y: 0,
        inputs: [{ id: "value", label: "Value", type: value("Customer") }],
      },
      {
        id: "sink-b",
        label: "Customer sink B",
        kind: "data.input",
        x: 380,
        y: 220,
        minimized: true,
        inputs: [{ id: "value", label: "Value", type: value("Customer") }],
      },
      {
        id: "number-source",
        label: "Number source",
        kind: "data.value",
        x: 0,
        y: 400,
        outputs: [{ id: "value", label: "Value", type: value("number") }],
      },
      {
        id: "number-sink",
        label: "Number sink",
        kind: "data.input",
        x: 380,
        y: 400,
        inputs: [{ id: "value", label: "Value", type: value("number") }],
      },
      {
        id: "number-spare",
        label: "Number spare",
        kind: "data.input",
        x: 380,
        y: 580,
        inputs: [{ id: "value", label: "Value", type: value("number") }],
      },
    ],
    edges: [
      {
        id: "a",
        sourceNodeId: "customer-a",
        sourcePortId: "value",
        targetNodeId: "sink-a",
        targetPortId: "value",
      },
      {
        id: "b",
        sourceNodeId: "customer-b",
        sourcePortId: "value",
        targetNodeId: "sink-b",
        targetPortId: "value",
      },
      {
        id: "n",
        sourceNodeId: "number-source",
        sourcePortId: "value",
        targetNodeId: "number-sink",
        targetPortId: "value",
      },
    ],
  },
};

const customerPorts = [
  ["customer-a", "output"],
  ["customer-b", "output"],
  ["sink-a", "input"],
  ["sink-b", "input"],
] as const;
const numberPorts = [
  ["number-source", "output"],
  ["number-sink", "input"],
  ["number-spare", "input"],
] as const;

function port(page: Page, nodeId: string, direction: "input" | "output"): Locator {
  return page
    .locator(
      `[data-slot="workflow-builder-node"][data-node-id="${nodeId}"] [data-slot="workflow-node-port"][data-port-direction="${direction}"][data-port-id="value"]`,
    )
    .first();
}

/** The port button together with its type chips. */
function portFrame(page: Page, nodeId: string, direction: "input" | "output"): Locator {
  return port(page, nodeId, direction).locator("xpath=..");
}

/** The color a user sees for a port: its dot fill, or the port marker fill when the dot is clear. */
async function visiblePortColor(locator: Locator) {
  return locator.evaluate((element) => {
    const transparent = (color: string) =>
      color === "transparent" || /^rgba\(.*,\s*0\)$/.test(color);
    const dot = element.querySelector('[data-slot="workflow-node-port-dot"]');
    const dotFill = dot ? getComputedStyle(dot).backgroundColor : "transparent";
    return transparent(dotFill) ? getComputedStyle(element).backgroundColor : dotFill;
  });
}

async function edgeStroke(page: Page, edgeId: string) {
  return page
    .locator(`[data-slot="workflow-builder-edge-hit"][aria-label="Connection ${edgeId}"]`)
    .locator('xpath=following-sibling::*[@data-slot="workflow-builder-edge"][1]')
    .evaluate((element) => getComputedStyle(element).stroke);
}

async function expectTypeColor(
  page: Page,
  ports: ReadonlyArray<readonly [string, "input" | "output"]>,
  edges: readonly string[],
  rgb: string,
) {
  for (const [nodeId, direction] of ports) {
    await expect
      .poll(() => visiblePortColor(port(page, nodeId, direction)), {
        message: `${nodeId} ${direction} port color`,
      })
      .toBe(rgb);
  }
  for (const edgeId of edges) {
    await expect
      .poll(() => edgeStroke(page, edgeId), { message: `edge ${edgeId} stroke` })
      .toBe(rgb);
  }
}

async function pressButton(page: Page, name: string) {
  const button = page.getByRole("button", { name, exact: true });
  await button.focus();
  await page.keyboard.press("Enter");
}

async function openTypes(page: Page) {
  await pressButton(page, "Types");
  await expect(
    page.getByRole("complementary", { name: "Workflow types", exact: true }),
  ).toBeVisible();
}

async function setTypeColor(page: Page, type: string, hex: string) {
  const control = page.getByLabel(`Color for type ${type}`, { exact: true });
  await expect(control).toHaveAttribute("type", "color");
  await control.fill(hex);
  await expect(control).toHaveValue(hex);
}

test("configures one color per port type across nodes, edges, minimized nodes and reopening", async ({
  page,
}, testInfo) => {
  test.skip(
    testInfo.project.name !== "chromium",
    "Desktop journey; phone layout is covered by owner screenshots (see PR)",
  );
  await page.goto(workbench);

  // Import a workflow with several nodes per type (some minimized) into the real workbench.
  await page.getByRole("button", { name: "Sales Data Pipeline", exact: true }).click();
  await page.getByLabel("Import workflow JSON", { exact: true }).setInputFiles({
    name: "port-colors.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(importedFile)),
  });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: documentName, exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Minimize node palette", exact: true }).click();
  await expect(port(page, "sink-b", "input")).toBeAttached();

  // Before configuration: every Customer port shares one (fallback) color, as does every number.
  const customerBefore = await visiblePortColor(port(page, "customer-a", "output"));
  const numberBefore = await visiblePortColor(port(page, "number-source", "output"));
  await expectTypeColor(page, customerPorts, [], customerBefore);
  await expectTypeColor(page, numberPorts, [], numberBefore);
  await page.screenshot({ path: testInfo.outputPath("port-colors-before.png"), fullPage: true });

  // Configure Customer: all four Customer ports (two on minimized nodes) and both edges follow.
  await openTypes(page);
  await setTypeColor(page, "Customer", red.hex);
  await pressButton(page, "Close types");
  await expectTypeColor(page, customerPorts, ["a", "b"], red.rgb);
  // A different type keeps its own color.
  await expectTypeColor(page, numberPorts, [], numberBefore);

  // Configure number independently.
  await openTypes(page);
  await setTypeColor(page, "number", blue.hex);
  await expect(page.getByLabel("Color for type Customer", { exact: true })).toHaveValue(red.hex);
  await pressButton(page, "Close types");
  await expectTypeColor(page, numberPorts, ["n"], blue.rgb);
  await expectTypeColor(page, customerPorts, ["a", "b"], red.rgb);
  await page.screenshot({ path: testInfo.outputPath("port-colors-after.png"), fullPage: true });

  // Save and reopen.
  await page.getByRole("button", { name: documentName, exact: true }).click();
  await pressButton(page, "Save version");
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(page.getByRole("button", { name: documentName, exact: true })).toBeVisible();
  await expect(port(page, "sink-b", "input")).toBeAttached();
  await expectTypeColor(page, customerPorts, ["a", "b"], red.rgb);
  await expectTypeColor(page, numberPorts, ["n"], blue.rgb);
  await page.getByRole("button", { name: "Minimize node palette", exact: true }).click();
  await openTypes(page);
  await expect(page.getByLabel("Color for type Customer", { exact: true })).toHaveValue(red.hex);
  await expect(page.getByLabel("Color for type number", { exact: true })).toHaveValue(blue.hex);

  // Identical colors do not make an incompatible connection valid; names remain visible text.
  await setTypeColor(page, "number", red.hex);
  await pressButton(page, "Close types");
  await expectTypeColor(page, numberPorts, ["n"], red.rgb);
  // The type chip sits next to the port button (graph-editor#73), inside the port frame.
  await expect(portFrame(page, "customer-a", "output")).toContainText(/customer/i);
  await expect(portFrame(page, "number-spare", "input")).toContainText(/number/i);
  await expect(port(page, "customer-b", "output")).toHaveAttribute("title", /customer/i);
  await expect(port(page, "sink-b", "input")).toHaveAttribute("title", /customer/i);

  const source = page.getByRole("button", { name: "Start Customer A Value", exact: true });
  await source.focus();
  await source.press("Shift+F10");
  await expect(page.getByRole("menu", { name: /Possible inputs/ })).toBeVisible();
  const incompatible = page.getByRole("menuitem", { name: "Number spare Value", exact: true });
  await expect(incompatible).toHaveAttribute("aria-disabled", "true");
  await expect(incompatible).toContainText("Type 'Customer' is not assignable to type 'number'");
  await incompatible.focus();
  await incompatible.press("Enter");
  await page.keyboard.press("Escape");
  const edges = await page.evaluate(() => {
    const library = JSON.parse(
      window.localStorage.getItem("moritzbrantner.workflow-editor.examples.v1") ?? "null",
    );
    const entry = library?.documents.find(
      (candidate: { name: string }) => candidate.name === "Port color acceptance",
    );
    return entry?.document.edges.map((edge: { id: string }) => edge.id).sort();
  });
  expect(edges).toEqual(["a", "b", "n"]);
});
