import {
  normalizeWorkflowEditorDocument,
  type WorkflowEditorDocument,
  type WorkflowEditorEdge,
  type WorkflowEditorGroup,
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
  groups?: Array<WorkflowEditorGroup>;
};

export type WorkflowEditorPasteResult<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
> = {
  document: WorkflowEditorDocument<TNodeData, TEdgeData>;
  nodeIds: string[];
  edgeIds: string[];
  groupIds?: string[];
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
  const groupIds = orderedUnique(
    (document.groups ?? []).map((group) => group.id),
    selection.groupIds ?? [],
  );
  const primary =
    selection.primary?.type === "node" && nodeIds.includes(selection.primary.id)
      ? selection.primary
      : selection.primary?.type === "edge" && edgeIds.includes(selection.primary.id)
        ? selection.primary
        : selection.primary?.type === "group" && groupIds.includes(selection.primary.id)
          ? selection.primary
          : groupIds.length > 0
            ? ({ type: "group", id: groupIds.at(-1)! } as const)
            : nodeIds.length > 0
              ? ({ type: "node", id: nodeIds.at(-1)! } as const)
              : edgeIds.length > 0
                ? ({ type: "edge", id: edgeIds.at(-1)! } as const)
                : undefined;

  return {
    nodeIds,
    edgeIds,
    ...(groupIds.length > 0 ? { groupIds } : {}),
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
  const explicitlyCopiedGroupIds = new Set(normalizedSelection.groupIds ?? []);

  for (const group of document.groups ?? []) {
    if (explicitlyCopiedGroupIds.has(group.id)) {
      for (const nodeId of group.nodeIds) {
        copiedNodeIds.add(nodeId);
      }
    }
  }

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
            normalizedSelection.nodeIds.includes(edge.targetNodeId)) ||
          (document.groups ?? []).some(
            (group) =>
              explicitlyCopiedGroupIds.has(group.id) &&
              group.nodeIds.includes(edge.sourceNodeId) &&
              group.nodeIds.includes(edge.targetNodeId),
          )),
    )
    .map(cloneWorkflowEditorEdge);
  const groups = (document.groups ?? [])
    .filter((group) => {
      if (explicitlyCopiedGroupIds.has(group.id)) {
        return group.nodeIds.every((nodeId) => copiedNodeIds.has(nodeId));
      }

      return (
        group.nodeIds.length >= 2 &&
        group.nodeIds.every((nodeId) => normalizedSelection.nodeIds.includes(nodeId))
      );
    })
    .map((group) => cloneWorkflowEditorGroup(group));

  return {
    format: workflowEditorClipboardFormat,
    version: workflowEditorClipboardVersion,
    copiedAt: options.copiedAt ?? new Date().toISOString(),
    ...(options.sourceDocumentId ? { sourceDocumentId: options.sourceDocumentId } : {}),
    nodes,
    edges,
    ...(groups.length > 0 ? { groups } : {}),
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
  const existingGroupIds = new Set((document.groups ?? []).map((group) => group.id));
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
  const groups = (payload.groups ?? []).flatMap((group) => {
    const nodeIds = group.nodeIds.flatMap((nodeId) => {
      const mappedNodeId = nodeIdMap.get(nodeId);
      return mappedNodeId ? [mappedNodeId] : [];
    });

    if (nodeIds.length < 2) {
      return [];
    }

    const id = createUniqueWorkflowEditorId(group.id, existingGroupIds);
    existingGroupIds.add(id);
    return [
      {
        ...cloneWorkflowEditorGroup(group),
        id,
        nodeIds,
      },
    ];
  });

  return {
    document: normalizeWorkflowEditorDocument({
      ...document,
      nodes: [...document.nodes, ...nodes],
      edges: [...document.edges, ...edges],
      groups: [...(document.groups ?? []), ...groups],
    }),
    nodeIds: nodes.map((node) => node.id),
    edgeIds: edges.map((edge) => edge.id),
    ...(groups.length > 0 ? { groupIds: groups.map((group) => group.id) } : {}),
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
  const selectedGroupIds = new Set(normalizedSelection.groupIds ?? []);
  const nodeIds = new Set(normalizedSelection.nodeIds);
  for (const group of document.groups ?? []) {
    if (selectedGroupIds.has(group.id)) {
      for (const nodeId of group.nodeIds) {
        nodeIds.add(nodeId);
      }
    }
  }
  const edgeIds = new Set(normalizedSelection.edgeIds);

  return normalizeWorkflowEditorDocument({
    ...document,
    nodes: document.nodes.filter((node) => !nodeIds.has(node.id)),
    edges: document.edges.filter(
      (edge) =>
        !edgeIds.has(edge.id) && !nodeIds.has(edge.sourceNodeId) && !nodeIds.has(edge.targetNodeId),
    ),
    groups: (document.groups ?? [])
      .filter((group) => !selectedGroupIds.has(group.id))
      .map((group) =>
        Object.assign({}, group, {
          nodeIds: group.nodeIds.filter((nodeId) => !nodeIds.has(nodeId)),
        }),
      )
      .filter((group) => group.nodeIds.length >= 2),
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
    !Array.isArray(payload.edges) ||
    (payload.groups !== undefined && !Array.isArray(payload.groups))
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

function cloneWorkflowEditorGroup<TData = Record<string, unknown>>(
  group: WorkflowEditorGroup<TData>,
): WorkflowEditorGroup<TData> {
  return structuredCloneSafe(group);
}

function structuredCloneSafe<T>(value: T): T {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }

  return JSON.parse(JSON.stringify(value)) as T;
}
