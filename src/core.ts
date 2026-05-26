import type {
  WorkflowBuilderConnection as UiWorkflowBuilderConnection,
  WorkflowBuilderEdge as UiWorkflowBuilderEdge,
  WorkflowBuilderConnectionValidity as UiWorkflowBuilderConnectionValidity,
  WorkflowBuilderNodeData as UiWorkflowBuilderNodeData,
  WorkflowBuilderViewport as UiWorkflowBuilderViewport,
  WorkflowNodeData as UiWorkflowNodeData,
  WorkflowNodePort as UiWorkflowNodePort,
} from "@moritzbrantner/ui/labs";
import { getWorkflowBuilderConnectionValidity } from "@moritzbrantner/ui/labs";

import {
  createWorkflowGraphIndex,
  type WorkflowEditorGraphIndex,
  type WorkflowEditorIndexedEdge,
  type WorkflowEditorIndexedNode,
  type WorkflowEditorSubgraph,
} from "./graph-index";

export type {
  WorkflowEditorGraphIndex,
  WorkflowEditorIndexedEdge,
  WorkflowEditorIndexedNode,
  WorkflowEditorSubgraph,
};

export type WorkflowEditorPortType =
  | { kind: "any" }
  | { kind: "unknown" }
  | { kind: "never" }
  | { kind: "string" | "number" | "boolean" | "null" | "undefined" }
  | { kind: "literal"; value: string | number | boolean | null }
  | { kind: "array"; element: WorkflowEditorPortType }
  | { kind: "object"; properties?: Record<string, WorkflowEditorPortProperty> }
  | { kind: "union"; types: WorkflowEditorPortType[] }
  | { kind: "intersection"; types: WorkflowEditorPortType[] }
  | { kind: "ref"; name: string };

export type WorkflowEditorPortProperty = {
  type: WorkflowEditorPortType;
  optional?: boolean;
};

export type WorkflowEditorObjectConstructorProperty = {
  key: string;
  sourceExpression?: string;
  sourceNodeId?: string;
  sourcePortId?: string;
};

export type WorkflowEditorObjectConstructorInputOptions = {
  portId?: string;
  propertyKey?: string;
  sourceExpression?: string;
  sourceNodeId?: string;
  sourcePortId?: string;
  type?: WorkflowEditorPortType;
};

export type WorkflowEditorObjectDecompositionProperty = {
  key: string;
};

export type WorkflowEditorObjectDecompositionOutputOptions = {
  portId?: string;
  propertyKey?: string;
  type?: WorkflowEditorPortType;
};

export type WorkflowEditorTypeDefinition = {
  name: string;
  type: WorkflowEditorPortType;
  extends?: string[];
};

export type WorkflowEditorTypeValidationOptions = {
  typeDefinitions?: readonly WorkflowEditorTypeDefinition[];
};

export type WorkflowEditorTypeDiagnostic = {
  type: "incompatible-port-type" | "missing-type-definition";
  edgeId?: string;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
  message: string;
};

export type WorkflowEditorPort = Omit<UiWorkflowNodePort, "kind"> & {
  type: WorkflowEditorPortType;
};

export type WorkflowEditorWorkflowReference = {
  documentId: string;
};

export type WorkflowEditorCompositionBoundary = {
  wrapperPortId: string;
  nodeId: string;
  portId: string;
};

export type WorkflowEditorNodeComposition<TNodeData = Record<string, unknown>> = {
  nodes: Array<WorkflowEditorNode<TNodeData>>;
  edges: Array<WorkflowEditorEdge>;
  inputBoundaries: WorkflowEditorCompositionBoundary[];
  outputBoundaries: WorkflowEditorCompositionBoundary[];
};

export type WorkflowEditorNode<TData = Record<string, unknown>> = Omit<
  UiWorkflowNodeData,
  "inputs" | "metadata" | "outputs"
> & {
  x: number;
  y: number;
  inputs?: WorkflowEditorPort[];
  outputs?: WorkflowEditorPort[];
  data?: TData;
  workflowRef?: WorkflowEditorWorkflowReference;
  composition?: WorkflowEditorNodeComposition<TData>;
};

export type WorkflowEditorEdge<TData = Record<string, unknown>> = {
  id: string;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
  status?: "idle" | "running" | "success" | "error" | "warning" | string;
  data?: TData;
};

export type WorkflowEditorViewport = {
  x: number;
  y: number;
  zoom: number;
};

export type WorkflowEditorDocument<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
> = {
  nodes: Array<WorkflowEditorNode<TNodeData>>;
  edges: Array<WorkflowEditorEdge<TEdgeData>>;
  viewport?: WorkflowEditorViewport;
};

export type WorkflowEditorDocumentNormalizationMode = "strict" | "repair";

export type WorkflowEditorDocumentDiagnosticCode =
  | "invalid-document"
  | "invalid-node"
  | "invalid-edge"
  | "duplicate-node-id"
  | "duplicate-edge-id"
  | "missing-edge-node"
  | "self-edge"
  | "cycle";

export type WorkflowEditorDocumentDiagnostic = {
  code: WorkflowEditorDocumentDiagnosticCode;
  message: string;
  path: string;
  nodeId?: string;
  edgeId?: string;
  sourceNodeId?: string;
  targetNodeId?: string;
};

export type WorkflowEditorDocumentValidationOptions = {
  allowCycles?: boolean;
};

export type WorkflowEditorDocumentNormalizationOptions = WorkflowEditorDocumentValidationOptions & {
  mode?: WorkflowEditorDocumentNormalizationMode;
};

export class WorkflowEditorDocumentValidationError extends Error {
  override name = "WorkflowEditorDocumentValidationError" as const;
  diagnostics: WorkflowEditorDocumentDiagnostic[];

  constructor(diagnostics: WorkflowEditorDocumentDiagnostic[]) {
    super(formatWorkflowEditorDocumentValidationMessage(diagnostics));
    this.diagnostics = diagnostics;
  }
}

export type WorkflowEditorConnectionInput = UiWorkflowBuilderConnection;

export type WorkflowEditorConnectionInvalidReason =
  | NonNullable<UiWorkflowBuilderConnectionValidity["reason"]>
  | "cycle"
  | "missing-node";

export type WorkflowEditorConnectionValidity = {
  valid: boolean;
  reason?: WorkflowEditorConnectionInvalidReason;
};

export type WorkflowEditorSelection<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
> =
  | {
      type: "node";
      id: string;
      node: WorkflowEditorNode<TNodeData>;
    }
  | {
      type: "edge";
      id: string;
      edge: WorkflowEditorEdge<TEdgeData>;
    }
  | null;

export type WorkflowEditorNodeTemplate<TData = Record<string, unknown>> = Omit<
  WorkflowEditorNode<TData>,
  "x" | "y"
>;

export const workflowEditorControlFlowNodeTemplates = [
  {
    id: "control-flow-start",
    label: "Start",
    description: "Begin a workflow branch.",
    kind: "control.start",
    category: "Control flow",
    outputs: [{ id: "out", label: "Out", type: { kind: "any" } }],
  },
  {
    id: "control-flow-if",
    label: "If",
    description: "Route a value by a boolean condition.",
    kind: "control.if",
    category: "Control flow",
    inputs: [
      { id: "value", label: "Value", type: { kind: "any" } },
      { id: "condition", label: "Condition", type: { kind: "boolean" } },
    ],
    outputs: [
      { id: "true", label: "True", type: { kind: "any" } },
      { id: "false", label: "False", type: { kind: "any" } },
    ],
  },
  {
    id: "control-flow-switch",
    label: "Switch",
    description: "Route a value through a matching case or fallback branch.",
    kind: "control.switch",
    category: "Control flow",
    inputs: [
      { id: "value", label: "Value", type: { kind: "any" } },
      { id: "case", label: "Case", type: { kind: "any" } },
    ],
    outputs: [
      { id: "match", label: "Match", type: { kind: "any" } },
      { id: "default", label: "Default", type: { kind: "any" } },
    ],
  },
  {
    id: "control-flow-merge",
    label: "Merge",
    description: "Join two branches into one value.",
    kind: "control.merge",
    category: "Control flow",
    inputs: [
      { id: "a", label: "A", type: { kind: "any" } },
      { id: "b", label: "B", type: { kind: "any" } },
    ],
    outputs: [{ id: "out", label: "Out", type: { kind: "any" } }],
  },
  {
    id: "control-flow-end",
    label: "End",
    description: "Finish a workflow branch.",
    kind: "control.end",
    category: "Control flow",
    inputs: [{ id: "in", label: "In", type: { kind: "any" } }],
  },
] satisfies WorkflowEditorNodeTemplate[];

export const workflowEditorJsonNodeTemplates = [
  {
    id: "json-string",
    label: "String",
    description: "Create a JSON string value.",
    kind: "json.string",
    category: "JSON",
    outputs: [{ id: "value", label: "Value", type: { kind: "string" } }],
    data: { value: "" },
  },
  {
    id: "json-number",
    label: "Number",
    description: "Create a JSON number value.",
    kind: "json.number",
    category: "JSON",
    outputs: [{ id: "value", label: "Value", type: { kind: "number" } }],
    data: { value: 0 },
  },
  {
    id: "json-boolean",
    label: "Boolean",
    description: "Create a JSON boolean value.",
    kind: "json.boolean",
    category: "JSON",
    outputs: [{ id: "value", label: "Value", type: { kind: "boolean" } }],
    data: { value: false },
  },
  {
    id: "json-null",
    label: "Null",
    description: "Create a JSON null value.",
    kind: "json.null",
    category: "JSON",
    outputs: [{ id: "value", label: "Value", type: { kind: "null" } }],
    data: { value: null },
  },
  {
    id: "json-array",
    label: "Array",
    description: "Create a JSON array value.",
    kind: "json.array",
    category: "JSON",
    inputs: [{ id: "item", label: "Item", type: { kind: "any" } }],
    outputs: [{ id: "value", label: "Value", type: { kind: "array", element: { kind: "any" } } }],
    data: { items: [] },
  },
  {
    id: "json-object",
    label: "Object",
    description: "Construct a JSON object from named input properties.",
    kind: "json.object",
    category: "JSON",
    inputs: [
      {
        id: "property",
        label: "Add property",
        type: { kind: "any" },
        badge: "new",
        metadata: { objectConstructorRole: "add-property" },
      },
    ],
    outputs: [{ id: "value", label: "Object", type: { kind: "object" } }],
    data: { properties: {} },
  },
  {
    id: "json-object-decompose",
    label: "Object decompose",
    description: "Split a JSON object into named property outputs.",
    kind: "json.object.decompose",
    category: "JSON",
    inputs: [{ id: "object", label: "Object", type: { kind: "object" } }],
    outputs: [
      {
        id: "property",
        label: "Add property",
        type: { kind: "any" },
        badge: "new",
        metadata: { objectDecompositionRole: "add-property" },
      },
    ],
    data: { properties: {} },
  },
] satisfies WorkflowEditorNodeTemplate[];

export const defaultWorkflowEditorNodeTemplates = [
  ...workflowEditorControlFlowNodeTemplates,
  ...workflowEditorJsonNodeTemplates,
] satisfies WorkflowEditorNodeTemplate[];

export type WorkflowEditorDuplicateNodeOptions = {
  offsetX?: number;
  offsetY?: number;
  createId?: (nodeId: string, existingIds: ReadonlySet<string>) => string;
};

export type WorkflowEditorComposeNodesOptions<TNodeData = Record<string, unknown>> = {
  id?: string;
  label?: string;
  description?: string;
  kind?: string;
  category?: string;
  eyebrow?: string;
  packageLabel?: string;
  status?: "idle" | "running" | "success" | "error" | "warning" | string;
  tone?: "neutral" | "info" | "success" | "warning" | "error" | string;
  variant?: "default" | "compact";
  minimized?: boolean;
  tags?: string[];
  data?: TNodeData;
  x?: number;
  y?: number;
  createId?: (baseId: string, existingIds: ReadonlySet<string>) => string;
};

