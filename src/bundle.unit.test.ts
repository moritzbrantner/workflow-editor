import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyWorkflowEditorBundleImportPlan,
  buildWorkflowEditorBundle,
  isWorkflowEditorBundleText,
  parseWorkflowEditorBundle,
  planWorkflowEditorBundleImport,
  stringifyWorkflowEditorBundle,
  type WorkflowEditorBundle,
} from "./bundle";
import type { WorkflowEditorDocument, WorkflowEditorWorkflowReference } from "./core";
import {
  createWorkflowEditorEntry,
  createWorkflowEditorLibrary,
  type WorkflowEditorLibrary,
} from "./persistence";

const exportedAt = "2026-10-18T00:00:00.000Z";

function refNode(id: string, workflowRef: WorkflowEditorWorkflowReference) {
  return { id, label: id, x: 0, y: 0, workflowRef };
}

function doc(...nodes: WorkflowEditorDocument["nodes"]): WorkflowEditorDocument {
  return { nodes, edges: [] };
}

function entry(id: string, document: WorkflowEditorDocument, version = 1) {
  return createWorkflowEditorEntry({
    id,
    name: id.toUpperCase(),
    version,
    createdAt: exportedAt,
    document,
  });
}

/** A → B, A → C, B → D, C → D: D is shared and must be bundled once. */
function diamondLibrary(): WorkflowEditorLibrary {
  return createWorkflowEditorLibrary({
    documents: [
      entry("a", doc(refNode("to-b", { documentId: "b" }), refNode("to-c", { documentId: "c" }))),
      entry("b", doc(refNode("to-d", { documentId: "d" }))),
      entry("c", doc(refNode("to-d", { documentId: "d" }))),
      entry("d", doc({ id: "leaf", label: "Leaf", x: 0, y: 0 }), 3),
      entry("unrelated", doc()),
    ],
  });
}

function build(library: WorkflowEditorLibrary, root: string): WorkflowEditorBundle {
  const result = buildWorkflowEditorBundle(library, root, { exportedAt });
  if (!result.ok) {
    throw new Error(result.diagnostics.map((diagnostic) => diagnostic.message).join("\n"));
  }
  return result.value;
}

function parse(text: string): WorkflowEditorBundle {
  const result = parseWorkflowEditorBundle(text);
  if (!result.ok) {
    throw new Error(result.diagnostics.map((diagnostic) => diagnostic.message).join("\n"));
  }
  return result.value;
}

const emptyLibrary = () => createWorkflowEditorLibrary({ documents: [entry("scratch", doc())] });

