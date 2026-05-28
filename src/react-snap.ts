import { getWorkflowNodePortCenterOffset, getWorkflowNodeSize } from "@moritzbrantner/ui/labs";

import {
  connectWorkflowEditorNodes,
  formatWorkflowEditorObjectConstructorExpression,
  toUiWorkflowBuilderNodes,
  validateWorkflowEditorConnection,
  type WorkflowEditorDocument,
  type WorkflowEditorNode,
  type WorkflowEditorPortType,
  type WorkflowEditorTypeDefinition,
} from "./core";

const workflowEditorSnapDistance = 28;
const workflowEditorMinimizedNodeWidth = 176;
const workflowEditorMinimizedNodeHeight = 36;
const workflowEditorObjectConstructorMinNodeWidth = 460;
const workflowEditorNodePortHeight = 64;
const workflowEditorNodePortGap = 8;
const workflowEditorObjectConstructorMinOutputPanelHeight = 148;
const workflowEditorObjectConstructorValidationHeight = 20;

type WorkflowEditorObjectConstructorLayoutOptions = {
  objectConstructorExpression?: string;
  objectConstructorValidationMessage?: string;
};

type WorkflowEditorPoint = {
  x: number;
  y: number;
};

type WorkflowEditorNodeSnapCandidate = {
  connection: {
    sourceNodeId: string;
    sourcePortId: string;
    targetNodeId: string;
    targetPortId: string;
  };
  distance: number;
  dx: number;
  dy: number;
};

export function snapWorkflowEditorNodeToCompatiblePort<
  TNodeData extends Record<string, unknown>,
  TEdgeData extends Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  nodeId: string,
  options: { typeDefinitions?: readonly WorkflowEditorTypeDefinition[] } = {},
) {
  const snapCandidate = findWorkflowEditorNodeSnapCandidate(document, nodeId, options);

  if (!snapCandidate) {
    return document;
  }

  const snappedDocument = applyWorkflowEditorNodeSnap(document, nodeId, snapCandidate);
  const validity = validateWorkflowEditorConnection(
    snappedDocument,
    snapCandidate.connection,
    options,
  );

  return validity.valid
    ? connectWorkflowEditorNodes(snappedDocument, snapCandidate.connection, options)
    : snappedDocument;
}

export function snapWorkflowEditorNodePositionToCompatiblePort<
  TNodeData extends Record<string, unknown>,
  TEdgeData extends Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  nodeId: string,
  options: { typeDefinitions?: readonly WorkflowEditorTypeDefinition[] } = {},
) {
  const snapCandidate = findWorkflowEditorNodeSnapCandidate(document, nodeId, options);

  return snapCandidate ? applyWorkflowEditorNodeSnap(document, nodeId, snapCandidate) : document;
}

function findWorkflowEditorNodeSnapCandidate<
  TNodeData extends Record<string, unknown>,
  TEdgeData extends Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  nodeId: string,
  options: { typeDefinitions?: readonly WorkflowEditorTypeDefinition[] } = {},
) {
  const movedNode = document.nodes.find((node) => node.id === nodeId);

  if (!movedNode) {
    return undefined;
  }

  let bestCandidate: WorkflowEditorNodeSnapCandidate | undefined;

  const addCandidate = (
    connection: WorkflowEditorNodeSnapCandidate["connection"],
    movedPortCenter: WorkflowEditorPoint | null,
    otherPortCenter: WorkflowEditorPoint | null,
  ) => {
    if (!movedPortCenter || !otherPortCenter) {
      return;
    }

    const dx = otherPortCenter.x - movedPortCenter.x;
    const dy = otherPortCenter.y - movedPortCenter.y;
    const distance = Math.hypot(dx, dy);

    if (distance > workflowEditorSnapDistance) {
      return;
    }

    if (
      !canSnapWorkflowEditorConnection(document, connection, options) ||
      (bestCandidate && bestCandidate.distance <= distance)
    ) {
      return;
    }

    bestCandidate = { connection, distance, dx, dy };
  };

  for (const node of document.nodes) {
    if (node.id === movedNode.id) {
      continue;
    }

    for (const output of movedNode.outputs ?? []) {
      for (const input of node.inputs ?? []) {
        addCandidate(
          {
            sourceNodeId: movedNode.id,
            sourcePortId: output.id,
            targetNodeId: node.id,
            targetPortId: input.id,
          },
          getWorkflowEditorPortCenter(movedNode, "output", output.id),
          getWorkflowEditorPortCenter(node, "input", input.id),
        );
      }
    }

    for (const input of movedNode.inputs ?? []) {
      for (const output of node.outputs ?? []) {
        addCandidate(
          {
            sourceNodeId: node.id,
            sourcePortId: output.id,
            targetNodeId: movedNode.id,
            targetPortId: input.id,
          },
          getWorkflowEditorPortCenter(movedNode, "input", input.id),
          getWorkflowEditorPortCenter(node, "output", output.id),
        );
      }
    }
  }

  return bestCandidate;
}

