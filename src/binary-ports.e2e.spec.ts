// Independent acceptance for issue #61 (TECH-003) in the real Pages workbench (examples/workbench).
// Authored before implementation from the issue's "Selection and slice contract" comment.
//
// P1 The library contains a "Binary Audio Ports" example. Its canvas ports show delivery mode and
//    media type in the graph-editor port badge ("buffered · audio/wav", "streamed · audio/wav").
//    It fans one buffered and one streamed WAV output out to two consumers each, without a Tee.
// P2 The port connection menu keeps a streamed → buffered-only target visible but disabled, with
//    an explanation naming both delivery modes; choosing it leaves the document unchanged.
// P3 The node inspector edits each port's delivery mode (select "<Input|Output> <port> delivery
//    mode") and media type (text "<Input|Output> <port> media type"); an optional apply button is
//    "Apply <port> payload". The change is saved into the library document's port `payload` and
//    connection validation follows it.
// Runs on the chromium and mobile-chrome projects (same keyboard port-menu mechanism as
// src/native-typescript.e2e.spec.ts).
import { expect, test, type Page } from "@playwright/test";

const workbench = "http://127.0.0.1:4175/";
const storageKey = "moritzbrantner.workflow-editor.examples.v1";
const documentFormat = "@moritzbrantner/workflow-editor/document";

type Payload = { mode: string; mediaType?: string };
type StoredPort = { id: string; label?: string; payload?: Payload };
type StoredNode = {
  id: string;
  label: string;
  kind?: string;
  inputs?: StoredPort[];
  outputs?: StoredPort[];
};
type StoredEdge = { id: string; sourceNodeId: string; sourcePortId: string };
type StoredDocument = { nodes: StoredNode[]; edges: StoredEdge[] };
type StoredEntry = { id: string; name: string; document: StoredDocument };

async function libraryEntry(page: Page, name: RegExp): Promise<StoredEntry | undefined> {
  const library = await page.evaluate(
    (key) => JSON.parse(window.localStorage.getItem(key) ?? "null"),
    storageKey,
  );
  return (library?.documents as StoredEntry[] | undefined)?.find((entry) => name.test(entry.name));
}

async function waitForLibrary(page: Page) {
  await expect(page.locator('[data-slot="workflow-builder-node"]').first()).toBeVisible();
  await expect
    .poll(async () => Boolean(await libraryEntry(page, /^Lead Intake Automation$/)))
    .toBe(true);
}

