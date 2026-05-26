import { fireEvent, render, screen } from "@testing-library/react";
import { beforeAll, describe, expect, test, vi } from "vitest";

import {
  WorkflowWorkbench,
  addWorkflowEditorNode,
  activeWorkflowEditorEntry,
  buildWorkflowEditorDocumentFile,
  canRedoWorkflowEditorHistory,
  canUndoWorkflowEditorHistory,
  commitWorkflowEditorHistory,
  connectWorkflowEditorNodes,
  createLocalStorageWorkflowEditorStorage,
  createWorkflowEditorGraphIndex,
  createWorkflowEditorHistory,
  createWorkflowEditorLibrary,
  createWorkflowEditorVersion,
  decodeWorkflowEditorSharePayload,
  detectWorkflowEditorCycles,
  duplicateWorkflowEditorNode,
  duplicateWorkflowEditorEntry,
  encodeWorkflowEditorSharePayload,
  fromUiWorkflowBuilderEdges,
  fromUiWorkflowBuilderNodes,
  isWorkflowEditorDirectedAcyclicGraph,
  loadWorkflowEditorLibrary,
  moveWorkflowEditorNode,
  normalizeWorkflowEditorDocument,
  parseWorkflowEditorDocumentFile,
  removeWorkflowEditorNode,
  removeWorkflowEditorEntry,
  renameWorkflowEditorEntry,
  restoreWorkflowEditorDocumentFile,
  restoreWorkflowEditorVersion,
  redoWorkflowEditorHistory,
  resetWorkflowEditorHistory,
  saveWorkflowEditorLibrary,
  toUiWorkflowBuilderEdges,
  toUiWorkflowBuilderNodes,
  topologicallySortWorkflowEditorNodes,
  undoWorkflowEditorHistory,
  upsertWorkflowEditorEntry,
  updateWorkflowEditorNode,
  validateWorkflowEditorConnection,
  wouldCreateWorkflowEditorCycle,
  workflowEditorDocumentFileVersion,
  type WorkflowEditorDocument,
} from "@moritzbrantner/workflow-editor";

