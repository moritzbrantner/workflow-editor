import {
  createGraphEditorGraphIndex,
  type GraphEditorGraphIndex,
  type GraphEditorIndexedEdge,
  type GraphEditorIndexedNode,
  type GraphEditorSubgraph,
} from "@moritzbrantner/graph-editor/core";

import type { WorkflowEditorDocument, WorkflowEditorPortType } from "./core-types";

export type WorkflowEditorIndexedNode<TData = Record<string, unknown>> = GraphEditorIndexedNode<
  TData,
  WorkflowEditorPortType
>;

export type WorkflowEditorIndexedEdge<TData = Record<string, unknown>> =
  GraphEditorIndexedEdge<TData>;

export type WorkflowEditorSubgraph<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
> = GraphEditorSubgraph<TNodeData, TEdgeData, WorkflowEditorPortType>;

export type WorkflowEditorGraphIndex<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
> = GraphEditorGraphIndex<TNodeData, TEdgeData, WorkflowEditorPortType>;

export function createWorkflowGraphIndex<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
): WorkflowEditorGraphIndex<TNodeData, TEdgeData> {
  return createGraphEditorGraphIndex<TNodeData, TEdgeData, WorkflowEditorPortType>(document);
}
