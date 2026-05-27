import { getWorkflowNodeSize } from "@moritzbrantner/ui/labs";
import { describe, expect, test } from "vitest";

import {
  WorkflowEditorDocumentValidationError,
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
  getWorkflowEditorObjectConstructorSchema,
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
  parseWorkflowEditorObjectConstructorExpression,
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
  updateWorkflowEditorObjectConstructorExpression,
  updateWorkflowEditorObjectConstructorExpressionInNode,
  updateWorkflowEditorObjectConstructorPropertiesInNode,
  updateWorkflowEditorObjectConstructorSchema,
  updateWorkflowEditorObjectConstructorSchemaInNode,
  validateWorkflowEditorDocument,
  validateWorkflowEditorConnection,
  wouldCreateWorkflowEditorCycle,
  workflowEditorCollectionNodeTemplates,
  workflowEditorControlFlowNodeTemplates,
  workflowEditorDocumentFileVersion,
  workflowEditorJsonNodeTemplates,
  type WorkflowEditorDocument,
  type WorkflowEditorPortType,
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
    expect(getWorkflowEditorObjectConstructorSchema(renamedObjectNode)).toEqual({
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
    expect(
      getWorkflowEditorObjectConstructorSchema(findWorkflowEditorNode(expanded, "employee-object")!)
        .properties,
    ).toEqual({
      firstName: { type: { kind: "string" } },
      lastName: { type: { kind: "any" } },
    });

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

  test("syncs object constructor inputs from schema", () => {
    const objectTemplate = workflowEditorJsonNodeTemplates.find(
      (template) => template.id === "json-object",
    )!;
    const schema = {
      kind: "object",
      properties: {
        firstName: { type: { kind: "string" } },
        age: { type: { kind: "number" }, optional: true },
      },
    } satisfies Extract<WorkflowEditorPortType, { kind: "object" }>;
    const objectNode = updateWorkflowEditorObjectConstructorSchemaInNode(
      {
        ...objectTemplate,
        id: "employee-object",
        x: 240,
        y: 0,
      } as WorkflowEditorDocument["nodes"][number],
      schema,
    );

    expect(getWorkflowEditorObjectConstructorInputs(objectNode)).toEqual([
      expect.objectContaining({ id: "firstname", label: "firstName", type: { kind: "string" } }),
      expect.objectContaining({ id: "age", label: "age", type: { kind: "number" } }),
    ]);
    expect(objectNode.outputs?.[0]?.type).toEqual(schema);
    expect(getWorkflowEditorObjectConstructorSchema(objectNode)).toEqual(schema);
  });

  test("updates object constructor schema exactly and removes deleted property edges", () => {
    const objectTemplate = workflowEditorJsonNodeTemplates.find(
      (template) => template.id === "json-object",
    )!;
    const objectNode = updateWorkflowEditorObjectConstructorSchemaInNode(
      {
        ...objectTemplate,
        id: "employee-object",
        x: 240,
        y: 0,
      } as WorkflowEditorDocument["nodes"][number],
      {
        kind: "object",
        properties: {
          firstName: { type: { kind: "string" } },
          age: { type: { kind: "number" }, optional: true },
        },
      },
    );
    const objectDocument = normalizeWorkflowEditorDocument<Record<string, unknown>>({
      nodes: [
        {
          id: "employee",
          label: "Employee",
          x: 0,
          y: 0,
          outputs: [
            { id: "firstName", label: "First name", type: { kind: "string" } },
            { id: "age", label: "Age", type: { kind: "number" } },
          ],
        },
        objectNode,
      ],
      edges: [
        {
          id: "employee:firstName->employee-object:firstname",
          sourceNodeId: "employee",
          sourcePortId: "firstName",
          targetNodeId: "employee-object",
          targetPortId: "firstname",
        },
        {
          id: "employee:age->employee-object:age",
          sourceNodeId: "employee",
          sourcePortId: "age",
          targetNodeId: "employee-object",
          targetPortId: "age",
        },
      ],
    });
    const nextDocument = updateWorkflowEditorObjectConstructorSchema(
      objectDocument,
      "employee-object",
      {
        kind: "object",
        properties: {
          firstName: { type: { kind: "string" } },
          active: { type: { kind: "boolean" } },
        },
      },
    );
    const nextObjectNode = findWorkflowEditorNode(nextDocument, "employee-object")!;

    expect(
      getWorkflowEditorObjectConstructorInputs(nextObjectNode).map((input) => input.label),
    ).toEqual(["firstName", "active"]);
    expect(nextDocument.edges).toEqual([
      expect.objectContaining({
        targetNodeId: "employee-object",
        targetPortId: "firstname",
      }),
    ]);
    expect(getWorkflowEditorObjectConstructorInputs(nextObjectNode)[0]).toEqual(
      expect.objectContaining({ badge: "employee.firstName" }),
    );
    expect(nextObjectNode.outputs?.[0]?.type).toEqual({
      kind: "object",
      properties: {
        firstName: { type: { kind: "string" } },
        active: { type: { kind: "boolean" } },
      },
    });
  });

  test("leaves non-object-constructor nodes unchanged when applying object schemas", () => {
    const node = {
      id: "input",
      label: "Input",
      x: 0,
      y: 0,
      outputs: [{ id: "out", label: "Out", type: { kind: "string" } }],
    } satisfies WorkflowEditorDocument["nodes"][number];

    expect(
      updateWorkflowEditorObjectConstructorSchemaInNode(node, {
        kind: "object",
        properties: { name: { type: { kind: "string" } } },
      }),
    ).toBe(node);
  });

  test("updates object constructor nodes from object expressions", () => {
    const objectTemplate = workflowEditorJsonNodeTemplates.find(
      (template) => template.id === "json-object",
    )!;
    const parsedExpression = parseWorkflowEditorObjectConstructorExpression(
      "{ firstName: employee.firstName, age: employee.age }",
    );

    expect(parsedExpression).toEqual([
      { key: "firstName", sourceExpression: "employee.firstName" },
      { key: "age", sourceExpression: "employee.age" },
    ]);

    const objectNode = updateWorkflowEditorObjectConstructorExpressionInNode(
      {
        ...objectTemplate,
        id: "employee-object",
        x: 240,
        y: 0,
      } as WorkflowEditorDocument["nodes"][number],
      "{ firstName: employee.firstName, age: employee.age }",
    );

    expect(getWorkflowEditorObjectConstructorInputs(objectNode)).toEqual([
      expect.objectContaining({
        id: "firstname",
        label: "firstName",
        badge: "employee.firstName",
        type: { kind: "any" },
      }),
      expect.objectContaining({
        id: "age",
        label: "age",
        badge: "employee.age",
        type: { kind: "any" },
      }),
    ]);
    expect(formatWorkflowEditorObjectConstructorExpression(objectNode)).toBe(
      "{\n  firstName: employee.firstName,\n  age: employee.age\n}",
    );
  });

  test("updates object constructor expressions and removes stale edges", () => {
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
          outputs: [
            { id: "firstName", label: "First name", type: { kind: "string" } },
            { id: "age", label: "Age", type: { kind: "number" } },
          ],
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
    const withFirstName = connectWorkflowEditorNodes(objectDocument, {
      sourceNodeId: "employee",
      sourcePortId: "firstName",
      targetNodeId: "employee-object",
      targetPortId: "property",
    });
    const nextDocument = updateWorkflowEditorObjectConstructorExpression(
      withFirstName,
      "employee-object",
      "{ givenName: employee.firstName, age: employee.age }",
    );
    const nextObjectNode = findWorkflowEditorNode(nextDocument, "employee-object")!;

    expect(getWorkflowEditorObjectConstructorInputs(nextObjectNode)).toEqual([
      expect.objectContaining({
        id: "firstname",
        label: "givenName",
        badge: "employee.firstName",
        type: { kind: "string" },
      }),
      expect.objectContaining({
        id: "age",
        label: "age",
        badge: "employee.age",
        type: { kind: "any" },
      }),
    ]);
    expect(nextDocument.edges).toEqual([
      expect.objectContaining({
        targetNodeId: "employee-object",
        targetPortId: "firstname",
      }),
    ]);

    const changedSourceDocument = updateWorkflowEditorObjectConstructorExpression(
      nextDocument,
      "employee-object",
      "{ givenName: employee.age }",
    );

    expect(changedSourceDocument.edges).toEqual([]);
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
