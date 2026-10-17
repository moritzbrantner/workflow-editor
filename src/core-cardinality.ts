import type { WorkflowEditorPort, WorkflowEditorPortType } from "./core-types";
import { workflowEditorPortTypeSource } from "./core-type-source";

/** Port cardinality rules shared by connection validation, document validation and compilation. */

export type WorkflowEditorPortDirection = "input" | "output";

type CardinalityNode = {
  id: string;
  kind?: string;
  inputs?: readonly WorkflowEditorPort[];
  outputs?: readonly WorkflowEditorPort[];
};

type CardinalityEdge = {
  id: string;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
};

export type WorkflowEditorExcessConnection = {
  edgeId: string;
  edgeIndex: number;
  nodeId: string;
  portId: string;
  direction: WorkflowEditorPortDirection;
  max: number;
  message: string;
};

export type WorkflowEditorPortMinViolation = {
  nodeId: string;
  portId: string;
  direction: WorkflowEditorPortDirection;
  min: number;
  connectionCount: number;
  message: string;
};

function isExpandableConstructorNode(kind: string | undefined) {
  return kind === "json.array" || kind === "json.object";
}

function isDynamicConstructorPort(port: WorkflowEditorPort) {
  return (
    port.metadata?.arrayConstructorRole === "add-item" ||
    port.metadata?.objectConstructorRole === "add-property"
  );
}

function bound(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    ? Math.trunc(value)
    : undefined;
}

/** Maximum connection count, or `undefined` when unbounded. */
export function resolveWorkflowEditorPortMax(
  port: WorkflowEditorPort,
  direction: WorkflowEditorPortDirection,
  node: Pick<CardinalityNode, "kind">,
): number | undefined {
  if (
    direction === "input" &&
    (isExpandableConstructorNode(node.kind) || isDynamicConstructorPort(port))
  ) {
    return undefined;
  }
  if (port.cardinality) {
    return bound(port.cardinality.max);
  }
  return direction === "input" ? 1 : undefined;
}

/** An input that accepts more than one connection and therefore carries an array type `T[]`. */
export function isWorkflowEditorMultiSourceInput(
  port: WorkflowEditorPort,
  node: Pick<CardinalityNode, "kind">,
): boolean {
  if (
    !port.cardinality ||
    isExpandableConstructorNode(node.kind) ||
    isDynamicConstructorPort(port)
  ) {
    return false;
  }
  const max = resolveWorkflowEditorPortMax(port, "input", node);
  return max === undefined || max > 1;
}

/** The element type `T` of an array port type `T[]`. */
export function workflowEditorPortElementType(
  type: WorkflowEditorPortType,
): WorkflowEditorPortType {
  return type.kind === "array"
    ? type.element
    : { kind: "typescript", source: `(${workflowEditorPortTypeSource(type)})[number]` };
}

/** Union array `(A | B)[]` of the given source types, used to infer multi-source outputs. */
export function workflowEditorArrayOfUnion(
  types: readonly WorkflowEditorPortType[],
): WorkflowEditorPortType {
  if (types.length === 1) {
    return { kind: "array", element: types[0]! };
  }
  return {
    kind: "typescript",
    source: `(${types.map((type) => `(${workflowEditorPortTypeSource(type)})`).join(" | ")})[]`,
  };
}

function portLookup(nodes: readonly CardinalityNode[]) {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  return (nodeId: string, portId: string, direction: WorkflowEditorPortDirection) => {
    const node = byId.get(nodeId);
    const port = (direction === "input" ? node?.inputs : node?.outputs)?.find(
      (candidate) => candidate.id === portId,
    );
    return node && port ? { node, port } : undefined;
  };
}

function describePort(
  port: WorkflowEditorPort,
  nodeId: string,
  direction: WorkflowEditorPortDirection,
) {
  return `${direction === "input" ? "Input" : "Output"} ${port.label ?? port.id} (${nodeId}.${port.id})`;
}

