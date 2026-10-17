import { workflowEditorTypeDefinitionsSource } from "./core-type-source";
import { analyzeWorkflowEditorPortCardinality } from "./cardinality";
import type { WorkflowEditorCardinalityPort, WorkflowEditorPortCardinality } from "./cardinality";
import {
  analyzeWorkflowEditorPortTypes,
  findWorkflowEditorPortPayloadMismatch,
  isWorkflowEditorIterationNode,
  validateWorkflowEditorIterationNode,
  workflowEditorIterationBound,
  normalizeWorkflowEditorDocument,
  workflowEditorValidationPolicies,
  resolveWorkflowEditorDocumentTypes,
  WorkflowEditorDocumentValidationError,
} from "./core";
import type {
  WorkflowEditorDocument,
  WorkflowEditorEdge,
  WorkflowEditorNode,
  WorkflowEditorPort,
  WorkflowEditorPortDefaultValue,
  WorkflowEditorPortPayload,
  WorkflowEditorPortType,
  WorkflowEditorTypeValidationOptions,
} from "./core-types";
import type { WorkflowEditorIterationDiagnosticCode } from "./core-iteration";

export const compiledWorkflowFormat = "@moritzbrantner/workflow/compiled" as const;
export const compiledWorkflowVersion = 1 as const;
/** Emitted only for documents containing bounded iteration; DAG-only documents stay version 1. */
export const compiledWorkflowIterationVersion = 2 as const;

export type CompiledWorkflowPort = {
  id: string;
  type: WorkflowEditorPortType;
  optional?: boolean;
  defaultValue?: WorkflowEditorPortDefaultValue;
  cardinality?: WorkflowEditorPortCardinality;
  payload?: WorkflowEditorPortPayload;
};

