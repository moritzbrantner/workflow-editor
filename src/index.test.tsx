import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import {
  WorkflowEditor,
  WorkflowEditorDocumentValidationError,
  WorkflowWorkbench,
  addWorkflowEditorNode,
  addWorkflowEditorObjectConstructorInput,
  activeWorkflowEditorEntry,
  analyzeWorkflowEditorPortTypes,
  buildWorkflowEditorDocumentFile,
  canRedoWorkflowEditorHistory,
  canUndoWorkflowEditorHistory,
  commitWorkflowEditorHistory,
  composeWorkflowEditorNodes,
  connectWorkflowEditorNodes,
  createLocalStorageWorkflowEditorStorage,
  createWorkflowEditorComposedNode,
  createWorkflowEditorEntry,
  createWorkflowEditorGraphIndex,
  createWorkflowEditorHistory,
  createWorkflowEditorLibrary,
  createWorkflowEditorVersion,
  defaultWorkflowEditorNodeTemplates,
  decodeWorkflowEditorSharePayload,
  detectWorkflowEditorCycles,
  duplicateWorkflowEditorNode,
  duplicateWorkflowEditorEntry,
  encodeWorkflowEditorSharePayload,
  findWorkflowEditorNode,
  formatWorkflowEditorObjectConstructorExpression,
  fromUiWorkflowBuilderEdges,
  fromUiWorkflowBuilderNodes,
  getWorkflowEditorObjectConstructorInputs,
  getWorkflowEditorReferenceDiagnostics,
  getWorkflowEditorReferencedDocumentIds,
  hasWorkflowEditorNodeComposition,
  hasWorkflowEditorWorkflowReference,
  isWorkflowEditorObjectConstructorNode,
  isWorkflowEditorDirectedAcyclicGraph,
  isWorkflowEditorPortTypeAssignable,
  listWorkflowEditorDocumentReferenceOptions,
  loadWorkflowEditorLibrary,
  moveWorkflowEditorNode,
  normalizeWorkflowEditorDocument,
  parseWorkflowEditorDocumentFile,
  removeWorkflowEditorNode,
  removeWorkflowEditorEntry,
  renameWorkflowEditorEntry,
  restoreWorkflowEditorComposedNode,
  resolveWorkflowEditorDocumentReference,
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
  updateWorkflowEditorNodeWorkflowReference,
  validateWorkflowEditorDocument,
  validateWorkflowEditorConnection,
  wouldCreateWorkflowEditorCycle,
  workflowEditorControlFlowNodeTemplates,
  workflowEditorDocumentFileVersion,
  workflowEditorJsonNodeTemplates,
  type WorkflowEditorDocument,
} from "@moritzbrantner/workflow-editor";

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

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserver {
      disconnect() {}
      observe() {}
      unobserve() {}
    },
  );
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
});

