import type {
  WorkflowEditorDocument,
  WorkflowEditorSelection,
  WorkflowEditorSelectionState,
} from "./core";

export function selectionStateToSingleSelection<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  selection: WorkflowEditorSelectionState,
): WorkflowEditorSelection<TNodeData, TEdgeData> {
  const primary = selection.primary;

  if (primary?.type === "node") {
    const node = document.nodes.find((candidate) => candidate.id === primary.id);
    return node ? { type: "node", id: primary.id, node } : null;
  }

  if (primary?.type === "edge") {
    const edge = document.edges.find((candidate) => candidate.id === primary.id);
    return edge ? { type: "edge", id: primary.id, edge } : null;
  }

  const node = document.nodes.find((candidate) => candidate.id === selection.nodeIds[0]);
  if (node) {
    return { type: "node", id: node.id, node };
  }

  const edge = document.edges.find((candidate) => candidate.id === selection.edgeIds[0]);
  return edge ? { type: "edge", id: edge.id, edge } : null;
}

export function toggleWorkflowEditorSelectionItem(
  selection: WorkflowEditorSelectionState,
  item: NonNullable<WorkflowEditorSelectionState["primary"]>,
): WorkflowEditorSelectionState {
  if (item.type === "node") {
    const hasNode = selection.nodeIds.includes(item.id);
    return {
      nodeIds: hasNode
        ? selection.nodeIds.filter((nodeId) => nodeId !== item.id)
        : [...selection.nodeIds, item.id],
      edgeIds: selection.edgeIds,
      primary: item,
    };
  }

  const hasEdge = selection.edgeIds.includes(item.id);
  return {
    nodeIds: selection.nodeIds,
    edgeIds: hasEdge
      ? selection.edgeIds.filter((edgeId) => edgeId !== item.id)
      : [...selection.edgeIds, item.id],
    primary: item,
  };
}
