// Acceptance for issue #14 / Decision Atlas 6.1 in the Pages workbench: importing a workflow file
// uses the `import` validation policy. Dangling, self and unknown-port edges open as visible
// warnings and are never silently dropped; repair is an explicit, undoable user action; cycles are
// still rejected fail-closed. Runs on desktop and mobile projects.
import { expect, test, type Page } from "@playwright/test";

const storageKey = "moritzbrantner.workflow-editor.examples.v1";
const documentFormat = "@moritzbrantner/workflow-editor/document";
const problemEdgeIds = ["edge-dangling", "edge-self", "edge-unknown-port"] as const;

type StoredPort = { id: string; type?: unknown };
type StoredNode = { id: string; outputs?: StoredPort[]; inputs?: StoredPort[] };
type StoredEdge = {
  id: string;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
};
type StoredDocument = { nodes: StoredNode[]; edges: StoredEdge[] };
type StoredEntry = { id: string; name?: string; document: StoredDocument };
type StoredLibrary = { documents: StoredEntry[] };

async function library(page: Page): Promise<StoredLibrary | null> {
  return page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? "null"), storageKey);
}

async function storedEntry(page: Page, name: string) {
  return (await library(page))?.documents.find((entry) => entry.name === name);
}

async function openSeededWorkbench(page: Page) {
  await page.addInitScript(() => {
    if (!window.sessionStorage.getItem("validation-policy-initialized")) {
      window.localStorage.clear();
      window.sessionStorage.setItem("validation-policy-initialized", "1");
    }
  });
  await page.goto("http://127.0.0.1:4175/");

  await expect(page.locator('[data-slot="workflow-builder-node"]').first()).toBeVisible();
  await expect.poll(async () => (await library(page))?.documents.length ?? 0).toBeGreaterThan(0);
  return (await library(page))!;
}

async function importWorkflowFile(page: Page, documentName: string, document: StoredDocument) {
  // Open the document menu from the active document title.
  await page.getByRole("button", { name: "Lead Intake Automation", exact: true }).click();
  await page.getByLabel("Import workflow JSON", { exact: true }).setInputFiles({
    name: `${documentName}.json`,
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        format: documentFormat,
        version: 1,
        exportedAt: new Date().toISOString(),
        documentName,
        document,
      }),
    ),
  });
}

function hasPorts(node: StoredNode, side: "inputs" | "outputs") {
  return (node[side]?.length ?? 0) > 0;
}

/** Builds a valid stored document plus one dangling, one self and one unknown-port edge. */
function documentWithProblemEdges(stored: StoredLibrary) {
  for (const entry of stored.documents) {
    const { nodes, edges } = entry.document;
    const selfNode = nodes.find((node) => hasPorts(node, "inputs") && hasPorts(node, "outputs"));
    const sourceNode = nodes.find((node) => hasPorts(node, "outputs"));
    // A sink cannot reach anything, so an edge into it can never close a cycle.
    const sinkNode = nodes.find(
      (node) =>
        node.id !== sourceNode?.id &&
        hasPorts(node, "inputs") &&
        !edges.some((edge) => edge.sourceNodeId === node.id),
    );
    if (!selfNode || !sourceNode || !sinkNode) {
      continue;
    }

    const document = structuredClone(entry.document);
    document.edges.push(
      {
        id: "edge-dangling",
        sourceNodeId: sourceNode.id,
        sourcePortId: sourceNode.outputs![0]!.id,
        targetNodeId: "node-does-not-exist",
        targetPortId: "in",
      },
      {
        id: "edge-self",
        sourceNodeId: selfNode.id,
        sourcePortId: selfNode.outputs![0]!.id,
        targetNodeId: selfNode.id,
        targetPortId: selfNode.inputs![0]!.id,
      },
      {
        id: "edge-unknown-port",
        sourceNodeId: sourceNode.id,
        sourcePortId: sourceNode.outputs![0]!.id,
        targetNodeId: sinkNode.id,
        targetPortId: "port-does-not-exist",
      },
    );
    return { original: entry.document, document };
  }
  throw new Error("No seeded workflow document can host the problem-edge fixture.");
}