describe("@moritzbrantner/workflow-editor core", () => {
  test("provides built-in control flow and JSON node templates", () => {
    const templateIds = defaultWorkflowEditorNodeTemplates.map((template) => template.id);
    const branchTemplate = workflowEditorControlFlowNodeTemplates.find(
      (template) => template.id === "control-flow-if",
    );
    const stringTemplate = workflowEditorJsonNodeTemplates.find(
      (template) => template.id === "json-string",
    );
    const arrayTemplate = workflowEditorJsonNodeTemplates.find(
      (template) => template.id === "json-array",
    );
    const objectTemplate = workflowEditorJsonNodeTemplates.find(
      (template) => template.id === "json-object",
    );

    expect(new Set(templateIds).size).toBe(templateIds.length);
    expect(templateIds).toEqual(
      expect.arrayContaining([
        "control-flow-start",
        "control-flow-if",
        "control-flow-switch",
        "control-flow-merge",
        "control-flow-end",
        "json-string",
        "json-number",
        "json-boolean",
        "json-null",
        "json-array",
        "json-object",
      ]),
    );
    expect(branchTemplate?.inputs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "condition", type: { kind: "boolean" } }),
      ]),
    );
    expect(stringTemplate?.outputs?.[0]?.type).toEqual({ kind: "string" });
    expect(arrayTemplate?.outputs?.[0]?.type).toEqual({
      kind: "array",
      element: { kind: "any" },
    });
    expect(objectTemplate?.outputs?.[0]?.type).toEqual({ kind: "object" });
  });

  test("constructs object nodes with expandable named inputs", () => {
    const objectTemplate = workflowEditorJsonNodeTemplates.find(
      (template) => template.id === "json-object",
    )!;
    const objectDocument = normalizeWorkflowEditorDocument<Record<string, unknown>>({
      nodes: [
        {
          id: "employee",
          label: "Employee",
          x: 0,
          y: 0,
          outputs: [{ id: "firstName", label: "First name", type: { kind: "string" } }],
        },
        {
          ...objectTemplate,
          id: "employee-object",
          x: 240,
          y: 0,
        },
      ],
      edges: [],
    });

    const connected = connectWorkflowEditorNodes(objectDocument, {
      sourceNodeId: "employee",
      sourcePortId: "firstName",
      targetNodeId: "employee-object",
      targetPortId: "property",
    });
    const objectNode = findWorkflowEditorNode(connected, "employee-object")!;

    expect(isWorkflowEditorObjectConstructorNode(objectNode)).toBe(true);
    expect(connected.edges[0]).toEqual(
      expect.objectContaining({
        targetNodeId: "employee-object",
        targetPortId: "firstname",
      }),
    );
    expect(getWorkflowEditorObjectConstructorInputs(objectNode)).toEqual([
      expect.objectContaining({
        id: "firstname",
        label: "firstName",
        badge: "employee.firstName",
        type: { kind: "string" },
      }),
    ]);
    expect(objectNode.inputs?.at(-1)).toEqual(
      expect.objectContaining({ id: "property", label: "Add property" }),
    );
    expect(objectNode.outputs?.[0]?.type).toEqual({
      kind: "object",
      properties: { firstName: { type: { kind: "string" } } },
    });
    expect(formatWorkflowEditorObjectConstructorExpression(objectNode)).toBe(
      "{\n  firstName: employee.firstName\n}",
    );

    const expanded = addWorkflowEditorObjectConstructorInput(connected, "employee-object", {
      propertyKey: "lastName",
    });
    expect(
      getWorkflowEditorObjectConstructorInputs(
        findWorkflowEditorNode(expanded, "employee-object")!,
      ),
    ).toHaveLength(2);
  });

  test("normalizes, mutates, indexes, and roundtrips graph data", () => {
    const added = addWorkflowEditorNode(document, {
      id: "review",
      label: "Review",
      x: 360,
      y: 120,
      inputs: [{ id: "in", label: "In", type: { kind: "string" } }],
    });
    const moved = moveWorkflowEditorNode(added, "review", { x: 400, y: 160 });
    const updated = updateWorkflowEditorNode(moved, "review", { label: "Human review" });
    const duplicated = duplicateWorkflowEditorNode(updated, "review");
    const graphIndex = createWorkflowEditorGraphIndex(duplicated);

    expect(graphIndex.getNodeById("review")?.label).toBe("Human review");
    expect(duplicated.nodes.some((node) => node.id === "review-copy")).toBe(true);
    expect(
      normalizeWorkflowEditorDocument(
        {
          nodes: [{ id: "zoom", label: "Zoom", x: Number.NaN, y: Number.NaN }],
          edges: [],
          viewport: { x: Number.NaN, y: Number.NaN, zoom: 10 },
        },
        { mode: "repair" },
      ).viewport,
    ).toEqual({ x: 0, y: 0, zoom: 4 });

    const uiNodes = toUiWorkflowBuilderNodes(duplicated.nodes);
    const uiEdges = toUiWorkflowBuilderEdges(duplicated.edges);
    expect(fromUiWorkflowBuilderNodes(uiNodes, duplicated.nodes)[0]?.id).toBe("input");
    expect(fromUiWorkflowBuilderEdges(uiEdges, duplicated.edges)[0]?.id).toBe("input-transform");

    const removed = removeWorkflowEditorNode(duplicated, "input");
    expect(removed.edges).toHaveLength(0);
  });

  test("validates workflow documents and supports repair-mode normalization", () => {
    expect(validateWorkflowEditorDocument(document)).toEqual([]);
    expect(validateWorkflowEditorDocument(null)).toEqual([
      expect.objectContaining({ code: "invalid-document" }),
    ]);
    expect(validateWorkflowEditorDocument({ edges: [] })).toEqual([
      expect.objectContaining({ code: "invalid-document", path: "$.nodes" }),
    ]);

    const invalidDocument = {
      nodes: [
        { id: "", label: "Missing id", x: 0, y: 0 },
        { id: "a", label: "A", x: 0, y: 0 },
        { id: "a", label: "Duplicate A", x: 0, y: 0 },
        { id: "b", label: "B", x: 0, y: 0 },
      ],
      edges: [
        {
          id: "missing-source",
          sourceNodeId: "missing",
          sourcePortId: "out",
          targetNodeId: "a",
          targetPortId: "in",
        },
        {
          id: "missing-target",
          sourceNodeId: "a",
          sourcePortId: "out",
          targetNodeId: "missing",
          targetPortId: "in",
        },
        {
          id: "self",
          sourceNodeId: "b",
          sourcePortId: "out",
          targetNodeId: "b",
          targetPortId: "in",
        },
        {
          id: "duplicate-edge",
          sourceNodeId: "a",
          sourcePortId: "out",
          targetNodeId: "b",
          targetPortId: "in",
        },
        {
          id: "duplicate-edge",
          sourceNodeId: "b",
          sourcePortId: "out",
          targetNodeId: "a",
          targetPortId: "in",
        },
      ],
    };
    const diagnosticCodes = validateWorkflowEditorDocument(invalidDocument).map(
      (diagnostic) => diagnostic.code,
    );

    expect(diagnosticCodes).toEqual(
      expect.arrayContaining([
        "invalid-node",
        "duplicate-node-id",
        "duplicate-edge-id",
        "missing-edge-node",
        "self-edge",
      ]),
    );
    expect(() =>
      normalizeWorkflowEditorDocument(invalidDocument as WorkflowEditorDocument),
    ).toThrow(WorkflowEditorDocumentValidationError);

    const cyclic = {
      nodes: [
        { id: "a", label: "A", x: 0, y: 0 },
        { id: "b", label: "B", x: 0, y: 0 },
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
          id: "b-a",
          sourceNodeId: "b",
          sourcePortId: "out",
          targetNodeId: "a",
          targetPortId: "in",
        },
      ],
    };

    expect(validateWorkflowEditorDocument(cyclic).map((diagnostic) => diagnostic.code)).toContain(
      "cycle",
    );
    expect(normalizeWorkflowEditorDocument(cyclic, { mode: "repair" }).edges).toHaveLength(1);
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
              outputs: [{ id: "out", label: "Out", type: { kind: "string" } }],
            },
            {
              id: "b",
              label: "B",
              x: 0,
              y: 0,
              inputs: [{ id: "in", label: "In", type: { kind: "number" } }],
            },
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

  test("preserves reusable workflow references without changing edge validation", () => {
    const referenced = normalizeWorkflowEditorDocument({
      ...document,
      nodes: [
        {
          ...document.nodes[0]!,
          workflowRef: { documentId: "child-workflow" },
        },
        document.nodes[1]!,
        document.nodes[2]!,
      ],
    });
    const uiNodes = toUiWorkflowBuilderNodes(referenced.nodes);
    uiNodes[0] = { ...uiNodes[0]!, x: 24, y: 36 };
    const movedNodes = fromUiWorkflowBuilderNodes(uiNodes, referenced.nodes);
    const cleared = updateWorkflowEditorNodeWorkflowReference(referenced, "input", null);

    expect(hasWorkflowEditorWorkflowReference(referenced.nodes[0]!)).toBe(true);
    expect(getWorkflowEditorReferencedDocumentIds(referenced)).toEqual(["child-workflow"]);
    expect(movedNodes[0]?.workflowRef).toEqual({ documentId: "child-workflow" });
    expect(
      updateWorkflowEditorNodeWorkflowReference(referenced, "transform", {
        documentId: "review-workflow",
      }).nodes.find((node) => node.id === "transform")?.workflowRef,
    ).toEqual({ documentId: "review-workflow" });
    expect(cleared.nodes[0]?.workflowRef).toBeUndefined();
    expect(
      validateWorkflowEditorConnection(referenced, {
        sourceNodeId: "transform",
        sourcePortId: "out",
        targetNodeId: "output",
        targetPortId: "in",
      }),
    ).toEqual({ valid: true });
  });

  test("creates and restores composed workflow nodes with boundary ports", () => {
    const connected = connectWorkflowEditorNodes(document, {
      sourceNodeId: "transform",
      sourcePortId: "out",
      targetNodeId: "output",
      targetPortId: "in",
    });
    const composedTemplate = createWorkflowEditorComposedNode(connected, ["input", "transform"], {
      id: "ingest-component",
      label: "Ingest component",
    });

    expect(composedTemplate).toMatchObject({
      id: "ingest-component",
      label: "Ingest component",
      outputs: [expect.objectContaining({ id: "out-transform-out", type: { kind: "string" } })],
    });
    expect(composedTemplate?.composition?.nodes.map((node) => node.id)).toEqual([
      "input",
      "transform",
    ]);
    expect(composedTemplate?.composition?.edges.map((edge) => edge.id)).toEqual([
      "input-transform",
    ]);

    const composed = composeWorkflowEditorNodes(connected, ["input", "transform"], {
      id: "ingest-component",
      label: "Ingest component",
    });
    const wrapper = composed.nodes.find((node) => node.id === "ingest-component");

    expect(wrapper && hasWorkflowEditorNodeComposition(wrapper)).toBe(true);
    expect(composed.nodes.map((node) => node.id).sort()).toEqual(["ingest-component", "output"]);
    expect(composed.edges).toEqual([
      expect.objectContaining({
        sourceNodeId: "ingest-component",
        sourcePortId: "out-transform-out",
        targetNodeId: "output",
        targetPortId: "in",
      }),
    ]);

    const uiNodes = toUiWorkflowBuilderNodes(composed.nodes);
    uiNodes[1] = { ...uiNodes[1]!, x: 96, y: 120 };
    expect(fromUiWorkflowBuilderNodes(uiNodes, composed.nodes)[1]?.composition).toEqual(
      wrapper?.composition,
    );

    const restored = restoreWorkflowEditorComposedNode(composed, "ingest-component");

    expect(restored.nodes.map((node) => node.id).sort()).toEqual(["input", "output", "transform"]);
    expect(restored.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceNodeId: "input",
          sourcePortId: "out",
          targetNodeId: "transform",
          targetPortId: "in",
        }),
        expect.objectContaining({
          sourceNodeId: "transform",
          sourcePortId: "out",
          targetNodeId: "output",
          targetPortId: "in",
        }),
      ]),
    );
  });

  test("prevents new edges from closing directed cycles", () => {
    const dag = normalizeWorkflowEditorDocument({
      nodes: [
        {
          id: "a",
          label: "A",
          x: 0,
          y: 0,
          inputs: [{ id: "in", label: "In", type: { kind: "string" } }],
          outputs: [{ id: "out", label: "Out", type: { kind: "string" } }],
        },
        {
          id: "b",
          label: "B",
          x: 220,
          y: 0,
          inputs: [{ id: "in", label: "In", type: { kind: "string" } }],
          outputs: [{ id: "out", label: "Out", type: { kind: "string" } }],
        },
        {
          id: "c",
          label: "C",
          x: 440,
          y: 0,
          inputs: [{ id: "in", label: "In", type: { kind: "string" } }],
          outputs: [{ id: "out", label: "Out", type: { kind: "string" } }],
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

    expect(() =>
      normalizeWorkflowEditorDocument({
        ...dag,
        edges: [
          ...dag.edges,
          {
            id: "c-a",
            ...cycleConnection,
          },
        ],
      }),
    ).toThrow(WorkflowEditorDocumentValidationError);
    const normalized = normalizeWorkflowEditorDocument(
      {
        ...dag,
        edges: [
          ...dag.edges,
          {
            id: "c-a",
            ...cycleConnection,
          },
        ],
      },
      { mode: "repair" },
    );

    expect(normalized.edges.map((edge) => edge.id)).toEqual(["a-b", "b-c"]);
    expect(isWorkflowEditorDirectedAcyclicGraph(normalized)).toBe(true);
  });

  test("validates TypeScript-like port type assignability", () => {
    const userType = {
      kind: "object" as const,
      properties: {
        id: { type: { kind: "string" as const } },
        email: { type: { kind: "string" as const } },
      },
    };
    const adminType = {
      kind: "object" as const,
      properties: {
        permissions: {
          type: { kind: "array" as const, element: { kind: "string" as const } },
        },
      },
    };
    const typeDefinitions = [
      { name: "User", type: userType },
      { name: "AdminUser", extends: ["User"], type: adminType },
    ];

    expect(
      isWorkflowEditorPortTypeAssignable(
        { kind: "ref", name: "AdminUser" },
        { kind: "ref", name: "User" },
        typeDefinitions,
      ),
    ).toBe(true);
    expect(
      isWorkflowEditorPortTypeAssignable(
        { kind: "ref", name: "User" },
        { kind: "ref", name: "AdminUser" },
        typeDefinitions,
      ),
    ).toBe(false);
    expect(
      isWorkflowEditorPortTypeAssignable(
        {
          kind: "object",
          properties: {
            id: { type: { kind: "string" } },
            email: { type: { kind: "string" } },
            role: { type: { kind: "literal", value: "admin" } },
          },
        },
        userType,
      ),
    ).toBe(true);
    expect(
      isWorkflowEditorPortTypeAssignable(
        { kind: "object", properties: { id: { type: { kind: "string" }, optional: true } } },
        { kind: "object", properties: { id: { type: { kind: "string" } } } },
      ),
    ).toBe(false);
    expect(
      isWorkflowEditorPortTypeAssignable({ kind: "literal", value: "ready" }, { kind: "string" }),
    ).toBe(true);
    expect(
      isWorkflowEditorPortTypeAssignable(
        { kind: "union", types: [{ kind: "literal", value: "a" }, { kind: "string" }] },
        { kind: "string" },
      ),
    ).toBe(true);
    expect(
      isWorkflowEditorPortTypeAssignable(
        { kind: "union", types: [{ kind: "string" }, { kind: "number" }] },
        { kind: "string" },
      ),
    ).toBe(false);
    expect(
      isWorkflowEditorPortTypeAssignable(
        { kind: "literal", value: 1 },
        { kind: "union", types: [{ kind: "string" }, { kind: "number" }] },
      ),
    ).toBe(true);
    expect(
      isWorkflowEditorPortTypeAssignable(
        { kind: "array", element: { kind: "literal", value: "active" } },
        { kind: "array", element: { kind: "string" } },
      ),
    ).toBe(true);

    const typedDocument = normalizeWorkflowEditorDocument({
      nodes: [
        {
          id: "admin",
          label: "Admin",
          x: 0,
          y: 0,
          outputs: [{ id: "out", label: "Out", type: { kind: "ref", name: "AdminUser" } }],
        },
        {
          id: "user",
          label: "User",
          x: 240,
          y: 0,
          inputs: [{ id: "in", label: "In", type: { kind: "ref", name: "User" } }],
        },
        {
          id: "admin-sink",
          label: "Admin Sink",
          x: 480,
          y: 0,
          inputs: [{ id: "in", label: "In", type: { kind: "ref", name: "AdminUser" } }],
        },
      ],
      edges: [],
    });

    expect(
      validateWorkflowEditorConnection(
        typedDocument,
        {
          sourceNodeId: "admin",
          sourcePortId: "out",
          targetNodeId: "user",
          targetPortId: "in",
        },
        { typeDefinitions },
      ),
    ).toEqual({ valid: true });
    expect(
      validateWorkflowEditorConnection(
        {
          ...typedDocument,
          nodes: [
            {
              id: "user-source",
              label: "User Source",
              x: 0,
              y: 0,
              outputs: [{ id: "out", label: "Out", type: { kind: "ref", name: "User" } }],
            },
            typedDocument.nodes[2]!,
          ],
        },
        {
          sourceNodeId: "user-source",
          sourcePortId: "out",
          targetNodeId: "admin-sink",
          targetPortId: "in",
        },
        { typeDefinitions },
      ).reason,
    ).toBe("kind-mismatch");

    const missingTypeDocument = normalizeWorkflowEditorDocument({
      nodes: [
        {
          id: "source",
          label: "Source",
          x: 0,
          y: 0,
          outputs: [{ id: "out", label: "Out", type: { kind: "ref", name: "Missing" } }],
        },
        {
          id: "target",
          label: "Target",
          x: 240,
          y: 0,
          inputs: [{ id: "in", label: "In", type: { kind: "string" } }],
        },
      ],
      edges: [
        {
          id: "source-target",
          sourceNodeId: "source",
          sourcePortId: "out",
          targetNodeId: "target",
          targetPortId: "in",
        },
      ],
    });

    expect(analyzeWorkflowEditorPortTypes(missingTypeDocument)).toEqual([
      expect.objectContaining({
        message: "Missing workflow port type definition: Missing",
        type: "missing-type-definition",
      }),
    ]);
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
            inputs: [{ id: "in", label: "In", type: { kind: "string" } }],
            outputs: [{ id: "out", label: "Out", type: { kind: "string" } }],
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

  test("uses type definitions for workbench connection validation", () => {
    const handleDocumentChange = vi.fn();
    const typedDocument = normalizeWorkflowEditorDocument({
      nodes: [
        {
          id: "source",
          label: "Source",
          x: 0,
          y: 0,
          outputs: [{ id: "out", label: "Out", type: { kind: "ref", name: "AdminUser" } }],
        },
        {
          id: "target",
          label: "Target",
          x: 240,
          y: 0,
          inputs: [{ id: "in", label: "In", type: { kind: "ref", name: "User" } }],
        },
      ],
      edges: [],
    });

    render(
      <WorkflowWorkbench
        document={typedDocument}
        typeDefinitions={[
          {
            name: "User",
            type: {
              kind: "object",
              properties: {
                id: { type: { kind: "string" } },
              },
            },
          },
          {
            name: "AdminUser",
            extends: ["User"],
            type: {
              kind: "object",
              properties: {
                permissions: {
                  type: { kind: "array", element: { kind: "string" } },
                },
              },
            },
          },
        ]}
        onDocumentChange={handleDocumentChange}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Start Source Out" })[0]!);
    fireEvent.click(screen.getAllByRole("button", { name: "Connect to Target In" })[0]!);

    expect(handleDocumentChange).toHaveBeenCalledTimes(1);
    expect(handleDocumentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        edges: [
          expect.objectContaining({
            id: "source:out->target:in",
            sourceNodeId: "source",
            sourcePortId: "out",
            targetNodeId: "target",
            targetPortId: "in",
          }),
        ],
      }),
    );
  });

  test("assigns workflow references from the default inspector", () => {
    const handleDocumentChange = vi.fn();
    render(
      <WorkflowWorkbench
        document={document}
        selectedNodeId="input"
        documentReferences={[{ id: "child", name: "Child workflow" }]}
        onDocumentChange={handleDocumentChange}
      />,
    );

    fireEvent.click(screen.getAllByLabelText("Workflow document")[0]!);
    fireEvent.click(screen.getByRole("option", { name: "Child workflow" }));
    fireEvent.click(
      screen
        .getAllByRole("button", { name: "Apply" })
        .find((button) => !(button as HTMLButtonElement).disabled)!,
    );

    expect(handleDocumentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: expect.arrayContaining([
          expect.objectContaining({
            id: "input",
            workflowRef: { documentId: "child" },
          }),
        ]),
      }),
    );
  });

  test("edits built-in JSON source values from the default inspector", () => {
    const handleDocumentChange = vi.fn();
    const sourceDocument = normalizeWorkflowEditorDocument({
      nodes: [
        {
          id: "flag",
          label: "Flag",
          kind: "json.boolean",
          category: "JSON",
          x: 0,
          y: 0,
          outputs: [{ id: "value", label: "Value", type: { kind: "boolean" } }],
          data: { value: false },
        },
      ],
      edges: [],
    });

    render(
      <WorkflowWorkbench
        document={sourceDocument}
        selectedNodeId="flag"
        onDocumentChange={handleDocumentChange}
      />,
    );

    fireEvent.click(screen.getAllByLabelText("Value")[0]!);
    fireEvent.click(screen.getByRole("option", { name: "True" }));
    fireEvent.click(
      screen
        .getAllByRole("button", { name: "Apply" })
        .find((button) => !(button as HTMLButtonElement).disabled)!,
    );

    expect(handleDocumentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: [
          expect.objectContaining({
            id: "flag",
            data: { value: true },
          }),
        ],
      }),
    );
  });

  test("creates and opens referenced workflows with breadcrumbs in the editor shell", async () => {
    const handlePathChange = vi.fn();
    const storage = {
      loadLibrary: vi.fn(async () => null),
      saveLibrary: vi.fn(async () => {}),
    };
    const initialLibrary = createWorkflowEditorLibrary({
      activeDocumentId: "parent",
      documents: [
        createWorkflowEditorEntry({
          id: "parent",
          name: "Parent",
          document,
        }),
      ],
    });

    render(
      <WorkflowEditor
        initialLibrary={initialLibrary}
        storage={storage}
        onDocumentPathChange={handlePathChange}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId("active-node-count").textContent).toBe("3 nodes"),
    );
    fireEvent.click(screen.getAllByText("Input")[1]!);
    fireEvent.click(
      screen
        .getAllByRole("button", { name: "Create nested workflow" })
        .find((button) => !(button as HTMLButtonElement).disabled)!,
    );

    await waitFor(() =>
      expect(screen.getByTestId("active-node-count").textContent).toBe("0 nodes"),
    );
    expect((screen.getByRole("button", { name: "Parent" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
    expect(
      (screen.getByRole("button", { name: "Input Workflow" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(handlePathChange).toHaveBeenLastCalledWith([
      { documentId: "parent" },
      expect.objectContaining({ documentId: expect.stringMatching(/^workflow-/) }),
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Parent" }));
    await waitFor(() =>
      expect(screen.getByTestId("active-node-count").textContent).toBe("3 nodes"),
    );
  });

  test("allows recursive drill-in until the configured editor depth", async () => {
    const storage = {
      loadLibrary: vi.fn(async () => null),
      saveLibrary: vi.fn(async () => {}),
    };
    const recursiveDocument = normalizeWorkflowEditorDocument({
      nodes: [
        {
          id: "self",
          label: "Self",
          x: 0,
          y: 0,
          workflowRef: { documentId: "recursive" },
        },
      ],
      edges: [],
    });
    const initialLibrary = createWorkflowEditorLibrary({
      activeDocumentId: "recursive",
      documents: [
        createWorkflowEditorEntry({
          id: "recursive",
          name: "Recursive",
          document: recursiveDocument,
        }),
      ],
    });

    render(
      <WorkflowEditor
        initialLibrary={initialLibrary}
        storage={storage}
        maxNestedWorkflowDepth={2}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId("active-node-count").textContent).toBe("1 nodes"),
    );
    fireEvent.click(screen.getAllByText("Self")[1]!);
    fireEvent.click(
      screen
        .getAllByRole("button", { name: "Open workflow" })
        .find((button) => !(button as HTMLButtonElement).disabled)!,
    );
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: "Recursive" })).toHaveLength(2),
    );
    fireEvent.click(screen.getAllByText("Self")[1]!);
    const cappedOpenButtons = screen.queryAllByRole("button", { name: "Open workflow" });
    expect(cappedOpenButtons.every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
  });
});