export function normalizeWorkflowEditorDocument<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  options: WorkflowEditorDocumentNormalizationOptions = {},
): WorkflowEditorDocument<TNodeData, TEdgeData> {
  const mode = options.mode ?? "strict";
  const diagnostics = validateWorkflowEditorDocument(document, options);

  if (mode === "strict" && diagnostics.length > 0) {
    throw new WorkflowEditorDocumentValidationError(diagnostics);
  }

  let nodes = Array.isArray(document.nodes)
    ? document.nodes.flatMap((node) =>
        isRecord(node) ? [normalizeWorkflowEditorNode(node as WorkflowEditorNode<TNodeData>)] : [],
      )
    : [];
  const nodeIds = new Set(nodes.map((node) => node.id));
  const edges = Array.isArray(document.edges)
    ? (normalizeWorkflowEditorDagEdges(
        document.edges.flatMap((edge) => (isRecord(edge) ? [edge as WorkflowEditorEdge] : [])),
        nodeIds,
      ) as Array<WorkflowEditorEdge<TEdgeData>>)
    : [];
  nodes = syncWorkflowEditorObjectConstructorNodes(nodes, edges);
  nodes = syncWorkflowEditorObjectDecompositionNodes(nodes, edges);

  return {
    ...document,
    nodes,
    edges,
    viewport: document.viewport
      ? {
          x: Number.isFinite(document.viewport.x) ? document.viewport.x : 0,
          y: Number.isFinite(document.viewport.y) ? document.viewport.y : 0,
          zoom: clampZoom(document.viewport.zoom),
        }
      : undefined,
  };
}

export function validateWorkflowEditorDocument<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  value: unknown,
  options: WorkflowEditorDocumentValidationOptions = {},
): WorkflowEditorDocumentDiagnostic[] {
  const diagnostics: WorkflowEditorDocumentDiagnostic[] = [];

  if (!isRecord(value)) {
    return [
      {
        code: "invalid-document",
        message: "Workflow document must be an object",
        path: "$",
      },
    ];
  }

  if (!Array.isArray(value.nodes)) {
    diagnostics.push({
      code: "invalid-document",
      message: "Workflow document nodes must be an array",
      path: "$.nodes",
    });
  }

  if (!Array.isArray(value.edges)) {
    diagnostics.push({
      code: "invalid-document",
      message: "Workflow document edges must be an array",
      path: "$.edges",
    });
  }

  if (!Array.isArray(value.nodes) || !Array.isArray(value.edges)) {
    return diagnostics;
  }

  const nodeIds = new Set<string>();
  const duplicateNodeIds = new Set<string>();
  value.nodes.forEach((node, index) => {
    const path = `$.nodes[${index}]`;

    if (!isRecord(node)) {
      diagnostics.push({
        code: "invalid-node",
        message: "Workflow node must be an object",
        path,
      });
      return;
    }

    const nodeId = typeof node.id === "string" ? node.id : undefined;
    if (!nodeId?.trim()) {
      diagnostics.push({
        code: "invalid-node",
        message: "Workflow node id must be a non-empty string",
        path: `${path}.id`,
      });
    } else if (nodeIds.has(nodeId)) {
      duplicateNodeIds.add(nodeId);
      diagnostics.push({
        code: "duplicate-node-id",
        message: `Duplicate workflow node id: ${nodeId}`,
        path: `${path}.id`,
        nodeId,
      });
    } else {
      nodeIds.add(nodeId);
    }

    if (typeof node.label !== "string") {
      diagnostics.push({
        code: "invalid-node",
        message: "Workflow node label must be a string",
        path: `${path}.label`,
        nodeId,
      });
    }

    if (typeof node.x !== "number" || !Number.isFinite(node.x)) {
      diagnostics.push({
        code: "invalid-node",
        message: "Workflow node x must be a finite number",
        path: `${path}.x`,
        nodeId,
      });
    }

    if (typeof node.y !== "number" || !Number.isFinite(node.y)) {
      diagnostics.push({
        code: "invalid-node",
        message: "Workflow node y must be a finite number",
        path: `${path}.y`,
        nodeId,
      });
    }

    validateWorkflowEditorPorts(node.inputs, `${path}.inputs`, nodeId, diagnostics);
    validateWorkflowEditorPorts(node.outputs, `${path}.outputs`, nodeId, diagnostics);
  });

  const edgeIds = new Set<string>();
  value.edges.forEach((edge, index) => {
    const path = `$.edges[${index}]`;

    if (!isRecord(edge)) {
      diagnostics.push({
        code: "invalid-edge",
        message: "Workflow edge must be an object",
        path,
      });
      return;
    }

    const edgeId = typeof edge.id === "string" ? edge.id : undefined;
    const sourceNodeId = typeof edge.sourceNodeId === "string" ? edge.sourceNodeId : undefined;
    const targetNodeId = typeof edge.targetNodeId === "string" ? edge.targetNodeId : undefined;

    if (!edgeId?.trim()) {
      diagnostics.push({
        code: "invalid-edge",
        message: "Workflow edge id must be a non-empty string",
        path: `${path}.id`,
      });
    } else if (edgeIds.has(edgeId)) {
      diagnostics.push({
        code: "duplicate-edge-id",
        message: `Duplicate workflow edge id: ${edgeId}`,
        path: `${path}.id`,
        edgeId,
      });
    } else {
      edgeIds.add(edgeId);
    }

    for (const key of ["sourceNodeId", "sourcePortId", "targetNodeId", "targetPortId"] as const) {
      if (typeof edge[key] !== "string" || !edge[key].trim()) {
        diagnostics.push({
          code: "invalid-edge",
          message: `Workflow edge ${key} must be a non-empty string`,
          path: `${path}.${key}`,
          edgeId,
          sourceNodeId,
          targetNodeId,
        });
      }
    }

    if (sourceNodeId && !nodeIds.has(sourceNodeId)) {
      diagnostics.push({
        code: "missing-edge-node",
        message: `Workflow edge source node does not exist: ${sourceNodeId}`,
        path: `${path}.sourceNodeId`,
        edgeId,
        sourceNodeId,
        targetNodeId,
      });
    }

    if (targetNodeId && !nodeIds.has(targetNodeId)) {
      diagnostics.push({
        code: "missing-edge-node",
        message: `Workflow edge target node does not exist: ${targetNodeId}`,
        path: `${path}.targetNodeId`,
        edgeId,
        sourceNodeId,
        targetNodeId,
      });
    }

    if (sourceNodeId && targetNodeId && sourceNodeId === targetNodeId) {
      diagnostics.push({
        code: "self-edge",
        message: `Workflow edge cannot connect node ${sourceNodeId} to itself`,
        path,
        edgeId,
        sourceNodeId,
        targetNodeId,
      });
    }
  });

  if (!options.allowCycles && diagnostics.length === 0) {
    const document = value as WorkflowEditorDocument<TNodeData, TEdgeData>;
    for (const cycle of detectWorkflowEditorCycles(document)) {
      diagnostics.push({
        code: "cycle",
        message: `Workflow document contains a cycle: ${cycle.join(" -> ")}`,
        path: "$.edges",
        sourceNodeId: cycle[0],
        targetNodeId: cycle.at(-1),
      });
    }
  }

  return diagnostics.filter((diagnostic) =>
    diagnostic.code === "duplicate-node-id" ? duplicateNodeIds.has(diagnostic.nodeId ?? "") : true,
  );
}

export function assertWorkflowEditorDocument<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  value: unknown,
  options: WorkflowEditorDocumentValidationOptions = {},
): asserts value is WorkflowEditorDocument<TNodeData, TEdgeData> {
  const diagnostics = validateWorkflowEditorDocument<TNodeData, TEdgeData>(value, options);

  if (diagnostics.length > 0) {
    throw new WorkflowEditorDocumentValidationError(diagnostics);
  }
}

export function createWorkflowEditorGraphIndex<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
): WorkflowEditorGraphIndex<TNodeData, TEdgeData> {
  return createWorkflowGraphIndex(document);
}

export function findWorkflowEditorNode<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(document: WorkflowEditorDocument<TNodeData, TEdgeData>, nodeId: string) {
  return document.nodes.find((node) => node.id === nodeId);
}

export function findWorkflowEditorEdge<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(document: WorkflowEditorDocument<TNodeData, TEdgeData>, edgeId: string) {
  return document.edges.find((edge) => edge.id === edgeId);
}

export function addWorkflowEditorNode<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  node: WorkflowEditorNode<TNodeData>,
): WorkflowEditorDocument<TNodeData, TEdgeData> {
  if (document.nodes.some((candidate) => candidate.id === node.id)) {
    throw new Error(`Duplicate workflow node id: ${node.id}`);
  }

  return normalizeWorkflowEditorDocument({
    ...document,
    nodes: [...document.nodes, node],
  });
}

export function updateWorkflowEditorNode<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  nodeId: string,
  patch: Partial<WorkflowEditorNode<TNodeData>>,
): WorkflowEditorDocument<TNodeData, TEdgeData> {
  return normalizeWorkflowEditorDocument({
    ...document,
    nodes: document.nodes.map((node) =>
      node.id === nodeId ? { ...node, ...patch, id: node.id } : node,
    ),
  });
}

export function updateWorkflowEditorNodeWorkflowReference<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  nodeId: string,
  reference: WorkflowEditorWorkflowReference | null,
): WorkflowEditorDocument<TNodeData, TEdgeData> {
  return updateWorkflowEditorNode(document, nodeId, {
    workflowRef: reference?.documentId ? { documentId: reference.documentId } : undefined,
  } as Partial<WorkflowEditorNode<TNodeData>>);
}

export function getWorkflowEditorReferencedDocumentIds<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(document: WorkflowEditorDocument<TNodeData, TEdgeData>) {
  const documentIds = new Set<string>();

  for (const node of document.nodes) {
    if (hasWorkflowEditorWorkflowReference(node)) {
      documentIds.add(node.workflowRef.documentId);
    }
  }

  return [...documentIds];
}

export function hasWorkflowEditorWorkflowReference<TData = Record<string, unknown>>(
  node: WorkflowEditorNode<TData>,
): node is WorkflowEditorNode<TData> & { workflowRef: WorkflowEditorWorkflowReference } {
  return typeof node.workflowRef?.documentId === "string" && node.workflowRef.documentId !== "";
}

export function hasWorkflowEditorNodeComposition<TNodeData = Record<string, unknown>>(
  node: WorkflowEditorNode<TNodeData>,
): node is WorkflowEditorNode<TNodeData> & {
  composition: WorkflowEditorNodeComposition<TNodeData>;
} {
  return (
    !!node.composition &&
    Array.isArray(node.composition.nodes) &&
    Array.isArray(node.composition.edges) &&
    Array.isArray(node.composition.inputBoundaries) &&
    Array.isArray(node.composition.outputBoundaries)
  );
}

export function isWorkflowEditorObjectConstructorNode<TNodeData = Record<string, unknown>>(
  node: WorkflowEditorNode<TNodeData>,
) {
  return node.kind === "json.object";
}

export function getWorkflowEditorObjectConstructorInputs<TNodeData = Record<string, unknown>>(
  node: WorkflowEditorNode<TNodeData>,
) {
  if (!isWorkflowEditorObjectConstructorNode(node)) {
    return [];
  }

  return (node.inputs ?? []).filter((input) => !isWorkflowEditorObjectConstructorAddInput(input));
}

export function addWorkflowEditorObjectConstructorInputToNode<TNodeData = Record<string, unknown>>(
  node: WorkflowEditorNode<TNodeData>,
  options: WorkflowEditorObjectConstructorInputOptions = {},
): WorkflowEditorNode<TNodeData> {
  if (!isWorkflowEditorObjectConstructorNode(node)) {
    return node;
  }

  const syncedNode = syncWorkflowEditorObjectConstructorNode(node);
  const inputs = syncedNode.inputs ?? [];
  const usedPortIds = new Set(inputs.map((input) => input.id));
  const usedPropertyKeys = new Set(
    getWorkflowEditorObjectConstructorInputs(syncedNode).map(
      (input) =>
        getWorkflowEditorObjectConstructorProperty(syncedNode, input.id)?.key ?? input.label,
    ),
  );
  const propertyKey = createUniqueObjectPropertyKey(
    options.propertyKey ?? "property",
    usedPropertyKeys,
  );
  const portId = createUniqueId(
    usedPortIds,
    safeWorkflowEditorId((options.portId ?? propertyKey) || "property"),
  );
  const port = createWorkflowEditorObjectConstructorPort(portId, {
    propertyKey,
    sourceExpression: options.sourceExpression,
    sourceNodeId: options.sourceNodeId,
    sourcePortId: options.sourcePortId,
    type: options.type,
  });
  const addInput = inputs.find(isWorkflowEditorObjectConstructorAddInput);
  const propertyInputs = inputs.filter(
    (input) => !isWorkflowEditorObjectConstructorAddInput(input),
  );

  return syncWorkflowEditorObjectConstructorNode({
    ...syncedNode,
    inputs: [...propertyInputs, port, addInput ?? createWorkflowEditorObjectConstructorAddPort()],
  });
}

