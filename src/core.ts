import {
  addGraphEditorEdge,
  addGraphEditorNode,
  createGraphEditorGraphIndex,
  detectGraphEditorCycles,
  duplicateGraphEditorNode,
  isGraphEditorDirectedAcyclicGraph,
  moveGraphEditorGroup,
  moveGraphEditorNode,
  normalizeGraphEditorDocument,
  removeGraphEditorEdge,
  ungroupGraphEditorGroup,
  updateGraphEditorGroup,
  updateGraphEditorNode,
  validateGraphEditorConnection,
  validateGraphEditorDocument,
  wouldCreateGraphEditorCycle,
  type GraphEditorDocumentDiagnostic,
} from "@moritzbrantner/graph-editor/core";
import type { GraphEditorOperation } from "@moritzbrantner/graph-editor/operations";
import {
  applyGraphEditorOperation,
  createGraphEditorRuntime,
  type GraphEditorRuntimeOptions,
  type GraphEditorRuntimeState,
} from "@moritzbrantner/graph-editor/runtime";

import type {
  WorkflowEditorGraphIndex,
  WorkflowEditorIndexedEdge,
  WorkflowEditorIndexedNode,
  WorkflowEditorSubgraph,
} from "./graph-index";
import {
  createWorkflowEditorDocumentContext,
  type WorkflowEditorDocumentContext,
} from "./core-context";
import type {
  WorkflowEditorArrayConstructorInputOptions,
  WorkflowEditorArrayConstructorItem,
  WorkflowEditorCompositionBoundary,
  WorkflowEditorConnectionInput,
  WorkflowEditorConnectionValidity,
  WorkflowEditorDocument,
  WorkflowEditorDocumentDiagnostic,
  WorkflowEditorDocumentNormalizationOptions,
  WorkflowEditorDocumentValidationOptions,
  WorkflowEditorEdge,
  WorkflowEditorGroup,
  WorkflowEditorNode,
  WorkflowEditorNodeComposition,
  WorkflowEditorObjectConstructorSchema,
  WorkflowEditorObjectConstructorProperty,
  WorkflowEditorObjectConstructorExpressionDiagnostic,
  WorkflowEditorObjectConstructorExpressionEntry,
  WorkflowEditorObjectConstructorInputOptions,
  WorkflowEditorObjectDecompositionOutputOptions,
  WorkflowEditorObjectDecompositionProperty,
  WorkflowEditorPort,
  WorkflowEditorPortProperty,
  WorkflowEditorPortType,
  WorkflowEditorTypeDefinition,
  WorkflowEditorTypeDiagnostic,
  WorkflowEditorTypeValidationOptions,
  WorkflowEditorWorkflowReference,
} from "./core-types";
import { createWorkflowEditorTypeResolver } from "./core-type-resolver";

export type WorkflowGraphOperation<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
  TPortType = WorkflowEditorPortType,
> = GraphEditorOperation<TNodeData, TEdgeData, TPortType>;

export type WorkflowGraphRuntimeState<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
  TPortType = WorkflowEditorPortType,
> = GraphEditorRuntimeState<TNodeData, TEdgeData, TPortType>;

export function createWorkflowGraphRuntime<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
  TPortType = WorkflowEditorPortType,
>(
  options: GraphEditorRuntimeOptions<TNodeData, TEdgeData, TPortType>,
): WorkflowGraphRuntimeState<TNodeData, TEdgeData, TPortType> {
  return createGraphEditorRuntime(options);
}

export function applyWorkflowGraphOperation<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
  TPortType = WorkflowEditorPortType,
>(
  state: WorkflowGraphRuntimeState<TNodeData, TEdgeData, TPortType>,
  operation: WorkflowGraphOperation<TNodeData, TEdgeData, TPortType>,
  options: Parameters<typeof applyGraphEditorOperation>[2] = {},
): WorkflowGraphRuntimeState<TNodeData, TEdgeData, TPortType> {
  return applyGraphEditorOperation(state, operation, options);
}

export type {
  WorkflowEditorDocumentContext,
  WorkflowEditorGraphIndex,
  WorkflowEditorIndexedEdge,
  WorkflowEditorIndexedNode,
  WorkflowEditorSubgraph,
};

export { createWorkflowEditorDocumentContext };

export type {
  WorkflowEditorArrayConstructorInputOptions,
  WorkflowEditorArrayConstructorItem,
  WorkflowEditorCompositionBoundary,
  WorkflowEditorConnectionInput,
  WorkflowEditorConnectionInvalidReason,
  WorkflowEditorConnectionValidity,
  WorkflowEditorDocument,
  WorkflowEditorDocumentDiagnostic,
  WorkflowEditorDocumentDiagnosticCode,
  WorkflowEditorDocumentNormalizationMode,
  WorkflowEditorDocumentNormalizationOptions,
  WorkflowEditorDocumentValidationOptions,
  WorkflowEditorEdge,
  WorkflowEditorGroup,
  WorkflowEditorNode,
  WorkflowEditorNodeComposition,
  WorkflowEditorNodeTemplate,
  WorkflowEditorObjectConstructorExpressionEntry,
  WorkflowEditorObjectConstructorExpressionDiagnostic,
  WorkflowEditorObjectConstructorInputOptions,
  WorkflowEditorObjectConstructorProperty,
  WorkflowEditorObjectConstructorSchema,
  WorkflowEditorObjectDecompositionOutputOptions,
  WorkflowEditorObjectDecompositionProperty,
  WorkflowEditorPort,
  WorkflowEditorPortDefaultValue,
  WorkflowEditorPortProperty,
  WorkflowEditorPortType,
  WorkflowEditorSelection,
  WorkflowEditorSelectionItem,
  WorkflowEditorSelectionState,
  WorkflowEditorTypeDefinition,
  WorkflowEditorTypeDiagnostic,
  WorkflowEditorTypeValidationOptions,
  WorkflowEditorViewport,
  WorkflowEditorWorkflowReference,
} from "./core-types";
export {
  defaultWorkflowEditorNodeTemplates,
  workflowEditorCollectionNodeTemplates,
  workflowEditorControlFlowNodeTemplates,
  workflowEditorJsonNodeTemplates,
} from "./core-templates";

export class WorkflowEditorDocumentValidationError extends Error {
  override name = "WorkflowEditorDocumentValidationError" as const;
  diagnostics: WorkflowEditorDocumentDiagnostic[];

  constructor(diagnostics: WorkflowEditorDocumentDiagnostic[]) {
    super(formatWorkflowEditorDocumentValidationMessage(diagnostics));
    this.diagnostics = diagnostics;
  }
}

function normalizeWorkflowEditorGraphDocument<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  options: WorkflowEditorDocumentNormalizationOptions,
): WorkflowEditorDocument<TNodeData, TEdgeData> {
  try {
    return normalizeGraphEditorDocument<TNodeData, TEdgeData, WorkflowEditorPortType>(
      document,
      options,
    ) as WorkflowEditorDocument<TNodeData, TEdgeData>;
  } catch (error) {
    const diagnostics = (error as { diagnostics?: GraphEditorDocumentDiagnostic[] }).diagnostics;
    if (Array.isArray(diagnostics)) {
      throw new WorkflowEditorDocumentValidationError(
        diagnostics as WorkflowEditorDocumentDiagnostic[],
      );
    }
    throw error;
  }
}

export type WorkflowEditorDuplicateNodeOptions = {
  offsetX?: number;
  offsetY?: number;
  createId?: (nodeId: string, existingIds: ReadonlySet<string>) => string;
};

export type WorkflowEditorCreateGroupOptions<TData = Record<string, unknown>> = {
  id?: string;
  label?: string;
  minimized?: boolean;
  data?: TData;
  createId?: (baseId: string, existingIds: ReadonlySet<string>) => string;
};

export type WorkflowEditorComposeNodesOptions<TNodeData = Record<string, unknown>> = {
  id?: string;
  label?: string;
  description?: string;
  kind?: string;
  category?: string;
  categoryPath?: readonly string[];
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
  const graphNormalized = normalizeWorkflowEditorGraphDocument(document, {
    ...options,
    allowCycles: options.allowCycles ?? false,
    mode,
  });

  let nodes = Array.isArray(graphNormalized.nodes)
    ? graphNormalized.nodes.flatMap((node) =>
        isRecord(node) ? [normalizeWorkflowEditorNode(node as WorkflowEditorNode<TNodeData>)] : [],
      )
    : [];
  const nodeIds = new Set(nodes.map((node) => node.id));
  let edges = Array.isArray(graphNormalized.edges)
    ? (normalizeWorkflowEditorDagEdges(
        graphNormalized.edges.flatMap((edge) =>
          isRecord(edge) ? [edge as WorkflowEditorEdge] : [],
        ),
        nodeIds,
      ) as Array<WorkflowEditorEdge<TEdgeData>>)
    : [];
  nodes = syncWorkflowEditorNodeBehaviors(nodes, edges);
  edges = normalizeWorkflowEditorDagEdges(edges, nodeIds, nodes);
  nodes = syncWorkflowEditorNodeBehaviors(nodes, edges);
  const groups = normalizeWorkflowEditorGroups(
    Array.isArray(document.groups) ? document.groups : [],
    new Set(nodes.map((node) => node.id)),
  );
  const { groups: _groups, ...documentWithoutGroups } = graphNormalized;

  return {
    ...documentWithoutGroups,
    nodes,
    edges,
    ...(groups.length > 0 ? { groups } : {}),
    viewport: document.viewport
      ? {
          x: Number.isFinite(document.viewport.x) ? document.viewport.x : 0,
          y: Number.isFinite(document.viewport.y) ? document.viewport.y : 0,
          zoom: clampZoom(document.viewport.zoom),
        }
      : undefined,
  };
}

export function validateWorkflowEditorDocument(
  value: unknown,
  options: WorkflowEditorDocumentValidationOptions = {},
): WorkflowEditorDocumentDiagnostic[] {
  return validateGraphEditorDocument(value, {
    ...options,
    allowCycles: options.allowCycles ?? false,
  }) as WorkflowEditorDocumentDiagnostic[];
}

export function assertWorkflowEditorDocument<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  value: unknown,
  options: WorkflowEditorDocumentValidationOptions = {},
): asserts value is WorkflowEditorDocument<TNodeData, TEdgeData> {
  const diagnostics = validateWorkflowEditorDocument(value, options);

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
  return createGraphEditorGraphIndex<TNodeData, TEdgeData, WorkflowEditorPortType>(document);
}

