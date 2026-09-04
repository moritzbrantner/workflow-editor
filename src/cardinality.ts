import { validateGraphEditorConnection } from "@moritzbrantner/graph-editor/core";

import { addWorkflowEditorEdge, connectWorkflowEditorNodes } from "./core";
import { createWorkflowEditorDocumentContext } from "./core-context";
import { createWorkflowEditorTypeResolver } from "./core-type-resolver";
import type {
  WorkflowEditorConnectionInput,
  WorkflowEditorDocument,
  WorkflowEditorEdge,
  WorkflowEditorPort,
  WorkflowEditorPortType,
  WorkflowEditorTypeValidationOptions,
} from "./core-types";

export type WorkflowEditorPortDirection = "input" | "output";

export type WorkflowEditorPortCardinality = {
  min?: number;
  max?: number | null;
};

export type WorkflowEditorCardinalityPort = WorkflowEditorPort & {
  cardinality?: WorkflowEditorPortCardinality;
};

export type WorkflowEditorCardinalityConnectionInvalidReason =
  | "cycle"
  | "duplicate"
  | "input-occupied"
  | "kind-mismatch"
  | "missing-node"
  | "missing-port"
  | "self-connection"
  | "type-mismatch"
  | "source-cardinality"
  | "target-cardinality";

export type WorkflowEditorCardinalityConnectionValidity = {
  valid: boolean;
  reason?: WorkflowEditorCardinalityConnectionInvalidReason;
};

export type WorkflowEditorPortCardinalityDiagnostic = {
  code: "port-cardinality-min" | "port-cardinality-max";
  message: string;
  nodeId: string;
  portId: string;
  direction: WorkflowEditorPortDirection;
  connectionCount: number;
  min?: number;
  max?: number | null;
};

export function analyzeWorkflowEditorPortCardinality<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
): WorkflowEditorPortCardinalityDiagnostic[] {
  const diagnostics: WorkflowEditorPortCardinalityDiagnostic[] = [];

  for (const node of document.nodes) {
    for (const port of node.inputs ?? []) {
      const cardinalityPort = port as WorkflowEditorCardinalityPort;
      if (isDynamicConstructorPort(cardinalityPort)) {
        continue;
      }
      diagnostics.push(
        ...diagnosePort(
          document,
          node.id,
          cardinalityPort,
          "input",
          isExpandableConstructorNode(node.kind),
        ),
      );
    }
    for (const port of node.outputs ?? []) {
      diagnostics.push(
        ...diagnosePort(document, node.id, port as WorkflowEditorCardinalityPort, "output", false),
      );
    }
  }

  return diagnostics;
}

export function validateWorkflowEditorConnectionCardinality<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  connection: WorkflowEditorConnectionInput,
): WorkflowEditorCardinalityConnectionValidity {
  const context = createWorkflowEditorDocumentContext(document);
  const sourceNode = context.nodeById.get(connection.sourceNodeId);
  const targetNode = context.nodeById.get(connection.targetNodeId);
  const sourcePort = context.getOutputPort(
    connection.sourceNodeId,
    connection.sourcePortId,
  ) as WorkflowEditorCardinalityPort | null;
  const targetPort = context.getInputPort(
    connection.targetNodeId,
    connection.targetPortId,
  ) as WorkflowEditorCardinalityPort | null;

  if (!sourceNode || !targetNode || !sourcePort || !targetPort) {
    return { valid: true };
  }

  const sourceCount = countConnections(
    document,
    connection.sourceNodeId,
    connection.sourcePortId,
    "output",
  );
  const targetCount = countConnections(
    document,
    connection.targetNodeId,
    connection.targetPortId,
    "input",
  );
  const sourceMax = resolveMax(sourcePort.cardinality, "output", false);
  const targetMax = resolveMax(
    targetPort.cardinality,
    "input",
    isExpandableConstructorNode(targetNode.kind),
  );

  if (sourceMax !== null && sourceCount + 1 > sourceMax) {
    return { valid: false, reason: "source-cardinality" };
  }
  if (!isDynamicConstructorPort(targetPort) && targetMax !== null && targetCount + 1 > targetMax) {
    return { valid: false, reason: "target-cardinality" };
  }

  return { valid: true };
}

export function validateWorkflowEditorConnectionWithCardinality<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  connection: WorkflowEditorConnectionInput,
  options: WorkflowEditorTypeValidationOptions = {},
): WorkflowEditorCardinalityConnectionValidity {
  const context = createWorkflowEditorDocumentContext(document);
  const targetNode = context.nodeById.get(connection.targetNodeId);
  const targetPort = context.getInputPort(
    connection.targetNodeId,
    connection.targetPortId,
  ) as WorkflowEditorCardinalityPort | null;
  const targetMax = targetPort
    ? resolveMax(targetPort.cardinality, "input", isExpandableConstructorNode(targetNode?.kind))
    : 1;
  const allowOccupiedInputs =
    !!targetPort &&
    (isDynamicConstructorPort(targetPort) || targetMax === null || (targetMax ?? 1) > 1);
  const typeResolver = createWorkflowEditorTypeResolver(options.typeDefinitions);

  const semanticValidity = validateGraphEditorConnection<
    TNodeData,
    TEdgeData,
    WorkflowEditorPortType
  >(document, connection, {
    allowCycles: false,
    allowOccupiedInputs,
    arePortsCompatible(graphSourcePort, graphTargetPort) {
      const sourcePort = graphSourcePort as WorkflowEditorCardinalityPort;
      const currentTargetPort = graphTargetPort as WorkflowEditorCardinalityPort;
      const targetType = isDynamicConstructorPort(currentTargetPort)
        ? ({ kind: "any" } as const)
        : currentTargetPort.type;
      return typeResolver.isAssignable(sourcePort.type, targetType)
        ? true
        : { valid: false, reason: "type-mismatch" };
    },
  }) as WorkflowEditorCardinalityConnectionValidity;

  if (!semanticValidity.valid) {
    return semanticValidity;
  }
  return validateWorkflowEditorConnectionCardinality(document, connection);
}