export function updateWorkflowEditorObjectConstructorPropertiesInNode<
  TNodeData = Record<string, unknown>,
>(
  node: WorkflowEditorNode<TNodeData>,
  propertyKeysByPortId: Record<string, string>,
): WorkflowEditorNode<TNodeData> {
  if (!isWorkflowEditorObjectConstructorNode(node)) {
    return node;
  }

  const syncedNode = syncWorkflowEditorObjectConstructorNode(node);
  const properties = readWorkflowEditorObjectConstructorProperties(syncedNode.data);
  const usedPropertyKeys = new Set<string>();
  const inputs = (syncedNode.inputs ?? []).map((input) => {
    if (isWorkflowEditorObjectConstructorAddInput(input)) {
      return input;
    }

    const currentProperty = properties[input.id];
    const propertyKey = createUniqueObjectPropertyKey(
      propertyKeysByPortId[input.id] ?? currentProperty?.key ?? input.label,
      usedPropertyKeys,
    );
    usedPropertyKeys.add(propertyKey);

    return Object.assign({}, input, { label: propertyKey });
  });
  const nextProperties = Object.fromEntries(
    inputs
      .filter((input) => !isWorkflowEditorObjectConstructorAddInput(input))
      .map((input) => [
        input.id,
        {
          ...(properties[input.id] ?? { key: input.label }),
          key: input.label,
        },
      ]),
  );

  return syncWorkflowEditorObjectConstructorNode({
    ...syncedNode,
    inputs,
    data: {
      ...(isRecord(syncedNode.data) ? syncedNode.data : {}),
      properties: nextProperties,
    } as TNodeData,
  });
}

export function addWorkflowEditorObjectConstructorInput<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  nodeId: string,
  options: WorkflowEditorObjectConstructorInputOptions = {},
): WorkflowEditorDocument<TNodeData, TEdgeData> {
  const node = findWorkflowEditorNode(document, nodeId);

  if (!node) {
    return document;
  }

  const nextNode = addWorkflowEditorObjectConstructorInputToNode(node, options);

  return updateWorkflowEditorNode(document, nodeId, {
    inputs: nextNode.inputs,
    outputs: nextNode.outputs,
    data: nextNode.data,
  } as Partial<WorkflowEditorNode<TNodeData>>);
}

export function formatWorkflowEditorObjectConstructorExpression<
  TNodeData = Record<string, unknown>,
>(node: WorkflowEditorNode<TNodeData>) {
  if (!isWorkflowEditorObjectConstructorNode(node)) {
    return "{}";
  }

  const properties = readWorkflowEditorObjectConstructorProperties(node.data);
  const entries = getWorkflowEditorObjectConstructorInputs(node).map((input) => {
    const property = properties[input.id];
    const key = property?.key || input.label || input.id;
    const source = property?.sourceExpression || input.badge || input.id;
    return `  ${formatWorkflowEditorObjectPropertyKey(key)}: ${source}`;
  });

  if (entries.length === 0) {
    return "{}";
  }

  return `{\n${entries.join(",\n")}\n}`;
}

export function isWorkflowEditorObjectDecompositionNode<TNodeData = Record<string, unknown>>(
  node: WorkflowEditorNode<TNodeData>,
) {
  return node.kind === "json.object.decompose";
}

export function getWorkflowEditorObjectDecompositionOutputs<TNodeData = Record<string, unknown>>(
  node: WorkflowEditorNode<TNodeData>,
) {
  if (!isWorkflowEditorObjectDecompositionNode(node)) {
    return [];
  }

  return (node.outputs ?? []).filter(
    (output) => !isWorkflowEditorObjectDecompositionAddOutput(output),
  );
}

export function addWorkflowEditorObjectDecompositionOutputToNode<
  TNodeData = Record<string, unknown>,
>(
  node: WorkflowEditorNode<TNodeData>,
  options: WorkflowEditorObjectDecompositionOutputOptions = {},
): WorkflowEditorNode<TNodeData> {
  if (!isWorkflowEditorObjectDecompositionNode(node)) {
    return node;
  }

  const syncedNode = syncWorkflowEditorObjectDecompositionNode(node);
  const outputs = syncedNode.outputs ?? [];
  const usedPortIds = new Set(outputs.map((output) => output.id));
  const usedPropertyKeys = new Set(
    getWorkflowEditorObjectDecompositionOutputs(syncedNode).map(
      (output) =>
        getWorkflowEditorObjectDecompositionProperty(syncedNode, output.id)?.key ?? output.label,
    ),
  );
  const propertyKey = createUniqueObjectPropertyKey(
    options.propertyKey ?? "property",
    usedPropertyKeys,
  );
  const portId = createUniqueId(
    usedPortIds,
    safeWorkflowEditorId((options.portId ?? propertyKey) || "property"),
  );
  const port = createWorkflowEditorObjectDecompositionPort(portId, {
    propertyKey,
    type: getWorkflowEditorObjectDecompositionPropertyType(syncedNode, propertyKey) ?? options.type,
  });
  const addOutput = outputs.find(isWorkflowEditorObjectDecompositionAddOutput);
  const propertyOutputs = outputs.filter(
    (output) => !isWorkflowEditorObjectDecompositionAddOutput(output),
  );

  return syncWorkflowEditorObjectDecompositionNode({
    ...syncedNode,
    outputs: [
      ...propertyOutputs,
      port,
      addOutput ?? createWorkflowEditorObjectDecompositionAddPort(),
    ],
  });
}

export function updateWorkflowEditorObjectDecompositionPropertiesInNode<
  TNodeData = Record<string, unknown>,
>(
  node: WorkflowEditorNode<TNodeData>,
  propertyKeysByPortId: Record<string, string>,
): WorkflowEditorNode<TNodeData> {
  if (!isWorkflowEditorObjectDecompositionNode(node)) {
    return node;
  }

  const syncedNode = syncWorkflowEditorObjectDecompositionNode(node);
  const properties = readWorkflowEditorObjectDecompositionProperties(syncedNode.data);
  const usedPropertyKeys = new Set<string>();
  const outputs = (syncedNode.outputs ?? []).map((output) => {
    if (isWorkflowEditorObjectDecompositionAddOutput(output)) {
      return output;
    }

    const currentProperty = properties[output.id];
    const propertyKey = createUniqueObjectPropertyKey(
      propertyKeysByPortId[output.id] ?? currentProperty?.key ?? output.label,
      usedPropertyKeys,
    );
    usedPropertyKeys.add(propertyKey);

    return Object.assign({}, output, { label: propertyKey });
  });
  const nextProperties = Object.fromEntries(
    outputs
      .filter((output) => !isWorkflowEditorObjectDecompositionAddOutput(output))
      .map((output) => [
        output.id,
        {
          ...(properties[output.id] ?? { key: output.label }),
          key: output.label,
        },
      ]),
  );

  return syncWorkflowEditorObjectDecompositionNode({
    ...syncedNode,
    outputs,
    data: {
      ...(isRecord(syncedNode.data) ? syncedNode.data : {}),
      properties: nextProperties,
    } as TNodeData,
  });
}

export function addWorkflowEditorObjectDecompositionOutput<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  nodeId: string,
  options: WorkflowEditorObjectDecompositionOutputOptions = {},
): WorkflowEditorDocument<TNodeData, TEdgeData> {
  const node = findWorkflowEditorNode(document, nodeId);

  if (!node) {
    return document;
  }

  const nextNode = addWorkflowEditorObjectDecompositionOutputToNode(node, options);

  return updateWorkflowEditorNode(document, nodeId, {
    inputs: nextNode.inputs,
    outputs: nextNode.outputs,
    data: nextNode.data,
  } as Partial<WorkflowEditorNode<TNodeData>>);
}

export function formatWorkflowEditorObjectDecompositionExpression<
  TNodeData = Record<string, unknown>,
>(node: WorkflowEditorNode<TNodeData>) {
  if (!isWorkflowEditorObjectDecompositionNode(node)) {
    return "";
  }

  const properties = readWorkflowEditorObjectDecompositionProperties(node.data);
  const entries = getWorkflowEditorObjectDecompositionOutputs(node).map((output) => {
    const property = properties[output.id];
    const key = property?.key || output.label || output.id;
    return `${key} = object${formatWorkflowEditorObjectPropertyAccess(key)}`;
  });

  return entries.join("\n");
}

export function moveWorkflowEditorNode<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  nodeId: string,
  position: { x: number; y: number },
) {
  return updateWorkflowEditorNode(document, nodeId, position);
}

export function removeWorkflowEditorNode<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  nodeId: string,
): WorkflowEditorDocument<TNodeData, TEdgeData> {
  return {
    ...document,
    nodes: document.nodes.filter((node) => node.id !== nodeId),
    edges: document.edges.filter(
      (edge) => edge.sourceNodeId !== nodeId && edge.targetNodeId !== nodeId,
    ),
  };
}

export function createWorkflowEditorComposedNode<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  nodeIds: readonly string[],
  options: WorkflowEditorComposeNodesOptions<TNodeData> = {},
): WorkflowEditorNode<TNodeData> | null {
  const parts = createWorkflowEditorCompositionParts(document, nodeIds);

  if (!parts) {
    return null;
  }

  const existingIds = new Set(document.nodes.map((node) => node.id));
  const baseId = options.id ?? safeWorkflowEditorId(options.label ?? "composed-node");
  const id =
    options.id ?? options.createId?.(baseId, existingIds) ?? createUniqueId(existingIds, baseId);

  return normalizeWorkflowEditorNode({
    id,
    label: options.label?.trim() || defaultWorkflowEditorComposedNodeLabel(parts.nodes),
    description:
      options.description ?? `${parts.nodes.length} workflow nodes composed behind boundary ports.`,
    kind: options.kind ?? "composed",
    category: options.category ?? commonWorkflowEditorNodeCategory(parts.nodes),
    eyebrow: options.eyebrow,
    packageLabel: options.packageLabel,
    status: options.status,
    tone: options.tone,
    variant: options.variant,
    minimized: options.minimized,
    tags: options.tags ?? commonWorkflowEditorNodeTags(parts.nodes),
    x: Number.isFinite(options.x) ? options.x! : parts.minX,
    y: Number.isFinite(options.y) ? options.y! : parts.minY,
    inputs: parts.inputPorts,
    outputs: parts.outputPorts,
    data: options.data,
    composition: {
      nodes: parts.nodes.map((node) => {
        const cloned = cloneWorkflowEditorNode(node);
        cloned.x = node.x - parts.minX;
        cloned.y = node.y - parts.minY;
        return cloned;
      }),
      edges: parts.internalEdges.map((edge) => cloneWorkflowEditorEdge(edge) as WorkflowEditorEdge),
      inputBoundaries: parts.inputBoundaries.map(cloneWorkflowEditorCompositionBoundary),
      outputBoundaries: parts.outputBoundaries.map(cloneWorkflowEditorCompositionBoundary),
    },
  });
}