export function findWorkflowEditorNode<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(document: WorkflowEditorDocument<TNodeData, TEdgeData>, nodeId: string) {
  return createWorkflowEditorDocumentContext(document).nodeById.get(nodeId);
}

export function findWorkflowEditorEdge<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(document: WorkflowEditorDocument<TNodeData, TEdgeData>, edgeId: string) {
  return createWorkflowEditorDocumentContext(document).edgeById.get(edgeId);
}

export function findWorkflowEditorGroup<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(document: WorkflowEditorDocument<TNodeData, TEdgeData>, groupId: string) {
  return document.groups?.find((group) => group.id === groupId);
}

export function getWorkflowEditorNodeGroupId<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(document: WorkflowEditorDocument<TNodeData, TEdgeData>, nodeId: string) {
  return document.groups?.find((group) => group.nodeIds.includes(nodeId))?.id;
}

export function getWorkflowEditorGroupBounds<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(document: WorkflowEditorDocument<TNodeData, TEdgeData>, groupId: string) {
  const group = findWorkflowEditorGroup(document, groupId);

  if (!group) {
    return null;
  }

  const nodeIds = new Set(group.nodeIds);
  const nodes = document.nodes.filter((node) => nodeIds.has(node.id));

  if (nodes.length === 0) {
    return null;
  }

  const minX = Math.min(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxX = Math.max(...nodes.map((node) => node.x));
  const maxY = Math.max(...nodes.map((node) => node.y));

  return {
    x: minX,
    y: minY,
    width: Math.max(1, maxX - minX),
    height: Math.max(1, maxY - minY),
  };
}

export function createWorkflowEditorGroup<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
  TGroupData extends Record<string, unknown> = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  nodeIds: readonly string[],
  options: WorkflowEditorCreateGroupOptions<TGroupData> = {},
): WorkflowEditorDocument<TNodeData, TEdgeData> {
  const requestedNodeIds = new Set(nodeIds);
  const groupedNodeIds = document.nodes
    .filter((node) => requestedNodeIds.has(node.id))
    .map((node) => node.id);

  if (groupedNodeIds.length < 2) {
    return document;
  }

  const groupedNodeIdSet = new Set(groupedNodeIds);
  const groups = (document.groups ?? [])
    .map((group) =>
      Object.assign({}, group, {
        nodeIds: group.nodeIds.filter((nodeId) => !groupedNodeIdSet.has(nodeId)),
      }),
    )
    .filter((group) => group.nodeIds.length >= 2);
  const existingIds = new Set(groups.map((group) => group.id));
  const defaultLabel = createWorkflowEditorDefaultGroupLabel(document);
  const baseId = safeWorkflowEditorId(options.id ?? options.label ?? defaultLabel);
  const id =
    options.id ?? options.createId?.(baseId, existingIds) ?? createUniqueId(existingIds, baseId);

  return normalizeWorkflowEditorDocument({
    ...document,
    groups: [
      ...groups,
      {
        id,
        label: options.label?.trim() || defaultLabel,
        nodeIds: groupedNodeIds,
        minimized: options.minimized === true ? true : undefined,
        data: options.data,
      },
    ],
  });
}

export function updateWorkflowEditorGroup<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  groupId: string,
  patch: Partial<WorkflowEditorGroup>,
): WorkflowEditorDocument<TNodeData, TEdgeData> {
  return normalizeWorkflowEditorDocument(
    updateGraphEditorGroup<TNodeData, TEdgeData, WorkflowEditorPortType>(
      document,
      groupId,
      patch,
    ) as WorkflowEditorDocument<TNodeData, TEdgeData>,
  );
}

export function ungroupWorkflowEditorGroup<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  groupId: string,
): WorkflowEditorDocument<TNodeData, TEdgeData> {
  return normalizeWorkflowEditorDocument(
    ungroupGraphEditorGroup<TNodeData, TEdgeData, WorkflowEditorPortType>(
      document,
      groupId,
    ) as WorkflowEditorDocument<TNodeData, TEdgeData>,
  );
}

export function moveWorkflowEditorGroup<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  groupId: string,
  delta: { x: number; y: number },
): WorkflowEditorDocument<TNodeData, TEdgeData> {
  return normalizeWorkflowEditorDocument(
    moveGraphEditorGroup<TNodeData, TEdgeData, WorkflowEditorPortType>(
      document,
      groupId,
      delta,
    ) as WorkflowEditorDocument<TNodeData, TEdgeData>,
  );
}

export function addWorkflowEditorNode<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  node: WorkflowEditorNode<TNodeData>,
): WorkflowEditorDocument<TNodeData, TEdgeData> {
  return normalizeWorkflowEditorDocument(
    addGraphEditorNode<TNodeData, TEdgeData, WorkflowEditorPortType>(
      document,
      node,
    ) as WorkflowEditorDocument<TNodeData, TEdgeData>,
  );
}

export function updateWorkflowEditorNode<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  nodeId: string,
  patch: Partial<WorkflowEditorNode<TNodeData>>,
): WorkflowEditorDocument<TNodeData, TEdgeData> {
  return normalizeWorkflowEditorDocument(
    updateGraphEditorNode<TNodeData, TEdgeData, WorkflowEditorPortType>(
      document,
      nodeId,
      patch,
    ) as WorkflowEditorDocument<TNodeData, TEdgeData>,
  );
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

export function isWorkflowEditorArrayConstructorNode<TNodeData = Record<string, unknown>>(
  node: WorkflowEditorNode<TNodeData>,
) {
  return node.kind === "json.array";
}

export function getWorkflowEditorArrayConstructorInputs<TNodeData = Record<string, unknown>>(
  node: WorkflowEditorNode<TNodeData>,
) {
  if (!isWorkflowEditorArrayConstructorNode(node)) {
    return [];
  }

  return (node.inputs ?? []).filter((input) => !isWorkflowEditorArrayConstructorAddInput(input));
}

export function addWorkflowEditorArrayConstructorInputToNode<TNodeData = Record<string, unknown>>(
  node: WorkflowEditorNode<TNodeData>,
  options: WorkflowEditorArrayConstructorInputOptions = {},
): WorkflowEditorNode<TNodeData> {
  if (!isWorkflowEditorArrayConstructorNode(node)) {
    return node;
  }

  const syncedNode = syncWorkflowEditorArrayConstructorNode(node);
  const inputs = syncedNode.inputs ?? [];
  const usedPortIds = new Set(inputs.map((input) => input.id));
  const portId = createUniqueId(usedPortIds, workflowEditorPortIdBase(options.portId, "item"));
  const port = createWorkflowEditorArrayConstructorPort(portId, options);
  const addInput = inputs.find(isWorkflowEditorArrayConstructorAddInput);
  const itemInputs = inputs.filter((input) => !isWorkflowEditorArrayConstructorAddInput(input));

  return syncWorkflowEditorArrayConstructorNode({
    ...syncedNode,
    inputs: [...itemInputs, port, addInput ?? createWorkflowEditorArrayConstructorAddPort()],
  });
}

export function removeWorkflowEditorArrayConstructorInputFromNode<
  TNodeData = Record<string, unknown>,
>(node: WorkflowEditorNode<TNodeData>, portId: string): WorkflowEditorNode<TNodeData> {
  if (!isWorkflowEditorArrayConstructorNode(node)) {
    return node;
  }

  const syncedNode = syncWorkflowEditorArrayConstructorNode(node);

  if (
    (syncedNode.inputs ?? []).some(
      (input) => input.id === portId && isWorkflowEditorArrayConstructorAddInput(input),
    )
  ) {
    return syncedNode;
  }

  const items = readWorkflowEditorArrayConstructorItems(syncedNode.data);
  const { [portId]: _removedItem, ...nextItems } = items;
  const inputs = (syncedNode.inputs ?? []).filter((input) => input.id !== portId);

  return syncWorkflowEditorArrayConstructorNode({
    ...syncedNode,
    inputs,
    data: {
      ...(isRecord(syncedNode.data) ? syncedNode.data : {}),
      items: nextItems,
    } as TNodeData,
  });
}

export function addWorkflowEditorArrayConstructorInput<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  nodeId: string,
  options: WorkflowEditorArrayConstructorInputOptions = {},
): WorkflowEditorDocument<TNodeData, TEdgeData> {
  const node = findWorkflowEditorNode(document, nodeId);

  if (!node) {
    return document;
  }

  const nextNode = addWorkflowEditorArrayConstructorInputToNode(node, options);

  return updateWorkflowEditorNode(document, nodeId, {
    inputs: nextNode.inputs,
    outputs: nextNode.outputs,
    data: nextNode.data,
  } as Partial<WorkflowEditorNode<TNodeData>>);
}

export function removeWorkflowEditorArrayConstructorInput<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  nodeId: string,
  portId: string,
): WorkflowEditorDocument<TNodeData, TEdgeData> {
  const node = findWorkflowEditorNode(document, nodeId);

  if (!node) {
    return document;
  }

  const nextNode = removeWorkflowEditorArrayConstructorInputFromNode(node, portId);

  return normalizeWorkflowEditorDocument({
    ...document,
    nodes: document.nodes.map((candidate) => (candidate.id === nodeId ? nextNode : candidate)),
    edges: document.edges.filter(
      (edge) => !(edge.targetNodeId === nodeId && edge.targetPortId === portId),
    ),
  });
}