describe("workflow bundle export", () => {
  it("bundles the complete referenced closure once, in deterministic order", () => {
    const bundle = build(diamondLibrary(), "a");

    expect(bundle.rootDocumentId).toBe("a");
    expect(bundle.documents.map((document) => document.id)).toEqual(["a", "b", "d", "c"]);
    expect(bundle.references).toEqual([
      { sourceDocumentId: "a", nodePath: ["to-b"], targetDocumentId: "b", targetVersion: 1 },
      { sourceDocumentId: "b", nodePath: ["to-d"], targetDocumentId: "d", targetVersion: 3 },
      { sourceDocumentId: "a", nodePath: ["to-c"], targetDocumentId: "c", targetVersion: 1 },
      { sourceDocumentId: "c", nodePath: ["to-d"], targetDocumentId: "d", targetVersion: 3 },
    ]);
    expect(bundle.documents.find((document) => document.id === "d")).toMatchObject({
      name: "D",
      version: 3,
    });
  });

  it("follows references inside composed nodes", () => {
    const library = createWorkflowEditorLibrary({
      documents: [
        entry(
          "outer",
          doc({
            id: "composed",
            label: "Composed",
            x: 0,
            y: 0,
            composition: {
              nodes: [refNode("inner-ref", { documentId: "inner" })],
              edges: [],
              inputBoundaries: [],
              outputBoundaries: [],
            },
          }),
        ),
        entry("inner", doc()),
      ],
    });

    const bundle = build(library, "outer");
    expect(bundle.documents.map((document) => document.id)).toEqual(["outer", "inner"]);
    expect(bundle.references[0]?.nodePath).toEqual(["composed", "inner-ref"]);
  });

  it("reports missing references before export", () => {
    const library = createWorkflowEditorLibrary({
      documents: [entry("a", doc(refNode("to-gone", { documentId: "gone" })))],
    });

    const result = buildWorkflowEditorBundle(library, "a", { exportedAt });
    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: "missing-reference",
        severity: "error",
        documentId: "a",
        nodePath: ["to-gone"],
      }),
    ]);
  });

  it("rejects unbounded recursion with the cycle path", () => {
    const library = createWorkflowEditorLibrary({
      documents: [
        entry("a", doc(refNode("to-b", { documentId: "b" }))),
        entry("b", doc(refNode("to-a", { documentId: "a" }))),
      ],
    });

    const result = buildWorkflowEditorBundle(library, "a", { exportedAt });
    expect(result.ok).toBe(false);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ code: "unbounded-recursive-reference", cycle: ["a", "b", "a"] }),
    ]);
  });

  it("keeps bounded recursion with its closure and bound", () => {
    const library = createWorkflowEditorLibrary({
      documents: [
        entry("a", doc(refNode("to-b", { documentId: "b" }))),
        entry("b", doc(refNode("to-a", { documentId: "a", maxDepth: 3 }))),
        entry("self", doc(refNode("again", { documentId: "self", maxDepth: 2 }))),
      ],
    });

    const bundle = build(library, "a");
    expect(bundle.documents.map((document) => document.id)).toEqual(["a", "b"]);
    expect(bundle.references[1]).toEqual({
      sourceDocumentId: "b",
      nodePath: ["to-a"],
      targetDocumentId: "a",
      targetVersion: 1,
      maxDepth: 3,
    });
    expect(bundle.documents[1]?.document.nodes[0]?.workflowRef).toEqual({
      documentId: "a",
      maxDepth: 3,
    });
    expect(build(library, "self").references[0]?.maxDepth).toBe(2);
  });

  it("reports a missing root", () => {
    const result = buildWorkflowEditorBundle(diamondLibrary(), "nope");
    expect(result).toEqual({
      ok: false,
      diagnostics: [expect.objectContaining({ code: "missing-root" })],
    });
  });
});

