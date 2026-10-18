import { expect, test } from "@playwright/test";

// Pages acceptance for bounded Workflow References (#95): the inspector shows the referenced
// start/end interface and edits the recursion bound; "Compile workflow" resolves references
// from the library into the compiled v3 contract.

const workbench = "http://127.0.0.1:4175/";
const storageKey = "moritzbrantner.workflow-editor.examples.v1";

test("edits a reference's depth and interface, then compiles it as v3", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Desktop Pages acceptance");
  await page.goto(workbench);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();

  await page.getByRole("button", { name: "Sales Data Pipeline", exact: true }).click();
  await page.getByLabel("Workflow document", { exact: true }).selectOption("lead-intake");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("button", { name: "Lead Intake Automation", exact: true }),
  ).toBeVisible();

  await page
    .locator('[data-slot="workflow-node-select"][aria-label="Enrich lead"]:visible')
    .first()
    .evaluate((element) => (element as HTMLElement).click());
  const workflowInterface = page.getByRole("region", { name: "Workflow interface" });
  await expect(workflowInterface).toContainText("lead: Lead");
  await expect(workflowInterface).toContainText("Ports match the workflow interface.");

  await page.locator('input[aria-label="Maximum recursion depth"]:visible').fill("3");
  await page.getByRole("button", { name: "Apply" }).filter({ visible: true }).first().click();
  await expect
    .poll(() =>
      page.evaluate((key) => {
        const library = JSON.parse(window.localStorage.getItem(key) ?? "null");
        const lead = library?.documents.find((entry: { id: string }) => entry.id === "lead-intake");
        return lead?.document.nodes.find((node: { id: string }) => node.id === "enrich")
          ?.workflowRef;
      }, storageKey),
    )
    .toEqual({ documentId: "enrich-lead", maxDepth: 3 });

  await page.getByRole("button", { name: "Compile workflow", exact: true }).click();
  await expect(page.getByRole("region", { name: "Compiled contract" })).toContainText(
    "Compiled contract v3",
  );
});