export function formatWorkflowEditorArrayConstructorExpression<TNodeData = Record<string, unknown>>(
  node: WorkflowEditorNode<TNodeData>,
) {
  if (!isWorkflowEditorArrayConstructorNode(node)) {
    return "[]";
  }

  const items = readWorkflowEditorArrayConstructorItems(node.data);
  const entries = getWorkflowEditorArrayConstructorInputs(node).map((input) => {
    const item = items[input.id];
    return `  ${item?.sourceExpression || input.badge || input.id}`;
  });

  if (entries.length === 0) {
    return "[]";
  }

  return `[\n${entries.join(",\n")}\n]`;
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

export function getWorkflowEditorObjectConstructorSchema<TNodeData = Record<string, unknown>>(
  node: WorkflowEditorNode<TNodeData>,
): WorkflowEditorObjectConstructorSchema {
  if (!isWorkflowEditorObjectConstructorNode(node)) {
    return { kind: "object", properties: {} };
  }

  const storedSchema = readWorkflowEditorObjectConstructorSchema(node.data);

  if (storedSchema) {
    return storedSchema;
  }

  const valueOutput = node.outputs?.find((output) => output.id === "value");

  if (valueOutput?.type.kind === "object") {
    return {
      kind: "object",
      properties: valueOutput.type.properties ?? {},
    };
  }

  return { kind: "object", properties: {} };
}

export function updateWorkflowEditorObjectConstructorSchemaInNode<
  TNodeData = Record<string, unknown>,
>(
  node: WorkflowEditorNode<TNodeData>,
  schema: WorkflowEditorObjectConstructorSchema,
): WorkflowEditorNode<TNodeData> {
  if (
    !isWorkflowEditorObjectConstructorNode(node) ||
    !isWorkflowEditorObjectConstructorSchema(schema)
  ) {
    return node;
  }

  return syncWorkflowEditorObjectConstructorNode({
    ...node,
    data: {
      ...(isRecord(node.data) ? node.data : {}),
      schema: normalizeWorkflowEditorObjectConstructorSchema(schema),
    } as TNodeData,
  });
}

export function parseWorkflowEditorObjectConstructorExpression(
  expression: string,
): WorkflowEditorObjectConstructorExpressionEntry[] | null {
  if (validateWorkflowEditorObjectConstructorExpression(expression).length > 0) {
    return null;
  }

  const source = expression.trim();

  if (!source || source === "{}") {
    return [];
  }

  const body = source.startsWith("{") && source.endsWith("}") ? source.slice(1, -1).trim() : source;

  if (!body) {
    return [];
  }

  const entries = splitWorkflowEditorExpressionList(body);

  if (!entries) {
    return null;
  }

  return entries.flatMap((entry) => {
    if (!entry.trim()) {
      return [];
    }

    const separatorIndex = findWorkflowEditorTopLevelCharacter(entry, ":");

    if (separatorIndex === -1) {
      return [];
    }

    const rawKey = entry.slice(0, separatorIndex).trim();
    const sourceExpression = entry.slice(separatorIndex + 1).trim();
    const key = parseWorkflowEditorObjectConstructorExpressionKey(rawKey);

    if (!key || !sourceExpression) {
      return [];
    }

    return [{ key, sourceExpression }];
  });
}

export function validateWorkflowEditorObjectConstructorExpression(
  expression: string,
): WorkflowEditorObjectConstructorExpressionDiagnostic[] {
  const source = expression.trim();

  if (!source || source === "{}") {
    return [];
  }

  const startsWithObject = source.startsWith("{");
  const endsWithObject = source.endsWith("}");

  if (startsWithObject !== endsWithObject) {
    return [
      {
        code: "invalid-object-expression",
        message: "Object expressions must start and end with braces.",
      },
    ];
  }

  if (!isWorkflowEditorExpressionBalanced(source)) {
    return [
      {
        code: "unbalanced-expression",
        message: "Expression has unbalanced braces, brackets, parentheses, or quotes.",
      },
    ];
  }

  const body = startsWithObject ? source.slice(1, -1).trim() : source;

  if (!body) {
    return [];
  }

  const entries = splitWorkflowEditorExpressionList(body);

  if (!entries) {
    return [
      {
        code: "unbalanced-expression",
        message: "Expression has unbalanced braces, brackets, parentheses, or quotes.",
      },
    ];
  }

  const diagnostics: WorkflowEditorObjectConstructorExpressionDiagnostic[] = [];

  entries.forEach((entry, index) => {
    const trimmedEntry = entry.trim();

    if (!trimmedEntry) {
      return;
    }

    const separatorIndex = findWorkflowEditorTopLevelCharacter(entry, ":");

    if (separatorIndex === -1) {
      diagnostics.push({
        code: "invalid-property",
        index,
        message: "Object properties must use key: value syntax.",
      });
      return;
    }

    const rawKey = entry.slice(0, separatorIndex).trim();
    const sourceExpression = entry.slice(separatorIndex + 1).trim();
    const key = parseWorkflowEditorObjectConstructorExpressionKey(rawKey);

    if (!key) {
      diagnostics.push({
        code: "invalid-property-key",
        index,
        message: "Object property keys must be identifiers or quoted strings.",
      });
    }

    if (!sourceExpression) {
      diagnostics.push({
        code: "missing-property-value",
        index,
        message: "Object property values cannot be empty.",
      });
    }
  });

  return diagnostics;
}

export function updateWorkflowEditorObjectConstructorExpressionInNode<
  TNodeData = Record<string, unknown>,
>(node: WorkflowEditorNode<TNodeData>, expression: string): WorkflowEditorNode<TNodeData> {
  const entries = parseWorkflowEditorObjectConstructorExpression(expression);

  if (!entries) {
    return node;
  }

  return updateWorkflowEditorObjectConstructorExpressionEntriesInNode(node, entries);
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
    workflowEditorPortIdBase(options.portId, propertyKey || "property"),
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
  const nextInputs = [
    ...propertyInputs,
    port,
    addInput ?? createWorkflowEditorObjectConstructorAddPort(),
  ];
  const nextProperties = {
    ...readWorkflowEditorObjectConstructorProperties(syncedNode.data),
    [port.id]: {
      key: propertyKey,
      sourceExpression: options.sourceExpression,
      sourceNodeId: options.sourceNodeId,
      sourcePortId: options.sourcePortId,
    } satisfies WorkflowEditorObjectConstructorProperty,
  };
  const nextSchema = createWorkflowEditorObjectConstructorSchemaFromInputs(
    nextInputs,
    nextProperties,
    getWorkflowEditorObjectConstructorSchema(syncedNode),
    readWorkflowEditorObjectConstructorProperties(syncedNode.data),
  );

  return syncWorkflowEditorObjectConstructorNode({
    ...syncedNode,
    inputs: nextInputs,
    data: {
      ...(isRecord(syncedNode.data) ? syncedNode.data : {}),
      properties: nextProperties,
      schema: nextSchema,
    } as TNodeData,
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
  const previousSchema = getWorkflowEditorObjectConstructorSchema(syncedNode);
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
  const nextSchema = createWorkflowEditorObjectConstructorSchemaFromInputs(
    inputs,
    nextProperties,
    previousSchema,
    properties,
  );

  return syncWorkflowEditorObjectConstructorNode({
    ...syncedNode,
    inputs,
    data: {
      ...(isRecord(syncedNode.data) ? syncedNode.data : {}),
      properties: nextProperties,
      schema: nextSchema,
    } as TNodeData,
  });
}

export function removeWorkflowEditorObjectConstructorInputFromNode<
  TNodeData = Record<string, unknown>,
>(node: WorkflowEditorNode<TNodeData>, portId: string): WorkflowEditorNode<TNodeData> {
  if (!isWorkflowEditorObjectConstructorNode(node)) {
    return node;
  }

  const syncedNode = syncWorkflowEditorObjectConstructorNode(node);

  if (
    (syncedNode.inputs ?? []).some(
      (input) => input.id === portId && isWorkflowEditorObjectConstructorAddInput(input),
    )
  ) {
    return syncedNode;
  }

  const properties = readWorkflowEditorObjectConstructorProperties(syncedNode.data);
  const { [portId]: _removedProperty, ...nextProperties } = properties;
  const inputs = (syncedNode.inputs ?? []).filter((input) => input.id !== portId);
  const nextSchema = createWorkflowEditorObjectConstructorSchemaFromInputs(
    inputs,
    nextProperties,
    getWorkflowEditorObjectConstructorSchema(syncedNode),
    properties,
  );

  return syncWorkflowEditorObjectConstructorNode({
    ...syncedNode,
    inputs,
    data: {
      ...(isRecord(syncedNode.data) ? syncedNode.data : {}),
      properties: nextProperties,
      schema: nextSchema,
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

export function updateWorkflowEditorObjectConstructorSchema<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  nodeId: string,
  schema: WorkflowEditorObjectConstructorSchema,
): WorkflowEditorDocument<TNodeData, TEdgeData> {
  const node = findWorkflowEditorNode(document, nodeId);

  if (!node || !isWorkflowEditorObjectConstructorNode(node)) {
    return document;
  }

  const nextNode = updateWorkflowEditorObjectConstructorSchemaInNode(node, schema);
  const nextInputIds = new Set((nextNode.inputs ?? []).map((input) => input.id));

  return normalizeWorkflowEditorDocument({
    ...document,
    nodes: document.nodes.map((candidate) => (candidate.id === nodeId ? nextNode : candidate)),
    edges: document.edges.filter(
      (edge) => edge.targetNodeId !== nodeId || nextInputIds.has(edge.targetPortId),
    ),
  });
}

export function updateWorkflowEditorObjectConstructorExpression<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  nodeId: string,
  expression: string,
): WorkflowEditorDocument<TNodeData, TEdgeData> {
  const node = findWorkflowEditorNode(document, nodeId);

  if (!node || !isWorkflowEditorObjectConstructorNode(node)) {
    return document;
  }

  const entries = parseWorkflowEditorObjectConstructorExpression(expression);

  if (!entries) {
    return document;
  }

  const previousProperties = readWorkflowEditorObjectConstructorProperties(node.data);
  const nextNode = updateWorkflowEditorObjectConstructorExpressionEntriesInNode(node, entries);
  const nextProperties = readWorkflowEditorObjectConstructorProperties(nextNode.data);
  const nextInputIds = new Set((nextNode.inputs ?? []).map((input) => input.id));

  return normalizeWorkflowEditorDocument({
    ...document,
    nodes: document.nodes.map((candidate) => (candidate.id === nodeId ? nextNode : candidate)),
    edges: document.edges.filter((edge) => {
      if (edge.targetNodeId !== nodeId || !nextInputIds.has(edge.targetPortId)) {
        return edge.targetNodeId !== nodeId;
      }

      const previousProperty = previousProperties[edge.targetPortId];
      const nextProperty = nextProperties[edge.targetPortId];
      return previousProperty?.sourceExpression === nextProperty?.sourceExpression;
    }),
  });
}

export function removeWorkflowEditorObjectConstructorInput<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  nodeId: string,
  portId: string,
): WorkflowEditorDocument<TNodeData, TEdgeData> {
  const node = findWorkflowEditorNode(document, nodeId);

  if (!node) {
    return document;
  }

  const nextNode = removeWorkflowEditorObjectConstructorInputFromNode(node, portId);

  return normalizeWorkflowEditorDocument({
    ...document,
    nodes: document.nodes.map((candidate) => (candidate.id === nodeId ? nextNode : candidate)),
    edges: document.edges.filter(
      (edge) => !(edge.targetNodeId === nodeId && edge.targetPortId === portId),
    ),
  });
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
    workflowEditorPortIdBase(options.portId, propertyKey || "property"),
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

export function removeWorkflowEditorObjectDecompositionOutputFromNode<
  TNodeData = Record<string, unknown>,
>(node: WorkflowEditorNode<TNodeData>, portId: string): WorkflowEditorNode<TNodeData> {
  if (!isWorkflowEditorObjectDecompositionNode(node)) {
    return node;
  }

  const syncedNode = syncWorkflowEditorObjectDecompositionNode(node);

  if (
    (syncedNode.outputs ?? []).some(
      (output) => output.id === portId && isWorkflowEditorObjectDecompositionAddOutput(output),
    )
  ) {
    return syncedNode;
  }

  const properties = readWorkflowEditorObjectDecompositionProperties(syncedNode.data);
  const { [portId]: _removedProperty, ...nextProperties } = properties;
  const outputs = (syncedNode.outputs ?? []).filter((output) => output.id !== portId);

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

export function removeWorkflowEditorObjectDecompositionOutput<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  nodeId: string,
  portId: string,
): WorkflowEditorDocument<TNodeData, TEdgeData> {
  const node = findWorkflowEditorNode(document, nodeId);

  if (!node) {
    return document;
  }

  const nextNode = removeWorkflowEditorObjectDecompositionOutputFromNode(node, portId);

  return normalizeWorkflowEditorDocument({
    ...document,
    nodes: document.nodes.map((candidate) => (candidate.id === nodeId ? nextNode : candidate)),
    edges: document.edges.filter(
      (edge) => !(edge.sourceNodeId === nodeId && edge.sourcePortId === portId),
    ),
  });
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
  return normalizeWorkflowEditorDocument(
    moveGraphEditorNode<TNodeData, TEdgeData, WorkflowEditorPortType>(
      document,
      nodeId,
      position,
    ) as WorkflowEditorDocument<TNodeData, TEdgeData>,
  );
}

export function removeWorkflowEditorNode<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  nodeId: string,
): WorkflowEditorDocument<TNodeData, TEdgeData> {
  return normalizeWorkflowEditorDocument({
    ...document,
    nodes: document.nodes.filter((node) => node.id !== nodeId),
    edges: document.edges.filter(
      (edge) => edge.sourceNodeId !== nodeId && edge.targetNodeId !== nodeId,
    ),
    groups: (document.groups ?? [])
      .map((group) =>
        Object.assign({}, group, {
          nodeIds: group.nodeIds.filter((currentNodeId) => currentNodeId !== nodeId),
        }),
      )
      .filter((group) => group.nodeIds.length >= 2),
  });
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
    categoryPath: options.categoryPath ?? commonWorkflowEditorNodeCategoryPath(parts.nodes),
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
  return normalizeWorkflowEditorDocument(
    addGraphEditorEdge<TNodeData, TEdgeData, WorkflowEditorPortType>(
      document,
      edge,
    ) as WorkflowEditorDocument<TNodeData, TEdgeData>,
  );
}

export function removeWorkflowEditorEdge<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  edgeId: string,
): WorkflowEditorDocument<TNodeData, TEdgeData> {
  return normalizeWorkflowEditorDocument(
    removeGraphEditorEdge<TNodeData, TEdgeData, WorkflowEditorPortType>(
      document,
      edgeId,
    ) as WorkflowEditorDocument<TNodeData, TEdgeData>,
  );
}

export function validateWorkflowEditorConnection<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  connection: WorkflowEditorConnectionInput,
  options: WorkflowEditorTypeValidationOptions = {},
): WorkflowEditorConnectionValidity {
  const context = createWorkflowEditorDocumentContext(document);
  const targetNode = context.nodeById.get(connection.targetNodeId);
  const targetPort = targetNode
    ? context.getInputPort(connection.targetNodeId, connection.targetPortId)
    : undefined;
  const typeResolver = createWorkflowEditorTypeResolver(options.typeDefinitions);
  const expandsToNewTargetPort =
    !!targetNode &&
    !!targetPort &&
    ((isWorkflowEditorArrayConstructorNode(targetNode) &&
      (isWorkflowEditorArrayConstructorAddInput(targetPort) ||
        !!context.getIncomingEdgeToPort(targetNode.id, targetPort.id))) ||
      (isWorkflowEditorObjectConstructorNode(targetNode) &&
        (isWorkflowEditorObjectConstructorAddInput(targetPort) ||
          !!context.getIncomingEdgeToPort(targetNode.id, targetPort.id))));

  const validity = validateGraphEditorConnection<TNodeData, TEdgeData, WorkflowEditorPortType>(
    document,
    connection,
    {
      allowCycles: false,
      allowOccupiedInputs: expandsToNewTargetPort,
      arePortsCompatible(sourcePort, targetPort) {
        const sourceType = sourcePort.type as WorkflowEditorPortType;
        const targetType = expandsToNewTargetPort
          ? ({ kind: "any" } as const)
          : (targetPort.type as WorkflowEditorPortType);
        return typeResolver.isAssignable(sourceType, targetType)
          ? true
          : { valid: false, reason: "type-mismatch" };
      },
    },
  );

  return validity as WorkflowEditorConnectionValidity;
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

  const expandedConnection = expandWorkflowEditorConnectionWithBehaviors(document, connection);
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
  const context = createWorkflowEditorDocumentContext(document);
  const typeResolver = createWorkflowEditorTypeResolver(options.typeDefinitions);

  for (const edge of document.edges) {
    const sourceNode = context.nodeById.get(edge.sourceNodeId);
    const targetNode = context.nodeById.get(edge.targetNodeId);
    const sourcePort = context.getOutputPort(edge.sourceNodeId, edge.sourcePortId);
    const targetPort = context.getInputPort(edge.targetNodeId, edge.targetPortId);

    if (!sourceNode || !targetNode || !sourcePort || !targetPort) {
      continue;
    }

    const resolutionErrors = [
      ...typeResolver.findResolutionErrors(sourcePort.type),
      ...typeResolver.findResolutionErrors(targetPort.type),
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
      !typeResolver.isAssignable(sourcePort.type, targetPort.type)
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
  return createWorkflowEditorTypeResolver(typeDefinitions).isAssignable(source, target);
}

export function duplicateWorkflowEditorNode<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  nodeId: string,
  options: WorkflowEditorDuplicateNodeOptions = {},
): WorkflowEditorDocument<TNodeData, TEdgeData> {
  return normalizeWorkflowEditorDocument(
    duplicateGraphEditorNode<TNodeData, TEdgeData, WorkflowEditorPortType>(
      document,
      nodeId,
      options,
    ) as WorkflowEditorDocument<TNodeData, TEdgeData>,
  );
}

export function detectWorkflowEditorCycles<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(document: WorkflowEditorDocument<TNodeData, TEdgeData>) {
  return detectGraphEditorCycles<TNodeData, TEdgeData, WorkflowEditorPortType>(document);
}

export function wouldCreateWorkflowEditorCycle<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  connection: WorkflowEditorConnectionInput,
  _context: WorkflowEditorDocumentContext<
    TNodeData,
    TEdgeData
  > = createWorkflowEditorDocumentContext(document),
) {
  return wouldCreateGraphEditorCycle<TNodeData, TEdgeData, WorkflowEditorPortType>(
    document,
    connection,
  );
}

export function isWorkflowEditorDirectedAcyclicGraph<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(document: WorkflowEditorDocument<TNodeData, TEdgeData>) {
  return isGraphEditorDirectedAcyclicGraph<TNodeData, TEdgeData, WorkflowEditorPortType>(document);
}

export function topologicallySortWorkflowEditorNodes<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(document: WorkflowEditorDocument<TNodeData, TEdgeData>) {
  const nodeLookup = new Map(document.nodes.map((node) => [node.id, node]));
  const inDegree = new Map(document.nodes.map((node) => [node.id, 0]));
  const context = createWorkflowEditorDocumentContext(document);

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

    for (const nextNodeId of context.adjacencyByNodeId.get(nodeId) ?? []) {
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

export function getWorkflowEditorJsonPrimitiveSourceName<TData>(
  node: WorkflowEditorNode<TData>,
): string | undefined {
  if (!isWorkflowEditorJsonPrimitiveNode(node)) {
    return undefined;
  }

  const sourceName = isRecord(node.data) ? node.data.sourceName : undefined;
  return normalizeWorkflowEditorSourceIdentifier(
    sourceName,
    getWorkflowEditorJsonPrimitiveSourceNameBase(node),
  );
}

function isWorkflowEditorJsonPrimitiveNode<TData>(
  node: WorkflowEditorNode<TData>,
): node is WorkflowEditorNode<TData> & {
  kind: "json.string" | "json.number" | "json.boolean" | "json.null";
} {
  return (
    node.kind === "json.string" ||
    node.kind === "json.number" ||
    node.kind === "json.boolean" ||
    node.kind === "json.null"
  );
}

function getWorkflowEditorJsonPrimitiveSourceNameBase<TData>(node: WorkflowEditorNode<TData>) {
  switch (node.kind) {
    case "json.string":
      return "stringValue";
    case "json.number":
      return "numberValue";
    case "json.boolean":
      return "booleanValue";
    case "json.null":
      return "nullValue";
    default:
      return "jsonValue";
  }
}

function expandWorkflowEditorArrayConstructorConnection<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  connection: WorkflowEditorConnectionInput,
  context: WorkflowEditorDocumentContext<
    TNodeData,
    TEdgeData
  > = createWorkflowEditorDocumentContext(document),
): {
  document: WorkflowEditorDocument<TNodeData, TEdgeData>;
  connection: WorkflowEditorConnectionInput;
} {
  const sourceNode = context.nodeById.get(connection.sourceNodeId);
  const targetNode = context.nodeById.get(connection.targetNodeId);
  const sourcePort = context.getOutputPort(connection.sourceNodeId, connection.sourcePortId);
  const targetPort = context.getInputPort(connection.targetNodeId, connection.targetPortId);

  if (!sourceNode || !targetNode || !sourcePort || !targetPort) {
    return { document, connection };
  }

  if (!isWorkflowEditorArrayConstructorNode(targetNode)) {
    return { document, connection };
  }

  const targetPortOccupied = !!context.getIncomingEdgeToPort(targetNode.id, targetPort.id);
  const shouldCreatePort =
    isWorkflowEditorArrayConstructorAddInput(targetPort) || targetPortOccupied;
  const source = createWorkflowEditorArrayConstructorSource(sourceNode, sourcePort);

  if (!shouldCreatePort) {
    const nextTargetNode = syncWorkflowEditorArrayConstructorNode({
      ...targetNode,
      inputs: (targetNode.inputs ?? []).map((input) =>
        input.id === targetPort.id
          ? createWorkflowEditorArrayConstructorPort(input.id, {
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

  const nextTargetNode = addWorkflowEditorArrayConstructorInputToNode(targetNode, {
    sourceExpression: source.expression,
    sourceNodeId: sourceNode.id,
    sourcePortId: sourcePort.id,
    type: sourcePort.type,
  });
  const nextPort = getWorkflowEditorArrayConstructorInputs(nextTargetNode).at(-1);

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

function expandWorkflowEditorObjectConstructorConnection<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  connection: WorkflowEditorConnectionInput,
  context: WorkflowEditorDocumentContext<
    TNodeData,
    TEdgeData
  > = createWorkflowEditorDocumentContext(document),
): {
  document: WorkflowEditorDocument<TNodeData, TEdgeData>;
  connection: WorkflowEditorConnectionInput;
} {
  const sourceNode = context.nodeById.get(connection.sourceNodeId);
  const targetNode = context.nodeById.get(connection.targetNodeId);
  const sourcePort = context.getOutputPort(connection.sourceNodeId, connection.sourcePortId);
  const targetPort = context.getInputPort(connection.targetNodeId, connection.targetPortId);

  if (!sourceNode || !targetNode || !sourcePort || !targetPort) {
    return { document, connection };
  }

  if (!isWorkflowEditorObjectConstructorNode(targetNode)) {
    return { document, connection };
  }

  const targetPortOccupied = !!context.getIncomingEdgeToPort(targetNode.id, targetPort.id);
  const shouldCreatePort =
    isWorkflowEditorObjectConstructorAddInput(targetPort) || targetPortOccupied;
  const source = createWorkflowEditorObjectConstructorSource(sourceNode, sourcePort);

  if (!shouldCreatePort) {
    const nextInputs = (targetNode.inputs ?? []).map((input) =>
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
    );
    const previousProperties = readWorkflowEditorObjectConstructorProperties(targetNode.data);
    const nextProperties = {
      ...previousProperties,
      [targetPort.id]: {
        key:
          getWorkflowEditorObjectConstructorProperty(targetNode, targetPort.id)?.key ??
          targetPort.label ??
          source.propertyKey,
        sourceExpression: source.expression,
        sourceNodeId: sourceNode.id,
        sourcePortId: sourcePort.id,
      } satisfies WorkflowEditorObjectConstructorProperty,
    };
    const nextTargetNode = syncWorkflowEditorObjectConstructorNode({
      ...targetNode,
      inputs: nextInputs,
      data: {
        ...(isRecord(targetNode.data) ? targetNode.data : {}),
        properties: nextProperties,
        schema: createWorkflowEditorObjectConstructorSchemaFromInputs(
          nextInputs,
          nextProperties,
          getWorkflowEditorObjectConstructorSchema(targetNode),
          previousProperties,
        ),
      } as TNodeData,
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
  context: WorkflowEditorDocumentContext<
    TNodeData,
    TEdgeData
  > = createWorkflowEditorDocumentContext(document),
): {
  document: WorkflowEditorDocument<TNodeData, TEdgeData>;
  connection: WorkflowEditorConnectionInput;
} {
  const sourceNode = context.nodeById.get(connection.sourceNodeId);
  const targetNode = context.nodeById.get(connection.targetNodeId);
  const sourcePort = context.getOutputPort(connection.sourceNodeId, connection.sourcePortId);
  const targetPort = context.getInputPort(connection.targetNodeId, connection.targetPortId);

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

type WorkflowEditorNodeBehavior = {
  kind: string;
  syncNodes?<TNodeData = Record<string, unknown>, TEdgeData = Record<string, unknown>>(
    nodes: Array<WorkflowEditorNode<TNodeData>>,
    edges: Array<WorkflowEditorEdge<TEdgeData>>,
  ): Array<WorkflowEditorNode<TNodeData>>;
  expandConnection?<TNodeData = Record<string, unknown>, TEdgeData = Record<string, unknown>>(
    document: WorkflowEditorDocument<TNodeData, TEdgeData>,
    connection: WorkflowEditorConnectionInput,
    context: WorkflowEditorDocumentContext<TNodeData, TEdgeData>,
  ): {
    document: WorkflowEditorDocument<TNodeData, TEdgeData>;
    connection: WorkflowEditorConnectionInput;
  };
};

const workflowEditorNodeBehaviors = [
  {
    kind: "json.primitive",
    syncNodes: syncWorkflowEditorJsonPrimitiveNodes,
  },
  {
    kind: "json.array",
    syncNodes: syncWorkflowEditorArrayConstructorNodes,
    expandConnection: expandWorkflowEditorArrayConstructorConnection,
  },
  {
    kind: "json.object",
    syncNodes: syncWorkflowEditorObjectConstructorNodes,
    expandConnection: expandWorkflowEditorObjectConstructorConnection,
  },
  {
    kind: "json.object.decompose",
    syncNodes: syncWorkflowEditorObjectDecompositionNodes,
    expandConnection: expandWorkflowEditorObjectDecompositionConnection,
  },
] satisfies WorkflowEditorNodeBehavior[];

function syncWorkflowEditorNodeBehaviors<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(nodes: Array<WorkflowEditorNode<TNodeData>>, edges: Array<WorkflowEditorEdge<TEdgeData>>) {
  return workflowEditorNodeBehaviors.reduce(
    (nextNodes, behavior) => behavior.syncNodes?.(nextNodes, edges) ?? nextNodes,
    nodes,
  );
}

function syncWorkflowEditorJsonPrimitiveNodes<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(nodes: Array<WorkflowEditorNode<TNodeData>>, _edges: Array<WorkflowEditorEdge<TEdgeData>>) {
  const usedSourceNames = new Set<string>();

  return nodes.map((node) => {
    if (!isWorkflowEditorJsonPrimitiveNode(node)) {
      return node;
    }

    const data: Record<string, unknown> = isRecord(node.data) ? node.data : {};
    const sourceName = createUniqueWorkflowEditorSourceIdentifier(
      data.sourceName,
      getWorkflowEditorJsonPrimitiveSourceNameBase(node),
      usedSourceNames,
    );
    usedSourceNames.add(sourceName);

    return {
      ...node,
      data: {
        ...data,
        sourceName,
      } as TNodeData,
    };
  });
}

function expandWorkflowEditorConnectionWithBehaviors<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  connection: WorkflowEditorConnectionInput,
) {
  return workflowEditorNodeBehaviors.reduce(
    (state, behavior) =>
      behavior.expandConnection?.(
        state.document,
        state.connection,
        createWorkflowEditorDocumentContext(state.document),
      ) ?? state,
    { document, connection },
  );
}

function syncWorkflowEditorArrayConstructorNodes<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(nodes: Array<WorkflowEditorNode<TNodeData>>, edges: Array<WorkflowEditorEdge<TEdgeData>>) {
  const context = createWorkflowEditorDocumentContext({ nodes, edges });

  return nodes.map((node) => {
    if (!isWorkflowEditorArrayConstructorNode(node)) {
      return node;
    }

    let nextNode = syncWorkflowEditorArrayConstructorNode(node);

    for (const input of getWorkflowEditorArrayConstructorInputs(nextNode)) {
      const incomingEdge = context.getIncomingEdgeToPort(nextNode.id, input.id);
      const sourceNode = incomingEdge ? context.nodeById.get(incomingEdge.sourceNodeId) : undefined;
      const sourcePort = incomingEdge
        ? context.getOutputPort(incomingEdge.sourceNodeId, incomingEdge.sourcePortId)
        : undefined;

      if (!incomingEdge || !sourceNode || !sourcePort) {
        continue;
      }

      const source = createWorkflowEditorArrayConstructorSource(sourceNode, sourcePort);
      nextNode = syncWorkflowEditorArrayConstructorNode({
        ...nextNode,
        inputs: (nextNode.inputs ?? []).map((nextInput) =>
          nextInput.id === input.id
            ? createWorkflowEditorArrayConstructorPort(nextInput.id, {
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

function syncWorkflowEditorObjectConstructorNodes<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(nodes: Array<WorkflowEditorNode<TNodeData>>, edges: Array<WorkflowEditorEdge<TEdgeData>>) {
  const context = createWorkflowEditorDocumentContext({ nodes, edges });

  return nodes.map((node) => {
    if (!isWorkflowEditorObjectConstructorNode(node)) {
      return node;
    }

    let nextNode = syncWorkflowEditorObjectConstructorNode(node);

    for (const input of getWorkflowEditorObjectConstructorInputs(nextNode)) {
      const incomingEdge = context.getIncomingEdgeToPort(nextNode.id, input.id);
      const sourceNode = incomingEdge ? context.nodeById.get(incomingEdge.sourceNodeId) : undefined;
      const sourcePort = incomingEdge
        ? context.getOutputPort(incomingEdge.sourceNodeId, incomingEdge.sourcePortId)
        : undefined;

      if (!incomingEdge || !sourceNode || !sourcePort) {
        continue;
      }

      const source = createWorkflowEditorObjectConstructorSource(sourceNode, sourcePort);
      const nextInputs = (nextNode.inputs ?? []).map((nextInput) =>
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
      );
      const previousProperties = readWorkflowEditorObjectConstructorProperties(nextNode.data);
      const nextProperties = {
        ...previousProperties,
        [input.id]: {
          key:
            getWorkflowEditorObjectConstructorProperty(nextNode, input.id)?.key ??
            input.label ??
            source.propertyKey,
          sourceExpression: source.expression,
          sourceNodeId: sourceNode.id,
          sourcePortId: sourcePort.id,
        } satisfies WorkflowEditorObjectConstructorProperty,
      };
      nextNode = syncWorkflowEditorObjectConstructorNode({
        ...nextNode,
        inputs: nextInputs,
        data: {
          ...(isRecord(nextNode.data) ? nextNode.data : {}),
          properties: nextProperties,
          schema: createWorkflowEditorObjectConstructorSchemaFromInputs(
            nextInputs,
            nextProperties,
            getWorkflowEditorObjectConstructorSchema(nextNode),
            previousProperties,
          ),
        } as TNodeData,
      });
    }

    return nextNode;
  });
}

function syncWorkflowEditorObjectDecompositionNodes<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(nodes: Array<WorkflowEditorNode<TNodeData>>, edges: Array<WorkflowEditorEdge<TEdgeData>>) {
  const context = createWorkflowEditorDocumentContext({ nodes, edges });

  return nodes.map((node) => {
    if (!isWorkflowEditorObjectDecompositionNode(node)) {
      return node;
    }

    let nextNode = syncWorkflowEditorObjectDecompositionNode(node);
    const objectInput = nextNode.inputs?.find(isWorkflowEditorObjectDecompositionObjectInput);
    const incomingEdge = objectInput
      ? context.getIncomingEdgeToPort(nextNode.id, objectInput.id)
      : undefined;
    const sourceNode = incomingEdge ? context.nodeById.get(incomingEdge.sourceNodeId) : undefined;
    const sourcePort = incomingEdge
      ? context.getOutputPort(incomingEdge.sourceNodeId, incomingEdge.sourcePortId)
      : undefined;

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

function syncWorkflowEditorArrayConstructorNode<TNodeData = Record<string, unknown>>(
  node: WorkflowEditorNode<TNodeData>,
): WorkflowEditorNode<TNodeData> {
  if (!isWorkflowEditorArrayConstructorNode(node)) {
    return node;
  }

  const items = readWorkflowEditorArrayConstructorItems(node.data);
  const itemInputs = (node.inputs ?? []).filter(
    (input) => !isWorkflowEditorArrayConstructorAddInput(input),
  );
  const syncedItems: Record<string, WorkflowEditorArrayConstructorItem> = {};
  const syncedInputs = itemInputs.map((input, index) => {
    const item = items[input.id] ?? getWorkflowEditorArrayConstructorItem(node, input.id);
    syncedItems[input.id] = item ?? {};

    return Object.assign({}, input, {
      label: `Item ${index + 1}`,
      badge: item?.sourceExpression ?? input.badge,
      type: input.type ?? { kind: "any" },
      metadata: {
        ...(input.metadata ?? {}),
        arrayConstructorRole: "item",
      },
    });
  });
  const elementType = getWorkflowEditorArrayConstructorElementType(syncedInputs);
  const outputs = node.outputs?.length
    ? node.outputs.map((output) =>
        output.id === "value"
          ? {
              ...output,
              label: output.label || "Value",
              type: { kind: "array", element: elementType } as WorkflowEditorPortType,
            }
          : output,
      )
    : [
        {
          id: "value",
          label: "Value",
          type: { kind: "array", element: elementType } as WorkflowEditorPortType,
        },
      ];

  if (!outputs.some((output) => output.id === "value")) {
    outputs.push({
      id: "value",
      label: "Value",
      type: { kind: "array", element: elementType },
    });
  }

  return {
    ...node,
    inputs: [...syncedInputs, createWorkflowEditorArrayConstructorAddPort()],
    outputs,
    data: {
      ...(isRecord(node.data) ? node.data : {}),
      items: syncedItems,
    } as TNodeData,
  };
}

function createWorkflowEditorArrayConstructorPort(
  id: string,
  options: WorkflowEditorArrayConstructorInputOptions,
): WorkflowEditorPort {
  return {
    id,
    label: "Item",
    type: options.type ?? { kind: "any" },
    badge: options.sourceExpression,
    metadata: {
      arrayConstructorRole: "item",
      arrayConstructorItem: {
        sourceExpression: options.sourceExpression,
        sourceNodeId: options.sourceNodeId,
        sourcePortId: options.sourcePortId,
      } satisfies WorkflowEditorArrayConstructorItem,
    },
  };
}

function createWorkflowEditorArrayConstructorAddPort(): WorkflowEditorPort {
  return {
    id: "item-add",
    label: "Add item",
    type: { kind: "any" },
    badge: "new",
    metadata: { arrayConstructorRole: "add-item" },
  };
}

function isWorkflowEditorArrayConstructorAddInput(port: WorkflowEditorPort) {
  return port.id === "item-add" && port.metadata?.arrayConstructorRole === "add-item";
}

function getWorkflowEditorArrayConstructorItem<TNodeData = Record<string, unknown>>(
  node: WorkflowEditorNode<TNodeData>,
  portId: string,
) {
  const items = readWorkflowEditorArrayConstructorItems(node.data);
  const item = items[portId];

  if (item) {
    return item;
  }

  const port = node.inputs?.find((input) => input.id === portId);
  const metadataItem = isRecord(port?.metadata?.arrayConstructorItem)
    ? port.metadata.arrayConstructorItem
    : undefined;

  if (!metadataItem) {
    return undefined;
  }

  return {
    sourceExpression:
      typeof metadataItem.sourceExpression === "string" ? metadataItem.sourceExpression : undefined,
    sourceNodeId:
      typeof metadataItem.sourceNodeId === "string" ? metadataItem.sourceNodeId : undefined,
    sourcePortId:
      typeof metadataItem.sourcePortId === "string" ? metadataItem.sourcePortId : undefined,
  } satisfies WorkflowEditorArrayConstructorItem;
}

function readWorkflowEditorArrayConstructorItems(
  data: unknown,
): Record<string, WorkflowEditorArrayConstructorItem> {
  if (!isRecord(data) || !isRecord(data.items)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(data.items).flatMap(([portId, value]) => {
      if (!isRecord(value)) {
        return [];
      }

      return [
        [
          portId,
          {
            sourceExpression:
              typeof value.sourceExpression === "string" ? value.sourceExpression : undefined,
            sourceNodeId: typeof value.sourceNodeId === "string" ? value.sourceNodeId : undefined,
            sourcePortId: typeof value.sourcePortId === "string" ? value.sourcePortId : undefined,
          } satisfies WorkflowEditorArrayConstructorItem,
        ],
      ];
    }),
  );
}

function getWorkflowEditorArrayConstructorElementType(inputs: WorkflowEditorPort[]) {
  if (inputs.length === 0) {
    return { kind: "any" } satisfies WorkflowEditorPortType;
  }

  if (inputs.some((input) => input.type.kind === "any")) {
    return { kind: "any" } satisfies WorkflowEditorPortType;
  }

  const uniqueTypes = new Map<string, WorkflowEditorPortType>();

  for (const input of inputs) {
    uniqueTypes.set(getWorkflowEditorPortTypeSignature(input.type), input.type);
  }

  if (uniqueTypes.size === 1) {
    return [...uniqueTypes.values()][0]!;
  }

  return { kind: "union", types: [...uniqueTypes.values()] } satisfies WorkflowEditorPortType;
}

function getWorkflowEditorPortTypeSignature(type: WorkflowEditorPortType): string {
  switch (type.kind) {
    case "literal":
      return `literal:${JSON.stringify(type.value)}`;
    case "array":
      return `array:${getWorkflowEditorPortTypeSignature(type.element)}`;
    case "object": {
      const properties = type.properties
        ? Object.entries(type.properties)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(
              ([key, property]) =>
                `${key}${property.optional ? "?" : ""}:${getWorkflowEditorPortTypeSignature(
                  property.type,
                )}`,
            )
            .join(",")
        : "";
      return `object:{${properties}}`;
    }
    case "union":
      return `union:${type.types.map(getWorkflowEditorPortTypeSignature).join("|")}`;
    case "intersection":
      return `intersection:${type.types.map(getWorkflowEditorPortTypeSignature).join("&")}`;
    case "ref":
      return `ref:${type.name}`;
    default:
      return type.kind;
  }
}

function createWorkflowEditorArrayConstructorSource<TNodeData = Record<string, unknown>>(
  node: WorkflowEditorNode<TNodeData>,
  port: WorkflowEditorPort,
) {
  const nodeKey = normalizeObjectPropertyKey(node.label || node.id);
  const portKey = normalizeObjectPropertyKey(port.label || port.id);
  const expression = isGenericWorkflowEditorPortKey(portKey) ? nodeKey : `${nodeKey}.${portKey}`;

  return {
    expression,
  };
}

function syncWorkflowEditorObjectConstructorNode<TNodeData = Record<string, unknown>>(
  node: WorkflowEditorNode<TNodeData>,
): WorkflowEditorNode<TNodeData> {
  if (!isWorkflowEditorObjectConstructorNode(node)) {
    return node;
  }

  const schema = readWorkflowEditorObjectConstructorSchema(node.data);
  const properties = readWorkflowEditorObjectConstructorProperties(node.data);
  const propertyInputs = (node.inputs ?? []).filter(
    (input) => !isWorkflowEditorObjectConstructorAddInput(input),
  );
  const previousSchema = getWorkflowEditorObjectConstructorSchema(node);
  const usedPropertyKeys = new Set<string>();
  const usedPortIds = new Set((node.inputs ?? []).map((input) => input.id));
  const syncedProperties: Record<string, WorkflowEditorObjectConstructorProperty> = {};
  const inputsByPropertyKey = new Map<string, WorkflowEditorPort>();
  const propertiesByKey = new Map<string, WorkflowEditorObjectConstructorProperty>();

  for (const input of propertyInputs) {
    const property =
      properties[input.id] ?? getWorkflowEditorObjectConstructorProperty(node, input.id);
    const propertyKey = normalizeObjectPropertyKey(property?.key ?? input.label ?? input.id);
    inputsByPropertyKey.set(propertyKey, input);
    propertiesByKey.set(propertyKey, property ?? { key: propertyKey });
  }

  const syncedInputs = schema
    ? Object.entries(schema.properties ?? {}).map(([rawPropertyKey, schemaProperty]) => {
        const propertyKey = createUniqueObjectPropertyKey(rawPropertyKey, usedPropertyKeys);
        usedPropertyKeys.add(propertyKey);
        const existingInput = inputsByPropertyKey.get(propertyKey);
        const existingProperty = propertiesByKey.get(propertyKey);
        const portId =
          existingInput?.id ??
          createUniqueId(usedPortIds, workflowEditorPortIdBase(undefined, propertyKey));
        usedPortIds.add(portId);
        syncedProperties[portId] = {
          ...(existingProperty ?? { key: propertyKey }),
          key: propertyKey,
        };

        return createWorkflowEditorObjectConstructorPort(portId, {
          propertyKey,
          sourceExpression: existingProperty?.sourceExpression,
          sourceNodeId: existingProperty?.sourceNodeId,
          sourcePortId: existingProperty?.sourcePortId,
          type: schemaProperty.type,
        });
      })
    : propertyInputs.map((input) => {
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
  const outputSchema =
    schema ??
    createWorkflowEditorObjectConstructorSchemaFromInputs(
      syncedInputs,
      syncedProperties,
      previousSchema,
      properties,
    );
  const outputs = node.outputs?.length
    ? node.outputs.map((output) =>
        output.id === "value"
          ? {
              ...output,
              label: output.label || "Object",
              type: outputSchema,
            }
          : output,
      )
    : [
        {
          id: "value",
          label: "Object",
          type: outputSchema,
        },
      ];

  if (!outputs.some((output) => output.id === "value")) {
    outputs.push({
      id: "value",
      label: "Object",
      type: outputSchema,
    });
  }

  return {
    ...node,
    inputs: [...syncedInputs, createWorkflowEditorObjectConstructorAddPort()],
    outputs,
    data: {
      ...(isRecord(node.data) ? node.data : {}),
      schema: outputSchema,
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

function readWorkflowEditorObjectConstructorSchema(
  data: unknown,
): WorkflowEditorObjectConstructorSchema | null {
  if (!isRecord(data) || !isWorkflowEditorObjectConstructorSchema(data.schema)) {
    return null;
  }

  return normalizeWorkflowEditorObjectConstructorSchema(data.schema);
}

export function isWorkflowEditorObjectConstructorSchema(
  value: unknown,
): value is WorkflowEditorObjectConstructorSchema {
  return isRecord(value) && value.kind === "object" && isWorkflowEditorPortTypeLike(value);
}

function normalizeWorkflowEditorObjectConstructorSchema(
  schema: WorkflowEditorObjectConstructorSchema,
): WorkflowEditorObjectConstructorSchema {
  const usedPropertyKeys = new Set<string>();
  const properties = Object.fromEntries(
    Object.entries(schema.properties ?? {}).map(([rawPropertyKey, property]) => {
      const propertyKey = createUniqueObjectPropertyKey(rawPropertyKey, usedPropertyKeys);
      usedPropertyKeys.add(propertyKey);

      return [
        propertyKey,
        {
          type: property.type,
          ...(property.optional === undefined ? {} : { optional: property.optional }),
        } satisfies WorkflowEditorPortProperty,
      ];
    }),
  );

  return { kind: "object", properties };
}

function createWorkflowEditorObjectConstructorSchemaFromInputs(
  inputs: WorkflowEditorPort[],
  properties: Record<string, WorkflowEditorObjectConstructorProperty>,
  previousSchema: WorkflowEditorObjectConstructorSchema,
  previousProperties: Record<string, WorkflowEditorObjectConstructorProperty>,
): WorkflowEditorObjectConstructorSchema {
  const schemaProperties = Object.fromEntries(
    inputs
      .filter((input) => !isWorkflowEditorObjectConstructorAddInput(input))
      .map((input) => {
        const propertyKey = properties[input.id]?.key ?? input.label ?? input.id;
        const previousPropertyKey = previousProperties[input.id]?.key;
        const previousSchemaProperty =
          previousSchema.properties?.[propertyKey] ??
          (previousPropertyKey ? previousSchema.properties?.[previousPropertyKey] : undefined);

        return [
          propertyKey,
          {
            type: input.type ?? ({ kind: "any" } satisfies WorkflowEditorPortType),
            ...(previousSchemaProperty?.optional === undefined
              ? {}
              : { optional: previousSchemaProperty.optional }),
          } satisfies WorkflowEditorPortProperty,
        ];
      }),
  );

  return { kind: "object", properties: schemaProperties };
}

function updateWorkflowEditorObjectConstructorExpressionEntriesInNode<
  TNodeData = Record<string, unknown>,
>(
  node: WorkflowEditorNode<TNodeData>,
  entries: WorkflowEditorObjectConstructorExpressionEntry[],
): WorkflowEditorNode<TNodeData> {
  if (!isWorkflowEditorObjectConstructorNode(node)) {
    return node;
  }

  const syncedNode = syncWorkflowEditorObjectConstructorNode(node);
  const previousProperties = readWorkflowEditorObjectConstructorProperties(syncedNode.data);
  const previousSchema = getWorkflowEditorObjectConstructorSchema(syncedNode);
  const previousInputs = getWorkflowEditorObjectConstructorInputs(syncedNode);
  const inputsByPropertyKey = new Map<string, WorkflowEditorPort>();
  const inputsBySourceExpression = new Map<string, WorkflowEditorPort>();
  const propertiesByPropertyKey = new Map<string, WorkflowEditorObjectConstructorProperty>();
  const usedPortIds = new Set((syncedNode.inputs ?? []).map((input) => input.id));
  const usedPropertyKeys = new Set<string>();
  const nextProperties: Record<string, WorkflowEditorObjectConstructorProperty> = {};

  for (const input of previousInputs) {
    const property = previousProperties[input.id] ?? { key: input.label ?? input.id };
    inputsByPropertyKey.set(property.key, input);
    propertiesByPropertyKey.set(property.key, property);

    if (property.sourceExpression) {
      inputsBySourceExpression.set(property.sourceExpression, input);
    }
  }

  const nextInputs = entries.map((entry) => {
    const propertyKey = createUniqueObjectPropertyKey(entry.key, usedPropertyKeys);
    usedPropertyKeys.add(propertyKey);
    const matchingInput =
      inputsByPropertyKey.get(propertyKey) ?? inputsBySourceExpression.get(entry.sourceExpression);
    const matchingProperty = matchingInput
      ? previousProperties[matchingInput.id]
      : propertiesByPropertyKey.get(propertyKey);
    const preserveSourceIds = matchingProperty?.sourceExpression === entry.sourceExpression;
    const portId =
      matchingInput?.id ??
      createUniqueId(usedPortIds, workflowEditorPortIdBase(undefined, propertyKey));
    const schemaProperty =
      previousSchema.properties?.[propertyKey] ??
      (matchingProperty?.key ? previousSchema.properties?.[matchingProperty.key] : undefined);
    usedPortIds.add(portId);
    nextProperties[portId] = {
      key: propertyKey,
      sourceExpression: entry.sourceExpression,
      sourceNodeId: preserveSourceIds ? matchingProperty?.sourceNodeId : undefined,
      sourcePortId: preserveSourceIds ? matchingProperty?.sourcePortId : undefined,
    };

    return createWorkflowEditorObjectConstructorPort(portId, {
      propertyKey,
      sourceExpression: entry.sourceExpression,
      sourceNodeId: preserveSourceIds ? matchingProperty?.sourceNodeId : undefined,
      sourcePortId: preserveSourceIds ? matchingProperty?.sourcePortId : undefined,
      type: matchingInput?.type ?? schemaProperty?.type ?? { kind: "any" },
    });
  });
  const addInput =
    (syncedNode.inputs ?? []).find(isWorkflowEditorObjectConstructorAddInput) ??
    createWorkflowEditorObjectConstructorAddPort();
  const nextSchema = createWorkflowEditorObjectConstructorSchemaFromInputs(
    nextInputs,
    nextProperties,
    previousSchema,
    previousProperties,
  );

  return syncWorkflowEditorObjectConstructorNode({
    ...syncedNode,
    inputs: [...nextInputs, addInput],
    data: {
      ...(isRecord(syncedNode.data) ? syncedNode.data : {}),
      properties: nextProperties,
      schema: nextSchema,
    } as TNodeData,
  });
}

function createWorkflowEditorObjectConstructorSource<TNodeData = Record<string, unknown>>(
  node: WorkflowEditorNode<TNodeData>,
  port: WorkflowEditorPort,
) {
  const nodeKey = normalizeObjectPropertyKey(node.label || node.id);
  const portKey = normalizeObjectPropertyKey(port.label || port.id);
  const jsonPrimitiveSourceName = getWorkflowEditorJsonPrimitiveSourceName(node);
  const genericPortKey = isGenericWorkflowEditorPortKey(portKey);
  const sourceKey = genericPortKey && jsonPrimitiveSourceName ? jsonPrimitiveSourceName : nodeKey;
  const expression = genericPortKey ? sourceKey : `${nodeKey}.${portKey}`;
  const propertyKey = genericPortKey ? sourceKey : portKey;

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

  const properties = createWorkflowEditorTypeResolver().objectPropertiesFromType(objectInput.type);

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

const workflowEditorReservedSourceIdentifiers = new Set([
  "any",
  "as",
  "async",
  "await",
  "boolean",
  "break",
  "case",
  "catch",
  "class",
  "const",
  "continue",
  "debugger",
  "declare",
  "default",
  "delete",
  "do",
  "else",
  "enum",
  "export",
  "extends",
  "false",
  "finally",
  "for",
  "from",
  "function",
  "get",
  "if",
  "implements",
  "import",
  "in",
  "infer",
  "instanceof",
  "interface",
  "is",
  "keyof",
  "let",
  "module",
  "namespace",
  "never",
  "new",
  "null",
  "number",
  "object",
  "of",
  "package",
  "private",
  "protected",
  "public",
  "readonly",
  "require",
  "return",
  "set",
  "static",
  "string",
  "super",
  "switch",
  "symbol",
  "this",
  "throw",
  "true",
  "try",
  "type",
  "typeof",
  "undefined",
  "unknown",
  "var",
  "void",
  "while",
  "with",
  "yield",
]);

function normalizeWorkflowEditorSourceIdentifier(value: unknown, fallback: string) {
  const text = String(value ?? "").trim();
  const fallbackIdentifier = normalizeObjectPropertyKey(fallback || "jsonValue");

  if (isWorkflowEditorSafeSourceIdentifier(text)) {
    return text;
  }

  const candidate = text ? normalizeObjectPropertyKey(text) : fallbackIdentifier;

  if (isWorkflowEditorSafeSourceIdentifier(candidate)) {
    return candidate;
  }

  if (isWorkflowEditorSafeSourceIdentifier(fallbackIdentifier)) {
    return fallbackIdentifier;
  }

  return `${fallbackIdentifier}Value`;
}

function isWorkflowEditorSafeSourceIdentifier(value: string) {
  return (
    /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(value) && !workflowEditorReservedSourceIdentifiers.has(value)
  );
}

function createUniqueWorkflowEditorSourceIdentifier(
  value: unknown,
  fallback: string,
  usedSourceNames: ReadonlySet<string>,
) {
  const base = normalizeWorkflowEditorSourceIdentifier(value, fallback);
  let candidate = base;
  let index = 2;

  while (usedSourceNames.has(candidate)) {
    candidate = `${base}${index}`;
    index += 1;
  }

  return candidate;
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

function workflowEditorPortIdBase(portId: string | undefined, fallback: string) {
  const explicitPortId = portId?.trim();
  return explicitPortId || safeWorkflowEditorId(fallback || "port");
}

function formatWorkflowEditorObjectPropertyKey(key: string) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? key : JSON.stringify(key);
}

function formatWorkflowEditorObjectPropertyAccess(key: string) {
  return /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(key) ? `.${key}` : `[${JSON.stringify(key)}]`;
}

function splitWorkflowEditorExpressionList(value: string) {
  const parts: string[] = [];
  let start = 0;

  for (let index = 0; index < value.length; index += 1) {
    if (value[index] !== ",") {
      continue;
    }

    if (isWorkflowEditorTopLevelCharacter(value, index)) {
      parts.push(value.slice(start, index));
      start = index + 1;
    }
  }

  if (!isWorkflowEditorExpressionBalanced(value)) {
    return null;
  }

  parts.push(value.slice(start));
  return parts;
}

function findWorkflowEditorTopLevelCharacter(value: string, character: string) {
  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === character && isWorkflowEditorTopLevelCharacter(value, index)) {
      return index;
    }
  }

  return -1;
}

function isWorkflowEditorTopLevelCharacter(value: string, targetIndex: number) {
  let quote: string | null = null;
  let escaped = false;
  let depth = 0;

  for (let index = 0; index < targetIndex; index += 1) {
    const char = value[index]!;

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === "\\") {
        escaped = true;
      } else if (char === quote) {
        quote = null;
      }
      continue;
    }

    if (char === '"' || char === "'" || char === "`") {
      quote = char;
    } else if (char === "(" || char === "[" || char === "{") {
      depth += 1;
    } else if (char === ")" || char === "]" || char === "}") {
      depth -= 1;
    }
  }

  return !quote && depth === 0;
}

function isWorkflowEditorExpressionBalanced(value: string) {
  return isWorkflowEditorTopLevelCharacter(value, value.length);
}

function parseWorkflowEditorObjectConstructorExpressionKey(value: string) {
  if (!value) {
    return null;
  }

  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    try {
      return JSON.parse(value.startsWith("'") ? JSON.stringify(value.slice(1, -1)) : value);
    } catch {
      return null;
    }
  }

  return value;
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

export {
  copyWorkflowEditorSelection,
  duplicateWorkflowEditorSelection,
  normalizeWorkflowEditorSelection,
  pasteWorkflowEditorClipboardPayload,
  removeWorkflowEditorSelection,
  workflowEditorClipboardFormat,
  workflowEditorClipboardVersion,
  type WorkflowEditorClipboardPayload,
  type WorkflowEditorPasteOptions,
  type WorkflowEditorPasteResult,
} from "./core-clipboard";

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

function normalizeWorkflowEditorCategoryPath(categoryPath: unknown) {
  if (!Array.isArray(categoryPath)) {
    return undefined;
  }

  const normalized = categoryPath.flatMap((part) => {
    if (typeof part !== "string") {
      return [];
    }

    const segment = part.trim();
    return segment ? [segment] : [];
  });

  return normalized.length > 0 ? normalized : undefined;
}

function normalizeWorkflowEditorGroups<TData = Record<string, unknown>>(
  groups: Array<WorkflowEditorGroup<TData>>,
  nodeIds: ReadonlySet<string>,
): Array<WorkflowEditorGroup<TData>> {
  const seenGroupIds = new Set<string>();
  const seenNodeIds = new Set<string>();
  const normalized: Array<WorkflowEditorGroup<TData>> = [];

  for (const group of groups) {
    if (!isRecord(group)) {
      continue;
    }

    const id = typeof group.id === "string" && group.id.trim() ? group.id : "";
    const label = typeof group.label === "string" && group.label.trim() ? group.label : id;

    if (!id || seenGroupIds.has(id) || !Array.isArray(group.nodeIds)) {
      continue;
    }

    const groupNodeIds: string[] = [];
    const seenInGroup = new Set<string>();
    for (const nodeId of group.nodeIds) {
      if (
        typeof nodeId !== "string" ||
        !nodeIds.has(nodeId) ||
        seenInGroup.has(nodeId) ||
        seenNodeIds.has(nodeId)
      ) {
        continue;
      }

      seenInGroup.add(nodeId);
      seenNodeIds.add(nodeId);
      groupNodeIds.push(nodeId);
    }

    if (groupNodeIds.length < 2) {
      continue;
    }

    seenGroupIds.add(id);
    normalized.push({
      ...group,
      id,
      label,
      nodeIds: groupNodeIds,
      minimized: group.minimized === true ? true : undefined,
    });
  }

  return normalized;
}

function normalizeWorkflowEditorNode<TNodeData = Record<string, unknown>>(
  node: WorkflowEditorNode<TNodeData>,
): WorkflowEditorNode<TNodeData> {
  const id = typeof node.id === "string" && node.id.trim() ? node.id : "node";

  return {
    ...node,
    id,
    label: typeof node.label === "string" ? node.label : id,
    categoryPath: normalizeWorkflowEditorCategoryPath(node.categoryPath),
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

function createWorkflowEditorPortLookup(nodes: readonly WorkflowEditorNode<unknown>[]) {
  const inputPortIdsByNodeId = new Map<string, Set<string>>();
  const outputPortIdsByNodeId = new Map<string, Set<string>>();

  for (const node of nodes) {
    const inputs = Array.isArray(node.inputs) ? node.inputs : [];
    const outputs = Array.isArray(node.outputs) ? node.outputs : [];

    inputPortIdsByNodeId.set(
      node.id,
      new Set(
        inputs.flatMap((input) =>
          isRecord(input) && typeof input.id === "string" ? [input.id] : [],
        ),
      ),
    );
    outputPortIdsByNodeId.set(
      node.id,
      new Set(
        outputs.flatMap((output) =>
          isRecord(output) && typeof output.id === "string" ? [output.id] : [],
        ),
      ),
    );
  }

  return {
    inputPortIdsByNodeId,
    outputPortIdsByNodeId,
  };
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
  const internalEdges: Array<WorkflowEditorEdge<TEdgeData>> = [];
  const incomingEdges: Array<WorkflowEditorEdge<TEdgeData>> = [];
  const outgoingEdges: Array<WorkflowEditorEdge<TEdgeData>> = [];
  const internallyConnectedInputs = new Set<string>();
  const internallyConnectedOutputs = new Set<string>();
  const externallyConnectedInputs = new Set<string>();
  const externallyConnectedOutputs = new Set<string>();

  for (const edge of document.edges) {
    const sourceSelected = selectedIds.has(edge.sourceNodeId);
    const targetSelected = selectedIds.has(edge.targetNodeId);

    if (sourceSelected && targetSelected) {
      internalEdges.push(edge);
      internallyConnectedOutputs.add(boundaryKey(edge.sourceNodeId, edge.sourcePortId));
      internallyConnectedInputs.add(boundaryKey(edge.targetNodeId, edge.targetPortId));
      continue;
    }

    if (!sourceSelected && targetSelected) {
      incomingEdges.push(edge);
      externallyConnectedInputs.add(boundaryKey(edge.targetNodeId, edge.targetPortId));
      continue;
    }

    if (sourceSelected && !targetSelected) {
      outgoingEdges.push(edge);
      externallyConnectedOutputs.add(boundaryKey(edge.sourceNodeId, edge.sourcePortId));
    }
  }
  const inputPorts: WorkflowEditorPort[] = [];
  const outputPorts: WorkflowEditorPort[] = [];
  const inputBoundaries: WorkflowEditorCompositionBoundary[] = [];
  const outputBoundaries: WorkflowEditorCompositionBoundary[] = [];
  const usedInputPortIds = new Set<string>();
  const usedOutputPortIds = new Set<string>();

  for (const node of nodes) {
    for (const input of node.inputs ?? []) {
      const key = boundaryKey(node.id, input.id);
      const hasInternalEdge = internallyConnectedInputs.has(key);
      const hasIncomingEdge = externallyConnectedInputs.has(key);

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
      const key = boundaryKey(node.id, output.id);
      const hasInternalEdge = internallyConnectedOutputs.has(key);
      const hasOutgoingEdge = externallyConnectedOutputs.has(key);

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

function createWorkflowEditorDefaultGroupLabel<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(document: WorkflowEditorDocument<TNodeData, TEdgeData>) {
  const existingLabels = new Set((document.groups ?? []).map((group) => group.label));
  let index = 1;
  let label = `Group ${index}`;

  while (existingLabels.has(label)) {
    index += 1;
    label = `Group ${index}`;
  }

  return label;
}

function areStringArraysEqual(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
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

function commonWorkflowEditorNodeCategoryPath<TData = Record<string, unknown>>(
  nodes: Array<WorkflowEditorNode<TData>>,
) {
  const categoryPaths = nodes.flatMap((node) => {
    const normalized = normalizeWorkflowEditorCategoryPath(node.categoryPath);
    return normalized ? [normalized] : [];
  });
  const firstPath = categoryPaths[0];

  if (!firstPath) {
    return undefined;
  }

  return categoryPaths.every((path) => areStringArraysEqual(path, firstPath))
    ? firstPath
    : undefined;
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
  nodes?: ReadonlyArray<WorkflowEditorNode<unknown>>,
) {
  const acceptedEdges: Array<WorkflowEditorEdge<TData>> = [];
  const adjacency = new Map<string, string[]>();
  const portLookup = nodes ? createWorkflowEditorPortLookup(nodes) : null;

  for (const edge of edges) {
    if (!nodeIds.has(edge.sourceNodeId) || !nodeIds.has(edge.targetNodeId)) {
      continue;
    }

    if (
      portLookup &&
      (!portLookup.outputPortIdsByNodeId.get(edge.sourceNodeId)?.has(edge.sourcePortId) ||
        !portLookup.inputPortIdsByNodeId.get(edge.targetNodeId)?.has(edge.targetPortId))
    ) {
      continue;
    }

    if (edge.sourceNodeId === edge.targetNodeId) {
      continue;
    }

    if (canReachWorkflowEditorNodeInAdjacency(adjacency, edge.targetNodeId, edge.sourceNodeId)) {
      continue;
    }

    acceptedEdges.push(edge);
    const targets = adjacency.get(edge.sourceNodeId) ?? [];
    targets.push(edge.targetNodeId);
    adjacency.set(edge.sourceNodeId, targets);
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

function createUniqueId(existingIds: ReadonlySet<string>, baseId: string) {
  let candidate = baseId;
  let index = 2;

  while (existingIds.has(candidate)) {
    candidate = `${baseId}-${index}`;
    index += 1;
  }

  return candidate;
}

function canReachWorkflowEditorNodeInAdjacency(
  adjacency: ReadonlyMap<string, readonly string[]>,
  startNodeId: string,
  targetNodeId: string,
) {
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
