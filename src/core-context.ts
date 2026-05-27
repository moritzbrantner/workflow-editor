import type {
  WorkflowEditorDocument,
  WorkflowEditorEdge,
  WorkflowEditorNode,
  WorkflowEditorPort,
} from "./core";

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
  const nodeById = new Map(document.nodes.map((node) => [node.id, node]));
  const edgeById = new Map(document.edges.map((edge) => [edge.id, edge]));
  const inputPortByNodeAndId = new Map<string, WorkflowEditorPort>();
  const outputPortByNodeAndId = new Map<string, WorkflowEditorPort>();
  const incomingEdgesByNodeId = new Map<string, Array<WorkflowEditorEdge<TEdgeData>>>();
  const outgoingEdgesByNodeId = new Map<string, Array<WorkflowEditorEdge<TEdgeData>>>();
  const adjacencyByNodeId = new Map(document.nodes.map((node) => [node.id, [] as string[]]));

  for (const node of document.nodes) {
    for (const input of node.inputs ?? []) {
      inputPortByNodeAndId.set(portKey(node.id, input.id), input);
    }

    for (const output of node.outputs ?? []) {
      outputPortByNodeAndId.set(portKey(node.id, output.id), output);
    }
  }

  for (const edge of document.edges) {
    const incoming = incomingEdgesByNodeId.get(edge.targetNodeId) ?? [];
    incoming.push(edge);
    incomingEdgesByNodeId.set(edge.targetNodeId, incoming);

    const outgoing = outgoingEdgesByNodeId.get(edge.sourceNodeId) ?? [];
    outgoing.push(edge);
    outgoingEdgesByNodeId.set(edge.sourceNodeId, outgoing);

    adjacencyByNodeId.get(edge.sourceNodeId)?.push(edge.targetNodeId);
  }

  const context: WorkflowEditorDocumentContext<TNodeData, TEdgeData> = {
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
      return incomingEdgesByNodeId.get(nodeId)?.find((edge) => edge.targetPortId === portId);
    },

    getOutgoingEdgesFromPort(nodeId, portId) {
      return (
        outgoingEdgesByNodeId.get(nodeId)?.filter((edge) => edge.sourcePortId === portId) ?? []
      );
    },

    canReach(startNodeId, targetNodeId) {
      const queue = [startNodeId];
      const visited = new Set<string>();

      for (let cursor = 0; cursor < queue.length; cursor += 1) {
        const nodeId = queue[cursor]!;

        if (nodeId === targetNodeId) {
          return true;
        }

        if (visited.has(nodeId)) {
          continue;
        }

        visited.add(nodeId);

        for (const nextNodeId of adjacencyByNodeId.get(nodeId) ?? []) {
          queue.push(nextNodeId);
        }
      }

      return false;
    },
  };

  return context;
}
