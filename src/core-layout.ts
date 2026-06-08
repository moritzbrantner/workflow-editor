import { layoutGraphEditorDocument } from "@moritzbrantner/graph-editor/layout";

import { getWorkflowNodeSize } from "./react/workflow-node";
import {
  normalizeWorkflowEditorDocument,
  toUiWorkflowBuilderNodes,
  type WorkflowEditorDocument,
  type WorkflowEditorNode,
  type WorkflowEditorPortType,
} from "./core";
import {
  getWorkflowEditorMinimizedNodeWidth,
  workflowEditorMinimizedNodeHeight,
} from "./core-rendered-node-size";

export type WorkflowEditorLayoutDirection = "right" | "down";

export type WorkflowEditorLayoutOptions<
  TNodeData = Record<string, unknown>,
  _TEdgeData = Record<string, unknown>,
> = {
  nodeIds?: readonly string[];
  direction?: WorkflowEditorLayoutDirection;
  nodeWidth?: number | ((node: WorkflowEditorNode<TNodeData>) => number);
  nodeHeight?: number | ((node: WorkflowEditorNode<TNodeData>) => number);
  rankSeparation?: number;
  nodeSeparation?: number;
  edgeSeparation?: number;
  marginX?: number;
  marginY?: number;
};

export type WorkflowEditorLayoutResult<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
> = {
  document: WorkflowEditorDocument<TNodeData, TEdgeData>;
  changedNodeIds: string[];
  cycles: string[][];
};

export function layoutWorkflowEditorDocument<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  options: WorkflowEditorLayoutOptions<TNodeData, TEdgeData> = {},
): WorkflowEditorLayoutResult<TNodeData, TEdgeData> {
  const result = layoutGraphEditorDocument<TNodeData, TEdgeData, WorkflowEditorPortType>(document, {
    ...options,
    nodeWidth: (node) =>
      resolveWorkflowEditorLayoutDimension(
        options.nodeWidth,
        node as WorkflowEditorNode<TNodeData>,
        "width",
      ),
    nodeHeight: (node) =>
      resolveWorkflowEditorLayoutDimension(
        options.nodeHeight,
        node as WorkflowEditorNode<TNodeData>,
        "height",
      ),
  });

  return {
    ...result,
    document: normalizeWorkflowEditorDocument(
      result.document as WorkflowEditorDocument<TNodeData, TEdgeData>,
      { allowCycles: true },
    ),
  };
}

function resolveWorkflowEditorLayoutDimension<TNodeData = Record<string, unknown>>(
  value: number | ((node: WorkflowEditorNode<TNodeData>) => number) | undefined,
  node: WorkflowEditorNode<TNodeData>,
  dimension: "height" | "width",
) {
  return typeof value === "function"
    ? value(node)
    : (value ?? getWorkflowEditorLayoutNodeSize(node)[dimension]);
}

function getWorkflowEditorLayoutNodeSize<TNodeData = Record<string, unknown>>(
  node: WorkflowEditorNode<TNodeData>,
) {
  const uiNode = toUiWorkflowBuilderNodes([node])[0]!;

  if (node.minimized === true && node.variant !== "compact") {
    return {
      width: getWorkflowEditorMinimizedNodeWidth(uiNode),
      height: workflowEditorMinimizedNodeHeight,
    };
  }

  return getWorkflowNodeSize(uiNode);
}