export function composeWorkflowEditorNodes<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  nodeIds: readonly string[],
  options: WorkflowEditorComposeNodesOptions<TNodeData> = {},
): WorkflowEditorDocument<TNodeData, TEdgeData> {
  const parts = createWorkflowEditorCompositionParts(document, nodeIds);

  if (!parts) {
    return document;
  }

  const composedNode = createWorkflowEditorComposedNode(document, nodeIds, options);

  if (!composedNode) {
    return document;
  }

  const selectedIds = new Set(parts.nodes.map((node) => node.id));
  const visibleEdges = document.edges
    .filter((edge) => !selectedIds.has(edge.sourceNodeId) && !selectedIds.has(edge.targetNodeId))
    .map(cloneWorkflowEditorEdge);
  const usedEdgeIds = new Set(visibleEdges.map((edge) => edge.id));
  const inputBoundaryByPort = new Map(
    parts.inputBoundaries.map((boundary) => [
      boundaryKey(boundary.nodeId, boundary.portId),
      boundary,
    ]),
  );
  const outputBoundaryByPort = new Map(
    parts.outputBoundaries.map((boundary) => [
      boundaryKey(boundary.nodeId, boundary.portId),
      boundary,
    ]),
  );
  const reroutedIncomingEdges = parts.incomingEdges.flatMap((edge) => {
    const boundary = inputBoundaryByPort.get(boundaryKey(edge.targetNodeId, edge.targetPortId));

    if (!boundary) {
      return [];
    }

    return [
      createWorkflowEditorReroutedEdge(
        edge,
        {
          sourceNodeId: edge.sourceNodeId,
          sourcePortId: edge.sourcePortId,
          targetNodeId: composedNode.id,
          targetPortId: boundary.wrapperPortId,
        },
        usedEdgeIds,
      ),
    ];
  });
  const reroutedOutgoingEdges = parts.outgoingEdges.flatMap((edge) => {
    const boundary = outputBoundaryByPort.get(boundaryKey(edge.sourceNodeId, edge.sourcePortId));

    if (!boundary) {
      return [];
    }

    return [
      createWorkflowEditorReroutedEdge(
        edge,
        {
          sourceNodeId: composedNode.id,
          sourcePortId: boundary.wrapperPortId,
          targetNodeId: edge.targetNodeId,
          targetPortId: edge.targetPortId,
        },
        usedEdgeIds,
      ),
    ];
  });

  return normalizeWorkflowEditorDocument({
    ...document,
    nodes: document.nodes
      .filter((node) => !selectedIds.has(node.id))
      .map(cloneWorkflowEditorNode)
      .concat(composedNode),
    edges: visibleEdges.concat(reroutedIncomingEdges, reroutedOutgoingEdges),
  });
}

export function restoreWorkflowEditorComposedNode<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  nodeId: string,
): WorkflowEditorDocument<TNodeData, TEdgeData> {
  const composedNode = findWorkflowEditorNode(document, nodeId);

  if (!composedNode?.composition) {
    return document;
  }

  const composition = normalizeWorkflowEditorNodeComposition(composedNode.composition);
  const occupiedIds = new Set(
    document.nodes.filter((node) => node.id !== nodeId).map((node) => node.id),
  );
  const idByOriginalId = new Map<string, string>();

  for (const node of composition.nodes) {
    const restoredId = occupiedIds.has(node.id)
      ? createUniqueId(occupiedIds, `${composedNode.id}-${safeWorkflowEditorId(node.id)}`)
      : node.id;
    occupiedIds.add(restoredId);
    idByOriginalId.set(node.id, restoredId);
  }

  const restoredNodes = composition.nodes.map((node) => ({
    ...cloneWorkflowEditorNode(node),
    id: idByOriginalId.get(node.id)!,
    x: composedNode.x + node.x,
    y: composedNode.y + node.y,
  }));
  const visibleEdges = document.edges
    .filter((edge) => edge.sourceNodeId !== nodeId && edge.targetNodeId !== nodeId)
    .map(cloneWorkflowEditorEdge);
  const usedEdgeIds = new Set(visibleEdges.map((edge) => edge.id));
  const inputBoundaryByPort = new Map(
    composition.inputBoundaries.map((boundary) => [boundary.wrapperPortId, boundary]),
  );
  const outputBoundaryByPort = new Map(
    composition.outputBoundaries.map((boundary) => [boundary.wrapperPortId, boundary]),
  );
  const restoredInternalEdges = composition.edges.flatMap((edge) => {
    const sourceNodeId = idByOriginalId.get(edge.sourceNodeId);
    const targetNodeId = idByOriginalId.get(edge.targetNodeId);

    if (!sourceNodeId || !targetNodeId) {
      return [];
    }

    return [
      createWorkflowEditorReroutedEdge(
        edge,
        {
          sourceNodeId,
          sourcePortId: edge.sourcePortId,
          targetNodeId,
          targetPortId: edge.targetPortId,
        },
        usedEdgeIds,
      ),
    ];
  });
  const restoredExternalEdges = document.edges.flatMap((edge) => {
    if (edge.targetNodeId === nodeId) {
      const boundary = inputBoundaryByPort.get(edge.targetPortId);
      const targetNodeId = boundary ? idByOriginalId.get(boundary.nodeId) : null;

      if (!boundary || !targetNodeId) {
        return [];
      }

      return [
        createWorkflowEditorReroutedEdge(
          edge,
          {
            sourceNodeId: edge.sourceNodeId,
            sourcePortId: edge.sourcePortId,
            targetNodeId,
            targetPortId: boundary.portId,
          },
          usedEdgeIds,
        ),
      ];
    }

    if (edge.sourceNodeId === nodeId) {
      const boundary = outputBoundaryByPort.get(edge.sourcePortId);
      const sourceNodeId = boundary ? idByOriginalId.get(boundary.nodeId) : null;

      if (!boundary || !sourceNodeId) {
        return [];
      }

      return [
        createWorkflowEditorReroutedEdge(
          edge,
          {
            sourceNodeId,
            sourcePortId: boundary.portId,
            targetNodeId: edge.targetNodeId,
            targetPortId: edge.targetPortId,
          },
          usedEdgeIds,
        ),
      ];
    }

    return [];
  });

  return normalizeWorkflowEditorDocument({
    ...document,
    nodes: document.nodes
      .filter((node) => node.id !== nodeId)
      .map(cloneWorkflowEditorNode)
      .concat(restoredNodes),
    edges: visibleEdges.concat(
      restoredInternalEdges as Array<WorkflowEditorEdge<TEdgeData>>,
      restoredExternalEdges,
    ),
  });
}

export function addWorkflowEditorEdge<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  edge: WorkflowEditorEdge<TEdgeData>,
): WorkflowEditorDocument<TNodeData, TEdgeData> {
  if (document.edges.some((candidate) => candidate.id === edge.id)) {
    throw new Error(`Duplicate workflow edge id: ${edge.id}`);
  }

  return normalizeWorkflowEditorDocument({
    ...document,
    edges: [...document.edges, edge],
  });
}

export function removeWorkflowEditorEdge<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  edgeId: string,
): WorkflowEditorDocument<TNodeData, TEdgeData> {
  return {
    ...document,
    edges: document.edges.filter((edge) => edge.id !== edgeId),
  };
}

export function validateWorkflowEditorConnection<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  connection: WorkflowEditorConnectionInput,
  options: WorkflowEditorTypeValidationOptions = {},
): WorkflowEditorConnectionValidity {
  const sourceNode = findWorkflowEditorNode(document, connection.sourceNodeId);
  const targetNode = findWorkflowEditorNode(document, connection.targetNodeId);

  if (!sourceNode || !targetNode) {
    return { valid: false, reason: "missing-node" };
  }

  if (connection.sourceNodeId === connection.targetNodeId) {
    return { valid: false, reason: "self-connection" };
  }

  const uiConnection = {
    nodes: toUiWorkflowBuilderNodes(document.nodes),
    edges: toUiWorkflowBuilderEdges(document.edges),
    ...connection,
  };
  const structuralValidity = getWorkflowBuilderConnectionValidity({
    ...uiConnection,
    edges: [],
  });

  if (!structuralValidity.valid) {
    return structuralValidity;
  }

  const sourcePort = sourceNode.outputs!.find((port) => port.id === connection.sourcePortId)!;
  const targetPort = targetNode.inputs!.find((port) => port.id === connection.targetPortId)!;

  if (
    !isWorkflowEditorPortTypeAssignable(sourcePort.type, targetPort.type, options.typeDefinitions)
  ) {
    return { valid: false, reason: "kind-mismatch" };
  }

  const baseValidity = getWorkflowBuilderConnectionValidity(uiConnection);

  if (!baseValidity.valid) {
    return baseValidity;
  }

  if (wouldCreateWorkflowEditorCycle(document, connection)) {
    return { valid: false, reason: "cycle" };
  }

  return { valid: true };
}

export function connectWorkflowEditorNodes<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  connection: WorkflowEditorConnectionInput,
  options: WorkflowEditorTypeValidationOptions = {},
): WorkflowEditorDocument<TNodeData, TEdgeData> {
  const validity = validateWorkflowEditorConnection(document, connection, options);

  if (!validity.valid) {
    return document;
  }

  const expandedObjectConstructorConnection = expandWorkflowEditorObjectConstructorConnection(
    document,
    connection,
  );
  const expandedConnection = expandWorkflowEditorObjectDecompositionConnection(
    expandedObjectConstructorConnection.document,
    expandedObjectConstructorConnection.connection,
  );
  const edgeId = createWorkflowEditorEdgeId(
    expandedConnection.document,
    expandedConnection.connection,
  );

  return addWorkflowEditorEdge(expandedConnection.document, {
    id: edgeId,
    ...expandedConnection.connection,
  } as WorkflowEditorEdge<TEdgeData>);
}

export function analyzeWorkflowEditorPortTypes<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  options: WorkflowEditorTypeValidationOptions = {},
): WorkflowEditorTypeDiagnostic[] {
  const diagnostics: WorkflowEditorTypeDiagnostic[] = [];
  const typeDefinitions = createWorkflowEditorTypeDefinitionMap(options.typeDefinitions);

  for (const edge of document.edges) {
    const sourceNode = findWorkflowEditorNode(document, edge.sourceNodeId);
    const targetNode = findWorkflowEditorNode(document, edge.targetNodeId);
    const sourcePort = sourceNode?.outputs?.find((port) => port.id === edge.sourcePortId);
    const targetPort = targetNode?.inputs?.find((port) => port.id === edge.targetPortId);

    if (!sourceNode || !targetNode || !sourcePort || !targetPort) {
      continue;
    }

    const resolutionErrors = [
      ...findWorkflowEditorPortTypeResolutionErrors(sourcePort.type, typeDefinitions),
      ...findWorkflowEditorPortTypeResolutionErrors(targetPort.type, typeDefinitions),
    ];
    const uniqueResolutionErrors = [...new Set(resolutionErrors)];

    for (const error of uniqueResolutionErrors) {
      diagnostics.push({
        type: "missing-type-definition",
        edgeId: edge.id,
        sourceNodeId: edge.sourceNodeId,
        sourcePortId: edge.sourcePortId,
        targetNodeId: edge.targetNodeId,
        targetPortId: edge.targetPortId,
        message: error,
      });
    }

    if (
      uniqueResolutionErrors.length === 0 &&
      !isWorkflowEditorPortTypeAssignable(sourcePort.type, targetPort.type, options.typeDefinitions)
    ) {
      diagnostics.push({
        type: "incompatible-port-type",
        edgeId: edge.id,
        sourceNodeId: edge.sourceNodeId,
        sourcePortId: edge.sourcePortId,
        targetNodeId: edge.targetNodeId,
        targetPortId: edge.targetPortId,
        message: `Output port ${edge.sourceNodeId}.${edge.sourcePortId} is not assignable to input port ${edge.targetNodeId}.${edge.targetPortId}`,
      });
    }
  }

  return diagnostics;
}

export function isWorkflowEditorPortTypeAssignable(
  source: WorkflowEditorPortType,
  target: WorkflowEditorPortType,
  typeDefinitions: readonly WorkflowEditorTypeDefinition[] = [],
): boolean {
  return isWorkflowEditorPortTypeAssignableWithState(
    source,
    target,
    {
      definitions: createWorkflowEditorTypeDefinitionMap(typeDefinitions),
      resolving: new Set(),
    },
    0,
  );
}

export function duplicateWorkflowEditorNode<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  nodeId: string,
  options: WorkflowEditorDuplicateNodeOptions = {},
): WorkflowEditorDocument<TNodeData, TEdgeData> {
  const node = findWorkflowEditorNode(document, nodeId);

  if (!node) {
    return document;
  }

  const existingIds = new Set(document.nodes.map((candidate) => candidate.id));
  const nextId =
    options.createId?.(nodeId, existingIds) ??
    createWorkflowEditorNodeId(document, `${nodeId}-copy`);

  return addWorkflowEditorNode(document, {
    ...node,
    id: nextId,
    label: `${node.label} Copy`,
    x: node.x + (options.offsetX ?? 48),
    y: node.y + (options.offsetY ?? 48),
  });
}

