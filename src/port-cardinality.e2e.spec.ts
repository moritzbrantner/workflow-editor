// Acceptance for issue #15 / Decision Atlas 1.9 and 1.10 in the Pages workbench. The default
// "Lead Intake Automation" document shows a multi-source `control.merge` node, "Routed leads",
// whose `items: Lead[]` input declares `{ min: 1, max: 3 }`. Through the real port connection
// menu (the same keyboard affordance the native TypeScript spec uses), compatible sources connect
// up to the limit, an excessive source and an incompatible (number) source are listed disabled
// with a visible explanation, and a second source on an ordinary single input is explained
// without changing its type. Edges and declared cardinality persist across reload.
// Runs on desktop and mobile projects.
import { expect, test, type Page } from "@playwright/test";

const storageKey = "moritzbrantner.workflow-editor.examples.v1";

type StoredPortType = { kind: string; source?: string; name?: string; element?: StoredPortType };
type StoredPort = { id: string; label?: string; type: StoredPortType; cardinality?: unknown };
type StoredNode = {
  id: string;
  label: string;
  kind: string;
  inputs?: StoredPort[];
  outputs?: StoredPort[];
};
type StoredEdge = {
  id: string;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
};
type StoredDocument = { nodes: StoredNode[]; edges: StoredEdge[] };

async function leadIntake(page: Page): Promise<StoredDocument | undefined> {
  return page.evaluate((key) => {
    const library = JSON.parse(window.localStorage.getItem(key) ?? "null");
    return library?.documents.find((entry: { id: string }) => entry.id === "lead-intake")?.document;
  }, storageKey);
}

function edgesInto(document: StoredDocument | undefined, nodeId: string, portId: string) {
  return (document?.edges ?? []).filter(
    (edge) => edge.targetNodeId === nodeId && edge.targetPortId === portId,
  );
}

function input(document: StoredDocument | undefined, nodeId: string, portId: string) {
  return document?.nodes
    .find((node) => node.id === nodeId)
    ?.inputs?.find((port) => port.id === portId);
}

/** `Lead[]` either as a structured array of the Lead reference or as TypeScript source. */
function isLeadArray(type: StoredPortType | undefined) {
  if (!type) return false;
  if (type.kind === "array") {
    return type.element?.kind === "ref"
      ? type.element.name === "Lead"
      : type.element?.kind === "typescript" && type.element.source?.trim() === "Lead";
  }
  return (
    type.kind === "typescript" &&
    /^(Lead\[\]|Array<Lead>)$/.test((type.source ?? "").replace(/\s+/g, ""))
  );
}

async function openMenu(page: Page, portName: string) {
  const port = page.getByRole("button", { name: portName, exact: true });
  await port.focus();
  await port.press("Shift+F10");
  const menu = page.getByRole("menu", { name: /Possible inputs/ });
  await expect(menu).toBeVisible();
  return menu;
}

async function closeMenu(page: Page) {
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu", { name: /Possible inputs/ })).toHaveCount(0);
}

async function connect(page: Page, sourcePort: string, target: string) {
  const menu = await openMenu(page, sourcePort);
  const choice = menu.getByRole("menuitem", { name: target, exact: true });
  await expect(choice).toHaveAttribute("aria-disabled", "false");
  await choice.focus();
  await choice.press("Enter");
}

/** Opens the source's menu and returns the target choice, asserting it is listed but disabled. */
async function expectRejected(page: Page, sourcePort: string, target: string) {
  const menu = await openMenu(page, sourcePort);
  const choice = menu.getByRole("menuitem", { name: target, exact: true });
  await expect(choice).toBeVisible();
  await expect(choice).toHaveAttribute("aria-disabled", "true");
  return choice;
}

