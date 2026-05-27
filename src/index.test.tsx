import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getWorkflowNodeSize } from "@moritzbrantner/ui/labs";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import {
  WorkflowEditor,
  WorkflowEditorDocumentValidationError,
  WorkflowWorkbench,
  addWorkflowEditorArrayConstructorInput,
  addWorkflowEditorNode,
  addWorkflowEditorObjectDecompositionOutput,
  addWorkflowEditorObjectConstructorInput,
  activeWorkflowEditorEntry,
  analyzeWorkflowEditorPortTypes,
  buildWorkflowEditorDocumentFile,
  canRedoWorkflowEditorHistory,
  canUndoWorkflowEditorHistory,
  commitWorkflowEditorHistory,
  composeWorkflowEditorNodes,
  connectWorkflowEditorNodes,
  copyWorkflowEditorSelection,
  createLocalStorageWorkflowEditorStorage,
  createWorkflowEditorComposedNode,
  createWorkflowEditorDocumentContext,
  createWorkflowEditorEntry,
  createWorkflowEditorGraphIndex,
  createWorkflowEditorHistory,
  createWorkflowEditorLibrary,
  createWorkflowEditorVersion,
  defaultWorkflowEditorNodeTemplates,
  decodeWorkflowEditorSharePayload,
  detectWorkflowEditorCycles,
  duplicateWorkflowEditorNode,
  duplicateWorkflowEditorSelection,
  duplicateWorkflowEditorEntry,
  encodeWorkflowEditorSharePayload,
  findWorkflowEditorNode,
  formatWorkflowEditorArrayConstructorExpression,
  formatWorkflowEditorObjectDecompositionExpression,
  formatWorkflowEditorObjectConstructorExpression,
  fromUiWorkflowBuilderEdges,
  fromUiWorkflowBuilderNodes,
  getWorkflowEditorArrayConstructorInputs,
  getWorkflowEditorObjectConstructorInputs,
  getWorkflowEditorObjectDecompositionOutputs,
  getWorkflowEditorReferenceDiagnostics,
  getWorkflowEditorReferencedDocumentIds,
  hasWorkflowEditorNodeComposition,
  hasWorkflowEditorWorkflowReference,
  isWorkflowEditorArrayConstructorNode,
  isWorkflowEditorObjectConstructorNode,
  isWorkflowEditorObjectDecompositionNode,
  isWorkflowEditorDirectedAcyclicGraph,
  isWorkflowEditorPortTypeAssignable,
  layoutWorkflowEditorDocument,
  listWorkflowEditorDocumentReferenceOptions,
  loadWorkflowEditorLibrary,
  moveWorkflowEditorNode,
  normalizeWorkflowEditorDocument,
  normalizeWorkflowEditorSelection,
  pasteWorkflowEditorClipboardPayload,
  parseWorkflowEditorDocumentFile,
  removeWorkflowEditorArrayConstructorInput,
  removeWorkflowEditorSelection,
  removeWorkflowEditorNode,
  removeWorkflowEditorObjectDecompositionOutput,
  removeWorkflowEditorObjectConstructorInput,
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
  updateWorkflowEditorObjectDecompositionPropertiesInNode,
  updateWorkflowEditorObjectConstructorPropertiesInNode,
  validateWorkflowEditorDocument,
  validateWorkflowEditorConnection,
  wouldCreateWorkflowEditorCycle,
  workflowEditorCollectionNodeTemplates,
  workflowEditorControlFlowNodeTemplates,
  workflowEditorDocumentFileVersion,
  workflowEditorJsonNodeTemplates,
  type WorkflowEditorDocument,
  type WorkflowEditorPortType,
  type WorkflowEditorSelectionState,
  type WorkflowEditorTypeDefinition,
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

function StatefulWorkbench({
  initialDocument = document,
  initialSelection = { nodeIds: [], edgeIds: [] },
  readOnly = false,
  documentReferences,
}: {
  initialDocument?: WorkflowEditorDocument;
  initialSelection?: WorkflowEditorSelectionState;
  readOnly?: boolean;
  documentReferences?: Array<{ id: string; name: string }>;
}) {
  const [currentDocument, setCurrentDocument] = useState(initialDocument);
  const [selection, setSelection] = useState(initialSelection);

  return (
    <>
      <WorkflowWorkbench
        document={currentDocument}
        selectedNodeIds={selection.nodeIds}
        selectedEdgeIds={selection.edgeIds}
        readOnly={readOnly}
        documentReferences={documentReferences}
        onDocumentChange={setCurrentDocument}
        onSelectionStateChange={setSelection}
      />
      <pre data-testid="stateful-document-json">{JSON.stringify(currentDocument)}</pre>
      <pre data-testid="stateful-selection-json">{JSON.stringify(selection)}</pre>
    </>
  );
}

function readStatefulDocument() {
  return JSON.parse(screen.getByTestId("stateful-document-json").textContent ?? "") as
    | WorkflowEditorDocument
    | never;
}

function readStatefulSelection() {
  return JSON.parse(screen.getByTestId("stateful-selection-json").textContent ?? "") as
    | WorkflowEditorSelectionState
    | never;
}

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
  test("provides built-in control flow, JSON, and collection node templates", () => {
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
    const objectDecomposeTemplate = workflowEditorJsonNodeTemplates.find(
      (template) => template.id === "json-object-decompose",
    );
    const filterTemplate = workflowEditorCollectionNodeTemplates.find(
      (template) => template.id === "collection-filter",
    );
    const reduceTemplate = workflowEditorCollectionNodeTemplates.find(
      (template) => template.id === "collection-reduce",
    );
    const aggregateTemplate = workflowEditorCollectionNodeTemplates.find(
      (template) => template.id === "collection-aggregate",
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
        "json-object-decompose",
        "collection-filter",
        "collection-reduce",
        "collection-aggregate",
      ]),
    );
    expect(branchTemplate?.inputs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "condition", type: { kind: "boolean" } }),
      ]),
    );
    expect(stringTemplate?.outputs?.[0]?.type).toEqual({ kind: "string" });
    expect(stringTemplate?.minimized).toBe(true);
    expect(arrayTemplate?.outputs?.[0]?.type).toEqual({
      kind: "array",
      element: { kind: "any" },
    });
    expect(arrayTemplate?.inputs?.[0]).toEqual(
      expect.objectContaining({
        id: "item-add",
        label: "Add item",
        metadata: { arrayConstructorRole: "add-item" },
      }),
    );
    expect(objectTemplate?.outputs?.[0]?.type).toEqual({ kind: "object" });
    expect(objectDecomposeTemplate?.inputs?.[0]?.type).toEqual({ kind: "object" });
    expect(filterTemplate?.inputs?.[0]?.type).toEqual({
      kind: "array",
      element: { kind: "any" },
    });
    expect(filterTemplate?.inputs?.[1]?.type).toEqual({ kind: "boolean" });
    expect(reduceTemplate?.outputs?.[0]?.type).toEqual({ kind: "any" });
    expect(aggregateTemplate?.outputs?.[0]?.type).toEqual({
      kind: "object",
      properties: expect.objectContaining({
        count: { type: { kind: "number" } },
      }),
    });
  });

  test("validates collection node template schemas and compatible typed connections", () => {
    const [filterTemplate, reduceTemplate, aggregateTemplate] = [
      workflowEditorCollectionNodeTemplates.find((template) => template.id === "collection-filter"),
      workflowEditorCollectionNodeTemplates.find((template) => template.id === "collection-reduce"),
      workflowEditorCollectionNodeTemplates.find(
        (template) => template.id === "collection-aggregate",
      ),
    ];

    expect(
      validateWorkflowEditorDocument({
        nodes: workflowEditorCollectionNodeTemplates.map((template, index) =>
          Object.assign({}, template, { x: index * 240, y: 0 }),
        ),
        edges: [],
      }),
    ).toEqual([]);

    const collectionDocument = normalizeWorkflowEditorDocument<Record<string, unknown>>({
      nodes: [
        {
          id: "events",
          label: "Events",
          x: 0,
          y: 0,
          outputs: [
            {
              id: "items",
              label: "Items",
              type: { kind: "array", element: { kind: "number" } },
            },
          ],
        },
        {
          ...filterTemplate!,
          id: "filter",
          x: 240,
          y: 0,
        },
        {
          ...reduceTemplate!,
          id: "reduce",
          x: 480,
          y: 0,
        },
        {
          ...aggregateTemplate!,
          id: "aggregate",
          x: 720,
          y: 0,
        },
        {
          id: "summary",
          label: "Summary",
          x: 960,
          y: 0,
          inputs: [
            {
              id: "in",
              label: "In",
              type: {
                kind: "object",
                properties: {
                  count: { type: { kind: "number" } },
                },
              },
            },
          ],
        },
      ],
      edges: [],
    });
    const filtered = connectWorkflowEditorNodes(collectionDocument, {
      sourceNodeId: "events",
      sourcePortId: "items",
      targetNodeId: "filter",
      targetPortId: "items",
    });
    const reduced = connectWorkflowEditorNodes(filtered, {
      sourceNodeId: "filter",
      sourcePortId: "items",
      targetNodeId: "reduce",
      targetPortId: "items",
    });
    const aggregated = connectWorkflowEditorNodes(reduced, {
      sourceNodeId: "filter",
      sourcePortId: "items",
      targetNodeId: "aggregate",
      targetPortId: "items",
    });
    const summarized = connectWorkflowEditorNodes(aggregated, {
      sourceNodeId: "aggregate",
      sourcePortId: "summary",
      targetNodeId: "summary",
      targetPortId: "in",
    });

    expect(summarized.edges).toHaveLength(4);
    expect(validateWorkflowEditorDocument(summarized)).toEqual([]);
    expect(analyzeWorkflowEditorPortTypes(summarized)).toEqual([]);
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

    const renamedObjectNode = updateWorkflowEditorObjectConstructorPropertiesInNode(objectNode, {
      firstname: "givenName",
    });
    expect(getWorkflowEditorObjectConstructorInputs(renamedObjectNode)[0]).toEqual(
      expect.objectContaining({ id: "firstname", label: "givenName" }),
    );
    expect(renamedObjectNode.outputs?.[0]?.type).toEqual({
      kind: "object",
      properties: { givenName: { type: { kind: "string" } } },
    });

    const expanded = addWorkflowEditorObjectConstructorInput(connected, "employee-object", {
      propertyKey: "lastName",
    });
    expect(
      getWorkflowEditorObjectConstructorInputs(
        findWorkflowEditorNode(expanded, "employee-object")!,
      ),
    ).toHaveLength(2);

    const explicitPortId = addWorkflowEditorObjectConstructorInput(connected, "employee-object", {
      portId: "trialDays",
      propertyKey: "trialDays",
    });
    expect(
      getWorkflowEditorObjectConstructorInputs(
        findWorkflowEditorNode(explicitPortId, "employee-object")!,
      ),
    ).toContainEqual(expect.objectContaining({ id: "trialDays", label: "trialDays" }));

    const withoutLastName = removeWorkflowEditorObjectConstructorInput(
      expanded,
      "employee-object",
      "lastname",
    );
    expect(
      getWorkflowEditorObjectConstructorInputs(
        findWorkflowEditorNode(withoutLastName, "employee-object")!,
      ),
    ).toHaveLength(1);

    const withoutFirstName = removeWorkflowEditorObjectConstructorInput(
      connected,
      "employee-object",
      "firstname",
    );
    const emptiedObjectNode = findWorkflowEditorNode(withoutFirstName, "employee-object")!;

    expect(withoutFirstName.edges).toHaveLength(0);
    expect(emptiedObjectNode.outputs?.[0]?.type).toEqual({
      kind: "object",
      properties: {},
    });
  });

  test("decomposes object nodes with expandable named outputs", () => {
    const decomposeTemplate = workflowEditorJsonNodeTemplates.find(
      (template) => template.id === "json-object-decompose",
    )!;
    const leadType = {
      kind: "object",
      properties: {
        email: { type: { kind: "string" } },
        score: { type: { kind: "number" } },
      },
    } satisfies WorkflowEditorPortType;
    const decomposeDocument = normalizeWorkflowEditorDocument<Record<string, unknown>>({
      nodes: [
        {
          id: "lead",
          label: "Lead",
          x: 0,
          y: 0,
          outputs: [{ id: "value", label: "Value", type: leadType }],
        },
        {
          ...decomposeTemplate,
          id: "split-lead",
          x: 240,
          y: 0,
        },
        {
          id: "email-target",
          label: "Email target",
          x: 480,
          y: 0,
          inputs: [{ id: "email", label: "Email", type: { kind: "string" } }],
        },
      ],
      edges: [],
    });
    const withInput = connectWorkflowEditorNodes(decomposeDocument, {
      sourceNodeId: "lead",
      sourcePortId: "value",
      targetNodeId: "split-lead",
      targetPortId: "object",
    });
    const connected = connectWorkflowEditorNodes(withInput, {
      sourceNodeId: "split-lead",
      sourcePortId: "property",
      targetNodeId: "email-target",
      targetPortId: "email",
    });
    const decomposeNode = findWorkflowEditorNode(connected, "split-lead")!;

    expect(isWorkflowEditorObjectDecompositionNode(decomposeNode)).toBe(true);
    expect(connected.edges[1]).toEqual(
      expect.objectContaining({
        sourceNodeId: "split-lead",
        sourcePortId: "email",
      }),
    );
    expect(getWorkflowEditorObjectDecompositionOutputs(decomposeNode)).toEqual([
      expect.objectContaining({
        id: "email",
        label: "email",
        badge: "object.email",
        type: { kind: "string" },
      }),
    ]);
    expect(decomposeNode.outputs?.at(-1)).toEqual(
      expect.objectContaining({ id: "property", label: "Add property" }),
    );
    expect(formatWorkflowEditorObjectDecompositionExpression(decomposeNode)).toBe(
      "email = object.email",
    );

    const renamedDecomposeNode = updateWorkflowEditorObjectDecompositionPropertiesInNode(
      decomposeNode,
      {
        email: "score",
      },
    );
    expect(getWorkflowEditorObjectDecompositionOutputs(renamedDecomposeNode)[0]).toEqual(
      expect.objectContaining({ id: "email", label: "score", type: { kind: "number" } }),
    );

    const expanded = addWorkflowEditorObjectDecompositionOutput(connected, "split-lead", {
      propertyKey: "score",
    });
    expect(
      getWorkflowEditorObjectDecompositionOutputs(findWorkflowEditorNode(expanded, "split-lead")!),
    ).toEqual([
      expect.objectContaining({ id: "email", type: { kind: "string" } }),
      expect.objectContaining({ id: "score", type: { kind: "number" } }),
    ]);

    const withoutScore = removeWorkflowEditorObjectDecompositionOutput(
      expanded,
      "split-lead",
      "score",
    );
    expect(
      getWorkflowEditorObjectDecompositionOutputs(
        findWorkflowEditorNode(withoutScore, "split-lead")!,
      ),
    ).toHaveLength(1);

    const withoutEmail = removeWorkflowEditorObjectDecompositionOutput(
      connected,
      "split-lead",
      "email",
    );

    expect(withoutEmail.edges.map((edge) => edge.id)).toEqual(["lead:value->split-lead:object"]);
    expect(
      getWorkflowEditorObjectDecompositionOutputs(
        findWorkflowEditorNode(withoutEmail, "split-lead")!,
      ),
    ).toHaveLength(0);
  });

  test("constructs array nodes with expandable item inputs", () => {
    const arrayTemplate = workflowEditorJsonNodeTemplates.find(
      (template) => template.id === "json-array",
    )!;
    const arrayDocument = normalizeWorkflowEditorDocument<Record<string, unknown>>({
      nodes: [
        {
          id: "name",
          label: "Name",
          x: 0,
          y: 0,
          outputs: [{ id: "value", label: "Value", type: { kind: "string" } }],
        },
        {
          id: "age",
          label: "Age",
          x: 0,
          y: 160,
          outputs: [{ id: "value", label: "Value", type: { kind: "number" } }],
        },
        {
          ...arrayTemplate,
          id: "items",
          x: 240,
          y: 0,
        },
      ],
      edges: [],
    });

    const withName = connectWorkflowEditorNodes(arrayDocument, {
      sourceNodeId: "name",
      sourcePortId: "value",
      targetNodeId: "items",
      targetPortId: "item-add",
    });
    const nameArrayNode = findWorkflowEditorNode(withName, "items")!;

    expect(isWorkflowEditorArrayConstructorNode(nameArrayNode)).toBe(true);
    expect(withName.edges[0]).toEqual(
      expect.objectContaining({
        targetNodeId: "items",
        targetPortId: "item",
      }),
    );
    expect(getWorkflowEditorArrayConstructorInputs(nameArrayNode)).toEqual([
      expect.objectContaining({
        id: "item",
        label: "Item 1",
        badge: "name",
        type: { kind: "string" },
      }),
    ]);
    expect(nameArrayNode.outputs?.[0]?.type).toEqual({
      kind: "array",
      element: { kind: "string" },
    });
    expect(formatWorkflowEditorArrayConstructorExpression(nameArrayNode)).toBe("[\n  name\n]");

    const withAge = connectWorkflowEditorNodes(withName, {
      sourceNodeId: "age",
      sourcePortId: "value",
      targetNodeId: "items",
      targetPortId: "item",
    });
    const mixedArrayNode = findWorkflowEditorNode(withAge, "items")!;

    expect(withAge.edges.at(-1)).toEqual(
      expect.objectContaining({
        targetNodeId: "items",
        targetPortId: "item-2",
      }),
    );
    expect(mixedArrayNode.outputs?.[0]?.type).toEqual({
      kind: "array",
      element: {
        kind: "union",
        types: [{ kind: "string" }, { kind: "number" }],
      },
    });

    const expanded = addWorkflowEditorArrayConstructorInput(withAge, "items");
    expect(
      getWorkflowEditorArrayConstructorInputs(findWorkflowEditorNode(expanded, "items")!),
    ).toHaveLength(3);

    const withoutAge = removeWorkflowEditorArrayConstructorInput(withAge, "items", "item-2");
    const stringArrayNode = findWorkflowEditorNode(withoutAge, "items")!;

    expect(withoutAge.edges).toHaveLength(1);
    expect(stringArrayNode.outputs?.[0]?.type).toEqual({
      kind: "array",
      element: { kind: "string" },
    });

    const legacy = normalizeWorkflowEditorDocument<Record<string, unknown>>({
      nodes: [
        {
          id: "legacy-array",
          label: "Legacy array",
          kind: "json.array",
          x: 0,
          y: 0,
          inputs: [{ id: "item", label: "Item", type: { kind: "string" } }],
          outputs: [
            { id: "value", label: "Value", type: { kind: "array", element: { kind: "string" } } },
          ],
        },
      ],
      edges: [],
    });
    const legacyNode = findWorkflowEditorNode(legacy, "legacy-array")!;

    expect(getWorkflowEditorArrayConstructorInputs(legacyNode)).toEqual([
      expect.objectContaining({ id: "item", label: "Item 1" }),
    ]);
    expect(legacyNode.inputs?.at(-1)).toEqual(
      expect.objectContaining({ id: "item-add", label: "Add item" }),
    );
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
    const documentContext = createWorkflowEditorDocumentContext(duplicated);
    const graphIndex = createWorkflowEditorGraphIndex(duplicated);

    expect(documentContext.nodeById.get("review")?.label).toBe("Human review");
    expect(documentContext.edgeById.get("input-transform")?.sourceNodeId).toBe("input");
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

  test("maps structured port types to stable UI labels and colors without mutating document types", () => {
    const typedDocument = normalizeWorkflowEditorDocument({
      nodes: [
        {
          id: "source",
          label: "Source",
          x: 0,
          y: 0,
          outputs: [
            { id: "string", label: "String", type: { kind: "string" } },
            { id: "number", label: "Number", type: { kind: "number" } },
            { id: "boolean", label: "Boolean", type: { kind: "boolean" } },
            { id: "object", label: "Object", type: { kind: "object" } },
            { id: "array", label: "Array", type: { kind: "array", element: { kind: "string" } } },
            { id: "ref", label: "Ref", type: { kind: "ref", name: "Lead" } },
            {
              id: "custom",
              label: "Custom",
              type: { kind: "ref", name: "Incident" },
              color: "#123456",
            },
          ],
        },
        {
          id: "target",
          label: "Target",
          x: 360,
          y: 0,
          inputs: [{ id: "in", label: "In", type: { kind: "string" } }],
        },
      ],
      edges: [
        {
          id: "source-string-target-in",
          sourceNodeId: "source",
          sourcePortId: "string",
          targetNodeId: "target",
          targetPortId: "in",
        },
      ],
    });

    const uiNodes = toUiWorkflowBuilderNodes(typedDocument.nodes);
    const outputPorts = uiNodes[0]!.outputs!;

    expect(outputPorts.map((port) => port.color)).toEqual([
      "#0891b2",
      "#16a34a",
      "#ca8a04",
      "#4f46e5",
      "#9333ea",
      expect.any(String),
      "#123456",
    ]);
    expect(outputPorts[0]).toMatchObject({
      type: { label: "string", source: "string" },
    });
    expect(outputPorts[4]).toMatchObject({
      type: { label: "string[]", source: "array:string" },
    });
    expect(outputPorts[5]).toMatchObject({
      type: { label: "Lead", source: "ref:Lead" },
    });

    const uiEdges = toUiWorkflowBuilderEdges(typedDocument.edges, typedDocument.nodes);
    expect(uiEdges[0]).toMatchObject({ color: "#0891b2" });

    const movedNodes = fromUiWorkflowBuilderNodes(
      uiNodes.map((node) =>
        node.id === "source" ? Object.assign({}, node, { minimized: true, x: 24 }) : node,
      ),
      typedDocument.nodes,
    );
    expect(movedNodes[0]?.outputs?.[0]?.type).toEqual({ kind: "string" });
    expect(movedNodes[0]?.outputs?.[4]?.type).toEqual({
      kind: "array",
      element: { kind: "string" },
    });
  });

  test("hides visible input and output headers in the workflow workbench", () => {
    render(<WorkflowWorkbench document={document} />);

    expect(screen.queryByText("Inputs")).toBeNull();
    expect(screen.queryByText("Outputs")).toBeNull();
  });

  test("copies, pastes, duplicates, and removes selected subgraphs", () => {
    const selection = normalizeWorkflowEditorSelection(document, {
      nodeIds: ["transform", "input", "input"],
      edgeIds: [],
      primary: { type: "node", id: "transform" },
    });
    expect(selection.nodeIds).toEqual(["input", "transform"]);

    const payload = copyWorkflowEditorSelection(document, selection, {
      copiedAt: "2026-05-27T00:00:00.000Z",
      sourceDocumentId: "demo",
    });
    expect(payload.nodes.map((node) => node.id)).toEqual(["input", "transform"]);
    expect(payload.edges.map((edge) => edge.id)).toEqual(["input-transform"]);
    expect(payload.sourceDocumentId).toBe("demo");

    const pasted = pasteWorkflowEditorClipboardPayload(document, payload);
    expect(pasted.nodeIds).toEqual(["input-copy", "transform-copy"]);
    expect(pasted.edgeIds).toEqual(["input-copy:out->transform-copy:in"]);
    expect(pasted.document.nodes.find((node) => node.id === "input-copy")).toEqual(
      expect.objectContaining({ x: 48, y: 48, outputs: document.nodes[0]?.outputs }),
    );
    expect(pasted.document.edges).toContainEqual(
      expect.objectContaining({
        id: "input-copy:out->transform-copy:in",
        sourceNodeId: "input-copy",
        targetNodeId: "transform-copy",
      }),
    );

    const edgePayload = copyWorkflowEditorSelection(document, {
      nodeIds: [],
      edgeIds: ["input-transform"],
      primary: { type: "edge", id: "input-transform" },
    });
    expect(edgePayload.nodes.map((node) => node.id)).toEqual(["input", "transform"]);
    expect(edgePayload.edges.map((edge) => edge.id)).toEqual(["input-transform"]);

    const duplicated = duplicateWorkflowEditorSelection(document, {
      nodeIds: ["input", "transform"],
      edgeIds: [],
    });
    expect(duplicated.nodeIds).toEqual(["input-copy", "transform-copy"]);
    expect(duplicated.document.nodes).toHaveLength(5);

    const removed = removeWorkflowEditorSelection(document, {
      nodeIds: ["input"],
      edgeIds: [],
    });
    expect(removed.nodes.map((node) => node.id)).toEqual(["transform", "output"]);
    expect(removed.edges).toHaveLength(0);

    expect(() =>
      pasteWorkflowEditorClipboardPayload(document, {
        ...payload,
        version: 999 as 1,
      }),
    ).toThrow("Invalid workflow editor clipboard payload");
  });

  test("lays out whole documents, selections, and cyclic graphs", () => {
    const laidOut = layoutWorkflowEditorDocument(document);
    const input = laidOut.document.nodes.find((node) => node.id === "input")!;
    const transform = laidOut.document.nodes.find((node) => node.id === "transform")!;
    expect(transform.x).toBeGreaterThan(input.x);
    expect(laidOut.cycles).toEqual([]);

    const vertical = layoutWorkflowEditorDocument(document, { direction: "down" });
    expect(vertical.document.nodes.find((node) => node.id === "transform")!.y).toBeGreaterThan(
      vertical.document.nodes.find((node) => node.id === "input")!.y,
    );

    const selected = layoutWorkflowEditorDocument(
      normalizeWorkflowEditorDocument({
        nodes: [
          {
            id: "a",
            label: "A",
            x: 100,
            y: 50,
            outputs: [{ id: "out", label: "Out", type: { kind: "string" } }],
          },
          { id: "b", label: "B", x: 0, y: 0 },
          {
            id: "c",
            label: "C",
            x: 200,
            y: 100,
            inputs: [{ id: "in", label: "In", type: { kind: "string" } }],
          },
        ],
        edges: [
          {
            id: "a-c",
            sourceNodeId: "a",
            sourcePortId: "out",
            targetNodeId: "c",
            targetPortId: "in",
          },
        ],
      }),
      { nodeIds: ["a", "c"] },
    );
    expect(selected.document.nodes.find((node) => node.id === "b")).toEqual(
      expect.objectContaining({ x: 0, y: 0 }),
    );
    expect(
      Math.min(...selected.document.nodes.filter((node) => node.id !== "b").map((node) => node.x)),
    ).toBe(100);

    const cyclic: WorkflowEditorDocument = {
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
          x: 100,
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
          id: "b-a",
          sourceNodeId: "b",
          sourcePortId: "out",
          targetNodeId: "a",
          targetPortId: "in",
        },
      ],
    } satisfies WorkflowEditorDocument;
    const cyclicLayout = layoutWorkflowEditorDocument(cyclic);
    expect(cyclicLayout.cycles).toHaveLength(1);
    expect(cyclicLayout.document.nodes.every((node) => Number.isFinite(node.x))).toBe(true);
  });

  test("uses rendered node dimensions when laying out sibling nodes", () => {
    const tallDocument = normalizeWorkflowEditorDocument({
      nodes: [
        {
          id: "wide-ports-a",
          label: "Wide Ports A",
          x: 0,
          y: 0,
          outputs: Array.from({ length: 8 }, (_, index) => ({
            id: `out-${index}`,
            label: `Out ${index}`,
            type: { kind: "string" as const },
          })),
        },
        {
          id: "wide-ports-b",
          label: "Wide Ports B",
          x: 0,
          y: 0,
          outputs: Array.from({ length: 8 }, (_, index) => ({
            id: `out-${index}`,
            label: `Out ${index}`,
            type: { kind: "string" as const },
          })),
        },
      ],
      edges: [],
    });

    const result = layoutWorkflowEditorDocument(tallDocument, { nodeSeparation: 0 });
    const first = result.document.nodes.find((node) => node.id === "wide-ports-a")!;
    const second = result.document.nodes.find((node) => node.id === "wide-ports-b")!;
    const firstSize = getWorkflowNodeSize(toUiWorkflowBuilderNodes([first])[0]!, {
      showPortColumnHeaders: false,
    });
    const secondSize = getWorkflowNodeSize(toUiWorkflowBuilderNodes([second])[0]!, {
      showPortColumnHeaders: false,
    });
    const verticalGap =
      Math.max(first.y, second.y) -
      Math.min(first.y + firstSize.height, second.y + secondSize.height);

    expect(verticalGap).toBeGreaterThanOrEqual(0);
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

    const cyclic: WorkflowEditorDocument = {
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
          x: 0,
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

    const missingPort: WorkflowEditorDocument = {
      nodes: [
        {
          id: "source",
          label: "Source",
          x: 0,
          y: 0,
          outputs: [{ id: "out", label: "Out", type: { kind: "string" } }],
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
          id: "missing-port",
          sourceNodeId: "source",
          sourcePortId: "missing",
          targetNodeId: "target",
          targetPortId: "in",
        },
      ],
    };

    expect(
      validateWorkflowEditorDocument(missingPort).map((diagnostic) => diagnostic.code),
    ).toContain("missing-edge-port");
    expect(() => normalizeWorkflowEditorDocument(missingPort)).toThrow(
      WorkflowEditorDocumentValidationError,
    );
    expect(normalizeWorkflowEditorDocument(missingPort, { mode: "repair" }).edges).toHaveLength(0);
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
    const typeDefinitions: readonly WorkflowEditorTypeDefinition[] = [
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

    fireEvent.click(screen.getByRole("button", { name: "Input" }));
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

  test("supports controlled multi-selection and keyboard selection shortcuts", () => {
    const handleSelectionStateChange = vi.fn();
    const handleSelectionChange = vi.fn();

    render(
      <WorkflowWorkbench
        document={document}
        selectedNodeIds={["input", "transform"]}
        onSelectionChange={handleSelectionChange}
        onSelectionStateChange={handleSelectionStateChange}
        renderInspector={(context) => (
          <div data-testid="selected-node-labels">
            {context.selectedNodes.map((node) => node.label).join(",")}
          </div>
        )}
      />,
    );

    expect(screen.getAllByTestId("selected-node-labels")[0]?.textContent).toBe("Input,Transform");
    expect(screen.getAllByTestId("selection-count")[0]?.textContent).toBe("2 selected");

    fireEvent.keyDown(window, { key: "a", metaKey: true });
    expect(handleSelectionStateChange).toHaveBeenLastCalledWith({
      nodeIds: ["input", "transform", "output"],
      edgeIds: [],
      primary: { type: "node", id: "input" },
    });
    expect(handleSelectionChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "input", type: "node" }),
    );
  });

  test("duplicates and arranges selected nodes from the workbench toolbar", () => {
    const handleDocumentChange = vi.fn();

    const { rerender } = render(
      <WorkflowWorkbench
        document={document}
        selectedNodeIds={["input", "transform"]}
        onDocumentChange={handleDocumentChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));
    expect(handleDocumentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: expect.arrayContaining([
          expect.objectContaining({ id: "input-copy" }),
          expect.objectContaining({ id: "transform-copy" }),
        ]),
        edges: expect.arrayContaining([
          expect.objectContaining({
            sourceNodeId: "input-copy",
            targetNodeId: "transform-copy",
          }),
        ]),
      }),
    );

    handleDocumentChange.mockClear();
    rerender(
      <WorkflowWorkbench
        document={document}
        selectedNodeIds={["input", "transform"]}
        onDocumentChange={handleDocumentChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Arrange selection" }));
    expect(handleDocumentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: expect.arrayContaining([
          expect.objectContaining({ id: "input", x: 0 }),
          expect.objectContaining({ id: "output", x: 480, y: 0 }),
        ]),
      }),
    );

    handleDocumentChange.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Arrange all" }));
    expect(handleDocumentChange).toHaveBeenCalled();
  });

  test("snaps dragged nodes to compatible ports even when the edge already exists", () => {
    const handleDocumentChange = vi.fn();
    render(<WorkflowWorkbench document={document} onDocumentChange={handleDocumentChange} />);

    const inputWidth = getWorkflowNodeSize(toUiWorkflowBuilderNodes([document.nodes[0]!])[0]!, {
      showPortColumnHeaders: false,
    }).width;
    const transformNode = globalThis.document.querySelector<HTMLElement>(
      "[data-slot='workflow-builder-node'][data-node-id='transform']",
    )!;
    const surface = globalThis.document.querySelector<HTMLElement>(
      "[data-slot='workflow-builder-surface']",
    )!;

    fireEvent.mouseDown(transformNode, { button: 0, clientX: 0, clientY: 0 });
    fireEvent.mouseMove(surface, {
      clientX: inputWidth + 20 - document.nodes[1]!.x,
      clientY: 0,
    });

    expect(handleDocumentChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        nodes: expect.arrayContaining([
          expect.objectContaining({ id: "transform", x: inputWidth, y: 0 }),
        ]),
        edges: expect.arrayContaining([
          expect.objectContaining({
            id: "input-transform",
            sourceNodeId: "input",
            targetNodeId: "transform",
          }),
        ]),
      }),
    );
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

    const typeDefinitions: readonly WorkflowEditorTypeDefinition[] = [
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
    ];
    const connected = connectWorkflowEditorNodes(
      typedDocument,
      {
        sourceNodeId: "source",
        sourcePortId: "out",
        targetNodeId: "target",
        targetPortId: "in",
      },
      { typeDefinitions },
    );

    render(
      <WorkflowWorkbench
        document={connected}
        typeDefinitions={typeDefinitions}
        onDocumentChange={handleDocumentChange}
      />,
    );

    expect(connected).toEqual(
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

  test("keeps node kind read-only in the default inspector", () => {
    const handleDocumentChange = vi.fn();

    render(
      <WorkflowWorkbench
        document={document}
        selectedNodeId="input"
        onDocumentChange={handleDocumentChange}
      />,
    );

    const labelField = screen.getAllByLabelText("Label")[0] as HTMLInputElement;
    const kindField = screen.getAllByLabelText("Kind")[0] as HTMLInputElement;

    expect(kindField.disabled || kindField.readOnly).toBe(true);

    fireEvent.change(labelField, { target: { value: "Source" } });
    fireEvent.change(kindField, { target: { value: "json.boolean" } });
    fireEvent.click(
      screen
        .getAllByRole("button", { name: "Apply" })
        .find((button) => !(button as HTMLButtonElement).disabled)!,
    );

    const nextDocument = handleDocumentChange.mock.calls.at(-1)?.[0] as WorkflowEditorDocument;
    const inputNode = nextDocument.nodes.find((node) => node.id === "input");

    expect(inputNode?.label).toBe("Source");
    expect(inputNode?.kind).toBeUndefined();
  });

  test("edits JSON string and number source values and keeps null read-only", () => {
    const stringChange = vi.fn();
    const stringDocument = normalizeWorkflowEditorDocument({
      nodes: [
        {
          id: "title",
          label: "Title",
          kind: "json.string",
          category: "JSON",
          x: 0,
          y: 0,
          outputs: [{ id: "value", label: "Value", type: { kind: "string" } }],
          data: { value: "draft" },
        },
      ],
      edges: [],
    });

    const { unmount } = render(
      <WorkflowWorkbench
        document={stringDocument}
        selectedNodeId="title"
        onDocumentChange={stringChange}
      />,
    );

    fireEvent.change(screen.getAllByLabelText("Value")[0]!, { target: { value: "published" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Apply" })[0]!);
    expect(stringChange).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: [expect.objectContaining({ id: "title", data: { value: "published" } })],
      }),
    );

    unmount();

    const numberChange = vi.fn();
    const numberDocument = normalizeWorkflowEditorDocument({
      nodes: [
        {
          id: "count",
          label: "Count",
          kind: "json.number",
          category: "JSON",
          x: 0,
          y: 0,
          outputs: [{ id: "value", label: "Value", type: { kind: "number" } }],
          data: { value: 1 },
        },
      ],
      edges: [],
    });

    const renderedNumber = render(
      <WorkflowWorkbench
        document={numberDocument}
        selectedNodeId="count"
        onDocumentChange={numberChange}
      />,
    );

    fireEvent.change(screen.getAllByLabelText("Value")[0]!, { target: { value: "42" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Apply" })[0]!);
    expect(numberChange).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: [expect.objectContaining({ id: "count", data: { value: 42 } })],
      }),
    );

    renderedNumber.unmount();

    const nullDocument = normalizeWorkflowEditorDocument({
      nodes: [
        {
          id: "nothing",
          label: "Nothing",
          kind: "json.null",
          category: "JSON",
          x: 0,
          y: 0,
          outputs: [{ id: "value", label: "Value", type: { kind: "null" } }],
          data: { value: null },
        },
      ],
      edges: [],
    });

    render(<WorkflowWorkbench document={nullDocument} selectedNodeId="nothing" />);

    const nullValue = screen.getAllByLabelText("Value")[0] as HTMLTextAreaElement;

    expect(nullValue.disabled).toBe(true);
    expect(nullValue.value).toBe("null");
  });

  test("edits JSON primitive source values from rendered workflow nodes", async () => {
    const primitiveDocument = normalizeWorkflowEditorDocument({
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
        {
          id: "title",
          label: "Title",
          kind: "json.string",
          category: "JSON",
          x: 360,
          y: 0,
          outputs: [{ id: "value", label: "Value", type: { kind: "string" } }],
          data: { value: "draft" },
        },
        {
          id: "count",
          label: "Count",
          kind: "json.number",
          category: "JSON",
          x: 720,
          y: 0,
          outputs: [{ id: "value", label: "Value", type: { kind: "number" } }],
          data: { value: 1 },
        },
        {
          id: "nothing",
          label: "Nothing",
          kind: "json.null",
          category: "JSON",
          x: 1080,
          y: 0,
          outputs: [{ id: "value", label: "Value", type: { kind: "null" } }],
          data: { value: null },
        },
      ],
      edges: [],
    });

    render(<StatefulWorkbench initialDocument={primitiveDocument} />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Set Flag to true" })).toBeTruthy(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Set Flag to true" }));
    expect(readStatefulDocument().nodes.find((node) => node.id === "flag")?.data).toEqual({
      value: true,
    });

    fireEvent.change(screen.getByLabelText("Title JSON value"), {
      target: { value: "published" },
    });
    expect(readStatefulDocument().nodes.find((node) => node.id === "title")?.data).toEqual({
      value: "published",
    });

    fireEvent.change(screen.getByLabelText("Count JSON value"), { target: { value: "42" } });
    expect(readStatefulDocument().nodes.find((node) => node.id === "count")?.data).toEqual({
      value: 42,
    });

    const nullValue = screen.getByLabelText("Nothing JSON value") as HTMLInputElement;
    expect(nullValue.disabled).toBe(true);
    expect(nullValue.value).toBe("null");
  });

  test("indicates JSON primitive source values on workflow nodes", () => {
    const uiNodes = toUiWorkflowBuilderNodes([
      {
        id: "flag",
        label: "Flag",
        description: "Create a JSON boolean value.",
        kind: "json.boolean",
        category: "JSON",
        x: 0,
        y: 0,
        outputs: [{ id: "value", label: "Value", type: { kind: "boolean" } }],
        data: { value: true },
      },
      {
        id: "title",
        label: "Title",
        kind: "json.string",
        category: "JSON",
        x: 0,
        y: 0,
        outputs: [{ id: "value", label: "Value", type: { kind: "string" } }],
        data: { value: "published" },
      },
    ]);

    expect(uiNodes[0]?.packageLabel).toBe("true");
    expect(uiNodes[0]?.minimized).toBe(true);
    expect(uiNodes[0]?.description).toBeUndefined();
    expect(uiNodes[0]?.outputs?.[0]?.badge).toBe("true");
    expect(uiNodes[1]?.packageLabel).toBe('"published"');
    expect(uiNodes[1]?.minimized).toBe(true);
    expect(uiNodes[1]?.outputs?.[0]?.badge).toBe('"published"');
  });

  test("handles keyboard mutation shortcuts, clipboard shortcuts, and escape", async () => {
    render(
      <StatefulWorkbench
        initialSelection={{
          nodeIds: ["input", "transform"],
          edgeIds: [],
          primary: { type: "node", id: "transform" },
        }}
      />,
    );

    fireEvent.keyDown(window, { key: "d", metaKey: true });
    expect(readStatefulDocument().nodes.map((node) => node.id)).toEqual(
      expect.arrayContaining(["input-copy", "transform-copy"]),
    );
    expect(readStatefulDocument().edges).toHaveLength(2);

    fireEvent.keyDown(window, { key: "c", metaKey: true });
    fireEvent.keyDown(window, { key: "v", metaKey: true });
    await waitFor(() => expect(readStatefulDocument().nodes).toHaveLength(7));
    expect(readStatefulDocument().edges).toHaveLength(3);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(readStatefulSelection()).toEqual({ nodeIds: [], edgeIds: [] });
  });

  test("deletes selected nodes and edges from keyboard shortcuts", () => {
    const { unmount } = render(
      <StatefulWorkbench
        initialSelection={{
          nodeIds: ["input"],
          edgeIds: [],
          primary: { type: "node", id: "input" },
        }}
      />,
    );

    fireEvent.keyDown(window, { key: "Backspace" });
    expect(readStatefulDocument().nodes.map((node) => node.id)).toEqual(["transform", "output"]);
    expect(readStatefulDocument().edges).toHaveLength(0);

    unmount();
    render(
      <StatefulWorkbench
        initialSelection={{
          nodeIds: [],
          edgeIds: ["input-transform"],
          primary: { type: "edge", id: "input-transform" },
        }}
      />,
    );

    fireEvent.keyDown(window, { key: "Delete" });
    expect(readStatefulDocument().nodes).toHaveLength(3);
    expect(readStatefulDocument().edges).toHaveLength(0);
  });

  test("ignores global shortcuts from editable inspector fields", () => {
    render(
      <StatefulWorkbench
        initialSelection={{
          nodeIds: ["input"],
          edgeIds: [],
          primary: { type: "node", id: "input" },
        }}
      />,
    );

    const labelInput = screen.getAllByLabelText("Label")[0]!;
    fireEvent.keyDown(labelInput, { key: "Backspace" });
    fireEvent.keyDown(labelInput, { key: "d", metaKey: true });

    expect(readStatefulDocument().nodes).toHaveLength(3);
    expect(readStatefulDocument().edges).toHaveLength(1);
  });

  test("blocks keyboard graph mutations in read-only mode", () => {
    const handleDocumentChange = vi.fn();
    render(
      <WorkflowWorkbench
        document={document}
        selectedNodeIds={["input"]}
        readOnly
        onDocumentChange={handleDocumentChange}
      />,
    );

    fireEvent.keyDown(window, { key: "Delete" });
    fireEvent.keyDown(window, { key: "Backspace" });
    fireEvent.keyDown(window, { key: "d", metaKey: true });
    fireEvent.keyDown(window, { key: "v", metaKey: true });

    expect(handleDocumentChange).not.toHaveBeenCalled();
  });

  test("edits edge status from the default inspector", () => {
    const handleDocumentChange = vi.fn();
    render(
      <WorkflowWorkbench
        document={document}
        selectedEdgeId="input-transform"
        onDocumentChange={handleDocumentChange}
      />,
    );

    expect(screen.getAllByText("Workflow edge")).not.toHaveLength(0);
    fireEvent.change(screen.getAllByLabelText("Status")[0]!, { target: { value: "success" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Apply" })[0]!);

    expect(handleDocumentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        edges: [
          expect.objectContaining({
            id: "input-transform",
            status: "success",
          }),
        ],
      }),
    );
  });

  test("ignores invalid UI connection attempts without mutating the document", () => {
    const handleDocumentChange = vi.fn();
    const typedDocument = normalizeWorkflowEditorDocument({
      nodes: [
        {
          id: "source",
          label: "Source",
          x: 0,
          y: 0,
          outputs: [{ id: "out", label: "Out", type: { kind: "string" } }],
        },
        {
          id: "target",
          label: "Target",
          x: 240,
          y: 0,
          inputs: [{ id: "in", label: "In", type: { kind: "number" } }],
        },
      ],
      edges: [],
    });

    render(<WorkflowWorkbench document={typedDocument} onDocumentChange={handleDocumentChange} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Start Source Out" })[0]!);
    fireEvent.click(screen.getAllByRole("button", { name: "Connect to Target In" })[0]!);

    expect(handleDocumentChange).not.toHaveBeenCalled();
  });

  test("clears workflow references back to none from the default inspector", () => {
    const referencedDocument = normalizeWorkflowEditorDocument({
      ...document,
      nodes: [
        { ...document.nodes[0]!, workflowRef: { documentId: "child" } },
        document.nodes[1]!,
        document.nodes[2]!,
      ],
    });
    const handleDocumentChange = vi.fn();
    render(
      <WorkflowWorkbench
        document={referencedDocument}
        selectedNodeId="input"
        documentReferences={[{ id: "child", name: "Child workflow" }]}
        onDocumentChange={handleDocumentChange}
      />,
    );

    fireEvent.click(screen.getAllByLabelText("Workflow document")[0]!);
    fireEvent.click(screen.getByRole("option", { name: "None" }));
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
            workflowRef: undefined,
          }),
        ]),
      }),
    );
  });

  test("updates node coordinates with valid numbers and ignores invalid values", () => {
    const handleDocumentChange = vi.fn();
    render(
      <WorkflowWorkbench
        document={document}
        selectedNodeId="input"
        onDocumentChange={handleDocumentChange}
      />,
    );

    fireEvent.change(screen.getAllByLabelText("X")[0]!, { target: { value: "120" } });
    fireEvent.change(screen.getAllByLabelText("Y")[0]!, { target: { value: "not-a-number" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Apply" })[0]!);

    expect(handleDocumentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: expect.arrayContaining([
          expect.objectContaining({
            id: "input",
            x: 120,
            y: 0,
          }),
        ]),
      }),
    );
  });

  test("adds and removes JSON composition ports from inspector controls", () => {
    const arrayTemplate = workflowEditorJsonNodeTemplates.find(
      (template) => template.id === "json-array",
    )!;
    const objectTemplate = workflowEditorJsonNodeTemplates.find(
      (template) => template.id === "json-object",
    )!;
    const decomposeTemplate = workflowEditorJsonNodeTemplates.find(
      (template) => template.id === "json-object-decompose",
    )!;
    const objectDocument = normalizeWorkflowEditorDocument<Record<string, unknown>>({
      nodes: [
        { ...arrayTemplate, id: "array", x: -280, y: 0 },
        { ...objectTemplate, id: "object", x: 0, y: 0 },
        { ...decomposeTemplate, id: "decompose", x: 280, y: 0 },
      ],
      edges: [],
    });
    const renderedObject = render(
      <StatefulWorkbench
        initialDocument={objectDocument}
        initialSelection={{
          nodeIds: ["object"],
          edgeIds: [],
          primary: { type: "node", id: "object" },
        }}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Add property input" })[0]!);
    expect(
      getWorkflowEditorObjectConstructorInputs(
        readStatefulDocument().nodes.find((node) => node.id === "object")!,
      ),
    ).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Remove property input property" }));
    expect(
      getWorkflowEditorObjectConstructorInputs(
        readStatefulDocument().nodes.find((node) => node.id === "object")!,
      ),
    ).toHaveLength(0);

    const updatedDocument = readStatefulDocument();
    renderedObject.unmount();
    const renderedDecompose = render(
      <StatefulWorkbench
        initialDocument={updatedDocument}
        initialSelection={{
          nodeIds: ["decompose"],
          edgeIds: [],
          primary: { type: "node", id: "decompose" },
        }}
      />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Add property output" })[0]!);
    expect(
      getWorkflowEditorObjectDecompositionOutputs(
        readStatefulDocument().nodes.find((node) => node.id === "decompose")!,
      ),
    ).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Remove property output property" }));
    expect(
      getWorkflowEditorObjectDecompositionOutputs(
        readStatefulDocument().nodes.find((node) => node.id === "decompose")!,
      ),
    ).toHaveLength(0);

    const decomposeUpdatedDocument = readStatefulDocument();
    renderedDecompose.unmount();
    render(
      <StatefulWorkbench
        initialDocument={decomposeUpdatedDocument}
        initialSelection={{
          nodeIds: ["array"],
          edgeIds: [],
          primary: { type: "node", id: "array" },
        }}
      />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Add item input" })[0]!);
    expect(
      getWorkflowEditorArrayConstructorInputs(
        readStatefulDocument().nodes.find((node) => node.id === "array")!,
      ),
    ).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Remove array item 1" }));
    expect(
      getWorkflowEditorArrayConstructorInputs(
        readStatefulDocument().nodes.find((node) => node.id === "array")!,
      ),
    ).toHaveLength(0);
  });

  test("disables JSON dynamic inspector controls in read-only mode", () => {
    const arrayTemplate = workflowEditorJsonNodeTemplates.find(
      (template) => template.id === "json-array",
    )!;
    const objectTemplate = workflowEditorJsonNodeTemplates.find(
      (template) => template.id === "json-object",
    )!;
    const decomposeTemplate = workflowEditorJsonNodeTemplates.find(
      (template) => template.id === "json-object-decompose",
    )!;
    let readonlyDocument = normalizeWorkflowEditorDocument<Record<string, unknown>>({
      nodes: [
        { ...arrayTemplate, id: "array", x: -280, y: 0 },
        { ...objectTemplate, id: "object", x: 0, y: 0 },
        { ...decomposeTemplate, id: "decompose", x: 280, y: 0 },
      ],
      edges: [],
    });

    readonlyDocument = addWorkflowEditorArrayConstructorInput(readonlyDocument, "array");
    readonlyDocument = addWorkflowEditorObjectConstructorInput(readonlyDocument, "object");
    readonlyDocument = addWorkflowEditorObjectDecompositionOutput(readonlyDocument, "decompose");

    const renderedObject = render(
      <StatefulWorkbench
        initialDocument={readonlyDocument}
        readOnly
        initialSelection={{
          nodeIds: ["object"],
          edgeIds: [],
          primary: { type: "node", id: "object" },
        }}
      />,
    );

    expect(
      (screen.getByRole("button", { name: "Add property input" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Remove property input property" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    renderedObject.unmount();
    const renderedDecompose = render(
      <StatefulWorkbench
        initialDocument={readonlyDocument}
        readOnly
        initialSelection={{
          nodeIds: ["decompose"],
          edgeIds: [],
          primary: { type: "node", id: "decompose" },
        }}
      />,
    );

    expect(
      (screen.getByRole("button", { name: "Add property output" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Remove property output property" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    renderedDecompose.unmount();
    render(
      <StatefulWorkbench
        initialDocument={readonlyDocument}
        readOnly
        initialSelection={{
          nodeIds: ["array"],
          edgeIds: [],
          primary: { type: "node", id: "array" },
        }}
      />,
    );

    expect(
      (screen.getByRole("button", { name: "Add item input" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Remove array item 1" }) as HTMLButtonElement).disabled,
    ).toBe(true);
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
    fireEvent.click(screen.getByRole("button", { name: "Input" }));
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
    fireEvent.click(screen.getByRole("button", { name: "Self" }));
    fireEvent.click(
      screen
        .getAllByRole("button", { name: "Open workflow" })
        .find((button) => !(button as HTMLButtonElement).disabled)!,
    );
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: "Recursive" })).toHaveLength(2),
    );
    fireEvent.click(screen.getByRole("button", { name: "Self" }));
    const cappedOpenButtons = screen.queryAllByRole("button", { name: "Open workflow" });
    expect(cappedOpenButtons.every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
  });
});
