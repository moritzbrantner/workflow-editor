import {
  normalizeWorkflowEditorDocument,
  type WorkflowEditorDocument,
  type WorkflowEditorEdge,
  type WorkflowEditorNode,
  type WorkflowEditorSelectionState,
} from "./core";

export const workflowEditorClipboardFormat = "@moritzbrantner/workflow-editor/clipboard";
export const workflowEditorClipboardVersion = 1;

export type WorkflowEditorClipboardPayload<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
> = {
  format: typeof workflowEditorClipboardFormat;
  version: typeof workflowEditorClipboardVersion;
  copiedAt: string;
  sourceDocumentId?: string;
  nodes: Array<WorkflowEditorNode<TNodeData>>;
  edges: Array<WorkflowEditorEdge<TEdgeData>>;
};

export type WorkflowEditorPasteResult<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
> = {
  document: WorkflowEditorDocument<TNodeData, TEdgeData>;
  nodeIds: string[];
  edgeIds: string[];
};

export type WorkflowEditorPasteOptions = {
  offsetX?: number;
  offsetY?: number;
  createNodeId?: (baseId: string, existingIds: ReadonlySet<string>) => string;
  createEdgeId?: (baseId: string, existingIds: ReadonlySet<string>) => string;
};

export function normalizeWorkflowEditorSelection<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  selection: WorkflowEditorSelectionState,
): WorkflowEditorSelectionState {
  const nodeIds = orderedUnique(
    document.nodes.map((node) => node.id),
    selection.nodeIds,
  );
  const edgeIds = orderedUnique(
    document.edges.map((edge) => edge.id),
    selection.edgeIds,
  );
  const primary =
    selection.primary?.type === "node" && nodeIds.includes(selection.primary.id)
      ? selection.primary
      : selection.primary?.type === "edge" && edgeIds.includes(selection.primary.id)
        ? selection.primary
        : nodeIds.length > 0
          ? ({ type: "node", id: nodeIds.at(-1)! } as const)
          : edgeIds.length > 0
            ? ({ type: "edge", id: edgeIds.at(-1)! } as const)
            : undefined;

  return {
    nodeIds,
    edgeIds,
    ...(primary ? { primary } : {}),
  };
}

export function copyWorkflowEditorSelection<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  selection: WorkflowEditorSelectionState,
  options: { sourceDocumentId?: string; copiedAt?: string } = {},
): WorkflowEditorClipboardPayload<TNodeData, TEdgeData> {
  const normalizedSelection = normalizeWorkflowEditorSelection(document, selection);
  const copiedNodeIds = new Set(normalizedSelection.nodeIds);

  for (const edge of document.edges) {
    if (
      normalizedSelection.edgeIds.includes(edge.id) &&
      document.nodes.some((node) => node.id === edge.sourceNodeId) &&
      document.nodes.some((node) => node.id === edge.targetNodeId)
    ) {
      copiedNodeIds.add(edge.sourceNodeId);
      copiedNodeIds.add(edge.targetNodeId);
    }
  }

  const nodes = document.nodes
    .filter((node) => copiedNodeIds.has(node.id))
    .map(cloneWorkflowEditorNode);
  const edges = document.edges
    .filter(
      (edge) =>
        copiedNodeIds.has(edge.sourceNodeId) &&
        copiedNodeIds.has(edge.targetNodeId) &&
        (normalizedSelection.edgeIds.includes(edge.id) ||
          (normalizedSelection.nodeIds.includes(edge.sourceNodeId) &&
            normalizedSelection.nodeIds.includes(edge.targetNodeId))),
    )
    .map(cloneWorkflowEditorEdge);

  return {
    format: workflowEditorClipboardFormat,
    version: workflowEditorClipboardVersion,
    copiedAt: options.copiedAt ?? new Date().toISOString(),
    ...(options.sourceDocumentId ? { sourceDocumentId: options.sourceDocumentId } : {}),
    nodes,
    edges,
  };
}

