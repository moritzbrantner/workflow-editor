import { describe, expect, test } from "vitest";

import {
  WorkflowEditorDocumentValidationError,
  normalizeWorkflowEditorDocument,
  type WorkflowEditorDocument,
} from "@moritzbrantner/workflow-editor/core";
import {
  activeWorkflowEditorEntry,
  buildWorkflowEditorDocumentFile,
  createLocalStorageWorkflowEditorStorage,
  createWorkflowEditorEntry,
  createWorkflowEditorLibrary,
  createWorkflowEditorVersion,
  duplicateWorkflowEditorEntry,
  getWorkflowEditorReferenceDiagnostics,
  listWorkflowEditorDocumentReferenceOptions,
  loadWorkflowEditorLibrary,
  parseWorkflowEditorDocumentFile,
  removeWorkflowEditorEntry,
  renameWorkflowEditorEntry,
  resolveWorkflowEditorDocumentReference,
  restoreWorkflowEditorDocumentFile,
  restoreWorkflowEditorVersion,
  saveWorkflowEditorLibrary,
  upsertWorkflowEditorEntry,
  workflowEditorDocumentFileVersion,
} from "@moritzbrantner/workflow-editor/persistence";

const document: WorkflowEditorDocument = normalizeWorkflowEditorDocument({
  nodes: [
    {
      id: "input",
      label: "Input",
      x: 0,
      y: 0,
      outputs: [{ id: "out", label: "Out", type: { kind: "string" } }],
    },
    {
      id: "transform",
      label: "Transform",
      x: 240,
      y: 0,
      inputs: [{ id: "in", label: "In", type: { kind: "string" } }],
      outputs: [{ id: "out", label: "Out", type: { kind: "string" } }],
    },
    {
      id: "output",
      label: "Output",
      x: 480,
      y: 0,
      inputs: [{ id: "in", label: "In", type: { kind: "string" } }],
    },
  ],
  edges: [
    {
      id: "input-transform",
      sourceNodeId: "input",
      sourcePortId: "out",
      targetNodeId: "transform",
      targetPortId: "in",
    },
  ],
});