async function openLeadIntake(page: Page) {
  await page.goto("http://127.0.0.1:4175/");
  await expect(
    page.getByRole("button", { name: "Lead Intake Automation", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('[data-slot="workflow-builder-node"][data-node-id="routed-leads"]').first(),
  ).toBeAttached();
  await expect.poll(async () => (await leadIntake(page)) !== undefined).toBe(true);
}

test("multi-source Routed leads input accepts compatible sources up to its limit and explains rejections", async ({
  page,
}, testInfo) => {
  await openLeadIntake(page);

  // The seeded document declares the multi-source contract.
  const seeded = (await leadIntake(page))!;
  const routed = seeded.nodes.find((node) => node.id === "routed-leads");
  expect(routed).toMatchObject({ label: "Routed leads", kind: "control.merge" });
  expect(routed!.inputs?.map((port) => port.id)).toEqual(["items"]);
  expect(routed!.outputs?.map((port) => port.id)).toEqual(["out"]);
  const declaredItems = input(seeded, "routed-leads", "items")!;
  expect(isLeadArray(declaredItems.type)).toBe(true);
  expect(declaredItems.cardinality).toEqual({ min: 1, max: 3 });
  expect(
    edgesInto(seeded, "routed-leads", "items")
      .map((edge) => `${edge.sourceNodeId}.${edge.sourcePortId}`)
      .sort(),
  ).toEqual(["route.false", "route.true"]);
  const declaredNurture = input(seeded, "nurture", "lead")!;
  expect(edgesInto(seeded, "nurture", "lead")).toHaveLength(1);

  // An incompatible source (Score: number) is listed but explained as a type mismatch.
  const score = await expectRejected(page, "Start Score lead Score", "Routed leads Items");
  await expect(score).toContainText(/not assignable|number/i);
  await score.press("Enter");
  await closeMenu(page);
  await expect
    .poll(async () => edgesInto(await leadIntake(page), "routed-leads", "items").length)
    .toBe(2);

  // A third compatible source (Deduplicate: Lead) connects.
  await connect(page, "Start Deduplicate Lead", "Routed leads Items");
  await expect
    .poll(async () =>
      edgesInto(await leadIntake(page), "routed-leads", "items")
        .map((edge) => `${edge.sourceNodeId}.${edge.sourcePortId}`)
        .sort(),
    )
    .toEqual(["dedupe.lead", "route.false", "route.true"]);
  const afterThird = await leadIntake(page);
  expect(input(afterThird, "routed-leads", "items")?.type).toEqual(declaredItems.type);
  expect(input(afterThird, "routed-leads", "items")?.cardinality).toEqual({ min: 1, max: 3 });

  // A fourth compatible source is rejected with a visible limit explanation.
  const fourth = await expectRejected(page, "Start Website form Lead", "Routed leads Items");
  await expect(fourth).toContainText("at most 3");
  await fourth.press("Enter");
  await closeMenu(page);

  // A second source on the ordinary single Nurture input is explained by cardinality.
  const nurture = await expectRejected(page, "Start Deduplicate Lead", "Nurture sequence Lead");
  await expect(nurture).toContainText(/only one|at most 1\b/i);
  await nurture.press("Enter");
  await closeMenu(page);

  const settled = await leadIntake(page);
  expect(edgesInto(settled, "routed-leads", "items")).toHaveLength(3);
  expect(edgesInto(settled, "nurture", "lead")).toHaveLength(1);
  expect(input(settled, "nurture", "lead")?.type).toEqual(declaredNurture.type);
  expect(input(settled, "routed-leads", "items")?.type).toEqual(declaredItems.type);

  await page.screenshot({
    path: testInfo.outputPath("port-cardinality-workbench.png"),
    fullPage: true,
  });

  // Edges and the declared contract persist across reload and are still enforced.
  await page.reload();
  await openLeadIntake(page);
  const reloaded = await leadIntake(page);
  expect(
    edgesInto(reloaded, "routed-leads", "items")
      .map((edge) => `${edge.sourceNodeId}.${edge.sourcePortId}`)
      .sort(),
  ).toEqual(["dedupe.lead", "route.false", "route.true"]);
  expect(input(reloaded, "routed-leads", "items")?.cardinality).toEqual({ min: 1, max: 3 });
  expect(input(reloaded, "routed-leads", "items")?.type).toEqual(declaredItems.type);
  expect(input(reloaded, "nurture", "lead")?.type).toEqual(declaredNurture.type);
  const stillFull = await expectRejected(page, "Start Website form Lead", "Routed leads Items");
  await expect(stillFull).toContainText("at most 3");
  await closeMenu(page);
});