describe("workflow bundle parsing", () => {
  it("detects bundle JSON", () => {
    expect(
      isWorkflowEditorBundleText(stringifyWorkflowEditorBundle(build(diamondLibrary(), "a"))),
    ).toBe(true);
    expect(
      isWorkflowEditorBundleText('{"format":"@moritzbrantner/workflow-editor/document"}'),
    ).toBe(false);
    expect(isWorkflowEditorBundleText("not json")).toBe(false);
  });

  it.each([
    ["not json", "invalid-json"],
    ['{"format":"other"}', "invalid-format"],
    [
      '{"format":"@moritzbrantner/workflow-editor/bundle","version":99}',
      "unsupported-future-version",
    ],
    ['{"format":"@moritzbrantner/workflow-editor/bundle","version":0}', "unsupported-version"],
    [
      '{"format":"@moritzbrantner/workflow-editor/bundle","version":1,"rootDocumentId":"a","documents":[]}',
      "missing-root",
    ],
  ])("rejects %s with %s", (text, code) => {
    const result = parseWorkflowEditorBundle(text);
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]).toMatchObject({ code, severity: "error" });
  });

  it("reports invalid documents, duplicates and references missing from the bundle", () => {
    const bundle = build(diamondLibrary(), "a");
    const broken = {
      ...bundle,
      documents: [
        bundle.documents[0],
        bundle.documents[1],
        bundle.documents[1],
        { id: "c", document: { nodes: "nope" } },
      ],
    };
    const result = parseWorkflowEditorBundle(JSON.stringify(broken));
    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((diagnostic) => [diagnostic.code, diagnostic.path])).toEqual([
      ["duplicate-document", "$.documents[2]"],
      ["invalid-document", "$.documents[3].document"],
    ]);

    const missing = { ...bundle, documents: bundle.documents.filter((d) => d.id !== "d") };
    const missingResult = parseWorkflowEditorBundle(JSON.stringify(missing));
    expect(missingResult.ok).toBe(false);
    expect(missingResult.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "missing-reference",
      "missing-reference",
    ]);
  });

  it("never silently drops an invalid recursion bound", () => {
    const bundle = build(
      createWorkflowEditorLibrary({
        documents: [entry("self", doc(refNode("again", { documentId: "self", maxDepth: 2 })))],
      }),
      "self",
    );
    const text = stringifyWorkflowEditorBundle(bundle).replace('"maxDepth": 2', '"maxDepth": 0');
    const result = parseWorkflowEditorBundle(text);
    expect(result.ok).toBe(false);
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).toContain(
      "invalid-reference-bound",
    );
  });

  it("warns about recorded version mismatches and unrecorded references", () => {
    const bundle = build(diamondLibrary(), "a");
    const tampered = {
      ...bundle,
      references: [{ ...bundle.references[1], targetVersion: 2 }, ...bundle.references.slice(2)],
    };
    const result = parseWorkflowEditorBundle(JSON.stringify(tampered));
    expect(result.ok).toBe(true);
    expect(result.diagnostics.map((diagnostic) => [diagnostic.code, diagnostic.severity])).toEqual([
      ["version-mismatch", "warning"],
      ["reference-mismatch", "warning"],
    ]);
  });

  it("reads the committed v1 fixture", () => {
    const text = readFileSync(resolve(process.cwd(), "fixtures/bundle-v1-diamond.json"), "utf8");
    const bundle = parse(text);
    expect(bundle.documents.map((document) => document.id)).toEqual(["a", "b", "d", "c"]);
    expect(JSON.parse(stringifyWorkflowEditorBundle(bundle))).toEqual(JSON.parse(text));
  });
});