describe("@moritzbrantner/workflow-editor persistence", () => {
  test("builds, parses, and restores workflow document files", () => {
    const file = buildWorkflowEditorDocumentFile(document, {
      documentId: "demo",
      documentName: "Demo",
      documentVersion: 2,
      exportedAt: "2026-05-26T00:00:00.000Z",
    });
    const parsed = parseWorkflowEditorDocumentFile(JSON.stringify(file));
    const restored = restoreWorkflowEditorDocumentFile(parsed);

    expect(parsed.documentName).toBe("Demo");
    expect(restored.document.nodes.map((node) => node.id)).toEqual([
      "input",
      "transform",
      "output",
    ]);
    expect(restored.document.edges).toHaveLength(1);
  });

  test("rejects malformed, unknown, and unsupported document files", () => {
    expect(() => parseWorkflowEditorDocumentFile("{")).toThrow("Invalid workflow document JSON");
    expect(() =>
      parseWorkflowEditorDocumentFile(
        JSON.stringify({
          format: "wrong",
          version: workflowEditorDocumentFileVersion,
          document,
        }),
      ),
    ).toThrow("not a workflow document file");
    expect(() =>
      parseWorkflowEditorDocumentFile(
        JSON.stringify({
          format: "@moritzbrantner/workflow-editor/document",
          version: 99,
          document,
        }),
      ),
    ).toThrow("Unsupported workflow document version");
  });

  test("strictly validates imported documents", () => {
    expect(() =>
      parseWorkflowEditorDocumentFile(
        JSON.stringify({
          format: "@moritzbrantner/workflow-editor/document",
          version: 1,
          exportedAt: "2026-05-26T00:00:00.000Z",
          document: {
            nodes: [{ id: "a", label: "A", x: null, y: null }],
            edges: [
              {
                id: "missing",
                sourceNodeId: "a",
                sourcePortId: "out",
                targetNodeId: "missing",
                targetPortId: "in",
              },
            ],
            viewport: { x: null, y: null, zoom: 10 },
          },
        }),
      ),
    ).toThrow(WorkflowEditorDocumentValidationError);
    expect(() =>
      parseWorkflowEditorDocumentFile(
        JSON.stringify({
          format: "@moritzbrantner/workflow-editor/document",
          version: 1,
          document: {
            nodes: [
              { id: "a", label: "A", x: 0, y: 0 },
              { id: "a", label: "A", x: 0, y: 0 },
            ],
            edges: [],
          },
        }),
      ),
    ).toThrow(WorkflowEditorDocumentValidationError);
  });

  test("creates, mutates, versions, and restores workflow libraries", () => {
    const library = createWorkflowEditorLibrary({
      documents: [
        {
          ...activeWorkflowEditorEntry(createWorkflowEditorLibrary())!,
          id: "demo",
          name: "Demo",
          document,
        },
      ],
      activeDocumentId: "demo",
    });
    const active = activeWorkflowEditorEntry(library);
    expect(active?.id).toBe("demo");

    const renamed = renameWorkflowEditorEntry(library, "demo", "Renamed");
    expect(activeWorkflowEditorEntry(renamed)?.name).toBe("Renamed");

    const duplicated = duplicateWorkflowEditorEntry(renamed, "demo");
    expect(duplicated.documents).toHaveLength(2);
    expect(activeWorkflowEditorEntry(duplicated)?.name).toBe("Renamed Copy");

    const upserted = upsertWorkflowEditorEntry(duplicated, {
      ...duplicated.documents[0]!,
      name: "Upserted",
    });
    expect(upserted.documents.some((entry) => entry.name === "Upserted")).toBe(true);

    let versioned = createWorkflowEditorVersion(renamed.documents[0]!, {
      createdAt: "2026-05-26T00:00:00.000Z",
      maxVersions: 2,
    });
    const firstVersionId = versioned.versions[0]!.id;
    expect(restoreWorkflowEditorVersion(versioned, firstVersionId).document.nodes).toHaveLength(3);

    versioned = createWorkflowEditorVersion(
      { ...versioned, document: { ...versioned.document, nodes: [], edges: [] } },
      { maxVersions: 2 },
    );
    versioned = createWorkflowEditorVersion(versioned, { maxVersions: 2 });
    expect(versioned.versions).toHaveLength(2);
    expect(versioned.version).toBe(4);

    const removed = removeWorkflowEditorEntry(
      duplicated,
      activeWorkflowEditorEntry(duplicated)!.id,
    );
    expect(removed.documents).toHaveLength(1);
  });

  test("resolves reusable workflow references and reports missing and recursive diagnostics", async () => {
    window.localStorage.clear();
    const parentDocument = normalizeWorkflowEditorDocument({
      nodes: [
        {
          id: "nested",
          label: "Nested",
          x: 0,
          y: 0,
          workflowRef: { documentId: "child" },
        },
        {
          id: "missing",
          label: "Missing",
          x: 200,
          y: 0,
          workflowRef: { documentId: "deleted" },
        },
      ],
      edges: [],
    });
    const childDocument = normalizeWorkflowEditorDocument({
      nodes: [
        {
          id: "loop",
          label: "Loop",
          x: 0,
          y: 0,
          workflowRef: { documentId: "parent" },
        },
      ],
      edges: [],
    });
    const library = createWorkflowEditorLibrary({
      activeDocumentId: "parent",
      documents: [
        createWorkflowEditorEntry({ id: "parent", name: "Parent", document: parentDocument }),
        createWorkflowEditorEntry({ id: "child", name: "Child", document: childDocument }),
      ],
    });
    const storage = createLocalStorageWorkflowEditorStorage("workflow-editor-reference-test");

    await saveWorkflowEditorLibrary(storage, library);
    const restored = await loadWorkflowEditorLibrary(storage);
    const parent = restored.documents.find((entry) => entry.id === "parent")!;
    const childReference = parent.document.nodes.find((node) => node.id === "nested")!.workflowRef;

    expect(listWorkflowEditorDocumentReferenceOptions(restored)).toEqual([
      { id: "parent", name: "Parent" },
      { id: "child", name: "Child" },
    ]);
    expect(resolveWorkflowEditorDocumentReference(restored, childReference)?.id).toBe("child");
    expect(
      duplicateWorkflowEditorEntry(restored, "parent").documents[0]?.document.nodes[0],
    ).toMatchObject({ workflowRef: { documentId: "child" } });

    const withoutChild = removeWorkflowEditorEntry(restored, "child");
    expect(
      withoutChild.documents.find((entry) => entry.id === "parent")?.document.nodes[0],
    ).toMatchObject({ workflowRef: { documentId: "child" } });
    expect(getWorkflowEditorReferenceDiagnostics(withoutChild)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "missing-document",
          sourceDocumentId: "parent",
          sourceNodeId: "nested",
          targetDocumentId: "child",
        }),
      ]),
    );
    expect(getWorkflowEditorReferenceDiagnostics(restored)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "missing-document",
          sourceDocumentId: "parent",
          sourceNodeId: "missing",
          targetDocumentId: "deleted",
        }),
      ]),
    );
    expect(getWorkflowEditorReferenceDiagnostics(restored, { includeRecursive: true })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "recursive-reference",
          sourceDocumentId: "parent",
          sourceNodeId: "nested",
          targetDocumentId: "parent",
          path: ["parent", "child", "parent"],
        }),
      ]),
    );
  });

  test("loads and saves localStorage libraries with corrupt storage fallback", async () => {
    window.localStorage.clear();
    const storage = createLocalStorageWorkflowEditorStorage("workflow-editor-test");
    const library = createWorkflowEditorLibrary({
      documents: [
        {
          ...activeWorkflowEditorEntry(createWorkflowEditorLibrary())!,
          id: "demo",
          name: "Stored",
          document,
        },
      ],
      activeDocumentId: "demo",
    });

    await saveWorkflowEditorLibrary(storage, library);
    await expect(loadWorkflowEditorLibrary(storage)).resolves.toMatchObject({
      activeDocumentId: "demo",
    });

    window.localStorage.setItem("workflow-editor-test", "{");
    const fallback = await loadWorkflowEditorLibrary(storage);
    expect(fallback.documents).toHaveLength(1);
    expect(activeWorkflowEditorEntry(fallback)?.name).toBe("Untitled Workflow");
  });
});
