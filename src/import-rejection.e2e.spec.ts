// Acceptance for issue #66: importing a workflow file with an unsupported legacy port-type record
// in the Pages workbench names the problem in an accessible alert, while the import still fails
// closed (library and graph stay unchanged). Runs on desktop and mobile projects.
import { expect, test, type Page } from "@playwright/test";

const storageKey = "moritzbrantner.workflow-editor.examples.v1";
const documentFormat = "@moritzbrantner/workflow-editor/document";

type StoredPort = { id: string; type?: unknown };
type StoredNode = { id: string; outputs?: StoredPort[]; inputs?: StoredPort[] };
type StoredEntry = { id: string; name?: string; document: { nodes: StoredNode[] } };
type StoredLibrary = { documents: StoredEntry[] };

async function library(page: Page): Promise<StoredLibrary | null> {
  return page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? "null"), storageKey);
}

test("names the unsupported port type when a workflow import is rejected", async ({ page }) => {
  await page.addInitScript(() => {
    if (!window.sessionStorage.getItem("import-rejection-initialized")) {
      window.localStorage.clear();
      window.sessionStorage.setItem("import-rejection-initialized", "1");
    }
  });
  await page.goto("http://127.0.0.1:4175/");

  const nodes = page.locator('[data-slot="workflow-builder-node"]');
  await expect(nodes.first()).toBeVisible();
  await expect.poll(async () => (await library(page))?.documents.length ?? 0).toBeGreaterThan(0);

  const before = (await library(page))!;
  const source = before.documents.find((entry) =>
    entry.document.nodes.some((node) => (node.outputs?.length ?? 0) > 0),
  )!;
  const document = structuredClone(source.document);
  const node = document.nodes.find((candidate) => (candidate.outputs?.length ?? 0) > 0)!;
  const port = node.outputs![0];
  port.type = { kind: "legacy-opaque" };
  const nodeCountBefore = await nodes.count();

  // Open the document menu from the active document title.
  await page.getByRole("button", { name: "Sales Data Pipeline", exact: true }).click();

  await page.getByLabel("Import workflow JSON", { exact: true }).setInputFiles({
    name: "unsupported-legacy.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        format: documentFormat,
        version: 1,
        exportedAt: new Date().toISOString(),
        documentName: "Unsupported legacy import",
        document,
      }),
    ),
  });

  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const message = new RegExp(
    `Unsupported workflow port type at ${escape(node.id)}\\.${escape(port.id)}`,
  );
  await expect(page.getByRole("alert").filter({ hasText: message })).toBeVisible();

  // Fail-closed behaviour is unchanged.
  const after = (await library(page))!;
  expect(after.documents.map((entry) => entry.id)).toEqual(
    before.documents.map((entry) => entry.id),
  );
  expect(JSON.stringify(after)).not.toContain("legacy-opaque");
  expect(JSON.stringify(after)).not.toContain("Unsupported legacy import");
  await expect(nodes).toHaveCount(nodeCountBefore);
});
