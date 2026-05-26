import { createGraphDensityIndex } from "@moritzbrantner/graphs";
import type {
  WorkflowBuilderEdge as UiWorkflowBuilderEdge,
  WorkflowBuilderNodeData as UiWorkflowBuilderNodeData,
  WorkflowBuilderViewport as UiWorkflowBuilderViewport,
} from "@moritzbrantner/ui/labs";

export type WorkflowEditorPort = {
  id: string;
  label: string;
  kind?: string;
  required?: boolean;
  description?: string;
  badge?: string;
  metadata?: Record<string, unknown>;
};

export type WorkflowEditorNode<TData = Record<string, unknown>> = {
  id: string;
  label: string;
  x: number;
  y: number;
  description?: string;
  kind?: string;
  category?: string;
  status?: "idle" | "running" | "success" | "error" | "warning" | string;
  inputs?: WorkflowEditorPort[];
  outputs?: WorkflowEditorPort[];
  data?: TData;
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

export type WorkflowEditorConnectionInput = {
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
};

export type WorkflowEditorConnectionInvalidReason =
  | "duplicate"
  | "kind-mismatch"
  | "missing-node"
  | "missing-port"
  | "self-connection";

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

export type WorkflowEditorNodeTemplate<TData = Record<string, unknown>> = {
  id: string;
  label: string;
  description?: string;
  kind?: string;
  category?: string;
  inputs?: WorkflowEditorPort[];
  outputs?: WorkflowEditorPort[];
  data?: TData;
};

export type WorkflowEditorDuplicateNodeOptions = {
  offsetX?: number;
  offsetY?: number;
  createId?: (nodeId: string, existingIds: ReadonlySet<string>) => string;
};

export function normalizeWorkflowEditorDocument<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
): WorkflowEditorDocument<TNodeData, TEdgeData> {
  assertUniqueIds(
    document.nodes.map((node) => node.id),
    "workflow node",
  );
  assertUniqueIds(
    document.edges.map((edge) => edge.id),
    "workflow edge",
  );

  const nodeIds = new Set(document.nodes.map((node) => node.id));

  return {
    ...document,
    nodes: document.nodes.map((node) => ({
      ...node,
      x: Number.isFinite(node.x) ? node.x : 0,
      y: Number.isFinite(node.y) ? node.y : 0,
      inputs: normalizePorts(node.inputs),
      outputs: normalizePorts(node.outputs),
    })),
    edges: document.edges.filter(
      (edge) => nodeIds.has(edge.sourceNodeId) && nodeIds.has(edge.targetNodeId),
    ),
    viewport: document.viewport
      ? {
          x: Number.isFinite(document.viewport.x) ? document.viewport.x : 0,
          y: Number.isFinite(document.viewport.y) ? document.viewport.y : 0,
          zoom: clampZoom(document.viewport.zoom),
        }
      : undefined,
  };
}

export function createWorkflowEditorGraphIndex<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(document: WorkflowEditorDocument<TNodeData, TEdgeData>) {
  return createGraphDensityIndex(
    document.nodes.map((node) => ({
      id: node.id,
      label: node.label,
      properties: node,
    })),
    document.edges.map((edge) => ({
      id: edge.id,
      directed: true,
      source: edge.sourceNodeId,
      target: edge.targetNodeId,
      properties: edge,
    })),
  );
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
): WorkflowEditorConnectionValidity {
  const sourceNode = findWorkflowEditorNode(document, connection.sourceNodeId);
  const targetNode = findWorkflowEditorNode(document, connection.targetNodeId);

  if (!sourceNode || !targetNode) {
    return { valid: false, reason: "missing-node" };
  }

  if (connection.sourceNodeId === connection.targetNodeId) {
    return { valid: false, reason: "self-connection" };
  }

  const sourcePort = sourceNode.outputs?.find((port) => port.id === connection.sourcePortId);
  const targetPort = targetNode.inputs?.find((port) => port.id === connection.targetPortId);

  if (!sourcePort || !targetPort) {
    return { valid: false, reason: "missing-port" };
  }

  if (sourcePort.kind && targetPort.kind && sourcePort.kind !== targetPort.kind) {
    return { valid: false, reason: "kind-mismatch" };
  }

  const duplicate = document.edges.some(
    (edge) =>
      edge.sourceNodeId === connection.sourceNodeId &&
      edge.sourcePortId === connection.sourcePortId &&
      edge.targetNodeId === connection.targetNodeId &&
      edge.targetPortId === connection.targetPortId,
  );

  if (duplicate) {
    return { valid: false, reason: "duplicate" };
  }

  return { valid: true };
}

export function connectWorkflowEditorNodes<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  connection: WorkflowEditorConnectionInput,
): WorkflowEditorDocument<TNodeData, TEdgeData> {
  const validity = validateWorkflowEditorConnection(document, connection);

  if (!validity.valid) {
    return document;
  }

  const edgeId = createWorkflowEditorEdgeId(document, connection);

  return addWorkflowEditorEdge(document, {
    id: edgeId,
    ...connection,
  } as WorkflowEditorEdge<TEdgeData>);
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
      x: node.x,
      y: node.y,
      inputs: node.inputs,
      outputs: node.outputs,
      data: (node.metadata as TData | undefined) ?? previousNode?.data,
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

function normalizePorts(ports: WorkflowEditorPort[] | undefined) {
  return ports?.map((port) => ({ ...port })) ?? [];
}

function assertUniqueIds(ids: string[], label: string) {
  const seen = new Set<string>();

  for (const id of ids) {
    if (seen.has(id)) {
      throw new Error(`Duplicate ${label} id: ${id}`);
    }

    seen.add(id);
  }
}

function clampZoom(zoom: number) {
  if (!Number.isFinite(zoom)) {
    return 1;
  }

  return Math.min(Math.max(zoom, 0.1), 4);
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