describe("workflow bundle import", () => {
  it("plans without mutating the target library", () => {
    const library = diamondLibrary();
    const snapshot = structuredClone(library);
    const plan = planWorkflowEditorBundleImport(library, build(library, "a"), "duplicate");

    expect(library).toEqual(snapshot);
    expect(plan.items.every((item) => item.collision)).toBe(true);
  });

  it("imports into an empty library and round-trips export → import → export", () => {
    const bundle = parse(stringifyWorkflowEditorBundle(build(diamondLibrary(), "a")));
    const plan = planWorkflowEditorBundleImport(emptyLibrary(), bundle, "abort");
    expect(plan).toMatchObject({ canApply: true, rootDocumentId: "a", rewrites: [] });
    expect(plan.items.map((item) => item.action)).toEqual(["create", "create", "create", "create"]);

    const imported = applyWorkflowEditorBundleImportPlan(emptyLibrary(), bundle, plan, {
      now: exportedAt,
    });
    expect(imported.activeDocumentId).toBe("a");
    expect(imported.documents.map((document) => document.id)).toEqual([
      "scratch",
      "a",
      "b",
      "d",
      "c",
    ]);
    expect(build(imported, "a")).toEqual(bundle);
  });

  it("aborts on collisions without an explicit strategy", () => {
    const library = diamondLibrary();
    const plan = planWorkflowEditorBundleImport(library, build(library, "a"), "abort");
    expect(plan.canApply).toBe(false);
    expect(plan.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
      "document-collision",
      "document-collision",
      "document-collision",
      "document-collision",
    ]);
    expect(() => applyWorkflowEditorBundleImportPlan(library, build(library, "a"), plan)).toThrow(
      /already exists/u,
    );
  });

  it("reuses existing documents in a partial target library and warns on version mismatch", () => {
    const bundle = build(diamondLibrary(), "a");
    const partial = createWorkflowEditorLibrary({
      documents: [entry("d", doc(), 5), entry("other", doc())],
    });
    const plan = planWorkflowEditorBundleImport(partial, bundle, "reuse");
    expect(plan.items.map((item) => [item.sourceDocumentId, item.action])).toEqual([
      ["a", "create"],
      ["b", "create"],
      ["d", "reuse"],
      ["c", "create"],
    ]);
    expect(plan.diagnostics).toEqual([
      expect.objectContaining({ code: "version-mismatch", severity: "warning", documentId: "d" }),
    ]);

    const imported = applyWorkflowEditorBundleImportPlan(partial, bundle, plan);
    expect(imported.documents.find((document) => document.id === "d")?.version).toBe(5);
    expect(imported.documents.find((document) => document.id === "d")?.document.nodes).toEqual([]);
  });

  it("replaces existing documents and keeps the previous content as a saved version", () => {
    const bundle = build(diamondLibrary(), "a");
    const partial = createWorkflowEditorLibrary({ documents: [entry("d", doc(), 5)] });
    const plan = planWorkflowEditorBundleImport(partial, bundle, "replace");
    expect(plan.items.find((item) => item.sourceDocumentId === "d")).toMatchObject({
      action: "replace",
      existingVersion: 5,
      bundleVersion: 3,
    });

    const imported = applyWorkflowEditorBundleImportPlan(partial, bundle, plan, {
      now: exportedAt,
    });
    const replaced = imported.documents.find((document) => document.id === "d")!;
    expect(replaced.document.nodes.map((node) => node.id)).toEqual(["leaf"]);
    expect(replaced.version).toBe(7);
    expect(replaced.versions[0]).toMatchObject({ name: "Before bundle import", version: 6 });
    expect(replaced.versions[0]?.document.nodes).toEqual([]);
  });

  it("duplicates collisions under deterministic ids and rewrites every affected reference", () => {
    const source = diamondLibrary();
    const bundle = build(source, "a");
    const target = createWorkflowEditorLibrary({
      documents: [...source.documents, entry("d-copy", doc())],
    });

    const plan = planWorkflowEditorBundleImport(target, bundle, "duplicate");
    expect(plan.rootDocumentId).toBe("a-copy");
    expect(plan.items.map((item) => item.targetDocumentId)).toEqual([
      "a-copy",
      "b-copy",
      "d-copy-2",
      "c-copy",
    ]);
    expect(plan.rewrites).toEqual([
      { documentId: "a-copy", nodePath: ["to-b"], from: "b", to: "b-copy" },
      { documentId: "b-copy", nodePath: ["to-d"], from: "d", to: "d-copy-2" },
      { documentId: "a-copy", nodePath: ["to-c"], from: "c", to: "c-copy" },
      { documentId: "c-copy", nodePath: ["to-d"], from: "d", to: "d-copy-2" },
    ]);
    expect(planWorkflowEditorBundleImport(target, bundle, "duplicate")).toEqual(plan);

    const imported = applyWorkflowEditorBundleImportPlan(target, bundle, plan, { now: exportedAt });
    expect(imported.documents).toHaveLength(target.documents.length + 4);
    // The originals stay untouched; the copies reference only copies.
    expect(imported.documents.find((document) => document.id === "a")).toEqual(
      target.documents.find((document) => document.id === "a"),
    );
    const copy = build(imported, "a-copy");
    expect(copy.documents.map((document) => document.id)).toEqual([
      "a-copy",
      "b-copy",
      "d-copy-2",
      "c-copy",
    ]);
  });

  it("rewrites bounded recursive references when duplicating", () => {
    const library = createWorkflowEditorLibrary({
      documents: [entry("self", doc(refNode("again", { documentId: "self", maxDepth: 2 })))],
    });
    const bundle = build(library, "self");
    const plan = planWorkflowEditorBundleImport(library, bundle, "duplicate");
    const imported = applyWorkflowEditorBundleImportPlan(library, bundle, plan);
    expect(
      imported.documents.find((document) => document.id === "self-copy")?.document.nodes[0]
        ?.workflowRef,
    ).toEqual({ documentId: "self-copy", maxDepth: 2 });
  });
});