export function detectWorkflowEditorCycles<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(document: WorkflowEditorDocument<TNodeData, TEdgeData>) {
  const adjacency = createWorkflowAdjacency(document);
  const cycles: string[][] = [];
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const path: string[] = [];

  function visit(nodeId: string) {
    if (visiting.has(nodeId)) {
      const cycleStart = path.indexOf(nodeId);
      cycles.push([...path.slice(cycleStart), nodeId]);
      return;
    }

    if (visited.has(nodeId)) {
      return;
    }

    visiting.add(nodeId);
    path.push(nodeId);

    for (const nextNodeId of adjacency.get(nodeId) ?? []) {
      visit(nextNodeId);
    }

    path.pop();
    visiting.delete(nodeId);
    visited.add(nodeId);
  }

  for (const node of document.nodes) {
    visit(node.id);
  }

  return cycles;
}

export function wouldCreateWorkflowEditorCycle<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  connection: WorkflowEditorConnectionInput,
) {
  if (connection.sourceNodeId === connection.targetNodeId) {
    return true;
  }

  return canReachWorkflowEditorNode(document, connection.targetNodeId, connection.sourceNodeId);
}

export function isWorkflowEditorDirectedAcyclicGraph<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(document: WorkflowEditorDocument<TNodeData, TEdgeData>) {
  return detectWorkflowEditorCycles(document).length === 0;
}

export function topologicallySortWorkflowEditorNodes<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(document: WorkflowEditorDocument<TNodeData, TEdgeData>) {
  const nodeLookup = new Map(document.nodes.map((node) => [node.id, node]));
  const inDegree = new Map(document.nodes.map((node) => [node.id, 0]));
  const adjacency = createWorkflowAdjacency(document);

  for (const edge of document.edges) {
    if (inDegree.has(edge.targetNodeId)) {
      inDegree.set(edge.targetNodeId, (inDegree.get(edge.targetNodeId) ?? 0) + 1);
    }
  }

  const queue = document.nodes.filter((node) => inDegree.get(node.id) === 0).map((node) => node.id);
  const sorted: Array<WorkflowEditorNode<TNodeData>> = [];

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const nodeId = queue[cursor]!;
    const node = nodeLookup.get(nodeId);

    if (node) {
      sorted.push(node);
    }

    for (const nextNodeId of adjacency.get(nodeId) ?? []) {
      const nextDegree = (inDegree.get(nextNodeId) ?? 0) - 1;
      inDegree.set(nextNodeId, nextDegree);

      if (nextDegree === 0) {
        queue.push(nextNodeId);
      }
    }
  }

  const sortedIds = new Set(sorted.map((node) => node.id));
  return [...sorted, ...document.nodes.filter((node) => !sortedIds.has(node.id))];
}

export function toUiWorkflowBuilderNodes<TData = Record<string, unknown>>(
  nodes: Array<WorkflowEditorNode<TData>>,
): UiWorkflowBuilderNodeData[] {
  return nodes.map((node) => ({
    id: node.id,
    label: node.label,
    description: node.description,
    kind: node.kind,
    category: node.category,
    status: node.status,
    eyebrow: node.eyebrow,
    packageLabel: node.packageLabel,
    tone: node.tone,
    variant: node.variant,
    minimized: node.minimized,
    tags: node.tags,
    x: node.x,
    y: node.y,
    inputs: node.inputs,
    outputs: node.outputs,
    metadata: node.data as Record<string, unknown> | undefined,
  }));
}

export function fromUiWorkflowBuilderNodes<TData = Record<string, unknown>>(
  uiNodes: UiWorkflowBuilderNodeData[],
  previousNodes: Array<WorkflowEditorNode<TData>>,
): Array<WorkflowEditorNode<TData>> {
  const previousLookup = new Map(previousNodes.map((node) => [node.id, node]));

  return uiNodes.map((node) => {
    const previousNode = previousLookup.get(node.id);

    return {
      id: node.id,
      label: node.label,
      description: node.description,
      kind: node.kind,
      category: node.category,
      status: node.status,
      eyebrow: node.eyebrow,
      packageLabel: node.packageLabel,
      tone: node.tone,
      variant: node.variant,
      minimized: node.minimized,
      tags: node.tags,
      x: node.x,
      y: node.y,
      inputs: node.inputs as WorkflowEditorPort[] | undefined,
      outputs: node.outputs as WorkflowEditorPort[] | undefined,
      data: (node.metadata as TData | undefined) ?? previousNode?.data,
      workflowRef: previousNode?.workflowRef,
      composition: previousNode?.composition,
    };
  });
}

export function toUiWorkflowBuilderEdges<TData = Record<string, unknown>>(
  edges: Array<WorkflowEditorEdge<TData>>,
): UiWorkflowBuilderEdge[] {
  return edges.map((edge) => ({
    id: edge.id,
    sourceNodeId: edge.sourceNodeId,
    sourcePortId: edge.sourcePortId,
    targetNodeId: edge.targetNodeId,
    targetPortId: edge.targetPortId,
    status: edge.status,
    metadata: edge.data as Record<string, unknown> | undefined,
  }));
}

export function fromUiWorkflowBuilderEdges<TData = Record<string, unknown>>(
  uiEdges: UiWorkflowBuilderEdge[],
  previousEdges: Array<WorkflowEditorEdge<TData>>,
): Array<WorkflowEditorEdge<TData>> {
  const previousLookup = new Map(previousEdges.map((edge) => [edge.id, edge]));

  return uiEdges.map((edge) => {
    const previousEdge = previousLookup.get(edge.id);

    return {
      id: edge.id,
      sourceNodeId: edge.sourceNodeId,
      sourcePortId: edge.sourcePortId,
      targetNodeId: edge.targetNodeId,
      targetPortId: edge.targetPortId,
      status: edge.status,
      data: (edge.metadata as TData | undefined) ?? previousEdge?.data,
    };
  });
}

export function toUiWorkflowBuilderViewport(
  viewport: WorkflowEditorViewport | undefined,
): UiWorkflowBuilderViewport | undefined {
  return viewport;
}

type WorkflowEditorPortTypeAssignabilityState = {
  definitions: Map<string, WorkflowEditorTypeDefinition>;
  resolving: Set<string>;
};

function createWorkflowEditorTypeDefinitionMap(
  typeDefinitions: readonly WorkflowEditorTypeDefinition[] = [],
) {
  return new Map(typeDefinitions.map((definition) => [definition.name, definition]));
}

function isWorkflowEditorPortTypeAssignableWithState(
  source: WorkflowEditorPortType,
  target: WorkflowEditorPortType,
  state: WorkflowEditorPortTypeAssignabilityState,
  depth: number,
): boolean {
  if (depth > 100) {
    return false;
  }

  const resolvedSource = resolveWorkflowEditorPortType(source, state);
  const resolvedTarget = resolveWorkflowEditorPortType(target, state);

  if (!resolvedSource || !resolvedTarget) {
    return false;
  }

  if (resolvedSource !== source) {
    return isWorkflowEditorPortTypeAssignableWithState(resolvedSource, target, state, depth + 1);
  }

  if (resolvedTarget !== target) {
    return isWorkflowEditorPortTypeAssignableWithState(source, resolvedTarget, state, depth + 1);
  }

  if (source.kind === "any" || target.kind === "any") {
    return true;
  }

  if (target.kind === "unknown" || source.kind === "never") {
    return true;
  }

  if (source.kind === "unknown") {
    return false;
  }

  if (target.kind === "never") {
    return false;
  }

  if (target.kind === "union") {
    return target.types.some((type) =>
      isWorkflowEditorPortTypeAssignableWithState(source, type, state, depth + 1),
    );
  }

  if (source.kind === "union") {
    return source.types.every((type) =>
      isWorkflowEditorPortTypeAssignableWithState(type, target, state, depth + 1),
    );
  }

  if (target.kind === "intersection") {
    return target.types.every((type) =>
      isWorkflowEditorPortTypeAssignableWithState(source, type, state, depth + 1),
    );
  }

  if (source.kind === "intersection" && target.kind !== "object") {
    return source.types.some((type) =>
      isWorkflowEditorPortTypeAssignableWithState(type, target, state, depth + 1),
    );
  }

  if (source.kind === "literal") {
    if (target.kind === "literal") {
      return source.value === target.value;
    }

    return target.kind === workflowEditorPrimitiveKindForLiteral(source.value);
  }

  if (target.kind === "literal") {
    return false;
  }

  if (isWorkflowEditorPrimitivePortTypeKind(source.kind)) {
    return source.kind === target.kind;
  }

  if (source.kind === "array" && target.kind === "array") {
    return isWorkflowEditorPortTypeAssignableWithState(
      source.element,
      target.element,
      state,
      depth + 1,
    );
  }

  if (target.kind === "object") {
    return isWorkflowEditorObjectPortTypeAssignable(source, target, state, depth + 1);
  }

  return false;
}

function resolveWorkflowEditorPortType(
  type: WorkflowEditorPortType,
  state: WorkflowEditorPortTypeAssignabilityState,
): WorkflowEditorPortType | null {
  if (type.kind !== "ref") {
    return type;
  }

  if (state.resolving.has(type.name)) {
    return null;
  }

  const definition = state.definitions.get(type.name);

  if (!definition) {
    return null;
  }

  state.resolving.add(type.name);

  const parentTypes: WorkflowEditorPortType[] = [];

  for (const parentName of definition.extends ?? []) {
    const parentType = resolveWorkflowEditorPortType({ kind: "ref", name: parentName }, state);

    if (!parentType) {
      state.resolving.delete(type.name);
      return null;
    }

    parentTypes.push(parentType);
  }

  state.resolving.delete(type.name);

  if (parentTypes.length === 0) {
    return definition.type;
  }

  return {
    kind: "intersection",
    types: [...parentTypes, definition.type],
  };
}

function isWorkflowEditorObjectPortTypeAssignable(
  source: WorkflowEditorPortType,
  target: WorkflowEditorPortType,
  state: WorkflowEditorPortTypeAssignabilityState,
  depth: number,
) {
  const sourceProperties = workflowEditorObjectPropertiesFromType(source, state, depth);
  const targetProperties = workflowEditorObjectPropertiesFromType(target, state, depth);

  if (!sourceProperties || !targetProperties) {
    return false;
  }

  for (const [propertyName, targetProperty] of Object.entries(targetProperties)) {
    const sourceProperty = sourceProperties[propertyName];

    if (!sourceProperty) {
      if (targetProperty.optional) {
        continue;
      }

      return false;
    }

    if (sourceProperty.optional && !targetProperty.optional) {
      return false;
    }

    if (
      !isWorkflowEditorPortTypeAssignableWithState(
        sourceProperty.type,
        targetProperty.type,
        state,
        depth + 1,
      )
    ) {
      return false;
    }
  }

  return true;
}

function workflowEditorObjectPropertiesFromType(
  type: WorkflowEditorPortType,
  state: WorkflowEditorPortTypeAssignabilityState,
  depth: number,
): Record<string, WorkflowEditorPortProperty> | null {
  if (depth > 100) {
    return null;
  }

  const resolvedType = resolveWorkflowEditorPortType(type, state);

  if (!resolvedType) {
    return null;
  }

  if (resolvedType !== type) {
    return workflowEditorObjectPropertiesFromType(resolvedType, state, depth + 1);
  }

  if (type.kind === "object") {
    return type.properties ?? {};
  }

  if (type.kind !== "intersection") {
    return null;
  }

  let merged: Record<string, WorkflowEditorPortProperty> | null = null;

  for (const intersectionType of type.types) {
    const properties = workflowEditorObjectPropertiesFromType(intersectionType, state, depth + 1);

    if (!properties) {
      continue;
    }

    merged ??= {};

    for (const [propertyName, property] of Object.entries(properties)) {
      const existing = merged[propertyName];

      merged[propertyName] = existing
        ? {
            optional: existing.optional && property.optional,
            type: { kind: "intersection", types: [existing.type, property.type] },
          }
        : property;
    }
  }

  return merged;
}

function findWorkflowEditorPortTypeResolutionErrors(
  type: WorkflowEditorPortType,
  definitions: Map<string, WorkflowEditorTypeDefinition>,
) {
  const errors: string[] = [];
  collectWorkflowEditorPortTypeResolutionErrors(type, definitions, [], errors);
  return errors;
}