export function connectWorkflowEditorNodesWithCardinality<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  connection: WorkflowEditorConnectionInput,
  options: WorkflowEditorTypeValidationOptions = {},
): WorkflowEditorDocument<TNodeData, TEdgeData> {
  const validity = validateWorkflowEditorConnectionWithCardinality(document, connection, options);
  if (!validity.valid) {
    return document;
  }

  const context = createWorkflowEditorDocumentContext(document);
  const targetNode = context.nodeById.get(connection.targetNodeId);
  if (isExpandableConstructorNode(targetNode?.kind)) {
    return connectWorkflowEditorNodes(document, connection, options);
  }

  const id = createCardinalityEdgeId(document, connection);
  return addWorkflowEditorEdge(document, { id, ...connection } as WorkflowEditorEdge<TEdgeData>);
}

export function getWorkflowEditorPortConnectionCount<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  nodeId: string,
  portId: string,
  direction: WorkflowEditorPortDirection,
): number {
  return countConnections(document, nodeId, portId, direction);
}

function diagnosePort<TNodeData, TEdgeData>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  nodeId: string,
  port: WorkflowEditorCardinalityPort,
  direction: WorkflowEditorPortDirection,
  expandableInput: boolean,
): WorkflowEditorPortCardinalityDiagnostic[] {
  const connectionCount = countConnections(document, nodeId, port.id, direction);
  const min = resolveMin(port.cardinality);
  const max = resolveMax(port.cardinality, direction, expandableInput);
  const diagnostics: WorkflowEditorPortCardinalityDiagnostic[] = [];

  if (min > 0 && connectionCount < min) {
    diagnostics.push({
      code: "port-cardinality-min",
      message: `${direction} port ${nodeId}.${port.id} requires at least ${min} connection${min === 1 ? "" : "s"}; found ${connectionCount}.`,
      nodeId,
      portId: port.id,
      direction,
      connectionCount,
      min,
      max,
    });
  }
  if (max !== null && connectionCount > max) {
    diagnostics.push({
      code: "port-cardinality-max",
      message: `${direction} port ${nodeId}.${port.id} allows at most ${max} connection${max === 1 ? "" : "s"}; found ${connectionCount}.`,
      nodeId,
      portId: port.id,
      direction,
      connectionCount,
      min,
      max,
    });
  }

  return diagnostics;
}

function countConnections<TNodeData, TEdgeData>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  nodeId: string,
  portId: string,
  direction: WorkflowEditorPortDirection,
): number {
  return document.edges.filter((edge) =>
    direction === "input"
      ? edge.targetNodeId === nodeId && edge.targetPortId === portId
      : edge.sourceNodeId === nodeId && edge.sourcePortId === portId,
  ).length;
}

function resolveMin(cardinality: WorkflowEditorPortCardinality | undefined): number {
  return normalizeBound(cardinality?.min) ?? 0;
}

function resolveMax(
  cardinality: WorkflowEditorPortCardinality | undefined,
  direction: WorkflowEditorPortDirection,
  expandableInput: boolean,
): number | null {
  if (cardinality?.max === null) {
    return null;
  }
  const explicit = normalizeBound(cardinality?.max);
  if (explicit !== undefined) {
    return explicit;
  }
  if (direction === "output" || expandableInput) {
    return null;
  }
  return 1;
}

function normalizeBound(value: number | undefined): number | undefined {
  return Number.isFinite(value) && Number(value) >= 0 ? Math.trunc(Number(value)) : undefined;
}

function isExpandableConstructorNode(kind: string | undefined): boolean {
  return kind === "json.array" || kind === "json.object";
}

function isDynamicConstructorPort(port: WorkflowEditorCardinalityPort): boolean {
  return (
    port.metadata?.arrayConstructorRole === "add-item" ||
    port.metadata?.objectConstructorRole === "add-property"
  );
}

function createCardinalityEdgeId<TNodeData, TEdgeData>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  connection: WorkflowEditorConnectionInput,
): string {
  const used = new Set(document.edges.map((edge) => edge.id));
  const base = `edge-${safeIdPart(connection.sourceNodeId)}-${safeIdPart(connection.sourcePortId)}-${safeIdPart(connection.targetNodeId)}-${safeIdPart(connection.targetPortId)}`;
  if (!used.has(base)) {
    return base;
  }
  let suffix = 2;
  while (used.has(`${base}-${suffix}`)) {
    suffix += 1;
  }
  return `${base}-${suffix}`;
}

function safeIdPart(value: string): string {
  return (
    value
      .trim()
      .replace(/[^a-zA-Z0-9_-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "port"
  );
}
