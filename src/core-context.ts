import { createGraphEditorDocumentContext } from "@moritzbrantner/graph-editor/core";

import type {
  WorkflowEditorDocument,
  WorkflowEditorEdge,
  WorkflowEditorNode,
  WorkflowEditorPort,
  WorkflowEditorPortType,
} from "./core-types";

function portKey(nodeId: string, portId: string) {
  return `${nodeId}:${portId}`;
}

export type WorkflowEditorDocumentContext<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
> = {
  document: WorkflowEditorDocument<TNodeData, TEdgeData>;
  nodeById: Map<string, WorkflowEditorNode<TNodeData>>;
  edgeById: Map<string, WorkflowEditorEdge<TEdgeData>>;
  inputPortByNodeAndId: Map<string, WorkflowEditorPort>;
  outputPortByNodeAndId: Map<string, WorkflowEditorPort>;
  incomingEdgesByNodeId: Map<string, Array<WorkflowEditorEdge<TEdgeData>>>;
  outgoingEdgesByNodeId: Map<string, Array<WorkflowEditorEdge<TEdgeData>>>;
  adjacencyByNodeId: Map<string, string[]>;
  getInputPort(nodeId: string, portId: string): WorkflowEditorPort | undefined;
  getOutputPort(nodeId: string, portId: string): WorkflowEditorPort | undefined;
  getIncomingEdges(nodeId: string): Array<WorkflowEditorEdge<TEdgeData>>;
  getOutgoingEdges(nodeId: string): Array<WorkflowEditorEdge<TEdgeData>>;
  getIncomingEdgeToPort(nodeId: string, portId: string): WorkflowEditorEdge<TEdgeData> | undefined;
  getOutgoingEdgesFromPort(nodeId: string, portId: string): Array<WorkflowEditorEdge<TEdgeData>>;
  canReach(startNodeId: string, targetNodeId: string): boolean;
};

export function createWorkflowEditorDocumentContext<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
): WorkflowEditorDocumentContext<TNodeData, TEdgeData> {
  const graphContext = createGraphEditorDocumentContext<
    TNodeData,
    TEdgeData,
    WorkflowEditorPortType
  >(document);
  const nodeById = graphContext.nodeById as Map<string, WorkflowEditorNode<TNodeData>>;
  const edgeById = graphContext.edgeById as Map<string, WorkflowEditorEdge<TEdgeData>>;
  const incomingEdgesByNodeId = graphContext.incomingEdgesByNodeId as Map<
    string,
    Array<WorkflowEditorEdge<TEdgeData>>
  >;
  const outgoingEdgesByNodeId = graphContext.outgoingEdgesByNodeId as Map<
    string,
    Array<WorkflowEditorEdge<TEdgeData>>
  >;
  const adjacencyByNodeId = graphContext.adjacencyByNodeId as Map<string, string[]>;
  const inputPortByNodeAndId = new Map<string, WorkflowEditorPort>();
  const outputPortByNodeAndId = new Map<string, WorkflowEditorPort>();

  for (const node of document.nodes) {
    for (const input of node.inputs ?? []) {
      inputPortByNodeAndId.set(portKey(node.id, input.id), input);
    }
    for (const output of node.outputs ?? []) {
      outputPortByNodeAndId.set(portKey(node.id, output.id), output);
    }
  }

  return {
    document,
    nodeById,
    edgeById,
    inputPortByNodeAndId,
    outputPortByNodeAndId,
    incomingEdgesByNodeId,
    outgoingEdgesByNodeId,
    adjacencyByNodeId,
    getInputPort(nodeId, portId) {
      return inputPortByNodeAndId.get(portKey(nodeId, portId));
    },
    getOutputPort(nodeId, portId) {
      return outputPortByNodeAndId.get(portKey(nodeId, portId));
    },
    getIncomingEdges(nodeId) {
      return incomingEdgesByNodeId.get(nodeId) ?? [];
    },
    getOutgoingEdges(nodeId) {
      return outgoingEdgesByNodeId.get(nodeId) ?? [];
    },
    getIncomingEdgeToPort(nodeId, portId) {
      return incomingEdgesByNodeId
        .get(nodeId)
        ?.find((edge) => edge.targetNodeId === nodeId && edge.targetPortId === portId);
    },
    getOutgoingEdgesFromPort(nodeId, portId) {
      return (
        outgoingEdgesByNodeId.get(nodeId)?.filter((edge) => edge.sourcePortId === portId) ?? []
      );
    },
    canReach(startNodeId, targetNodeId) {
      return graphContext.canReach(startNodeId, targetNodeId);
    },
  };
}