function collectWorkflowEditorPortTypeResolutionErrors(
  type: WorkflowEditorPortType,
  definitions: Map<string, WorkflowEditorTypeDefinition>,
  stack: string[],
  errors: string[],
) {
  switch (type.kind) {
    case "array":
      collectWorkflowEditorPortTypeResolutionErrors(type.element, definitions, stack, errors);
      return;
    case "object":
      for (const property of Object.values(type.properties ?? {})) {
        collectWorkflowEditorPortTypeResolutionErrors(property.type, definitions, stack, errors);
      }
      return;
    case "union":
    case "intersection":
      for (const childType of type.types) {
        collectWorkflowEditorPortTypeResolutionErrors(childType, definitions, stack, errors);
      }
      return;
    case "ref": {
      if (stack.includes(type.name)) {
        errors.push(`Cyclic workflow port type reference: ${[...stack, type.name].join(" -> ")}`);
        return;
      }

      const definition = definitions.get(type.name);

      if (!definition) {
        errors.push(`Missing workflow port type definition: ${type.name}`);
        return;
      }

      const nextStack = [...stack, type.name];

      for (const parentName of definition.extends ?? []) {
        collectWorkflowEditorPortTypeResolutionErrors(
          { kind: "ref", name: parentName },
          definitions,
          nextStack,
          errors,
        );
      }

      collectWorkflowEditorPortTypeResolutionErrors(
        definition.type,
        definitions,
        nextStack,
        errors,
      );
      return;
    }
    default:
      return;
  }
}

function isWorkflowEditorPrimitivePortTypeKind(kind: WorkflowEditorPortType["kind"]) {
  return (
    kind === "string" ||
    kind === "number" ||
    kind === "boolean" ||
    kind === "null" ||
    kind === "undefined"
  );
}

function workflowEditorPrimitiveKindForLiteral(
  value: string | number | boolean | null,
): "string" | "number" | "boolean" | "null" {
  if (value === null) {
    return "null";
  }

  if (typeof value === "string") {
    return "string";
  }

  if (typeof value === "number") {
    return "number";
  }

  return "boolean";
}

function expandWorkflowEditorObjectConstructorConnection<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  connection: WorkflowEditorConnectionInput,
): {
  document: WorkflowEditorDocument<TNodeData, TEdgeData>;
  connection: WorkflowEditorConnectionInput;
} {
  const sourceNode = findWorkflowEditorNode(document, connection.sourceNodeId);
  const targetNode = findWorkflowEditorNode(document, connection.targetNodeId);
  const sourcePort = sourceNode?.outputs?.find((port) => port.id === connection.sourcePortId);
  const targetPort = targetNode?.inputs?.find((port) => port.id === connection.targetPortId);

  if (!sourceNode || !targetNode || !sourcePort || !targetPort) {
    return { document, connection };
  }

  if (!isWorkflowEditorObjectConstructorNode(targetNode)) {
    return { document, connection };
  }

  const targetPortOccupied = document.edges.some(
    (edge) => edge.targetNodeId === targetNode.id && edge.targetPortId === targetPort.id,
  );
  const shouldCreatePort =
    isWorkflowEditorObjectConstructorAddInput(targetPort) || targetPortOccupied;
  const source = createWorkflowEditorObjectConstructorSource(sourceNode, sourcePort);

  if (!shouldCreatePort) {
    const nextTargetNode = syncWorkflowEditorObjectConstructorNode({
      ...targetNode,
      inputs: (targetNode.inputs ?? []).map((input) =>
        input.id === targetPort.id
          ? createWorkflowEditorObjectConstructorPort(input.id, {
              propertyKey:
                getWorkflowEditorObjectConstructorProperty(targetNode, input.id)?.key ??
                input.label ??
                source.propertyKey,
              sourceExpression: source.expression,
              sourceNodeId: sourceNode.id,
              sourcePortId: sourcePort.id,
              type: sourcePort.type,
            })
          : input,
      ),
    });

    return {
      document: {
        ...document,
        nodes: document.nodes.map((node) => (node.id === targetNode.id ? nextTargetNode : node)),
      },
      connection,
    };
  }

  const nextTargetNode = addWorkflowEditorObjectConstructorInputToNode(targetNode, {
    propertyKey: source.propertyKey,
    sourceExpression: source.expression,
    sourceNodeId: sourceNode.id,
    sourcePortId: sourcePort.id,
    type: sourcePort.type,
  });
  const nextPort = getWorkflowEditorObjectConstructorInputs(nextTargetNode).at(-1);

  if (!nextPort) {
    return { document, connection };
  }

  return {
    document: {
      ...document,
      nodes: document.nodes.map((node) => (node.id === targetNode.id ? nextTargetNode : node)),
    },
    connection: {
      ...connection,
      targetPortId: nextPort.id,
    },
  };
}

function expandWorkflowEditorObjectDecompositionConnection<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  connection: WorkflowEditorConnectionInput,
): {
  document: WorkflowEditorDocument<TNodeData, TEdgeData>;
  connection: WorkflowEditorConnectionInput;
} {
  const sourceNode = findWorkflowEditorNode(document, connection.sourceNodeId);
  const targetNode = findWorkflowEditorNode(document, connection.targetNodeId);
  const sourcePort = sourceNode?.outputs?.find((port) => port.id === connection.sourcePortId);
  const targetPort = targetNode?.inputs?.find((port) => port.id === connection.targetPortId);

  if (!sourceNode || !targetNode || !sourcePort || !targetPort) {
    return { document, connection };
  }

  if (
    !isWorkflowEditorObjectDecompositionNode(sourceNode) ||
    !isWorkflowEditorObjectDecompositionAddOutput(sourcePort)
  ) {
    return { document, connection };
  }

  const target = createWorkflowEditorObjectDecompositionTarget(targetNode, targetPort);
  const nextSourceNode = addWorkflowEditorObjectDecompositionOutputToNode(sourceNode, {
    propertyKey: target.propertyKey,
    type: targetPort.type,
  });
  const nextPort = getWorkflowEditorObjectDecompositionOutputs(nextSourceNode).at(-1);

  if (!nextPort) {
    return { document, connection };
  }

  return {
    document: {
      ...document,
      nodes: document.nodes.map((node) => (node.id === sourceNode.id ? nextSourceNode : node)),
    },
    connection: {
      ...connection,
      sourcePortId: nextPort.id,
    },
  };
}

function syncWorkflowEditorObjectConstructorNodes<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(nodes: Array<WorkflowEditorNode<TNodeData>>, edges: Array<WorkflowEditorEdge<TEdgeData>>) {
  const nodeLookup = new Map(nodes.map((node) => [node.id, node]));

  return nodes.map((node) => {
    if (!isWorkflowEditorObjectConstructorNode(node)) {
      return node;
    }

    let nextNode = syncWorkflowEditorObjectConstructorNode(node);

    for (const input of getWorkflowEditorObjectConstructorInputs(nextNode)) {
      const incomingEdge = edges.find(
        (edge) => edge.targetNodeId === nextNode.id && edge.targetPortId === input.id,
      );
      const sourceNode = incomingEdge ? nodeLookup.get(incomingEdge.sourceNodeId) : undefined;
      const sourcePort = sourceNode?.outputs?.find(
        (port) => port.id === incomingEdge?.sourcePortId,
      );

      if (!incomingEdge || !sourceNode || !sourcePort) {
        continue;
      }

      const source = createWorkflowEditorObjectConstructorSource(sourceNode, sourcePort);
      nextNode = syncWorkflowEditorObjectConstructorNode({
        ...nextNode,
        inputs: (nextNode.inputs ?? []).map((nextInput) =>
          nextInput.id === input.id
            ? createWorkflowEditorObjectConstructorPort(nextInput.id, {
                propertyKey:
                  getWorkflowEditorObjectConstructorProperty(nextNode, nextInput.id)?.key ??
                  nextInput.label ??
                  source.propertyKey,
                sourceExpression: source.expression,
                sourceNodeId: sourceNode.id,
                sourcePortId: sourcePort.id,
                type: sourcePort.type,
              })
            : nextInput,
        ),
      });
    }

    return nextNode;
  });
}

function syncWorkflowEditorObjectDecompositionNodes<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(nodes: Array<WorkflowEditorNode<TNodeData>>, edges: Array<WorkflowEditorEdge<TEdgeData>>) {
  const nodeLookup = new Map(nodes.map((node) => [node.id, node]));

  return nodes.map((node) => {
    if (!isWorkflowEditorObjectDecompositionNode(node)) {
      return node;
    }

    let nextNode = syncWorkflowEditorObjectDecompositionNode(node);
    const objectInput = nextNode.inputs?.find(isWorkflowEditorObjectDecompositionObjectInput);
    const incomingEdge = edges.find(
      (edge) => edge.targetNodeId === nextNode.id && edge.targetPortId === objectInput?.id,
    );
    const sourceNode = incomingEdge ? nodeLookup.get(incomingEdge.sourceNodeId) : undefined;
    const sourcePort = sourceNode?.outputs?.find((port) => port.id === incomingEdge?.sourcePortId);

    if (incomingEdge && sourceNode && sourcePort) {
      nextNode = syncWorkflowEditorObjectDecompositionNode({
        ...nextNode,
        inputs: (nextNode.inputs ?? []).map((input) =>
          input.id === objectInput?.id
            ? Object.assign({}, input, { type: sourcePort.type })
            : input,
        ),
      });
    }

    return nextNode;
  });
}

function syncWorkflowEditorObjectConstructorNode<TNodeData = Record<string, unknown>>(
  node: WorkflowEditorNode<TNodeData>,
): WorkflowEditorNode<TNodeData> {
  if (!isWorkflowEditorObjectConstructorNode(node)) {
    return node;
  }

  const properties = readWorkflowEditorObjectConstructorProperties(node.data);
  const propertyInputs = (node.inputs ?? []).filter(
    (input) => !isWorkflowEditorObjectConstructorAddInput(input),
  );
  const usedPropertyKeys = new Set<string>();
  const syncedProperties: Record<string, WorkflowEditorObjectConstructorProperty> = {};
  const syncedInputs = propertyInputs.map((input) => {
    const property =
      properties[input.id] ?? getWorkflowEditorObjectConstructorProperty(node, input.id);
    const propertyKey = createUniqueObjectPropertyKey(
      property?.key ?? input.label ?? input.id,
      usedPropertyKeys,
    );
    usedPropertyKeys.add(propertyKey);
    syncedProperties[input.id] = {
      ...(property ?? { key: propertyKey }),
      key: propertyKey,
    };

    return Object.assign({}, input, {
      label: propertyKey,
      badge: property?.sourceExpression ?? input.badge,
      type: input.type ?? { kind: "any" },
      metadata: {
        ...(input.metadata ?? {}),
        objectConstructorRole: "property",
      },
    });
  });
  const outputProperties = Object.fromEntries(
    syncedInputs.map((input) => [
      syncedProperties[input.id]!.key,
      { type: input.type } satisfies WorkflowEditorPortProperty,
    ]),
  );
  const outputs = node.outputs?.length
    ? node.outputs.map((output) =>
        output.id === "value"
          ? {
              ...output,
              label: output.label || "Object",
              type: { kind: "object", properties: outputProperties } as WorkflowEditorPortType,
            }
          : output,
      )
    : [
        {
          id: "value",
          label: "Object",
          type: { kind: "object", properties: outputProperties } as WorkflowEditorPortType,
        },
      ];

  if (!outputs.some((output) => output.id === "value")) {
    outputs.push({
      id: "value",
      label: "Object",
      type: { kind: "object", properties: outputProperties },
    });
  }

  return {
    ...node,
    inputs: [...syncedInputs, createWorkflowEditorObjectConstructorAddPort()],
    outputs,
    data: {
      ...(isRecord(node.data) ? node.data : {}),
      properties: syncedProperties,
    } as TNodeData,
  };
}

function createWorkflowEditorObjectConstructorPort(
  id: string,
  options: WorkflowEditorObjectConstructorInputOptions,
): WorkflowEditorPort {
  const propertyKey = normalizeObjectPropertyKey(options.propertyKey ?? id);

  return {
    id,
    label: propertyKey,
    type: options.type ?? { kind: "any" },
    badge: options.sourceExpression,
    metadata: {
      objectConstructorRole: "property",
      objectConstructorProperty: {
        key: propertyKey,
        sourceExpression: options.sourceExpression,
        sourceNodeId: options.sourceNodeId,
        sourcePortId: options.sourcePortId,
      } satisfies WorkflowEditorObjectConstructorProperty,
    },
  };
}

function createWorkflowEditorObjectConstructorAddPort(): WorkflowEditorPort {
  return {
    id: "property",
    label: "Add property",
    type: { kind: "any" },
    badge: "new",
    metadata: { objectConstructorRole: "add-property" },
  };
}