export type CompiledWorkflowNode<TData extends Record<string, unknown> = Record<string, unknown>> =
  {
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

export type CompiledWorkflowIterationBoundary = { nodeId: string; portId: string };

/**
 * A bounded loop (TECH-002). The runner runs `body` at most `maxIterations` times, feeding each
 * `next` back as `state`, and reports `converged` only when the `converged` body output is true;
 * with `limit-only` every completed run is `limit-exhausted`. `value` is always the latest state.
 */
export type CompiledWorkflowIteration<
  TData extends Record<string, unknown> = Record<string, unknown>,
> = {
  maxIterations: number;
  state: { inputPortId: "state"; type: WorkflowEditorPortType };
  stop: { kind: "body-output"; outputId: "converged" } | { kind: "limit-only" };
  candidate: "latest-state";
  result: { outputPortId: "result"; statuses: ["converged", "limit-exhausted"] };
  body: {
    nodes: CompiledWorkflowNode<TData>[];
    edges: CompiledWorkflowEdge[];
    order: string[];
    inputs: Array<CompiledWorkflowIterationBoundary & { id: string }>;
    outputs: {
      next: CompiledWorkflowIterationBoundary;
      converged?: CompiledWorkflowIterationBoundary;
    };
  };
};

export type CompiledWorkflowIterationNode<
  TData extends Record<string, unknown> = Record<string, unknown>,
> = CompiledWorkflowNode<TData> & {
  kind: "control.iterate";
  iteration: CompiledWorkflowIteration<TData>;
};

export type CompiledWorkflowV1<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
> = {
  format: typeof compiledWorkflowFormat;
  version: typeof compiledWorkflowVersion;
  nodes: CompiledWorkflowNode<TNodeData>[];
  edges: CompiledWorkflowEdge[];
  order: string[];
  typeDeclarations?: string;
};

export type CompiledWorkflowV2<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
> = Omit<CompiledWorkflowV1<TNodeData>, "version" | "nodes"> & {
  version: typeof compiledWorkflowIterationVersion;
  nodes: Array<CompiledWorkflowNode<TNodeData> | CompiledWorkflowIterationNode<TNodeData>>;
};

export type CompiledWorkflow<TNodeData extends Record<string, unknown> = Record<string, unknown>> =
  | CompiledWorkflowV1<TNodeData>
  | CompiledWorkflowV2<TNodeData>;

export type WorkflowEditorCompileDiagnosticCode =
  | "invalid-port-type"
  | "invalid-port-payload"
  | "missing-node-kind"
  | "nested-workflow-not-supported"
  | "composition-not-supported"
  | "port-cardinality"
  | "invalid-dag"
  | WorkflowEditorIterationDiagnosticCode;

export type WorkflowEditorCompileDiagnostic = {
  code: WorkflowEditorCompileDiagnosticCode;
  message: string;
  path: string;
  nodeId?: string;
  portId?: string;
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

function compareIds(left: string, right: string) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function containsNativeType(type: WorkflowEditorPortType): boolean {
  switch (type.kind) {
    case "typescript":
      return true;
    case "array":
      return containsNativeType(type.element);
    case "object":
      return Object.values(type.properties ?? {}).some((property) =>
        containsNativeType(property.type),
      );
    case "union":
    case "intersection":
      return type.types.some(containsNativeType);
    default:
      return false;
  }
}

function compilePort(port: WorkflowEditorPort): CompiledWorkflowPort {
  const cardinality = (port as WorkflowEditorCardinalityPort).cardinality;
  return {
    id: port.id,
    type: port.type,
    ...(port.optional === undefined ? {} : { optional: port.optional }),
    ...(port.defaultValue === undefined ? {} : { defaultValue: port.defaultValue }),
    ...(cardinality === undefined ? {} : { cardinality }),
    ...(port.payload === undefined ? {} : { payload: port.payload }),
  };
}

function payloadDiagnostics(document: WorkflowEditorDocument): WorkflowEditorCompileDiagnostic[] {
  const nodeById = new Map(document.nodes.map((node) => [node.id, node]));
  return document.edges.flatMap((edge) => {
    const source = nodeById
      .get(edge.sourceNodeId)
      ?.outputs?.find((port) => port.id === edge.sourcePortId);
    const target = nodeById
      .get(edge.targetNodeId)
      ?.inputs?.find((port) => port.id === edge.targetPortId);
    const mismatch = source && target && findWorkflowEditorPortPayloadMismatch(source, target);
    return mismatch
      ? [
          {
            code: "invalid-port-payload" as const,
            message: mismatch.message,
            path: `edges.${edge.id}`,
          },
        ]
      : [];
  });
}

function validateExecutableNode(
  node: WorkflowEditorNode,
  scope: CompileScope,
): WorkflowEditorCompileDiagnostic[] {
  const diagnostics: WorkflowEditorCompileDiagnostic[] = [];
  const iteration = isWorkflowEditorIterationNode(node);

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

  if (iteration && scope.inBody) {
    // The enclosing iteration already reports nested-iteration-not-supported.
    return diagnostics;
  }

  if (iteration) {
    diagnostics.push(
      ...validateWorkflowEditorIterationNode(node, scope.options).map(
        ({ code, message, path, nodeId, portId }) => ({
          code,
          message,
          path: `${scope.pathPrefix}${path}`,
          nodeId,
          ...(portId ? { portId } : {}),
        }),
      ),
    );
    if (node.composition && diagnostics.length === 0) {
      diagnostics.push(
        ...scopeDiagnostics(bodyDocument(node, scope), {
          ...scope,
          inBody: true,
          pathPrefix: `${scope.pathPrefix}nodes.${node.id}.composition.`,
        }),
      );
    }
  } else if (node.composition) {
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
  const indegree = new Map<string, number>(document.nodes.map((node) => [node.id, 0]));
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
    .sort(compareIds);
  const order: string[] = [];

  while (ready.length > 0) {
    const nodeId = ready.shift();
    if (!nodeId) break;
    order.push(nodeId);

    const edges = [...(outgoing.get(nodeId) ?? [])].sort((a, b) =>
      a.targetNodeId === b.targetNodeId
        ? compareIds(a.id, b.id)
        : compareIds(a.targetNodeId, b.targetNodeId),
    );
    for (const edge of edges) {
      const next = (indegree.get(edge.targetNodeId) ?? 0) - 1;
      indegree.set(edge.targetNodeId, next);
      if (next === 0) {
        ready.push(edge.targetNodeId);
        ready.sort(compareIds);
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
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  options: WorkflowEditorTypeValidationOptions = {},
): CompiledWorkflow<TNodeData> {
  let normalized: WorkflowEditorDocument<TNodeData, TEdgeData>;
  try {
    normalized = resolveWorkflowEditorDocumentTypes(
      normalizeWorkflowEditorDocument(document, {
        policy: workflowEditorValidationPolicies.execution,
      }).document,
      options,
    );
  } catch (error) {
    if (
      error instanceof WorkflowEditorDocumentValidationError &&
      error.diagnostics.length > 0 &&
      error.diagnostics.every((diagnostic) => diagnostic.code === "cycle")
    ) {
      throw new WorkflowEditorCompileError(
        error.diagnostics.map((diagnostic) => ({
          code: "invalid-dag",
          message: "Workflow compilation requires a directed acyclic graph.",
          path: diagnostic.path,
        })),
      );
    }
    throw error;
  }

  const scope: CompileScope = {
    options: {
      ...options,
      typeDeclarations: options.typeDeclarations ?? normalized.typeDeclarations,
    },
    pathPrefix: "",
    inBody: false,
  };
  const diagnostics = scopeDiagnostics(normalized as WorkflowEditorDocument, scope);
  if (diagnostics.length > 0) {
    throw new WorkflowEditorCompileError(diagnostics);
  }

  const compiledScope = compileScope(normalized as WorkflowEditorDocument, scope);
  const iterates = normalized.nodes.some(isWorkflowEditorIterationNode);

  return {
    format: compiledWorkflowFormat,
    version: iterates ? compiledWorkflowIterationVersion : compiledWorkflowVersion,
    ...(compiledScope as Omit<CompiledWorkflowV1<TNodeData>, "format" | "version">),
    ...(normalized.typeDeclarations === undefined &&
    options.typeDeclarations === undefined &&
    !options.typeDefinitions?.length
      ? {}
      : {
          typeDeclarations: [
            workflowEditorTypeDefinitionsSource(options.typeDefinitions ?? []),
            options.typeDeclarations ?? normalized.typeDeclarations ?? "",
          ]
            .filter(Boolean)
            .join("\n"),
        }),
  } as CompiledWorkflow<TNodeData>;
}

type CompileScope = {
  options: WorkflowEditorTypeValidationOptions;
  /** Prefix that places body diagnostics inside their iteration node. */
  pathPrefix: string;
  inBody: boolean;
};

function scopeDiagnostics(
  document: WorkflowEditorDocument,
  scope: CompileScope,
): WorkflowEditorCompileDiagnostic[] {
  const prefix = scope.pathPrefix;
  const cardinalityDiagnostics: WorkflowEditorCompileDiagnostic[] =
    analyzeWorkflowEditorPortCardinality(document).map((diagnostic) => ({
      code: "port-cardinality",
      message: diagnostic.message,
      path: `${prefix}nodes.${diagnostic.nodeId}.${diagnostic.direction === "input" ? "inputs" : "outputs"}.${diagnostic.portId}.cardinality`,
      nodeId: diagnostic.nodeId,
      portId: diagnostic.portId,
    }));
  const nativeTypes =
    scope.options.typeDeclarations !== undefined ||
    Boolean(scope.options.typeDefinitions?.length) ||
    document.nodes.some((node) =>
      [...(node.inputs ?? []), ...(node.outputs ?? [])].some((port) =>
        containsNativeType(port.type),
      ),
    );
  const typeDiagnostics: WorkflowEditorCompileDiagnostic[] = nativeTypes
    ? analyzeWorkflowEditorPortTypes(document, scope.options)
        .filter(
          (diagnostic) =>
            diagnostic.type === "incompatible-port-type" ||
            diagnostic.type === "missing-type-definition",
        )
        .map((diagnostic) => ({
          code: "invalid-port-type",
          message: diagnostic.message,
          path: diagnostic.edgeId
            ? `${prefix}edges.${diagnostic.edgeId}`
            : diagnostic.sourceNodeId
              ? `${prefix}nodes.${diagnostic.sourceNodeId}.${diagnostic.sourcePortId}`
              : "typeDeclarations",
        }))
    : [];
  return [
    ...typeDiagnostics,
    ...payloadDiagnostics(document).map((diagnostic) => ({
      ...diagnostic,
      path: `${prefix}${diagnostic.path}`,
    })),
    ...cardinalityDiagnostics,
    ...document.nodes.flatMap((node) => validateExecutableNode(node, scope)),
  ];
}

function compileScope(document: WorkflowEditorDocument, scope: CompileScope) {
  const order = topologicalOrder(document);
  const nodeById = new Map(document.nodes.map((node) => [node.id, node] as const));
  const nodes = order.map((nodeId) => {
    const node = nodeById.get(nodeId);
    if (!node?.kind) {
      throw new WorkflowEditorCompileError([
        {
          code: "missing-node-kind",
          message: `Workflow node ${nodeId} has no executable kind.`,
          path: `${scope.pathPrefix}nodes.${nodeId}.kind`,
          nodeId,
        },
      ]);
    }

    if (isWorkflowEditorIterationNode(node)) {
      return compileIterationNode(node, scope);
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

  const edges = [...document.edges]
    .sort((a, b) => compareIds(a.id, b.id))
    .map(({ id, sourceNodeId, sourcePortId, targetNodeId, targetPortId }) => ({
      id,
      sourceNodeId,
      sourcePortId,
      targetNodeId,
      targetPortId,
    }));

  return { nodes, edges, order };
}

function bodyDocument(node: WorkflowEditorNode, scope: CompileScope): WorkflowEditorDocument {
  return resolveWorkflowEditorDocumentTypes(
    {
      nodes: node.composition?.nodes ?? [],
      edges: node.composition?.edges ?? [],
      ...(scope.options.typeDeclarations === undefined
        ? {}
        : { typeDeclarations: scope.options.typeDeclarations }),
    },
    scope.options,
  );
}

function compileIterationNode(
  node: WorkflowEditorNode,
  scope: CompileScope,
): CompiledWorkflowIterationNode {
  const body = node.composition!;
  const compiledBody = compileScope(bodyDocument(node, scope), {
    ...scope,
    inBody: true,
    pathPrefix: `${scope.pathPrefix}nodes.${node.id}.composition.`,
  });
  const boundary = (id: string) => {
    const match = body.outputBoundaries.find((candidate) => candidate.wrapperPortId === id);
    return match ? { nodeId: match.nodeId, portId: match.portId } : undefined;
  };
  const next = boundary("next")!;
  const converged = boundary("converged");
  const state = node.inputs!.find((port) => port.id === "state")!;
  const { iteration: _iteration, ...data } = (node.data ?? {}) as Record<string, unknown>;

  return {
    id: node.id,
    label: node.label,
    kind: "control.iterate",
    ...(node.inputs?.length ? { inputs: node.inputs.map(compilePort) } : {}),
    ...(node.outputs?.length ? { outputs: node.outputs.map(compilePort) } : {}),
    ...(Object.keys(data).length ? { data } : {}),
    iteration: {
      maxIterations: workflowEditorIterationBound(node) as number,
      state: { inputPortId: "state", type: state.type },
      stop: converged ? { kind: "body-output", outputId: "converged" } : { kind: "limit-only" },
      candidate: "latest-state",
      result: { outputPortId: "result", statuses: ["converged", "limit-exhausted"] },
      body: {
        ...compiledBody,
        inputs: body.inputBoundaries
          .map(({ wrapperPortId, nodeId, portId }) => ({ id: wrapperPortId, nodeId, portId }))
          .sort(
            (a, b) =>
              compareIds(a.id, b.id) ||
              compareIds(a.nodeId, b.nodeId) ||
              compareIds(a.portId, b.portId),
          ),
        outputs: { next, ...(converged ? { converged } : {}) },
      },
    },
  };
}