/** Builds a stored document with one extra edge that closes a cycle over an existing edge. */
function documentWithCycle(stored: StoredLibrary) {
  for (const entry of stored.documents) {
    const { nodes, edges } = entry.document;
    const byId = new Map(nodes.map((node) => [node.id, node]));
    const closable = edges.find((edge) => {
      const source = byId.get(edge.sourceNodeId);
      const target = byId.get(edge.targetNodeId);
      return (
        source &&
        target &&
        source.id !== target.id &&
        hasPorts(source, "inputs") &&
        hasPorts(target, "outputs")
      );
    });
    if (!closable) {
      continue;
    }
    const source = byId.get(closable.sourceNodeId)!;
    const target = byId.get(closable.targetNodeId)!;
    const document = structuredClone(entry.document);
    document.edges.push({
      id: "edge-cycle",
      sourceNodeId: target.id,
      sourcePortId: target.outputs![0]!.id,
      targetNodeId: source.id,
      targetPortId: source.inputs![0]!.id,
    });
    return document;
  }
  throw new Error("No seeded workflow document can host the cycle fixture.");
}

function storedEdgeIds(entry: StoredEntry | undefined) {
  return entry?.document.edges.map((edge) => edge.id) ?? [];
}

test("imports a document with dangling, self and unknown-port edges as visible warnings", async ({
  page,
}) => {
  const before = await openSeededWorkbench(page);
  const { original, document } = documentWithProblemEdges(before);
  const documentName = "Imported with problems";

  await importWorkflowFile(page, documentName, document);

  // The import succeeds and opens on the canvas.
  await expect.poll(async () => (await storedEntry(page, documentName)) !== undefined).toBe(true);
  await expect(page.getByRole("button", { name: documentName, exact: true })).toBeVisible();
  await expect(page.locator('[data-slot="workflow-builder-node"]').first()).toBeVisible();

  const problems = page.getByRole("region", { name: "Document problems" });
  await expect(problems).toBeVisible();
  await expect(problems.getByRole("listitem")).toHaveCount(problemEdgeIds.length);
  await Promise.all(
    problemEdgeIds.map((edgeId) =>
      expect(problems.getByRole("listitem").filter({ hasText: edgeId })).toHaveCount(1),
    ),
  );

  // Nothing is silently dropped from the stored library entry.
  const imported = await storedEntry(page, documentName);
  expect(storedEdgeIds(imported)).toEqual(expect.arrayContaining([...problemEdgeIds]));
  expect(storedEdgeIds(imported)).toEqual(
    expect.arrayContaining(original.edges.map((edge) => edge.id)),
  );
});

test("repairs the imported problems explicitly and undoes the repair", async ({ page }) => {
  const before = await openSeededWorkbench(page);
  const { original, document } = documentWithProblemEdges(before);
  const documentName = "Imported for repair";

  await importWorkflowFile(page, documentName, document);
  const problems = page.getByRole("region", { name: "Document problems" });
  await expect(problems).toBeVisible();

  await page.getByRole("button", { name: "Repair document", exact: true }).click();

  await expect(problems).toHaveCount(0);
  await expect
    .poll(async () => storedEdgeIds(await storedEntry(page, documentName)).sort())
    .toEqual(original.edges.map((edge) => edge.id).sort());
  const repaired = (await storedEntry(page, documentName))!;
  expect(repaired.document.nodes.map((node) => node.id).sort()).toEqual(
    original.nodes.map((node) => node.id).sort(),
  );
  for (const edgeId of problemEdgeIds) {
    expect(storedEdgeIds(repaired)).not.toContain(edgeId);
  }

  await page
    .getByRole("button", { name: "Undo", exact: true })
    .filter({ visible: true })
    .first()
    .click();

  await expect(problems).toBeVisible();
  await Promise.all(problemEdgeIds.map((edgeId) => expect(problems).toContainText(edgeId)));
});

test("still rejects an imported cycle fail-closed", async ({ page }) => {
  const before = await openSeededWorkbench(page);
  const document = documentWithCycle(before);
  const documentName = "Imported cycle";
  const nodes = page.locator('[data-slot="workflow-builder-node"]');
  const nodeCountBefore = await nodes.count();

  await importWorkflowFile(page, documentName, document);

  await expect(page.getByRole("alert").filter({ hasText: /cycle/i })).toBeVisible();
  const after = (await library(page))!;
  expect(after.documents.map((entry) => entry.id)).toEqual(
    before.documents.map((entry) => entry.id),
  );
  expect(JSON.stringify(after)).not.toContain(documentName);
  expect(JSON.stringify(after)).not.toContain("edge-cycle");
  await expect(nodes).toHaveCount(nodeCountBefore);
  await expect(page.getByRole("region", { name: "Document problems" })).toHaveCount(0);
});