export function pasteWorkflowEditorClipboardPayload<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  payload: WorkflowEditorClipboardPayload<TNodeData, TEdgeData>,
  options: WorkflowEditorPasteOptions = {},
): WorkflowEditorPasteResult<TNodeData, TEdgeData> {
  assertWorkflowEditorClipboardPayload(payload);

  const offsetX = options.offsetX ?? 48;
  const offsetY = options.offsetY ?? 48;
  const existingNodeIds = new Set(document.nodes.map((node) => node.id));
  const existingEdgeIds = new Set(document.edges.map((edge) => edge.id));
  const nodeIdMap = new Map<string, string>();

  const nodes = payload.nodes.map((node) => {
    const id =
      options.createNodeId?.(node.id, existingNodeIds) ??
      createUniqueWorkflowEditorId(node.id, existingNodeIds);
    existingNodeIds.add(id);
    nodeIdMap.set(node.id, id);
    return {
      ...cloneWorkflowEditorNode(node),
      id,
      x: node.x + offsetX,
      y: node.y + offsetY,
    };
  });

  const edges = payload.edges.flatMap((edge) => {
    const sourceNodeId = nodeIdMap.get(edge.sourceNodeId);
    const targetNodeId = nodeIdMap.get(edge.targetNodeId);

    if (!sourceNodeId || !targetNodeId) {
      return [];
    }

    const baseId = `${sourceNodeId}:${edge.sourcePortId}->${targetNodeId}:${edge.targetPortId}`;
    const id =
      options.createEdgeId?.(baseId, existingEdgeIds) ??
      createUniqueWorkflowEditorId(baseId, existingEdgeIds);
    existingEdgeIds.add(id);
    return [
      {
        ...cloneWorkflowEditorEdge(edge),
        id,
        sourceNodeId,
        targetNodeId,
      },
    ];
  });

  return {
    document: normalizeWorkflowEditorDocument({
      ...document,
      nodes: [...document.nodes, ...nodes],
      edges: [...document.edges, ...edges],
    }),
    nodeIds: nodes.map((node) => node.id),
    edgeIds: edges.map((edge) => edge.id),
  };
}

export function duplicateWorkflowEditorSelection<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  selection: WorkflowEditorSelectionState,
  options: { offsetX?: number; offsetY?: number } = {},
): WorkflowEditorPasteResult<TNodeData, TEdgeData> {
  return pasteWorkflowEditorClipboardPayload(
    document,
    copyWorkflowEditorSelection(document, selection),
    options,
  );
}

export function removeWorkflowEditorSelection<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  selection: WorkflowEditorSelectionState,
): WorkflowEditorDocument<TNodeData, TEdgeData> {
  const normalizedSelection = normalizeWorkflowEditorSelection(document, selection);
  const nodeIds = new Set(normalizedSelection.nodeIds);
  const edgeIds = new Set(normalizedSelection.edgeIds);

  return normalizeWorkflowEditorDocument({
    ...document,
    nodes: document.nodes.filter((node) => !nodeIds.has(node.id)),
    edges: document.edges.filter(
      (edge) =>
        !edgeIds.has(edge.id) && !nodeIds.has(edge.sourceNodeId) && !nodeIds.has(edge.targetNodeId),
    ),
  });
}

function assertWorkflowEditorClipboardPayload<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  payload: WorkflowEditorClipboardPayload<TNodeData, TEdgeData>,
): asserts payload is WorkflowEditorClipboardPayload<TNodeData, TEdgeData> {
  if (
    payload?.format !== workflowEditorClipboardFormat ||
    payload.version !== workflowEditorClipboardVersion ||
    !Array.isArray(payload.nodes) ||
    !Array.isArray(payload.edges)
  ) {
    throw new Error("Invalid workflow editor clipboard payload");
  }
}

function orderedUnique(availableIds: string[], selectedIds: readonly string[]) {
  const selected = new Set(selectedIds);
  return availableIds.filter((id) => selected.has(id));
}

function createUniqueWorkflowEditorId(baseId: string, existingIds: ReadonlySet<string>) {
  const fallbackBase = baseId.trim() || "item";
  let id = fallbackBase;
  let index = 1;

  while (existingIds.has(id)) {
    id = `${fallbackBase}-copy${index === 1 ? "" : `-${index}`}`;
    index += 1;
  }

  return id;
}

function cloneWorkflowEditorNode<TData = Record<string, unknown>>(
  node: WorkflowEditorNode<TData>,
): WorkflowEditorNode<TData> {
  return structuredCloneSafe(node);
}

function cloneWorkflowEditorEdge<TData = Record<string, unknown>>(
  edge: WorkflowEditorEdge<TData>,
): WorkflowEditorEdge<TData> {
  return structuredCloneSafe(edge);
}

function structuredCloneSafe<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}
