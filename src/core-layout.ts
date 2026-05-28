import { graphlib, layout } from "@dagrejs/dagre";
import { getWorkflowNodeSize } from "@moritzbrantner/ui/labs";

import {
  detectWorkflowEditorCycles,
  normalizeWorkflowEditorDocument,
  toUiWorkflowBuilderNodes,
  type WorkflowEditorDocument,
  type WorkflowEditorNode,
} from "./core";

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

const defaultNodeWidth = 248;
const defaultNodeHeight = 124;
const minimizedNodeWidth = 176;
const minimizedNodeHeight = 36;

export function layoutWorkflowEditorDocument<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  options: WorkflowEditorLayoutOptions<TNodeData, TEdgeData> = {},
): WorkflowEditorLayoutResult<TNodeData, TEdgeData> {
  const cycles = detectWorkflowEditorCycles(document);
  const selectedNodeIdSet = options.nodeIds ? new Set(options.nodeIds) : null;
  const nodes = document.nodes.filter(
    (node) => !selectedNodeIdSet || selectedNodeIdSet.has(node.id),
  );

  if (nodes.length === 0) {
    return { document, changedNodeIds: [], cycles };
  }

  const graph = new graphlib.Graph();
  graph.setGraph({
    rankdir: options.direction === "down" ? "TB" : "LR",
    acyclicer: "greedy",
    ranksep: options.rankSeparation ?? 96,
    nodesep: options.nodeSeparation ?? 48,
    edgesep: options.edgeSeparation ?? 24,
    marginx: options.marginX ?? 0,
    marginy: options.marginY ?? 0,
  });
  graph.setDefaultEdgeLabel(() => ({}));

  for (const node of nodes) {
    const size = getWorkflowEditorLayoutNodeSize(node);
    graph.setNode(node.id, {
      width: resolveLayoutDimension(options.nodeWidth, node, size.width, defaultNodeWidth),
      height: resolveLayoutDimension(options.nodeHeight, node, size.height, defaultNodeHeight),
    });
  }

  const nodeIds = new Set(nodes.map((node) => node.id));
  for (const edge of document.edges) {
    if (nodeIds.has(edge.sourceNodeId) && nodeIds.has(edge.targetNodeId)) {
      graph.setEdge(edge.sourceNodeId, edge.targetNodeId, { id: edge.id });
    }
  }

  layout(graph);

  const previousBounds = workflowEditorNodeBounds(nodes);
  const positionedNodes = nodes.flatMap((node) => {
    const layoutNode = graph.node(node.id) as {
      x?: number;
      y?: number;
      width?: number;
      height?: number;
    };
    if (!Number.isFinite(layoutNode?.x) || !Number.isFinite(layoutNode?.y)) {
      return [];
    }

    const width = Number.isFinite(layoutNode.width) ? Number(layoutNode.width) : defaultNodeWidth;
    const height = Number.isFinite(layoutNode.height)
      ? Number(layoutNode.height)
      : defaultNodeHeight;
    return [
      {
        id: node.id,
        x: Math.round(Number(layoutNode.x) - width / 2),
        y: Math.round(Number(layoutNode.y) - height / 2),
      },
    ];
  });

  if (positionedNodes.length === 0) {
    return { document, changedNodeIds: [], cycles };
  }

  const nextBounds = workflowEditorPointBounds(positionedNodes);
  const offsetX = previousBounds.x - nextBounds.x;
  const offsetY = previousBounds.y - nextBounds.y;
  const positionByNodeId = new Map(
    positionedNodes.map((node) => [
      node.id,
      {
        x: node.x + offsetX,
        y: node.y + offsetY,
      },
    ]),
  );
  const changedNodeIds: string[] = [];
  const nextNodes = document.nodes.map((node) => {
    const position = positionByNodeId.get(node.id);
    if (!position) {
      return node;
    }

    const nextNode = {
      ...node,
      x: Math.round(position.x),
      y: Math.round(position.y),
    };
    if (nextNode.x !== node.x || nextNode.y !== node.y) {
      changedNodeIds.push(node.id);
    }
    return nextNode;
  });

  return {
    document: normalizeWorkflowEditorDocument(
      {
        ...document,
        nodes: nextNodes,
      },
      { allowCycles: true },
    ),
    changedNodeIds,
    cycles,
  };
}

function getWorkflowEditorLayoutNodeSize<TNodeData = Record<string, unknown>>(
  node: WorkflowEditorNode<TNodeData>,
) {
  if (node.minimized === true && node.variant !== "compact") {
    return {
      width: minimizedNodeWidth,
      height: minimizedNodeHeight,
    };
  }

  return getWorkflowNodeSize(toUiWorkflowBuilderNodes([node])[0]!);
}

function resolveLayoutDimension<TNodeData = Record<string, unknown>>(
  value: number | ((node: WorkflowEditorNode<TNodeData>) => number) | undefined,
  node: WorkflowEditorNode<TNodeData>,
  measured: number,
  fallback: number,
) {
  const resolved = typeof value === "function" ? value(node) : value;
  if (Number.isFinite(resolved) && Number(resolved) > 0) {
    return Number(resolved);
  }

  return Number.isFinite(measured) && measured > 0 ? measured : fallback;
}

function workflowEditorNodeBounds<TNodeData = Record<string, unknown>>(
  nodes: Array<WorkflowEditorNode<TNodeData>>,
) {
  return workflowEditorPointBounds(nodes);
}

function workflowEditorPointBounds(points: Array<{ x: number; y: number }>) {
  return {
    x: Math.min(...points.map((point) => point.x)),
    y: Math.min(...points.map((point) => point.y)),
  };
}