export function describeWorkflowEditorCardinalityLimit(
  port: WorkflowEditorPort,
  nodeId: string,
  direction: WorkflowEditorPortDirection,
  max: number,
) {
  const limit = max === 1 ? "accepts only one connection" : `accepts at most ${max} connections`;
  return `${describePort(port, nodeId, direction)} ${limit}.`;
}

/** Edges beyond a port's maximum, in document order (an edge is reported once). */
export function findWorkflowEditorExcessConnections(document: {
  nodes: readonly CardinalityNode[];
  edges: readonly CardinalityEdge[];
}): WorkflowEditorExcessConnection[] {
  const lookup = portLookup(document.nodes);
  const counts = new Map<string, number>();
  const excess: WorkflowEditorExcessConnection[] = [];
  document.edges.forEach((edge, edgeIndex) => {
    const ends: Array<[string, string, WorkflowEditorPortDirection]> = [
      [edge.targetNodeId, edge.targetPortId, "input"],
      [edge.sourceNodeId, edge.sourcePortId, "output"],
    ];
    let reported = false;
    for (const [nodeId, portId, direction] of ends) {
      const key = JSON.stringify([nodeId, portId, direction]);
      const count = (counts.get(key) ?? 0) + 1;
      counts.set(key, count);
      const resolved = lookup(nodeId, portId, direction);
      if (!resolved || reported) {
        continue;
      }
      const max = resolveWorkflowEditorPortMax(resolved.port, direction, resolved.node);
      if (max !== undefined && count > max) {
        reported = true;
        excess.push({
          edgeId: edge.id,
          edgeIndex,
          nodeId,
          portId,
          direction,
          max,
          message: `Edge ${edge.id} exceeds the limit: ${describeWorkflowEditorCardinalityLimit(
            resolved.port,
            nodeId,
            direction,
            max,
          )}`,
        });
      }
    }
  });
  return excess;
}

/** Ports with fewer connections than their declared `min` (an execution-readiness concern). */
export function findWorkflowEditorPortMinViolations(document: {
  nodes: readonly CardinalityNode[];
  edges: readonly CardinalityEdge[];
}): WorkflowEditorPortMinViolation[] {
  const counts = new Map<string, number>();
  for (const edge of document.edges) {
    for (const key of [
      JSON.stringify([edge.targetNodeId, edge.targetPortId, "input"]),
      JSON.stringify([edge.sourceNodeId, edge.sourcePortId, "output"]),
    ]) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }
  const violations: WorkflowEditorPortMinViolation[] = [];
  for (const node of document.nodes) {
    for (const [direction, ports] of [
      ["input", node.inputs ?? []],
      ["output", node.outputs ?? []],
    ] as const) {
      for (const port of ports) {
        const min = bound(port.cardinality?.min) ?? 0;
        const connectionCount = counts.get(JSON.stringify([node.id, port.id, direction])) ?? 0;
        if (min > 0 && connectionCount < min) {
          violations.push({
            nodeId: node.id,
            portId: port.id,
            direction,
            min,
            connectionCount,
            message: `${describePort(port, node.id, direction)} requires at least ${min} connection${
              min === 1 ? "" : "s"
            }; found ${connectionCount}.`,
          });
        }
      }
    }
  }
  return violations;
}

/** Counts connections on one port, ignoring an optional edge being rewired. */
export function countWorkflowEditorPortConnections(
  edges: readonly CardinalityEdge[],
  nodeId: string,
  portId: string,
  direction: WorkflowEditorPortDirection,
  ignoredEdgeId?: string,
) {
  let count = 0;
  for (const edge of edges) {
    if (edge.id === ignoredEdgeId) {
      continue;
    }
    if (
      direction === "input"
        ? edge.targetNodeId === nodeId && edge.targetPortId === portId
        : edge.sourceNodeId === nodeId && edge.sourcePortId === portId
    ) {
      count += 1;
    }
  }
  return count;
}
