import type {
  WorkflowEditorDocument,
  WorkflowEditorNode,
  WorkflowEditorPortType,
} from "./core-types";
import { workflowEditorPortTypeSource } from "./core-type-source";
import { isWorkflowEditorMultiSourceInput, workflowEditorArrayOfUnion } from "./core-cardinality";

/** Execution-neutral output contracts for built-ins; no runtime branch selection is inferred. */
export function propagateWorkflowEditorTypes<TNodeData, TEdgeData>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  synchronizeConstructor?: (node: WorkflowEditorNode<TNodeData>) => WorkflowEditorNode<TNodeData>,
): WorkflowEditorDocument<TNodeData, TEdgeData> {
  const nodes = new Map(document.nodes.map((node) => [node.id, node]));
  const incoming = new Map<string, (typeof document.edges)[number]>();
  const incomingAll = new Map<string, Array<(typeof document.edges)[number]>>();
  for (const edge of document.edges) {
    const key = JSON.stringify([edge.targetNodeId, edge.targetPortId]);
    incoming.set(key, edge);
    incomingAll.set(key, [...(incomingAll.get(key) ?? []), edge]);
  }
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
    const sourceType = (edge: (typeof document.edges)[number]) => {
      visit(edge.sourceNodeId);
      return nodes.get(edge.sourceNodeId)?.outputs?.find((port) => port.id === edge.sourcePortId)
        ?.type;
    };
    const inputType = (portId: string): WorkflowEditorPortType => {
      const port = node.inputs?.find((candidate) => candidate.id === portId);
      if (port && isWorkflowEditorMultiSourceInput(port, node)) {
        // A multi-source input `T[]` collects one element per connected source.
        const types = (incomingAll.get(JSON.stringify([id, portId])) ?? []).flatMap((edge) => {
          const type = sourceType(edge);
          return type ? [type] : [];
        });
        return types.length > 0 ? workflowEditorArrayOfUnion(types) : port.type;
      }
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
    const decomposition = node.kind === "json.object.decompose";
    const connectedObject = incoming.has(JSON.stringify([id, "object"]));
    const constructorNode = decomposition
      ? {
          ...node,
          outputs: node.outputs?.map((port) => {
            if (port.metadata?.objectDecompositionRole !== "property") {
              return port;
            }
            const base = (port.metadata.workflowTypeInferenceBase ??
              port.type) as WorkflowEditorPortType;
            return {
              ...port,
              type: connectedObject ? port.type : base,
              metadata: { ...port.metadata, workflowTypeInferenceBase: base },
            };
          }),
        }
      : node;
    const effectiveNode =
      constructor && synchronizeConstructor
        ? synchronizeConstructor({
            ...constructorNode,
            inputs: node.inputs?.map((port) => ({
              ...port,
              type: inputType(port.id),
              ...(decomposition
                ? { metadata: { ...port.metadata, workflowResolvedType: inputType(port.id) } }
                : {}),
            })),
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
    nodes.set(id, {
      ...effectiveNode,
      ...(decomposition && node.inputs
        ? {
            inputs: node.inputs.map((port) => {
              const { workflowResolvedType: _resolved, ...metadata } = port.metadata ?? {};
              return Object.assign({}, port, {
                metadata: {
                  ...metadata,
                  ...(incoming.has(JSON.stringify([id, port.id]))
                    ? { workflowResolvedType: inputType(port.id) }
                    : {}),
                },
              });
            }),
          }
        : {}),
      ...(outputs ? { outputs } : {}),
    });
    visiting.delete(id);
    visited.add(id);
  };
  for (const node of document.nodes) {
    visit(node.id);
  }
  return { ...document, nodes: document.nodes.map((node) => nodes.get(node.id)!) };
}
