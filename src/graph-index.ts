import type { WorkflowEditorDocument, WorkflowEditorEdge, WorkflowEditorNode } from "./core";

export type WorkflowEditorIndexedNode<TData = Record<string, unknown>> = {
  id: string;
  index: number;
  label: string;
  properties: WorkflowEditorNode<TData>;
};

export type WorkflowEditorIndexedEdge<TData = Record<string, unknown>> = {
  directed: true;
  id: string;
  index: number;
  source: string;
  target: string;
  properties: WorkflowEditorEdge<TData>;
};

export type WorkflowEditorSubgraph<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
> = {
  nodes: Array<WorkflowEditorIndexedNode<TNodeData>>;
  edges: Array<WorkflowEditorIndexedEdge<TEdgeData>>;
  summary: {
    edgeCount: number;
    offset: number;
    selectedNodeCount: number;
    totalCount: number;
  };
};

export type WorkflowEditorGraphIndex<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
> = {
  getEdgeById(edgeId: string): WorkflowEditorIndexedEdge<TEdgeData> | null;
  getNodeById(nodeId: string): WorkflowEditorIndexedNode<TNodeData> | null;
  getSubgraph(query: {
    offset?: number;
    limit?: number;
  }): WorkflowEditorSubgraph<TNodeData, TEdgeData>;
};

export function createWorkflowGraphIndex<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
): WorkflowEditorGraphIndex<TNodeData, TEdgeData> {
  const nodes = document.nodes.map(
    (node, index): WorkflowEditorIndexedNode<TNodeData> => ({
      id: node.id,
      index,
      label: node.label,
      properties: node,
    }),
  );
  const nodeLookup = new Map(nodes.map((node) => [node.id, node]));
  const edges = document.edges
    .map(
      (edge, index): WorkflowEditorIndexedEdge<TEdgeData> => ({
        directed: true,
        id: edge.id,
        index,
        source: edge.sourceNodeId,
        target: edge.targetNodeId,
        properties: edge,
      }),
    )
    .filter((edge) => nodeLookup.has(edge.source) && nodeLookup.has(edge.target));
  const edgeLookup = new Map(edges.map((edge) => [edge.id, edge]));

  return {
    getEdgeById(edgeId) {
      return edgeLookup.get(edgeId) ?? null;
    },

    getNodeById(nodeId) {
      return nodeLookup.get(nodeId) ?? null;
    },

    getSubgraph(query) {
      const offset = Math.max(0, Math.trunc(query.offset ?? 0));
      const limit = Math.max(0, Math.trunc(query.limit ?? nodes.length));
      const selectedNodes = nodes.slice(offset, offset + limit);
      const selectedNodeIds = new Set(selectedNodes.map((node) => node.id));
      const selectedEdges = edges.filter(
        (edge) => selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target),
      );

      return {
        edges: selectedEdges,
        nodes: selectedNodes,
        summary: {
          edgeCount: selectedEdges.length,
          offset,
          selectedNodeCount: selectedNodes.length,
          totalCount: nodes.length,
        },
      };
    },
  };
}
