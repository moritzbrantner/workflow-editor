import { normalizeWorkflowEditorDocument } from "./core";
import type {
  WorkflowEditorDocument,
  WorkflowEditorEdge,
  WorkflowEditorNode,
  WorkflowEditorPort,
  WorkflowEditorPortDefaultValue,
  WorkflowEditorPortType,
} from "./core-types";

export const compiledWorkflowFormat = "@moritzbrantner/workflow/compiled" as const;
export const compiledWorkflowVersion = 1 as const;

export type CompiledWorkflowPort = {
  id: string;
  type: WorkflowEditorPortType;
  optional?: boolean;
  defaultValue?: WorkflowEditorPortDefaultValue;
};

export type CompiledWorkflowNode<
  TData extends Record<string, unknown> = Record<string, unknown>,
> = {
  id: string;
  label: string;
  kind: string;
  inputs?: CompiledWorkflowPort[];
  outputs?: CompiledWorkflowPort[];
  data?: TData;
};

export type CompiledWorkflowEdge = Pick<
  WorkflowEditorEdge,
  "id" | "sourceNodeId" | "sourcePortId" | "targetNodeId" | "targetPortId"
>;

export type CompiledWorkflow<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
> = {
  format: typeof compiledWorkflowFormat;
  version: typeof compiledWorkflowVersion;
  nodes: CompiledWorkflowNode<TNodeData>[];
  edges: CompiledWorkflowEdge[];
  order: string[];
};

export type WorkflowEditorCompileDiagnosticCode =
  | "missing-node-kind"
  | "nested-workflow-not-supported"
  | "composition-not-supported"
  | "invalid-dag";

export type WorkflowEditorCompileDiagnostic = {
  code: WorkflowEditorCompileDiagnosticCode;
  message: string;
  path: string;
  nodeId?: string;
};

export class WorkflowEditorCompileError extends Error {
  override name = "WorkflowEditorCompileError" as const;
  diagnostics: WorkflowEditorCompileDiagnostic[];

  constructor(diagnostics: WorkflowEditorCompileDiagnostic[]) {
    super(
      diagnostics.length === 1
        ? diagnostics[0]?.message
        : `Workflow compilation failed with ${diagnostics.length} diagnostics.`,
    );
    this.diagnostics = diagnostics;
  }
}

function compilePort(port: WorkflowEditorPort): CompiledWorkflowPort {
  return {
    id: port.id,
    type: port.type,
    ...(port.optional === undefined ? {} : { optional: port.optional }),
    ...(port.defaultValue === undefined ? {} : { defaultValue: port.defaultValue }),
  };
}

function validateExecutableNode(
  node: WorkflowEditorNode,
): WorkflowEditorCompileDiagnostic[] {
  const diagnostics: WorkflowEditorCompileDiagnostic[] = [];

  if (!node.kind?.trim()) {
    diagnostics.push({
      code: "missing-node-kind",
      message: `Workflow node ${node.id} has no executable kind.`,
      path: `nodes.${node.id}.kind`,
      nodeId: node.id,
    });
  }

  if (node.workflowRef) {
    diagnostics.push({
      code: "nested-workflow-not-supported",
      message: `Workflow node ${node.id} references another workflow; compiler version 1 does not inline nested workflows yet.`,
      path: `nodes.${node.id}.workflowRef`,
      nodeId: node.id,
    });
  }

  if (node.composition) {
    diagnostics.push({
      code: "composition-not-supported",
      message: `Workflow node ${node.id} contains an embedded composition; restore or flatten it before compilation.`,
      path: `nodes.${node.id}.composition`,
      nodeId: node.id,
    });
  }

  return diagnostics;
}

function topologicalOrder(document: WorkflowEditorDocument): string[] {
  const indegree = new Map<string, number>(
    document.nodes.map((node) => [node.id, 0]),
  );
  const outgoing = new Map<string, WorkflowEditorEdge[]>();

  for (const edge of document.edges) {
    indegree.set(edge.targetNodeId, (indegree.get(edge.targetNodeId) ?? 0) + 1);
    const edges = outgoing.get(edge.sourceNodeId) ?? [];
    edges.push(edge);
    outgoing.set(edge.sourceNodeId, edges);
  }

  const ready = document.nodes
    .filter((node) => indegree.get(node.id) === 0)
    .map((node) => node.id)
    .sort();
  const order: string[] = [];

  while (ready.length > 0) {
    const nodeId = ready.shift();
    if (!nodeId) break;
    order.push(nodeId);

    const edges = [...(outgoing.get(nodeId) ?? [])].sort((a, b) =>
      a.targetNodeId === b.targetNodeId
        ? a.id.localeCompare(b.id)
        : a.targetNodeId.localeCompare(b.targetNodeId),
    );
    for (const edge of edges) {
      const next = (indegree.get(edge.targetNodeId) ?? 0) - 1;
      indegree.set(edge.targetNodeId, next);
      if (next === 0) {
        ready.push(edge.targetNodeId);
        ready.sort();
      }
    }
  }

  if (order.length !== document.nodes.length) {
    throw new WorkflowEditorCompileError([
      {
        code: "invalid-dag",
        message: "Workflow compilation could not produce a complete DAG order.",
        path: "edges",
      },
    ]);
  }

  return order;
}

export function compileWorkflowEditorDocument<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
>(document: WorkflowEditorDocument<TNodeData, TEdgeData>): CompiledWorkflow<TNodeData> {
  const normalized = normalizeWorkflowEditorDocument(document, { mode: "strict" });
  const diagnostics = normalized.nodes.flatMap(validateExecutableNode);
  if (diagnostics.length > 0) {
    throw new WorkflowEditorCompileError(diagnostics);
  }

  const order = topologicalOrder(normalized);
  const nodeById = new Map(normalized.nodes.map((node) => [node.id, node] as const));
  const nodes = order.map((nodeId) => {
    const node = nodeById.get(nodeId);
    if (!node?.kind) {
      throw new WorkflowEditorCompileError([
        {
          code: "missing-node-kind",
          message: `Workflow node ${nodeId} has no executable kind.`,
          path: `nodes.${nodeId}.kind`,
          nodeId,
        },
      ]);
    }

    return {
      id: node.id,
      label: node.label,
      kind: node.kind,
      ...(node.inputs?.length ? { inputs: node.inputs.map(compilePort) } : {}),
      ...(node.outputs?.length ? { outputs: node.outputs.map(compilePort) } : {}),
      ...(node.data === undefined ? {} : { data: node.data }),
    };
  });

  const edges = [...normalized.edges]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map(({ id, sourceNodeId, sourcePortId, targetNodeId, targetPortId }) => ({
      id,
      sourceNodeId,
      sourcePortId,
      targetNodeId,
      targetPortId,
    }));

  return {
    format: compiledWorkflowFormat,
    version: compiledWorkflowVersion,
    nodes,
    edges,
    order,
  };
}
