// Issue #16 / Decision Atlas 5.18: the Pages palette comes from the Node Template registry and
// lists an invalid host template disabled with its diagnostic instead of hiding it.
import { expect, test } from "@playwright/test";

test("lists an invalid template disabled with its diagnostic and never adds it", async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (!window.sessionStorage.getItem("template-registry-initialized")) {
      window.localStorage.clear();
      window.sessionStorage.setItem("template-registry-initialized", "1");
    }
  });
  await page.goto("http://127.0.0.1:4175/");
  const nodes = page.locator('[data-slot="workflow-builder-node"]');
  await expect(nodes.first()).toBeVisible();

  const nodesDock = page.getByRole("button", { name: "Nodes", exact: true });
  if (await nodesDock.isVisible()) {
    await nodesDock.click();
  }
  const search = page
    .getByRole("textbox", { name: "Search node palette" })
    .filter({ visible: true })
    .first();
  await search.fill("Legacy contact");
  const invalid = page.getByRole("group", { name: "Legacy contact sync (unavailable)" }).first();
  await expect(invalid).toBeVisible();
  await expect(invalid).toHaveAttribute("aria-disabled", "true");
  await expect(invalid).toContainText("LegacyContact");

  const nodeCount = await nodes.count();
  await invalid.dispatchEvent("click");
  await expect(nodes).toHaveCount(nodeCount);
  await expect(
    page.locator('[data-slot="workflow-builder-node"]').filter({ hasText: "Legacy contact sync" }),
  ).toHaveCount(0);

  // Valid templates in the same palette still add nodes.
  if (!(await search.isVisible())) {
    await nodesDock.click();
  }
  await search.fill("Approval");
  const approval = page
    .locator('[data-slot="workflow-palette-overlay"], [data-slot="workflow-palette"]')
    .getByText("Approval", { exact: true })
    .filter({ visible: true })
    .first();
  await approval.click();
  await expect(nodes).toHaveCount(nodeCount + 1);
});