function isWorkflowEditorObjectConstructorAddInput(port: WorkflowEditorPort) {
  return port.id === "property" && port.metadata?.objectConstructorRole === "add-property";
}

function getWorkflowEditorObjectConstructorProperty<TNodeData = Record<string, unknown>>(
  node: WorkflowEditorNode<TNodeData>,
  portId: string,
) {
  const properties = readWorkflowEditorObjectConstructorProperties(node.data);
  const property = properties[portId];

  if (property) {
    return property;
  }

  const port = node.inputs?.find((input) => input.id === portId);
  const metadataProperty = isRecord(port?.metadata?.objectConstructorProperty)
    ? port.metadata.objectConstructorProperty
    : undefined;

  if (!metadataProperty) {
    return undefined;
  }

  return {
    key: String(metadataProperty.key ?? port?.label ?? portId),
    sourceExpression:
      typeof metadataProperty.sourceExpression === "string"
        ? metadataProperty.sourceExpression
        : undefined,
    sourceNodeId:
      typeof metadataProperty.sourceNodeId === "string" ? metadataProperty.sourceNodeId : undefined,
    sourcePortId:
      typeof metadataProperty.sourcePortId === "string" ? metadataProperty.sourcePortId : undefined,
  } satisfies WorkflowEditorObjectConstructorProperty;
}

function readWorkflowEditorObjectConstructorProperties(
  data: unknown,
): Record<string, WorkflowEditorObjectConstructorProperty> {
  if (!isRecord(data) || !isRecord(data.properties)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(data.properties).flatMap(([portId, value]) => {
      if (!isRecord(value)) {
        return [];
      }

      const key = normalizeObjectPropertyKey(value.key ?? portId);

      return [
        [
          portId,
          {
            key,
            sourceExpression:
              typeof value.sourceExpression === "string" ? value.sourceExpression : undefined,
            sourceNodeId: typeof value.sourceNodeId === "string" ? value.sourceNodeId : undefined,
            sourcePortId: typeof value.sourcePortId === "string" ? value.sourcePortId : undefined,
          } satisfies WorkflowEditorObjectConstructorProperty,
        ],
      ];
    }),
  );
}

function createWorkflowEditorObjectConstructorSource<TNodeData = Record<string, unknown>>(
  node: WorkflowEditorNode<TNodeData>,
  port: WorkflowEditorPort,
) {
  const nodeKey = normalizeObjectPropertyKey(node.label || node.id);
  const portKey = normalizeObjectPropertyKey(port.label || port.id);
  const expression = isGenericWorkflowEditorPortKey(portKey) ? nodeKey : `${nodeKey}.${portKey}`;
  const propertyKey = isGenericWorkflowEditorPortKey(portKey) ? nodeKey : portKey;

  return {
    expression,
    propertyKey,
  };
}

function syncWorkflowEditorObjectDecompositionNode<TNodeData = Record<string, unknown>>(
  node: WorkflowEditorNode<TNodeData>,
): WorkflowEditorNode<TNodeData> {
  if (!isWorkflowEditorObjectDecompositionNode(node)) {
    return node;
  }

  const properties = readWorkflowEditorObjectDecompositionProperties(node.data);
  const inputs = node.inputs?.some(isWorkflowEditorObjectDecompositionObjectInput)
    ? node.inputs.map((input) =>
        isWorkflowEditorObjectDecompositionObjectInput(input)
          ? {
              ...input,
              label: input.label || "Object",
              type: input.type ?? ({ kind: "object" } satisfies WorkflowEditorPortType),
            }
          : input,
      )
    : [createWorkflowEditorObjectDecompositionInputPort(), ...(node.inputs ?? [])];
  const propertyOutputs = (node.outputs ?? []).filter(
    (output) => !isWorkflowEditorObjectDecompositionAddOutput(output),
  );
  const usedPropertyKeys = new Set<string>();
  const syncedProperties: Record<string, WorkflowEditorObjectDecompositionProperty> = {};
  const syncedOutputs = propertyOutputs.map((output) => {
    const property =
      properties[output.id] ?? getWorkflowEditorObjectDecompositionProperty(node, output.id);
    const propertyKey = createUniqueObjectPropertyKey(
      property?.key ?? output.label ?? output.id,
      usedPropertyKeys,
    );
    usedPropertyKeys.add(propertyKey);
    syncedProperties[output.id] = {
      ...(property ?? { key: propertyKey }),
      key: propertyKey,
    };

    return Object.assign({}, output, {
      label: propertyKey,
      badge: `object${formatWorkflowEditorObjectPropertyAccess(propertyKey)}`,
      type: getWorkflowEditorObjectDecompositionPropertyType({ ...node, inputs }, propertyKey) ??
        output.type ?? { kind: "any" },
      metadata: {
        ...(output.metadata ?? {}),
        objectDecompositionRole: "property",
      },
    });
  });

  return {
    ...node,
    inputs,
    outputs: [...syncedOutputs, createWorkflowEditorObjectDecompositionAddPort()],
    data: {
      ...(isRecord(node.data) ? node.data : {}),
      properties: syncedProperties,
    } as TNodeData,
  };
}

function createWorkflowEditorObjectDecompositionInputPort(): WorkflowEditorPort {
  return {
    id: "object",
    label: "Object",
    type: { kind: "object" },
  };
}

function createWorkflowEditorObjectDecompositionPort(
  id: string,
  options: WorkflowEditorObjectDecompositionOutputOptions,
): WorkflowEditorPort {
  const propertyKey = normalizeObjectPropertyKey(options.propertyKey ?? id);

  return {
    id,
    label: propertyKey,
    type: options.type ?? { kind: "any" },
    badge: `object${formatWorkflowEditorObjectPropertyAccess(propertyKey)}`,
    metadata: {
      objectDecompositionRole: "property",
      objectDecompositionProperty: {
        key: propertyKey,
      } satisfies WorkflowEditorObjectDecompositionProperty,
    },
  };
}

function createWorkflowEditorObjectDecompositionAddPort(): WorkflowEditorPort {
  return {
    id: "property",
    label: "Add property",
    type: { kind: "any" },
    badge: "new",
    metadata: { objectDecompositionRole: "add-property" },
  };
}

function isWorkflowEditorObjectDecompositionObjectInput(port: WorkflowEditorPort) {
  return port.id === "object";
}

function isWorkflowEditorObjectDecompositionAddOutput(port: WorkflowEditorPort) {
  return port.id === "property" && port.metadata?.objectDecompositionRole === "add-property";
}

function getWorkflowEditorObjectDecompositionProperty<TNodeData = Record<string, unknown>>(
  node: WorkflowEditorNode<TNodeData>,
  portId: string,
) {
  const properties = readWorkflowEditorObjectDecompositionProperties(node.data);
  const property = properties[portId];

  if (property) {
    return property;
  }

  const port = node.outputs?.find((output) => output.id === portId);
  const metadataProperty = isRecord(port?.metadata?.objectDecompositionProperty)
    ? port.metadata.objectDecompositionProperty
    : undefined;

  if (!metadataProperty) {
    return undefined;
  }

  return {
    key: String(metadataProperty.key ?? port?.label ?? portId),
  } satisfies WorkflowEditorObjectDecompositionProperty;
}

function readWorkflowEditorObjectDecompositionProperties(
  data: unknown,
): Record<string, WorkflowEditorObjectDecompositionProperty> {
  if (!isRecord(data) || !isRecord(data.properties)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(data.properties).flatMap(([portId, value]) => {
      if (!isRecord(value)) {
        return [];
      }

      return [
        [
          portId,
          {
            key: normalizeObjectPropertyKey(value.key ?? portId),
          } satisfies WorkflowEditorObjectDecompositionProperty,
        ],
      ];
    }),
  );
}

function getWorkflowEditorObjectDecompositionPropertyType<TNodeData = Record<string, unknown>>(
  node: WorkflowEditorNode<TNodeData>,
  propertyKey: string,
) {
  const objectInput = node.inputs?.find(isWorkflowEditorObjectDecompositionObjectInput);

  if (!objectInput) {
    return undefined;
  }

  const properties = workflowEditorObjectPropertiesFromType(
    objectInput.type,
    { definitions: new Map(), resolving: new Set() },
    0,
  );

  return properties?.[propertyKey]?.type;
}

function createWorkflowEditorObjectDecompositionTarget<TNodeData = Record<string, unknown>>(
  node: WorkflowEditorNode<TNodeData>,
  port: WorkflowEditorPort,
) {
  const nodeKey = normalizeObjectPropertyKey(node.label || node.id);
  const portKey = normalizeObjectPropertyKey(port.label || port.id);
  const propertyKey = isGenericWorkflowEditorPortKey(portKey) ? nodeKey : portKey;

  return {
    propertyKey,
  };
}

function normalizeObjectPropertyKey(value: unknown) {
  const text = String(value ?? "").trim();
  const words = text.match(/[A-Z]?[a-z]+|[A-Z]+(?![a-z])|[0-9]+/g) ?? [];

  if (words.length === 0) {
    return "property";
  }

  const [first = "property", ...rest] = words;
  const normalized = `${first.toLowerCase()}${rest
    .map((word) => `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join("")}`;

  return /^[A-Za-z_$]/.test(normalized) ? normalized : `property${normalized}`;
}

function createUniqueObjectPropertyKey(value: unknown, usedPropertyKeys: ReadonlySet<string>) {
  const base = normalizeObjectPropertyKey(value);
  let candidate = base;
  let index = 2;

  while (usedPropertyKeys.has(candidate)) {
    candidate = `${base}${index}`;
    index += 1;
  }

  return candidate;
}

function formatWorkflowEditorObjectPropertyKey(key: string) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
}

function formatWorkflowEditorObjectPropertyAccess(key: string) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`;
}

function isGenericWorkflowEditorPortKey(key: string) {
  return ["in", "input", "out", "output", "value"].includes(key);
}