function canSnapWorkflowEditorConnection<
  TNodeData extends Record<string, unknown>,
  TEdgeData extends Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  connection: WorkflowEditorNodeSnapCandidate["connection"],
  options: { typeDefinitions?: readonly WorkflowEditorTypeDefinition[] },
) {
  const validity = validateWorkflowEditorConnection(document, connection, options);

  return validity.valid || validity.reason === "duplicate" || validity.reason === "cycle";
}

function applyWorkflowEditorNodeSnap<
  TNodeData extends Record<string, unknown>,
  TEdgeData extends Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  nodeId: string,
  snapCandidate: WorkflowEditorNodeSnapCandidate,
): WorkflowEditorDocument<TNodeData, TEdgeData> {
  const movedNode = document.nodes.find((node) => node.id === nodeId);

  if (!movedNode) {
    return document;
  }

  const nextX = Math.round(movedNode.x + snapCandidate.dx);
  const nextY = Math.round(movedNode.y + snapCandidate.dy);

  if (movedNode.x === nextX && movedNode.y === nextY) {
    return document;
  }

  return {
    ...document,
    nodes: document.nodes.map((node) =>
      node.id === nodeId
        ? {
            ...node,
            x: nextX,
            y: nextY,
          }
        : node,
    ),
  };
}

function getWorkflowEditorPortCenter<TNodeData extends Record<string, unknown>>(
  node: WorkflowEditorNode<TNodeData>,
  direction: "input" | "output",
  portId: string,
): WorkflowEditorPoint | null {
  const ports = direction === "input" ? (node.inputs ?? []) : (node.outputs ?? []);
  const portIndex = ports.findIndex((port) => port.id === portId);

  if (portIndex === -1) {
    return null;
  }

  const uiNode = toUiWorkflowBuilderNodes([node])[0]!;
  const size = getWorkflowEditorRenderedNodeSize(uiNode);

  return {
    x: node.x + (direction === "input" ? 0 : size.width),
    y: node.y + getWorkflowEditorPortCenterOffset(uiNode, direction, portIndex),
  };
}

export function getWorkflowEditorRenderedNodeSize(
  node: ReturnType<typeof toUiWorkflowBuilderNodes>[number],
  options: WorkflowEditorObjectConstructorLayoutOptions = {},
) {
  if (node.minimized === true && node.variant !== "compact") {
    return {
      width: workflowEditorMinimizedNodeWidth,
      height: workflowEditorMinimizedNodeHeight,
    };
  }

  const size = getWorkflowNodeSize(node);

  if (node.kind === "json.object") {
    return {
      ...size,
      height: Math.max(
        size.height,
        getWorkflowEditorObjectConstructorRenderedHeight(node, size, options),
      ),
      width: Math.max(
        size.width,
        getWorkflowEditorObjectConstructorRenderedWidth(
          node,
          options.objectConstructorExpression,
          options.objectConstructorValidationMessage,
        ),
      ),
    };
  }

  return size;
}

export function getWorkflowEditorPortCenterOffset(
  node: ReturnType<typeof toUiWorkflowBuilderNodes>[number],
  direction: "input" | "output",
  portIndex: number,
  options: WorkflowEditorObjectConstructorLayoutOptions = {},
) {
  if (node.minimized === true && node.variant !== "compact") {
    const portCount =
      direction === "input" ? (node.inputs?.length ?? 0) : (node.outputs?.length ?? 0);
    return ((portIndex + 1) / (portCount + 1)) * workflowEditorMinimizedNodeHeight;
  }

  const offset = getWorkflowNodePortCenterOffset(node, portIndex);

  if (
    node.kind === "json.object" &&
    direction === "output" &&
    node.outputs?.[portIndex]?.id === "value"
  ) {
    return (
      offset -
      workflowEditorNodePortHeight / 2 +
      getWorkflowEditorObjectConstructorOutputPanelHeight(
        node,
        options.objectConstructorExpression,
        options.objectConstructorValidationMessage,
      ) /
        2
    );
  }

  return offset;
}

