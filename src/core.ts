import type {
  WorkflowBuilderEdge as UiWorkflowBuilderEdge,
  WorkflowBuilderNodeData as UiWorkflowBuilderNodeData,
  WorkflowBuilderViewport as UiWorkflowBuilderViewport,
  WorkflowNodeData as UiWorkflowNodeData,
  WorkflowNodePort as UiWorkflowNodePort,
} from "@moritzbrantner/ui/labs";

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

export type WorkflowEditorPort = UiWorkflowNodePort;

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
  "metadata"
> & {
  x: number;
  y: number;
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

export type WorkflowEditorConnectionInput = {
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
};

export type WorkflowEditorConnectionInvalidReason =
  | "cycle"
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

export type WorkflowEditorNodeTemplate<TData = Record<string, unknown>> = Omit<
  WorkflowEditorNode<TData>,
  "x" | "y"
>;

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
): WorkflowEditorDocument<TNodeData, TEdgeData> {
  assertUniqueIds(
    document.nodes.map((node) => node.id),
    "workflow node",
  );
  assertUniqueIds(
    document.edges.map((edge) => edge.id),
    "workflow edge",
  );

  const nodes = document.nodes.map((node) => normalizeWorkflowEditorNode(node));
  const nodeIds = new Set(nodes.map((node) => node.id));

  return {
    ...document,
    nodes,
    edges: normalizeWorkflowEditorDagEdges(document.edges, nodeIds),
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
      inputs: node.inputs,
      outputs: node.outputs,
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

function normalizePorts(ports: WorkflowEditorPort[] | undefined) {
  return ports?.map((port) => ({ ...port })) ?? [];
}

function normalizeWorkflowEditorNode<TNodeData = Record<string, unknown>>(
  node: WorkflowEditorNode<TNodeData>,
): WorkflowEditorNode<TNodeData> {
  return {
    ...node,
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
  const normalizedDocument = normalizeWorkflowEditorDocument({
    nodes: composition.nodes,
    edges: composition.edges,
  });
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