const document: WorkflowEditorDocument = normalizeWorkflowEditorDocument({
  nodes: [
    {
      id: "input",
      label: "Input",
      x: 0,
      y: 0,
      outputs: [{ id: "out", label: "Out", kind: "text" }],
    },
    {
      id: "transform",
      label: "Transform",
      x: 240,
      y: 0,
      inputs: [{ id: "in", label: "In", kind: "text" }],
      outputs: [{ id: "out", label: "Out", kind: "text" }],
    },
    {
      id: "output",
      label: "Output",
      x: 480,
      y: 0,
      inputs: [{ id: "in", label: "In", kind: "text" }],
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

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserver {
      disconnect() {}
      observe() {}
      unobserve() {}
    },
  );
});

describe("@moritzbrantner/workflow-editor core", () => {
  test("normalizes, mutates, indexes, and roundtrips graph data", () => {
    const added = addWorkflowEditorNode(document, {
      id: "review",
      label: "Review",
      x: 360,
      y: 120,
      inputs: [{ id: "in", label: "In", kind: "text" }],
    });
    const moved = moveWorkflowEditorNode(added, "review", { x: 400, y: 160 });
    const updated = updateWorkflowEditorNode(moved, "review", { label: "Human review" });
    const duplicated = duplicateWorkflowEditorNode(updated, "review");
    const graphIndex = createWorkflowEditorGraphIndex(duplicated);

    expect(graphIndex.getNodeById("review")?.label).toBe("Human review");
    expect(duplicated.nodes.some((node) => node.id === "review-copy")).toBe(true);
    expect(
      normalizeWorkflowEditorDocument({
        nodes: [{ id: "zoom", label: "Zoom", x: Number.NaN, y: Number.NaN }],
        edges: [],
        viewport: { x: Number.NaN, y: Number.NaN, zoom: 10 },
      }).viewport,
    ).toEqual({ x: 0, y: 0, zoom: 4 });

    const uiNodes = toUiWorkflowBuilderNodes(duplicated.nodes);
    const uiEdges = toUiWorkflowBuilderEdges(duplicated.edges);
    expect(fromUiWorkflowBuilderNodes(uiNodes, duplicated.nodes)[0]?.id).toBe("input");
    expect(fromUiWorkflowBuilderEdges(uiEdges, duplicated.edges)[0]?.id).toBe("input-transform");

    const removed = removeWorkflowEditorNode(duplicated, "input");
    expect(removed.edges).toHaveLength(0);
  });

  test("validates connections and detects ordering and cycles", () => {
    expect(
      validateWorkflowEditorConnection(document, {
        sourceNodeId: "input",
        sourcePortId: "out",
        targetNodeId: "transform",
        targetPortId: "in",
      }),
    ).toEqual({ valid: false, reason: "duplicate" });
    expect(
      validateWorkflowEditorConnection(document, {
        sourceNodeId: "input",
        sourcePortId: "missing",
        targetNodeId: "output",
        targetPortId: "in",
      }).reason,
    ).toBe("missing-port");
    expect(
      validateWorkflowEditorConnection(document, {
        sourceNodeId: "input",
        sourcePortId: "out",
        targetNodeId: "input",
        targetPortId: "out",
      }).reason,
    ).toBe("self-connection");
    expect(
      validateWorkflowEditorConnection(
        {
          nodes: [
            {
              id: "a",
              label: "A",
              x: 0,
              y: 0,
              outputs: [{ id: "out", label: "Out", kind: "text" }],
            },
            { id: "b", label: "B", x: 0, y: 0, inputs: [{ id: "in", label: "In", kind: "image" }] },
          ],
          edges: [],
        },
        {
          sourceNodeId: "a",
          sourcePortId: "out",
          targetNodeId: "b",
          targetPortId: "in",
        },
      ).reason,
    ).toBe("kind-mismatch");

    const connected = connectWorkflowEditorNodes(document, {
      sourceNodeId: "transform",
      sourcePortId: "out",
      targetNodeId: "output",
      targetPortId: "in",
    });
    const graphIndex = createWorkflowEditorGraphIndex(connected);
    const subgraph = graphIndex.getSubgraph({ offset: 0, limit: 2 });

    expect(connected.edges).toHaveLength(2);
    expect(graphIndex.getEdgeById("input-transform")?.source).toBe("input");
    expect(subgraph.summary).toEqual(
      expect.objectContaining({
        edgeCount: 1,
        selectedNodeCount: 2,
        totalCount: 3,
      }),
    );
    expect(topologicallySortWorkflowEditorNodes(connected).map((node) => node.id)).toEqual([
      "input",
      "transform",
      "output",
    ]);

    const cyclic = {
      nodes: connected.nodes,
      edges: [
        ...connected.edges,
        {
          id: "output-input",
          sourceNodeId: "output",
          sourcePortId: "out",
          targetNodeId: "input",
          targetPortId: "in",
        },
      ],
    };
    expect(detectWorkflowEditorCycles(cyclic)).toHaveLength(1);
  });

  test("prevents new edges from closing directed cycles", () => {
    const dag = normalizeWorkflowEditorDocument({
      nodes: [
        {
          id: "a",
          label: "A",
          x: 0,
          y: 0,
          inputs: [{ id: "in", label: "In", kind: "text" }],
          outputs: [{ id: "out", label: "Out", kind: "text" }],
        },
        {
          id: "b",
          label: "B",
          x: 220,
          y: 0,
          inputs: [{ id: "in", label: "In", kind: "text" }],
          outputs: [{ id: "out", label: "Out", kind: "text" }],
        },
        {
          id: "c",
          label: "C",
          x: 440,
          y: 0,
          inputs: [{ id: "in", label: "In", kind: "text" }],
          outputs: [{ id: "out", label: "Out", kind: "text" }],
        },
      ],
      edges: [
        {
          id: "a-b",
          sourceNodeId: "a",
          sourcePortId: "out",
          targetNodeId: "b",
          targetPortId: "in",
        },
        {
          id: "b-c",
          sourceNodeId: "b",
          sourcePortId: "out",
          targetNodeId: "c",
          targetPortId: "in",
        },
      ],
    });
    const cycleConnection = {
      sourceNodeId: "c",
      sourcePortId: "out",
      targetNodeId: "a",
      targetPortId: "in",
    };

    expect(isWorkflowEditorDirectedAcyclicGraph(dag)).toBe(true);
    expect(wouldCreateWorkflowEditorCycle(dag, cycleConnection)).toBe(true);
    expect(validateWorkflowEditorConnection(dag, cycleConnection)).toEqual({
      valid: false,
      reason: "cycle",
    });
    expect(connectWorkflowEditorNodes(dag, cycleConnection).edges).toHaveLength(2);

    const normalized = normalizeWorkflowEditorDocument({
      ...dag,
      edges: [
        ...dag.edges,
        {
          id: "c-a",
          ...cycleConnection,
        },
      ],
    });

    expect(normalized.edges.map((edge) => edge.id)).toEqual(["a-b", "b-c"]);
    expect(isWorkflowEditorDirectedAcyclicGraph(normalized)).toBe(true);
  });
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

  test("normalizes imported documents and rejects duplicate node IDs", () => {
    const parsed = parseWorkflowEditorDocumentFile(
      JSON.stringify({
        format: "@moritzbrantner/workflow-editor/document",
        version: 1,
        exportedAt: "2026-05-26T00:00:00.000Z",
        document: {
          nodes: [{ id: "a", label: "A", x: Number.NaN, y: Number.NaN }],
          edges: [
            {
              id: "missing",
              sourceNodeId: "a",
              sourcePortId: "out",
              targetNodeId: "missing",
              targetPortId: "in",
            },
          ],
          viewport: { x: Number.NaN, y: Number.NaN, zoom: 10 },
        },
      }),
    );

    expect(parsed.document.viewport).toEqual({ x: 0, y: 0, zoom: 4 });
    expect(parsed.document.edges).toEqual([]);
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
    ).toThrow("Duplicate workflow node id");
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
      { ...versioned, document: { ...versioned.document, nodes: [] } },
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

describe("@moritzbrantner/workflow-editor history", () => {
  test("commits, ignores unchanged documents, undoes, redoes, resets, and limits history", () => {
    const nextDocument = addWorkflowEditorNode(document, {
      id: "review",
      label: "Review",
      x: 300,
      y: 120,
    });
    let history = createWorkflowEditorHistory(document);

    history = commitWorkflowEditorHistory(history, document);
    expect(history.past).toHaveLength(0);

    history = commitWorkflowEditorHistory(history, nextDocument, { limit: 1 });
    history = commitWorkflowEditorHistory(
      history,
      addWorkflowEditorNode(nextDocument, { id: "done", label: "Done", x: 480, y: 120 }),
      { limit: 1 },
    );
    expect(history.past).toHaveLength(1);
    expect(canUndoWorkflowEditorHistory(history)).toBe(true);

    history = undoWorkflowEditorHistory(history);
    expect(history.present.nodes.map((node) => node.id)).toContain("review");
    expect(history.present.nodes.map((node) => node.id)).not.toContain("done");
    expect(canRedoWorkflowEditorHistory(history)).toBe(true);

    history = redoWorkflowEditorHistory(history);
    expect(history.present.nodes.map((node) => node.id)).toContain("done");

    history = resetWorkflowEditorHistory(document);
    expect(canUndoWorkflowEditorHistory(history)).toBe(false);
    expect(canRedoWorkflowEditorHistory(history)).toBe(false);
  });
});

describe("@moritzbrantner/workflow-editor share", () => {
  test("encodes and decodes plain workflow share payloads", async () => {
    const token = await encodeWorkflowEditorSharePayload({ document });
    expect(token.startsWith("plain.")).toBe(true);
    await expect(decodeWorkflowEditorSharePayload(token)).resolves.toMatchObject({
      document: {
        nodes: expect.arrayContaining([expect.objectContaining({ id: "input" })]),
      },
    });
  });

  test("rejects invalid workflow share payloads", async () => {
    await expect(decodeWorkflowEditorSharePayload("bad")).rejects.toThrow("invalid");
    await expect(decodeWorkflowEditorSharePayload("unknown.payload")).rejects.toThrow(
      "unknown encoding",
    );
  });
});

describe("@moritzbrantner/workflow-editor React workbench", () => {
  test("renders, selects, changes document state, and respects read-only mode", () => {
    const handleDocumentChange = vi.fn();
    const handleSelectionChange = vi.fn();
    const { rerender } = render(
      <WorkflowWorkbench
        document={document}
        selectedNodeId="input"
        nodeTemplates={[
          {
            id: "decision",
            label: "Decision",
            inputs: [{ id: "in", label: "In", kind: "text" }],
            outputs: [{ id: "out", label: "Out", kind: "text" }],
          },
        ]}
        renderNodeTemplate={(template) => template.label}
        onDocumentChange={handleDocumentChange}
        onSelectionChange={handleSelectionChange}
      />,
    );

    fireEvent.click(screen.getAllByText("Input")[1]!);
    expect(handleSelectionChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: "input", type: "node" }),
    );

    fireEvent.click(screen.getAllByRole("button", { name: /Decision/ })[0]!);
    expect(handleDocumentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: expect.arrayContaining([expect.objectContaining({ id: "decision" })]),
      }),
    );

    handleDocumentChange.mockClear();
    rerender(
      <WorkflowWorkbench
        document={document}
        selectedNodeId="input"
        readOnly
        nodeTemplates={[{ id: "decision", label: "Decision" }]}
        renderNodeTemplate={(template) => template.label}
        onDocumentChange={handleDocumentChange}
      />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: /Decision/ })[0]!);
    expect(handleDocumentChange).not.toHaveBeenCalled();
  });
});
