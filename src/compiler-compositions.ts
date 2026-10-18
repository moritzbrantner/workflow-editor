import { isWorkflowEditorIterationNode } from "./core-iteration";
import type {
  WorkflowEditorCompositionBoundary,
  WorkflowEditorDocument,
  WorkflowEditorEdge,
  WorkflowEditorNode,
} from "./core-types";

/**
 * How the compiler treats composed nodes (non-iteration nodes with an embedded `composition`):
 * - `reject` (default): report `composition-not-supported`, as before.
 * - `opaque`: compile the composed node as one ordinary node (its kind and data); the embedded
 *   subgraph is not part of the output, and the host executes the node as a black box.
 * - `expand`: inline the embedded subgraph. Inner nodes and edges get addresses
 *   `<composed id>/<inner id>`, connections through the wrapper ports are rewired to the boundary
 *   ports, and the source map links every inlined entity back to its authoring path.
 */
export type WorkflowEditorCompositionMode = "reject" | "opaque" | "expand";

/** Separates a composed node's id from an inlined inner id (`outer/inner`). */
export const workflowEditorExpandedIdSeparator = "/";
/** Suffix for the extra edges created when one wrapper input feeds several boundaries. */
export const workflowEditorExpandedEdgeFanOutSeparator = "#";

type Endpoint = { nodeId: string; portId: string };

type ExpandedScope = {
  nodes: WorkflowEditorNode[];
  edges: WorkflowEditorEdge[];
  /** Where a connection into `endpoint` lands once composed nodes are inlined. */
  resolveInput: (endpoint: Endpoint) => Endpoint[];
  /** Where a connection out of `endpoint` starts once composed nodes are inlined. */
  resolveOutput: (endpoint: Endpoint) => Endpoint;
};

export function isWorkflowEditorComposedNode(node: WorkflowEditorNode<unknown>) {
  return !!node.composition && !isWorkflowEditorIterationNode(node);
}

const prefixed = (prefix: string, id: string) =>
  `${prefix}${workflowEditorExpandedIdSeparator}${id}`;

function expandScope(
  nodes: readonly WorkflowEditorNode[],
  edges: readonly WorkflowEditorEdge[],
): ExpandedScope {
  const expandedNodes: WorkflowEditorNode[] = [];
  const expandedEdges: WorkflowEditorEdge[] = [];
  const inputs = new Map<string, (portId: string) => Endpoint[]>();
  const outputs = new Map<string, (portId: string) => Endpoint | undefined>();

  for (const node of nodes) {
    const composition = node.composition;
    if (composition && isWorkflowEditorComposedNode(node)) {
      const inner = expandScope(composition.nodes, composition.edges);
      const outer = (endpoint: Endpoint) => ({
        nodeId: prefixed(node.id, endpoint.nodeId),
        portId: endpoint.portId,
      });
      expandedNodes.push(
        ...inner.nodes.map((child) => ({ ...child, id: prefixed(node.id, child.id) })),
      );
      expandedEdges.push(
        ...inner.edges.map((edge) => ({
          ...edge,
          id: prefixed(node.id, edge.id),
          sourceNodeId: prefixed(node.id, edge.sourceNodeId),
          targetNodeId: prefixed(node.id, edge.targetNodeId),
        })),
      );
      inputs.set(node.id, (portId) =>
        composition.inputBoundaries
          .filter((boundary) => boundary.wrapperPortId === portId)
          .flatMap((boundary) => inner.resolveInput(boundary).map(outer)),
      );
      outputs.set(node.id, (portId) => {
        const boundary = composition.outputBoundaries.find(
          (candidate) => candidate.wrapperPortId === portId,
        );
        return boundary ? outer(inner.resolveOutput(boundary)) : undefined;
      });
      continue;
    }

    if (composition && isWorkflowEditorIterationNode(node)) {
      // Iteration bodies keep their node; composed nodes inside them are inlined in the body.
      const body = expandScope(composition.nodes, composition.edges);
      const rewire = (
        boundaries: WorkflowEditorCompositionBoundary[],
        resolve: (endpoint: Endpoint) => Endpoint[],
      ) =>
        boundaries.flatMap((boundary) =>
          resolve(boundary).map((endpoint) => ({ ...boundary, ...endpoint })),
        );
      expandedNodes.push({
        ...node,
        composition: {
          nodes: body.nodes,
          edges: body.edges,
          inputBoundaries: rewire(composition.inputBoundaries, body.resolveInput),
          outputBoundaries: rewire(composition.outputBoundaries, (endpoint) => [
            body.resolveOutput(endpoint),
          ]),
        },
      });
      continue;
    }

    expandedNodes.push(node);
  }

  const resolveInput = (endpoint: Endpoint) =>
    inputs.get(endpoint.nodeId)?.(endpoint.portId) ?? [endpoint];
  const resolveOutput = (endpoint: Endpoint) =>
    outputs.get(endpoint.nodeId)?.(endpoint.portId) ?? endpoint;

  for (const edge of edges) {
    const source = outputs.get(edge.sourceNodeId)?.(edge.sourcePortId ?? "");
    const targets = inputs.has(edge.targetNodeId)
      ? inputs.get(edge.targetNodeId)!(edge.targetPortId ?? "")
      : [undefined];
    targets.forEach((target, index) => {
      expandedEdges.push({
        ...edge,
        id:
          index === 0 ? edge.id : `${edge.id}${workflowEditorExpandedEdgeFanOutSeparator}${index}`,
        ...(source ? { sourceNodeId: source.nodeId, sourcePortId: source.portId } : {}),
        ...(target ? { targetNodeId: target.nodeId, targetPortId: target.portId } : {}),
      });
    });
  }

  return { nodes: expandedNodes, edges: expandedEdges, resolveInput, resolveOutput };
}

/**
 * Inlines every composed node, including composed nodes nested in other composed nodes or in
 * iteration bodies. A wrapper input without a boundary drops its connections; a wrapper output
 * without a boundary keeps pointing at the (now absent) wrapper, so validation reports it.
 */
export function expandWorkflowEditorCompositions<TNodeData, TEdgeData>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
): WorkflowEditorDocument<TNodeData, TEdgeData> {
  const nodes = document.nodes as unknown as WorkflowEditorNode[];
  if (!nodes.some((node) => node.composition)) return document;
  const expanded = expandScope(nodes, document.edges as unknown as WorkflowEditorEdge[]);
  return {
    ...document,
    nodes: expanded.nodes as unknown as WorkflowEditorDocument<TNodeData, TEdgeData>["nodes"],
    edges: expanded.edges as unknown as WorkflowEditorDocument<TNodeData, TEdgeData>["edges"],
  };
}

/** Authoring path of an inlined compiled id such as `outer/inner` (`nodes.outer.composition.nodes.inner`). */
export function workflowEditorExpandedAuthoringPath(
  id: string,
  collection: "nodes" | "edges",
  pathPrefix = "",
) {
  const segments = id.split(workflowEditorExpandedIdSeparator);
  let last = segments.pop()!;
  if (collection === "edges") last = last.split(workflowEditorExpandedEdgeFanOutSeparator)[0]!;
  return {
    path: `${pathPrefix}${segments.map((segment) => `nodes.${segment}.composition.`).join("")}${collection}.${last}`,
    id: last,
  };
}