function formatWorkflowEditorDocumentValidationMessage(
  diagnostics: WorkflowEditorDocumentDiagnostic[],
) {
  if (diagnostics.length === 0) {
    return "Workflow document is invalid";
  }

  const [first] = diagnostics;
  return diagnostics.length === 1
    ? first!.message
    : `${first!.message} and ${diagnostics.length - 1} more validation issue${
        diagnostics.length === 2 ? "" : "s"
      }`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateWorkflowEditorPorts(
  ports: unknown,
  path: string,
  nodeId: string | undefined,
  diagnostics: WorkflowEditorDocumentDiagnostic[],
) {
  if (ports === undefined) {
    return;
  }

  if (!Array.isArray(ports)) {
    diagnostics.push({
      code: "invalid-node",
      message: "Workflow node ports must be an array",
      path,
      nodeId,
    });
    return;
  }

  ports.forEach((port, index) => {
    const portPath = `${path}[${index}]`;
    if (!isRecord(port)) {
      diagnostics.push({
        code: "invalid-node",
        message: "Workflow node port must be an object",
        path: portPath,
        nodeId,
      });
      return;
    }

    if (typeof port.id !== "string" || !port.id.trim()) {
      diagnostics.push({
        code: "invalid-node",
        message: "Workflow node port id must be a non-empty string",
        path: `${portPath}.id`,
        nodeId,
      });
    }

    if (!isWorkflowEditorPortTypeLike(port.type)) {
      diagnostics.push({
        code: "invalid-node",
        message: "Workflow node port type is invalid",
        path: `${portPath}.type`,
        nodeId,
      });
    }
  });
}

function isWorkflowEditorPortTypeLike(value: unknown, depth = 0): value is WorkflowEditorPortType {
  if (depth > 100 || !isRecord(value) || typeof value.kind !== "string") {
    return false;
  }

  switch (value.kind) {
    case "any":
    case "unknown":
    case "never":
    case "string":
    case "number":
    case "boolean":
    case "null":
    case "undefined":
      return true;
    case "literal":
      return (
        typeof value.value === "string" ||
        typeof value.value === "number" ||
        typeof value.value === "boolean" ||
        value.value === null
      );
    case "array":
      return isWorkflowEditorPortTypeLike(value.element, depth + 1);
    case "object":
      return (
        value.properties === undefined ||
        (isRecord(value.properties) &&
          Object.values(value.properties).every(
            (property) =>
              isRecord(property) &&
              isWorkflowEditorPortTypeLike(property.type, depth + 1) &&
              (property.optional === undefined || typeof property.optional === "boolean"),
          ))
      );
    case "union":
    case "intersection":
      return (
        Array.isArray(value.types) &&
        value.types.every((type) => isWorkflowEditorPortTypeLike(type, depth + 1))
      );
    case "ref":
      return typeof value.name === "string" && value.name.trim() !== "";
    default:
      return false;
  }
}

function normalizePorts(ports: WorkflowEditorPort[] | undefined) {
  return ports?.map((port) => ({ ...port })) ?? [];
}

function normalizeWorkflowEditorNode<TNodeData = Record<string, unknown>>(
  node: WorkflowEditorNode<TNodeData>,
): WorkflowEditorNode<TNodeData> {
  const id = typeof node.id === "string" && node.id.trim() ? node.id : "node";

  return {
    ...node,
    id,
    label: typeof node.label === "string" ? node.label : id,
    x: Number.isFinite(node.x) ? node.x : 0,
    y: Number.isFinite(node.y) ? node.y : 0,
    inputs: normalizePorts(node.inputs),
    outputs: normalizePorts(node.outputs),
    workflowRef: node.workflowRef?.documentId
      ? { documentId: node.workflowRef.documentId }
      : undefined,
    composition: node.composition
      ? normalizeWorkflowEditorNodeComposition(node.composition)
      : undefined,
  };
}

function normalizeWorkflowEditorNodeComposition<TNodeData = Record<string, unknown>>(
  composition: WorkflowEditorNodeComposition<TNodeData>,
): WorkflowEditorNodeComposition<TNodeData> {
  const normalizedDocument = normalizeWorkflowEditorDocument(
    {
      nodes: composition.nodes,
      edges: composition.edges,
    },
    { mode: "repair" },
  );
  const nodeIds = new Set(normalizedDocument.nodes.map((node) => node.id));

  return {
    nodes: normalizedDocument.nodes,
    edges: normalizedDocument.edges,
    inputBoundaries: normalizeCompositionBoundaries(composition.inputBoundaries, nodeIds),
    outputBoundaries: normalizeCompositionBoundaries(composition.outputBoundaries, nodeIds),
  };
}

function normalizeCompositionBoundaries(
  boundaries: WorkflowEditorCompositionBoundary[],
  nodeIds: ReadonlySet<string>,
) {
  const seen = new Set<string>();
  const normalized: WorkflowEditorCompositionBoundary[] = [];

  for (const boundary of boundaries) {
    if (!nodeIds.has(boundary.nodeId) || !boundary.wrapperPortId || !boundary.portId) {
      continue;
    }

    const key = `${boundary.wrapperPortId}:${boundary.nodeId}:${boundary.portId}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalized.push({ ...boundary });
  }

  return normalized;
}

function cloneWorkflowEditorNode<TNodeData = Record<string, unknown>>(
  node: WorkflowEditorNode<TNodeData>,
): WorkflowEditorNode<TNodeData> {
  return normalizeWorkflowEditorNode(node);
}

function cloneWorkflowEditorEdge<TData = Record<string, unknown>>(
  edge: WorkflowEditorEdge<TData>,
): WorkflowEditorEdge<TData> {
  return { ...edge };
}

function cloneWorkflowEditorCompositionBoundary(
  boundary: WorkflowEditorCompositionBoundary,
): WorkflowEditorCompositionBoundary {
  return {
    wrapperPortId: boundary.wrapperPortId,
    nodeId: boundary.nodeId,
    portId: boundary.portId,
  };
}

function createWorkflowEditorCompositionParts<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(document: WorkflowEditorDocument<TNodeData, TEdgeData>, nodeIds: readonly string[]) {
  const requestedIds = new Set(nodeIds);
  const nodes = document.nodes.filter((node) => requestedIds.has(node.id));

  if (nodes.length === 0) {
    return null;
  }

  const selectedIds = new Set(nodes.map((node) => node.id));
  const minX = Math.min(...nodes.map((node) => (Number.isFinite(node.x) ? node.x : 0)));
  const minY = Math.min(...nodes.map((node) => (Number.isFinite(node.y) ? node.y : 0)));
  const internalEdges = document.edges.filter(
    (edge) => selectedIds.has(edge.sourceNodeId) && selectedIds.has(edge.targetNodeId),
  );
  const incomingEdges = document.edges.filter(
    (edge) => !selectedIds.has(edge.sourceNodeId) && selectedIds.has(edge.targetNodeId),
  );
  const outgoingEdges = document.edges.filter(
    (edge) => selectedIds.has(edge.sourceNodeId) && !selectedIds.has(edge.targetNodeId),
  );
  const inputPorts: WorkflowEditorPort[] = [];
  const outputPorts: WorkflowEditorPort[] = [];
  const inputBoundaries: WorkflowEditorCompositionBoundary[] = [];
  const outputBoundaries: WorkflowEditorCompositionBoundary[] = [];
  const usedInputPortIds = new Set<string>();
  const usedOutputPortIds = new Set<string>();

  for (const node of nodes) {
    for (const input of node.inputs ?? []) {
      const hasInternalEdge = internalEdges.some(
        (edge) => edge.targetNodeId === node.id && edge.targetPortId === input.id,
      );
      const hasIncomingEdge = incomingEdges.some(
        (edge) => edge.targetNodeId === node.id && edge.targetPortId === input.id,
      );

      if (!hasInternalEdge || hasIncomingEdge) {
        const wrapperPort = compositionBoundaryPort("in", node, input, usedInputPortIds);
        inputPorts.push(wrapperPort);
        inputBoundaries.push({
          wrapperPortId: wrapperPort.id,
          nodeId: node.id,
          portId: input.id,
        });
      }
    }

    for (const output of node.outputs ?? []) {
      const hasInternalEdge = internalEdges.some(
        (edge) => edge.sourceNodeId === node.id && edge.sourcePortId === output.id,
      );
      const hasOutgoingEdge = outgoingEdges.some(
        (edge) => edge.sourceNodeId === node.id && edge.sourcePortId === output.id,
      );

      if (!hasInternalEdge || hasOutgoingEdge) {
        const wrapperPort = compositionBoundaryPort("out", node, output, usedOutputPortIds);
        outputPorts.push(wrapperPort);
        outputBoundaries.push({
          wrapperPortId: wrapperPort.id,
          nodeId: node.id,
          portId: output.id,
        });
      }
    }
  }

  return {
    nodes,
    minX,
    minY,
    internalEdges,
    incomingEdges,
    outgoingEdges,
    inputPorts,
    outputPorts,
    inputBoundaries,
    outputBoundaries,
  };
}

function compositionBoundaryPort(
  direction: "in" | "out",
  node: WorkflowEditorNode<unknown>,
  port: WorkflowEditorPort,
  usedPortIds: Set<string>,
): WorkflowEditorPort {
  const id = createUniqueId(
    usedPortIds,
    `${direction}-${safeWorkflowEditorId(node.id)}-${safeWorkflowEditorId(port.id)}`,
  );
  usedPortIds.add(id);

  return {
    ...port,
    id,
    label: `${node.label} ${port.label}`.trim(),
  };
}

function createWorkflowEditorReroutedEdge<TData = Record<string, unknown>>(
  edge: WorkflowEditorEdge<TData>,
  connection: WorkflowEditorConnectionInput,
  usedEdgeIds: Set<string>,
): WorkflowEditorEdge<TData> {
  const id = createUniqueId(
    usedEdgeIds,
    `${connection.sourceNodeId}:${connection.sourcePortId}->${connection.targetNodeId}:${connection.targetPortId}`,
  );
  usedEdgeIds.add(id);

  return {
    ...edge,
    id,
    ...connection,
  };
}

function boundaryKey(nodeId: string, portId: string) {
  return `${nodeId}:${portId}`;
}

function safeWorkflowEditorId(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9:_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "node"
  );
}

function defaultWorkflowEditorComposedNodeLabel<TData = Record<string, unknown>>(
  nodes: Array<WorkflowEditorNode<TData>>,
) {
  if (nodes.length === 1) {
    return `${nodes[0]!.label} Component`;
  }

  return `${nodes[0]!.label} + ${nodes.length - 1}`;
}

function commonWorkflowEditorNodeCategory<TData = Record<string, unknown>>(
  nodes: Array<WorkflowEditorNode<TData>>,
) {
  const categories = nodes.flatMap((node) => (node.category ? [node.category] : []));
  const uniqueCategories = new Set(categories);

  return uniqueCategories.size === 1 ? categories[0] : undefined;
}

function commonWorkflowEditorNodeTags<TData = Record<string, unknown>>(
  nodes: Array<WorkflowEditorNode<TData>>,
) {
  const tags = nodes.flatMap((node) => node.tags ?? []);
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const tag of tags) {
    if (seen.has(tag)) {
      continue;
    }

    seen.add(tag);
    normalized.push(tag);
  }

  return normalized.length > 0 ? normalized : undefined;
}

function clampZoom(zoom: number) {
  if (!Number.isFinite(zoom)) {
    return 1;
  }

  return Math.min(Math.max(zoom, 0.1), 4);
}

function normalizeWorkflowEditorDagEdges<TData = Record<string, unknown>>(
  edges: Array<WorkflowEditorEdge<TData>>,
  nodeIds: ReadonlySet<string>,
) {
  const acceptedEdges: Array<WorkflowEditorEdge<TData>> = [];

  for (const edge of edges) {
    if (!nodeIds.has(edge.sourceNodeId) || !nodeIds.has(edge.targetNodeId)) {
      continue;
    }

    if (edge.sourceNodeId === edge.targetNodeId) {
      continue;
    }

    if (canReachWorkflowEditorNodeInEdges(acceptedEdges, edge.targetNodeId, edge.sourceNodeId)) {
      continue;
    }

    acceptedEdges.push(edge);
  }

  return acceptedEdges;
}

function createWorkflowEditorEdgeId<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  connection: WorkflowEditorConnectionInput,
) {
  return createUniqueId(
    new Set(document.edges.map((edge) => edge.id)),
    `${connection.sourceNodeId}:${connection.sourcePortId}->${connection.targetNodeId}:${connection.targetPortId}`,
  );
}

function createWorkflowEditorNodeId<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(document: WorkflowEditorDocument<TNodeData, TEdgeData>, baseId: string) {
  return createUniqueId(new Set(document.nodes.map((node) => node.id)), baseId);
}

function createUniqueId(existingIds: ReadonlySet<string>, baseId: string) {
  let candidate = baseId;
  let index = 2;

  while (existingIds.has(candidate)) {
    candidate = `${baseId}-${index}`;
    index += 1;
  }

  return candidate;
}

function createWorkflowAdjacency<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(document: WorkflowEditorDocument<TNodeData, TEdgeData>) {
  const adjacency = new Map(document.nodes.map((node) => [node.id, [] as string[]]));

  for (const edge of document.edges) {
    adjacency.get(edge.sourceNodeId)?.push(edge.targetNodeId);
  }

  return adjacency;
}

function canReachWorkflowEditorNode<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  startNodeId: string,
  targetNodeId: string,
) {
  const adjacency = createWorkflowAdjacency(document);
  const queue = [startNodeId];
  const visited = new Set<string>();

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const nodeId = queue[cursor]!;

    if (nodeId === targetNodeId) {
      return true;
    }

    if (visited.has(nodeId)) {
      continue;
    }

    visited.add(nodeId);

    for (const nextNodeId of adjacency.get(nodeId) ?? []) {
      queue.push(nextNodeId);
    }
  }

  return false;
}

function canReachWorkflowEditorNodeInEdges<TData = Record<string, unknown>>(
  edges: Array<WorkflowEditorEdge<TData>>,
  startNodeId: string,
  targetNodeId: string,
) {
  const adjacency = new Map<string, string[]>();

  for (const edge of edges) {
    const targets = adjacency.get(edge.sourceNodeId) ?? [];
    targets.push(edge.targetNodeId);
    adjacency.set(edge.sourceNodeId, targets);
  }

  const queue = [startNodeId];
  const visited = new Set<string>();

  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const nodeId = queue[cursor]!;

    if (nodeId === targetNodeId) {
      return true;
    }

    if (visited.has(nodeId)) {
      continue;
    }

    visited.add(nodeId);

    for (const nextNodeId of adjacency.get(nodeId) ?? []) {
      queue.push(nextNodeId);
    }
  }

  return false;
}
