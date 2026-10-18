// Retrospective acceptance (independent agent, PR #62) — not pre-implementation authorship.
// Issue #59: on the real Pages workbench, invalid/stale type declarations are explained without
// changing the document, reopening restores visible type intent, and importing a file with an
// unsupported legacy port record is rejected instead of being silently rewritten.
import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const storageKey = "moritzbrantner.workflow-editor.examples.v1";
const original = "type Customer = { id: string; name?: string };";

async function library(page: Page) {
  return page.evaluate((key) => JSON.parse(window.localStorage.getItem(key) ?? "null"), storageKey);
}
async function savedDocument(page: Page) {
  return (await library(page))?.documents.find(
    (entry: { id: string }) => entry.id === "typescript-ports",
  )?.document;
}
async function customerOutputType(page: Page) {
  return (await savedDocument(page))?.nodes.find((node: { id: string }) => node.id === "customer")
    ?.outputs[0].type;
}
async function pressButton(page: Page, name: string) {
  const button = page.getByRole("button", { name, exact: true });
  await button.focus();
  await page.keyboard.press("Enter");
}

test("explains invalid declarations, restores type intent on reopen, and rejects unsupported imports", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Desktop journey; mobile is covered by PR tests");
  await page.goto("http://127.0.0.1:4175/");
  await page.getByRole("button", { name: "Sales Data Pipeline", exact: true }).click();
  await page.getByLabel("Workflow document", { exact: true }).selectOption("typescript-ports");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Minimize node palette", exact: true }).click();
  await expect.poll(async () => (await savedDocument(page))?.typeDeclarations).toBe(original);

  // Stale declarations are explained and not applied.
  await pressButton(page, "Types");
  const declarations = page.getByLabel("TypeScript declarations", { exact: true });
  await declarations.fill("type Broken = Missing;");
  await pressButton(page, "Apply declarations");
  await expect(
    page.getByRole("alert").filter({ hasText: "Cannot find name 'Missing'" }),
  ).toBeVisible();
  expect((await savedDocument(page)).typeDeclarations).toBe(original);
  await pressButton(page, "Close types");

  // A port type naming an undeclared type is explained and not applied.
  await page.getByRole("button", { name: "Customer source", exact: true }).click();
  await pressButton(page, "Types");
  const output = page.getByLabel("Output Value TypeScript type", { exact: true });
  await output.fill("Unknown");
  await output.press("Enter");
  await expect(
    page.getByRole("alert").filter({ hasText: "Cannot find name 'Unknown'" }),
  ).toBeVisible();
  expect(await customerOutputType(page)).toEqual({ kind: "typescript", source: "Customer" });

  // A valid user declaration and port type are applied and survive a reload.
  const declared =
    "type Customer = { id: string; name?: string };\ntype Tagged = Customer & { tag: string };";
  await page.getByLabel("TypeScript declarations", { exact: true }).fill(declared);
  await pressButton(page, "Apply declarations");
  await output.fill("Tagged");
  await output.press("Enter");
  await expect
    .poll(() => customerOutputType(page))
    .toEqual({ kind: "typescript", source: "Tagged" });
  const panel = page.getByRole("complementary", { name: "Workflow types", exact: true });
  await expect(panel).toContainText("Customer source · Value: Tagged");
  await pressButton(page, "Close types");

  await page.reload();
  await expect(page.getByRole("button", { name: "TypeScript ports", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Minimize node palette", exact: true }).click();
  await page.getByRole("button", { name: "Customer source", exact: true }).click();
  await pressButton(page, "Types");
  await expect(page.getByLabel("TypeScript declarations", { exact: true })).toHaveValue(declared);
  await expect(page.getByLabel("Output Value TypeScript type", { exact: true })).toHaveValue(
    "Tagged",
  );
  await expect(
    page.getByRole("complementary", { name: "Workflow types", exact: true }),
  ).toContainText("Customer source · Value: Tagged");
  await pressButton(page, "Close types");

  // Importing a file with an unsupported legacy port record fails closed.
  await page.getByRole("button", { name: "TypeScript ports", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON", exact: true }).click();
  const exported = JSON.parse(await readFile((await (await downloadPromise).path())!, "utf8"));
  exported.document.nodes.find((node: { id: string }) => node.id === "customer").outputs[0].type = {
    kind: "legacy-opaque",
  };
  exported.documentName = "Unsupported legacy import";
  const before = await library(page);
  await page.getByLabel("Import workflow JSON", { exact: true }).setInputFiles({
    name: "unsupported-legacy.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(exported)),
  });
  await expect(page.getByTestId("save-state").first()).toHaveText("Save error");
  const after = await library(page);
  expect(after.documents.map((entry: { id: string }) => entry.id)).toEqual(
    before.documents.map((entry: { id: string }) => entry.id),
  );
  expect(JSON.stringify(after)).not.toContain("legacy-opaque");
  expect(JSON.stringify(after)).not.toContain("Unsupported legacy import");
});
