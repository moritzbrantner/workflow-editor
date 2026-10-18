import { describe, expect, test, vi } from "vitest";

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
  parseWorkflowEditorLibrary,
  removeWorkflowEditorEntry,
  renameWorkflowEditorEntry,
  resolveWorkflowEditorDocumentReference,
  restoreWorkflowEditorDocumentFile,
  restoreWorkflowEditorVersion,
  saveWorkflowEditorLibrary,
  upsertWorkflowEditorEntry,
  workflowEditorDocumentFileVersion,
  workflowEditorLibraryFormat,
  workflowEditorLibraryVersion,
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
}).document;

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

  test("round-trips the per-node persistence setting and drops unknown values", () => {
    const authored = {
      nodes: [
        { id: "a", label: "A", x: 0, y: 0, persistence: "on-completion" },
        { id: "b", label: "B", x: 0, y: 0, persistence: "always" },
        { id: "c", label: "C", x: 0, y: 0 },
      ],
      edges: [],
    } as unknown as WorkflowEditorDocument;

    const parsed = parseWorkflowEditorDocumentFile(
      JSON.stringify(buildWorkflowEditorDocumentFile(authored)),
    );
    expect(parsed.document.nodes.map((node) => node.persistence)).toEqual([
      "on-completion",
      undefined,
      undefined,
    ]);
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
    }).document;
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
    }).document;
    const library = createWorkflowEditorLibrary({
      activeDocumentId: "parent",
      documents: [
        createWorkflowEditorEntry({ id: "parent", name: "Parent", document: parentDocument }),
        createWorkflowEditorEntry({ id: "child", name: "Child", document: childDocument }),
      ],
    });
    const storage = createLocalStorageWorkflowEditorStorage("workflow-editor-reference-test");

    await saveWorkflowEditorLibrary(storage, library);
    const loaded = await loadWorkflowEditorLibrary(storage);
    if (loaded.status !== "loaded") throw new Error(`unexpected ${loaded.status}`);
    const restored = loaded.library;
    const parent = restored.documents.find((entry) => entry.id === "parent")!;
    const childReference = parent.document.nodes.find((node) => node.id === "nested")!.workflowRef;

    expect(listWorkflowEditorDocumentReferenceOptions(restored)).toEqual([
      expect.objectContaining({ id: "parent", name: "Parent" }),
      expect.objectContaining({
        id: "child",
        name: "Child",
        interface: expect.objectContaining({ inputs: expect.any(Array) }),
      }),
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

  test("loads and saves localStorage libraries and keeps unreadable data recoverable", async () => {
    window.localStorage.clear();
    const key = "workflow-editor-test";
    const storage = createLocalStorageWorkflowEditorStorage(key);
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

    await expect(loadWorkflowEditorLibrary(storage)).resolves.toEqual({ status: "empty" });
    await saveWorkflowEditorLibrary(storage, library);
    await expect(loadWorkflowEditorLibrary(storage)).resolves.toMatchObject({
      status: "loaded",
      library: { activeDocumentId: "demo" },
    });
    // The first save had nothing to back up.
    await expect(storage.loadBackup!()).resolves.toEqual({ status: "empty" });

    // Replacing a readable library keeps the previous one as last-known-good backup.
    const renamed = renameWorkflowEditorEntry(library, "demo", "Renamed");
    await saveWorkflowEditorLibrary(storage, renamed);
    const backup = await storage.loadBackup!();
    expect(backup.status === "loaded" && activeWorkflowEditorEntry(backup.library)?.name).toBe(
      "Stored",
    );

    // Corrupt data is reported with its raw payload, never replaced by an empty library.
    window.localStorage.setItem(key, "{");
    await expect(loadWorkflowEditorLibrary(storage)).resolves.toMatchObject({
      status: "recoverable-error",
      raw: "{",
      diagnostics: [expect.objectContaining({ code: "invalid-json" })],
    });
    // Saving over unreadable data does not overwrite the last-known-good backup.
    await saveWorkflowEditorLibrary(storage, library);
    const kept = await storage.loadBackup!();
    expect(kept.status === "loaded" && activeWorkflowEditorEntry(kept.library)?.name).toBe(
      "Stored",
    );
  });

  test("classifies future versions, unknown formats and unreadable entries", () => {
    const future = JSON.stringify({
      format: workflowEditorLibraryFormat,
      version: workflowEditorLibraryVersion + 1,
      documents: [],
    });
    expect(parseWorkflowEditorLibrary(future)).toMatchObject({
      status: "unsupported-future-version",
      raw: future,
      version: workflowEditorLibraryVersion + 1,
    });
    expect(parseWorkflowEditorLibrary('{"format":"other"}')).toMatchObject({
      status: "recoverable-error",
      diagnostics: [expect.objectContaining({ code: "invalid-format" })],
    });
    const badEntry = JSON.stringify({
      format: workflowEditorLibraryFormat,
      version: workflowEditorLibraryVersion,
      activeDocumentId: null,
      documents: [{ id: "broken", name: "Broken", document: { nodes: "nope" } }],
    });
    expect(parseWorkflowEditorLibrary(badEntry)).toMatchObject({
      status: "recoverable-error",
      raw: badEntry,
      diagnostics: [expect.objectContaining({ code: "invalid-entry", path: "$.documents[0]" })],
    });
  });

  test("reports structured write failures", async () => {
    const storage = createLocalStorageWorkflowEditorStorage("workflow-editor-quota-test");
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("full", "QuotaExceededError");
    });
    try {
      await expect(
        saveWorkflowEditorLibrary(storage, createWorkflowEditorLibrary()),
      ).rejects.toMatchObject({
        name: "WorkflowEditorStorageError",
        diagnostic: { code: "quota-exceeded" },
      });
    } finally {
      setItem.mockRestore();
    }
  });
});