const sameDocument = (name: string) =>
  new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`);

const vt = (source: string) => ({ kind: "typescript", source });
const importedName = "Binary port rejection";
const importedFile = {
  format: documentFormat,
  version: 1,
  exportedAt: "2026-10-17T00:00:00.000Z",
  documentName: importedName,
  document: {
    viewport: { x: 40, y: 40, zoom: 0.6 },
    nodes: [
      {
        id: "chunk-source",
        label: "Chunk source",
        kind: "audio.source",
        x: 0,
        y: 0,
        outputs: [
          {
            id: "chunks",
            label: "Chunks",
            type: vt("Uint8Array"),
            payload: { mode: "streamed", mediaType: "audio/wav" },
          },
        ],
      },
      {
        id: "stream-sink",
        label: "Stream sink",
        kind: "audio.preview",
        x: 360,
        y: 0,
        inputs: [
          {
            id: "chunks",
            label: "Stream",
            type: vt("Uint8Array"),
            payload: { mode: "streamed", mediaType: "audio/wav" },
          },
        ],
      },
      {
        id: "buffer-sink",
        label: "Buffer sink",
        kind: "audio.archive",
        x: 360,
        y: 180,
        inputs: [
          {
            id: "wav",
            label: "Samples",
            type: vt("Uint8Array"),
            payload: { mode: "buffered", mediaType: "audio/wav" },
          },
        ],
      },
      {
        id: "plain-sink",
        label: "Plain sink",
        kind: "audio.inspect",
        x: 360,
        y: 360,
        inputs: [{ id: "bytes", label: "Bytes", type: vt("Uint8Array") }],
      },
    ],
    edges: [
      {
        id: "stream",
        sourceNodeId: "chunk-source",
        sourcePortId: "chunks",
        targetNodeId: "stream-sink",
        targetPortId: "chunks",
      },
    ],
  },
};

async function importRejectionDocument(page: Page) {
  await page.goto(workbench);
  await waitForLibrary(page);
  await page.getByRole("button", { name: "Lead Intake Automation", exact: true }).click();
  await page.getByLabel("Import workflow JSON", { exact: true }).setInputFiles({
    name: "binary-ports.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(importedFile)),
  });
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: importedName, exact: true })).toBeVisible();
  await expect
    .poll(async () => (await libraryEntry(page, sameDocument(importedName)))?.document.edges.length)
    .toBe(1);
}

async function openOutputMenu(page: Page, name: string) {
  const port = page.getByRole("button", { name, exact: true });
  await port.focus();
  await port.press("Shift+F10");
  await expect(page.getByRole("menu", { name: /Possible inputs/ })).toBeVisible();
}

async function importedEdges(page: Page) {
  return (await libraryEntry(page, sameDocument(importedName)))?.document.edges.length;
}

async function importedPort(page: Page, nodeId: string, portId: string) {
  const entry = await libraryEntry(page, sameDocument(importedName));
  return entry?.document.nodes
    .find((node) => node.id === nodeId)
    ?.inputs?.find((port) => port.id === portId);
}

async function chooseDeliveryMode(page: Page, label: string, mode: "buffered" | "streamed") {
  const control = page.getByLabel(label, { exact: true });
  await expect(control).toBeVisible();
  if ((await control.evaluate((element) => element.tagName)) === "SELECT") {
    await expect(control.locator("option")).toHaveText(["buffered", "streamed"], {
      ignoreCase: true,
    });
    await control.selectOption(mode);
    return;
  }
  // Custom (listbox) select.
  await control.click();
  await expect(page.getByRole("option", { name: "buffered", exact: true })).toBeVisible();
  await page.getByRole("option", { name: mode, exact: true }).click();
}

async function readDeliveryMode(page: Page, label: string) {
  const control = page.getByLabel(label, { exact: true });
  return control.evaluate((element) =>
    element instanceof HTMLSelectElement ? element.value : (element.textContent ?? "").trim(),
  );
}

test("shows the Binary Audio Ports example with buffered and streamed WAV fan-out", async ({
  page,
}) => {
  await page.goto(workbench);
  await waitForLibrary(page);

  const entry = await libraryEntry(page, /^binary audio ports$/i);
  expect(entry, 'library example "Binary Audio Ports"').toBeDefined();

  await page.getByRole("button", { name: "Lead Intake Automation", exact: true }).click();
  await page.getByLabel("Workflow document", { exact: true }).selectOption(entry!.id);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: entry!.name, exact: true })).toBeVisible();

  // Mode and media are visible on the canvas ports themselves.
  const nodes = page.locator('[data-slot="workflow-builder-node"]');
  await expect(nodes.getByText("buffered · audio/wav").first()).toBeVisible();
  await expect(nodes.getByText("streamed · audio/wav").first()).toBeVisible();

  // One buffered and one streamed output each feed two consumers directly.
  const document = entry!.document;
  const fanOut = (mode: string) =>
    document.nodes.flatMap((node) =>
      (node.outputs ?? [])
        .filter((port) => port.payload?.mode === mode && port.payload.mediaType === "audio/wav")
        .map(
          (port) =>
            document.edges.filter(
              (edge) => edge.sourceNodeId === node.id && edge.sourcePortId === port.id,
            ).length,
        ),
    );
  expect(fanOut("buffered")).toContain(2);
  expect(fanOut("streamed")).toContain(2);
  expect(document.nodes.filter((node) => /\btee\b/i.test(`${node.kind} ${node.label}`))).toEqual(
    [],
  );
});

test("explains and rejects a streamed output feeding a buffered-only input", async ({ page }) => {
  await importRejectionDocument(page);

  await openOutputMenu(page, "Start Chunk source Chunks");
  const buffered = page.getByRole("menuitem", { name: "Buffer sink Samples", exact: true });
  await expect(buffered).toHaveAttribute("aria-disabled", "true");
  await expect(buffered).toContainText(/streamed/i);
  await expect(buffered).toContainText(/buffered/i);
  const ordinary = page.getByRole("menuitem", { name: "Plain sink Bytes", exact: true });
  await expect(ordinary).toHaveAttribute("aria-disabled", "true");
  await expect(ordinary).toContainText(/streamed/i);

  await buffered.focus();
  await buffered.press("Enter");
  await page.keyboard.press("Escape");
  await expect.poll(() => importedEdges(page)).toBe(1);
});

test("edits a port's delivery mode and media type in the inspector", async ({ page }, testInfo) => {
  await importRejectionDocument(page);
  const mobile = testInfo.project.name === "mobile-chrome";
  if (!mobile) {
    // Same desktop precedent as native-typescript.e2e: the palette overlay covers the canvas.
    await page.getByRole("button", { name: "Minimize node palette", exact: true }).click();
  }

  await page.getByRole("button", { name: "Plain sink", exact: true }).click();
  if (mobile) {
    await page
      .locator("[data-mobile-workbench-dock]")
      .getByRole("button", { name: "Info", exact: true })
      .click();
  }

  // A port without payload is presented as buffered.
  const modeLabel = "Input Bytes delivery mode";
  await expect(page.getByLabel(modeLabel, { exact: true })).toBeVisible();
  expect((await readDeliveryMode(page, modeLabel)).toLowerCase()).toContain("buffered");
  await chooseDeliveryMode(page, modeLabel, "streamed");
  await page.getByLabel("Input Bytes media type", { exact: true }).fill("audio/wav");
  const apply = page.getByRole("button", { name: "Apply Bytes payload", exact: true });
  if ((await apply.count()) > 0) {
    await apply.click();
  } else {
    await page.getByLabel("Input Bytes media type", { exact: true }).press("Enter");
  }

  await expect
    .poll(async () => (await importedPort(page, "plain-sink", "bytes"))?.payload)
    .toEqual({ mode: "streamed", mediaType: "audio/wav" });

  // Validation follows the edited contract: the streamed source may now fan out to it.
  if (mobile) {
    await page
      .locator("[data-mobile-workbench-dock]")
      .getByRole("button", { name: "Info", exact: true })
      .click();
  }
  await openOutputMenu(page, "Start Chunk source Chunks");
  const ordinary = page.getByRole("menuitem", { name: "Plain sink Bytes", exact: true });
  await expect(ordinary).toHaveAttribute("aria-disabled", "false");
  await ordinary.focus();
  await ordinary.press("Enter");
  await expect.poll(() => importedEdges(page)).toBe(2);
});
