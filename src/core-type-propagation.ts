import type {
  WorkflowEditorDocument,
  WorkflowEditorNode,
  WorkflowEditorPortType,
} from "./core-types";
import { workflowEditorPortTypeSource } from "./core-type-source";

/** Execution-neutral output contracts for built-ins; no runtime branch selection is inferred. */
export function propagateWorkflowEditorTypes<TNodeData, TEdgeData>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  synchronizeConstructor?: (node: WorkflowEditorNode<TNodeData>) => WorkflowEditorNode<TNodeData>,
): WorkflowEditorDocument<TNodeData, TEdgeData> {
  const nodes = new Map(document.nodes.map((node) => [node.id, node]));
  const incoming = new Map(
    document.edges.map((edge) => [JSON.stringify([edge.targetNodeId, edge.targetPortId]), edge]),
  );
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const visit = (id: string) => {
    if (visited.has(id) || visiting.has(id)) {
      return;
    }
    const node = nodes.get(id);
    if (!node) {
      return;
    }
    visiting.add(id);
    const inputType = (portId: string): WorkflowEditorPortType => {
      const edge = incoming.get(JSON.stringify([id, portId]));
      if (edge) {
        visit(edge.sourceNodeId);
        const source = nodes
          .get(edge.sourceNodeId)
          ?.outputs?.find((port) => port.id === edge.sourcePortId);
        if (source) {
          return source.type;
        }
      }
      return node.inputs?.find((port) => port.id === portId)?.type ?? { kind: "any" };
    };
    const constructor =
      node.kind === "json.array" ||
      node.kind === "json.object" ||
      node.kind === "json.object.decompose";
    const effectiveNode =
      constructor && synchronizeConstructor
        ? synchronizeConstructor({
            ...node,
            inputs: node.inputs?.map((port) => ({ ...port, type: inputType(port.id) })),
          })
        : node;
    const outputs = effectiveNode.outputs?.map((port) => {
      const inference = port.metadata?.workflowTypeInference;
      if (typeof inference !== "string") {
        return port;
      }
      const types = inference.split(",").map(inputType);
      const type =
        types.length === 1
          ? types[0]!
          : ({
              kind: "typescript",
              source: types.map((part) => `(${workflowEditorPortTypeSource(part)})`).join(" | "),
            } as const);
      return { ...port, type };
    });
    nodes.set(id, { ...effectiveNode, ...(outputs ? { outputs } : {}) });
    visiting.delete(id);
    visited.add(id);
  };
  for (const node of document.nodes) {
    visit(node.id);
  }
  return { ...document, nodes: document.nodes.map((node) => nodes.get(node.id)!) };
}
