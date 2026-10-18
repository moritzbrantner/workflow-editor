import { expect, test, type Page } from "@playwright/test";

// Pages acceptance for typed workflow inputs and named input profiles (#115): the data pipeline
// declares a required export date and a defaulted currency; two profiles survive a reload and
// never change the compiled workflow.

const workbench = "http://127.0.0.1:4175/";
const storageKey = "moritzbrantner.workflow-editor.examples.v1";

async function storedEntry(page: Page) {
  return page.evaluate((key) => {
    const library = JSON.parse(window.localStorage.getItem(key) ?? "null");
    return library?.documents.find((entry: { id: string }) => entry.id === "data-pipeline") as
      | { document: unknown; inputProfiles?: Array<{ name: string; values: unknown }> }
      | undefined;
  }, storageKey);
}

async function openInputs(page: Page) {
  const inputs = page.getByRole("region", { name: "Inputs" });
  if (!(await inputs.isVisible())) {
    await page.getByRole("button", { name: "Expand info panel" }).click();
  }
  await expect(inputs).toBeVisible();
  return inputs;
}

async function compiledSummary(page: Page) {
  await page.getByRole("button", { name: "Compile workflow", exact: true }).click();
  const region = page.getByRole("region", { name: "Compiled contract" });
  await expect(region).toContainText("not executed");
  const text = await region.innerText();
  await page.getByRole("button", { name: "Close compiled contract" }).click();
  return text;
}

test("saves, switches and reloads named input profiles on the data pipeline", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Desktop Pages acceptance");
  await page.goto(workbench);
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Sales Data Pipeline", exact: true }),
  ).toBeVisible();
  const compiledBefore = await compiledSummary(page);
  const documentBefore = JSON.stringify((await storedEntry(page))?.document ?? null);

  const inputs = await openInputs(page);
  const exportDate = inputs.getByLabel("Input Export date");
  const currency = inputs.getByLabel("Input Currency");
  await expect(currency).toHaveAttribute("placeholder", "Default: EUR");

  // Diagnostics: the required date is missing and the currency is not a declared literal.
  await currency.fill("GBP");
  await expect(inputs.getByRole("alert")).toHaveCount(2);
  await currency.fill("");

  await exportDate.fill("2026-10-18");
  await inputs.getByLabel("Profile name").fill("Daily");
  await inputs.getByRole("button", { name: "Save profile" }).click();

  await inputs.getByLabel("Input profile").selectOption({ label: "New profile" });
  await exportDate.fill("2026-01-01");
  await currency.fill("USD");
  await inputs.getByLabel("Profile name").fill("Backfill");
  await inputs.getByRole("button", { name: "Save profile" }).click();

  await inputs.getByLabel("Input profile").selectOption({ label: "Daily" });
  await expect(exportDate).toHaveValue("2026-10-18");
  await expect(currency).toHaveValue("");

  await expect
    .poll(async () => (await storedEntry(page))?.inputProfiles?.map((profile) => profile.name))
    .toEqual(["Daily", "Backfill"]);
  await page.reload();

  const reloaded = await openInputs(page);
  await reloaded.getByLabel("Input profile").selectOption({ label: "Backfill" });
  await expect(reloaded.getByLabel("Input Export date")).toHaveValue("2026-01-01");
  await expect(reloaded.getByLabel("Input Currency")).toHaveValue("USD");
  // Static Pages has no run host, so it never claims a run happened.
  await expect(reloaded).toContainText("runs are unavailable");

  // Profiles live beside the document: neither the document nor the compiled contract changed.
  expect(JSON.stringify((await storedEntry(page))?.document ?? null)).toBe(documentBefore);
  expect(await compiledSummary(page)).toBe(compiledBefore);
});
