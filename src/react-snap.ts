import { getWorkflowNodePortCenterOffset, getWorkflowNodeSize } from "./react/workflow-node";

import {
  connectWorkflowEditorNodes,
  formatWorkflowEditorObjectConstructorExpression,
  validateWorkflowEditorConnection,
  type WorkflowEditorDocument,
  type WorkflowEditorNode,
  type WorkflowEditorTypeDefinition,
} from "./core";
import { toUiWorkflowBuilderNodes } from "./react/workflow-builder-adapters";
import {
  createWorkflowEditorNodeLayoutOptions,
  type WorkflowEditorNodeLayoutDrafts,
} from "./core-node-layout";

const workflowEditorSnapDistance = 28;

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

  const size = getWorkflowEditorRenderedNodeSize(node);

  return {
    x: node.x + (direction === "input" ? 0 : size.width),
    y: node.y + getWorkflowEditorPortCenterOffset(node, direction, portIndex),
  };
}

function workflowEditorNodeLayoutOptions(
  node: WorkflowEditorNode<unknown>,
  drafts: WorkflowEditorNodeLayoutDrafts,
) {
  return createWorkflowEditorNodeLayoutOptions({
    objectConstructorExpression: () =>
      formatWorkflowEditorObjectConstructorExpression(node as WorkflowEditorNode),
    ...drafts,
  });
}

/** The node's rendered size, from the same geometry model as the canvas (#48). */
export function getWorkflowEditorRenderedNodeSize(
  node: WorkflowEditorNode<unknown>,
  drafts: WorkflowEditorNodeLayoutDrafts = {},
) {
  const uiNode = toUiWorkflowBuilderNodes([node])[0]!;
  return getWorkflowNodeSize(uiNode, workflowEditorNodeLayoutOptions(node, drafts));
}

export function getWorkflowEditorPortCenterOffset(
  node: WorkflowEditorNode<unknown>,
  direction: "input" | "output",
  portIndex: number,
  drafts: WorkflowEditorNodeLayoutDrafts = {},
) {
  const uiNode = toUiWorkflowBuilderNodes([node])[0]!;
  return getWorkflowNodePortCenterOffset(
    uiNode,
    portIndex,
    workflowEditorNodeLayoutOptions(node, drafts),
    direction,
  );
}