export function getWorkflowEditorObjectConstructorRenderedWidth(
  node: ReturnType<typeof toUiWorkflowBuilderNodes>[number],
  expressionOverride?: string,
  validationMessage?: string,
) {
  const expression = expressionOverride ?? getWorkflowEditorObjectConstructorExpression(node);
  const longestLine = Math.max(
    ...expression.split("\n").map((line) => line.length),
    validationMessage?.length ?? 0,
    0,
  );
  const expressionWidth = 260 + Math.max(0, longestLine - 24) * 6;

  return Math.max(workflowEditorObjectConstructorMinNodeWidth, expressionWidth);
}

export function getWorkflowEditorObjectConstructorOutputPanelHeight(
  node: ReturnType<typeof toUiWorkflowBuilderNodes>[number],
  expressionOverride?: string,
  validationMessage?: string,
) {
  const expression = expressionOverride ?? getWorkflowEditorObjectConstructorExpression(node);
  const lineCount = Math.max(3, expression.split("\n").length);
  const validationHeight = validationMessage ? workflowEditorObjectConstructorValidationHeight : 0;
  const expressionHeight = 58 + lineCount * 16 + validationHeight;

  return Math.max(workflowEditorObjectConstructorMinOutputPanelHeight, expressionHeight);
}

export function getWorkflowEditorObjectConstructorTextAreaHeight(
  node: ReturnType<typeof toUiWorkflowBuilderNodes>[number],
  expressionOverride?: string,
  validationMessage?: string,
) {
  const validationHeight = validationMessage ? workflowEditorObjectConstructorValidationHeight : 0;

  return Math.max(
    76,
    getWorkflowEditorObjectConstructorOutputPanelHeight(
      node,
      expressionOverride,
      validationMessage,
    ) -
      52 -
      validationHeight,
  );
}

function getWorkflowEditorObjectConstructorRenderedHeight(
  node: ReturnType<typeof toUiWorkflowBuilderNodes>[number],
  size: { height: number },
  options: WorkflowEditorObjectConstructorLayoutOptions = {},
) {
  const inputCount = node.inputs?.length ?? 0;
  const outputCount = node.outputs?.length ?? 0;
  const portCount = Math.max(inputCount, outputCount, 1);
  const currentPortColumnHeight =
    portCount * workflowEditorNodePortHeight +
    Math.max(portCount - 1, 0) * workflowEditorNodePortGap;
  const expandedOutputHeight = getWorkflowEditorObjectConstructorOutputPanelHeight(
    node,
    options.objectConstructorExpression,
    options.objectConstructorValidationMessage,
  );

  return size.height + Math.max(0, expandedOutputHeight - currentPortColumnHeight);
}

function getWorkflowEditorObjectConstructorExpression(
  node: ReturnType<typeof toUiWorkflowBuilderNodes>[number],
) {
  return formatWorkflowEditorObjectConstructorExpression({
    id: node.id,
    label: node.label,
    kind: node.kind,
    x: node.x,
    y: node.y,
    inputs: node.inputs?.map((input) => ({
      ...input,
      type: getWorkflowEditorPortTypeFromMetadata(input) ?? { kind: "any" },
    })),
    outputs: node.outputs?.map((output) => ({
      ...output,
      type: getWorkflowEditorPortTypeFromMetadata(output) ?? { kind: "any" },
    })),
    data: node.metadata,
  });
}

function getWorkflowEditorPortTypeFromMetadata(
  port: NonNullable<ReturnType<typeof toUiWorkflowBuilderNodes>[number]["inputs"]>[number],
): WorkflowEditorPortType | null {
  const metadataType = port.metadata?.workflowEditorType;

  return metadataType && typeof metadataType === "object" && "kind" in metadataType
    ? (metadataType as WorkflowEditorPortType)
    : null;
}
