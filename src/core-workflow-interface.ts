import type { WorkflowEditorDocument, WorkflowEditorNode, WorkflowEditorPort } from "./core-types";
import { workflowEditorPortTypeSource } from "./core-type-source";

/**
 * A Workflow Document's interface (owner decision for #95, option A): its inputs are the output
 * ports of its `control.start` nodes and its outputs are the input ports of its `control.end`
 * nodes. A Workflow Reference node exposes the same ports, matched by id.
 */
export type WorkflowEditorWorkflowInterface = {
  inputs: WorkflowEditorPort[];
  outputs: WorkflowEditorPort[];
};

function interfacePort(port: WorkflowEditorPort): WorkflowEditorPort {
  return {
    id: port.id,
    label: port.label,
    type: port.type,
    ...(port.optional ? { optional: true } : {}),
    ...(port.payload ? { payload: port.payload } : {}),
  };
}

export function getWorkflowEditorWorkflowInterface(
  document: WorkflowEditorDocument<unknown, unknown>,
): WorkflowEditorWorkflowInterface {
  const collect = (kind: string, side: "inputs" | "outputs") => {
    const seen = new Set<string>();
    return document.nodes
      .filter((node) => node.kind === kind)
      .flatMap((node) => node[side] ?? [])
      .filter((port) => !seen.has(port.id) && !!seen.add(port.id))
      .map(interfacePort);
  };
  return {
    inputs: collect("control.start", "outputs"),
    outputs: collect("control.end", "inputs"),
  };
}

function samePorts(current: readonly WorkflowEditorPort[] | undefined, next: WorkflowEditorPort[]) {
  const ports = current ?? [];
  return (
    ports.length === next.length &&
    next.every((port) => {
      const match = ports.find((candidate) => candidate.id === port.id);
      return (
        match !== undefined &&
        workflowEditorPortTypeSource(match.type) === workflowEditorPortTypeSource(port.type) &&
        !!match.optional === !!port.optional
      );
    })
  );
}

/** Whether a reference node's ports already match the referenced workflow's interface. */
export function workflowEditorReferenceMatchesInterface(
  node: Pick<WorkflowEditorNode<unknown>, "inputs" | "outputs">,
  workflowInterface: WorkflowEditorWorkflowInterface,
) {
  return (
    samePorts(node.inputs, workflowInterface.inputs) &&
    samePorts(node.outputs, workflowInterface.outputs)
  );
}

/**
 * Replaces a reference node's ports with the referenced workflow's interface. Connections to
 * ports that no longer exist are removed; connections to kept ports stay.
 */
export function syncWorkflowEditorReferenceInterface<TNodeData, TEdgeData>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  nodeId: string,
  workflowInterface: WorkflowEditorWorkflowInterface,
): WorkflowEditorDocument<TNodeData, TEdgeData> {
  const node = document.nodes.find((candidate) => candidate.id === nodeId);
  if (!node || workflowEditorReferenceMatchesInterface(node, workflowInterface)) return document;
  const keep = (ports: readonly WorkflowEditorPort[] | undefined, next: WorkflowEditorPort[]) =>
    next.map((port) => {
      const existing = ports?.find((candidate) => candidate.id === port.id);
      return existing ? { ...existing, ...port, label: existing.label ?? port.label } : port;
    });
  const inputs = keep(node.inputs, workflowInterface.inputs);
  const outputs = keep(node.outputs, workflowInterface.outputs);
  const inputIds = new Set(inputs.map((port) => port.id));
  const outputIds = new Set(outputs.map((port) => port.id));
  return {
    ...document,
    nodes: document.nodes.map((candidate) =>
      candidate.id === nodeId ? { ...candidate, inputs, outputs } : candidate,
    ),
    edges: document.edges.filter(
      (edge) =>
        !(edge.targetNodeId === nodeId && !inputIds.has(edge.targetPortId)) &&
        !(edge.sourceNodeId === nodeId && !outputIds.has(edge.sourcePortId)),
    ),
  };
}
