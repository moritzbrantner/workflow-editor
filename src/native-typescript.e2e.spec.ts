import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

const storageKey = "moritzbrantner.workflow-editor.examples.v1";
async function savedDocument(page: Page) {
  return page.evaluate((key) => {
    const library = JSON.parse(window.localStorage.getItem(key) ?? "null");
    return library?.documents.find((entry: { id: string }) => entry.id === "typescript-ports")
      ?.document;
  }, storageKey);
}
async function openMenu(page: Page, name: string) {
  const port = page.getByRole("button", { name, exact: true });
  await port.focus();
  await port.press("Shift+F10");
  await expect(page.getByRole("menu", { name: /Possible inputs/ })).toBeVisible();
  const bounds = await page.getByRole("menu", { name: /Possible inputs/ }).boundingBox();
  const viewport = page.viewportSize()!;
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(viewport.width);
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(viewport.height);
}
async function connect(page: Page, source: string, target: string) {
  await openMenu(page, source);
  const choice = page.getByRole("menuitem", { name: target, exact: true });
  await expect(choice).toHaveAttribute("aria-disabled", "false");
  await choice.focus();
  await choice.press("Enter");
}

/** The merge output is an array of the union of its sources; exact syntax is not prescribed. */
async function expectMergedOut(panel: ReturnType<Page["getByRole"]>, member: string) {
  const line = panel.getByRole("listitem").filter({ hasText: "Possible customer · Out:" });
  await expect(line.first()).toContainText(member);
  await expect(line.first()).toContainText('"anonymous"');
  await expect(line.first()).toContainText(/\[\]|Array</);
}

// Exercise this through both the desktop and phone projects, using the actual Pages entry.
test("authors native types, explains rejection, propagates branches, and reopens exported workflows", async ({
  page,
}, testInfo) => {
  await page.goto("http://127.0.0.1:4175/");
  await page.getByRole("button", { name: "Lead Intake Automation", exact: true }).click();
  await page.getByLabel("Workflow document", { exact: true }).selectOption("typescript-ports");
  await page.keyboard.press("Escape");
  const mobile = testInfo.project.name === "mobile-chrome";
  if (mobile) {
    await page
      .locator("[data-mobile-workbench-dock]")
      .getByRole("button", { name: "Actions", exact: true })
      .click();
  } else {
    await page.getByRole("button", { name: "Minimize node palette", exact: true }).click();
  }
  await page.getByRole("button", { name: "Types", exact: true }).click();
  const declarations =
    "interface Customer { id: string; nickname?: string };\ntype Box<T> = { value: T };";
  await page.getByLabel("TypeScript declarations", { exact: true }).fill(declarations);
  await page.getByRole("button", { name: "Apply declarations", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "Close types", exact: true }).click();
  if (mobile) {
    await page
      .locator("[data-mobile-workbench-dock]")
      .getByRole("button", { name: "Actions", exact: true })
      .click();
  }
  await page.getByRole("button", { name: "Customer source", exact: true }).click();
  if (mobile) {
    await page
      .locator("[data-mobile-workbench-dock]")
      .getByRole("button", { name: "Actions", exact: true })
      .click();
  }
  await page.getByRole("button", { name: "Types", exact: true }).click();
  await page.getByLabel("Output Value TypeScript type", { exact: true }).fill("Customer");
  await page.getByLabel("Output Value TypeScript type", { exact: true }).press("Enter");
  await page.getByRole("button", { name: "Close types", exact: true }).click();
  if (mobile) {
    await page
      .locator("[data-mobile-workbench-dock]")
      .getByRole("button", { name: "Actions", exact: true })
      .click();
  }

  await openMenu(page, "Start Customer source Value");
  const incompatible = page.getByRole("menuitem", { name: "Number receiver Value", exact: true });
  await expect(incompatible).toHaveAttribute("aria-disabled", "true");
  await expect(incompatible).toContainText("Type 'Customer' is not assignable to type 'number'");
  await page.keyboard.press("ArrowDown");
  await expect(incompatible).toBeFocused();
  await incompatible.press("Enter");
  await expect.poll(async () => (await savedDocument(page))?.edges.length).toBe(0);
  const compatible = page.getByRole("menuitem", { name: "Customer receiver Value", exact: true });
  await page.keyboard.press("ArrowUp");
  await expect(compatible).toBeFocused();
  await compatible.press("Enter");
  await connect(page, "Start Customer source Value", "Customer branch Value");
  // control.merge has one multi-source `items` input (#15, Decision 1.9/1.10).
  await connect(page, "Start Customer branch True", "Possible customer Items");
  await connect(page, "Start Fallback Value", "Possible customer Items");
  await expect.poll(async () => (await savedDocument(page))?.edges.length).toBe(4);
  if (mobile) {
    await page
      .locator("[data-mobile-workbench-dock]")
      .getByRole("button", { name: "Actions", exact: true })
      .click();
  }
  await page.getByRole("button", { name: "Types", exact: true }).click();
  const panel = page.getByRole("complementary", { name: "Workflow types", exact: true });
  await expectMergedOut(panel, "Customer");
  await page.getByLabel("Output Value TypeScript type", { exact: true }).fill("number");
  await page.getByLabel("Output Value TypeScript type", { exact: true }).press("Enter");
  await expectMergedOut(panel, "number");
  await expect
    .poll(
      async () =>
        (await savedDocument(page))?.nodes.find((node: { id: string }) => node.id === "branch")
          ?.outputs[0].type.source,
    )
    .toBe("number");
  await page.getByLabel("Output Value TypeScript type", { exact: true }).fill("Customer");
  await page.getByLabel("Output Value TypeScript type", { exact: true }).press("Enter");
  await expectMergedOut(panel, "Customer");

  await expect.poll(async () => (await savedDocument(page))?.typeDeclarations).toBe(declarations);
  await page.screenshot({
    path: testInfo.outputPath("native-typescript-workbench.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "Close types", exact: true }).click();
  await page.getByRole("button", { name: "TypeScript ports", exact: true }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export JSON", exact: true }).click();
  const download = await downloadPromise;
  const exported = JSON.parse(await readFile((await download.path())!, "utf8"));
  expect(exported.document.typeDeclarations).toBe(declarations);
  expect(
    exported.document.nodes.find((node: { id: string }) => node.id === "customer").outputs[0].type,
  ).toEqual({ kind: "typescript", source: "Customer" });
  await page.getByLabel("Import workflow JSON", { exact: true }).setInputFiles({
    name: "typed-workflow.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(exported)),
  });
  await page.keyboard.press("Escape");
  await page.reload();
  await expect(page.getByRole("button", { name: "TypeScript ports", exact: true })).toBeVisible();
  await expect.poll(async () => (await savedDocument(page))?.edges.length).toBe(4);
  expect((await savedDocument(page)).typeDeclarations).toBe(declarations);
});
