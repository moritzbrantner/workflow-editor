import { workflowEditorTypeDefinitionsSource } from "./core-type-source";
import { resolveWorkflowEditorLinkedNodes } from "./core-linked-templates";
import type { WorkflowEditorNodeTemplate } from "./core-types";
import {
  expandWorkflowEditorCompositions,
  type WorkflowEditorCompositionMode,
} from "./compiler-compositions";
import { findWorkflowEditorPortMinViolations } from "./core-cardinality";
import {
  analyzeWorkflowEditorPortTypes,
  findWorkflowEditorPortPayloadMismatch,
  isWorkflowEditorIterationNode,
  validateWorkflowEditorIterationNode,
  workflowEditorIterationBound,
  workflowEditorIterationMeasurements,
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
  WorkflowEditorPortCardinality,
  WorkflowEditorPortDefaultValue,
  WorkflowEditorPortPayload,
  WorkflowEditorPortType,
  WorkflowEditorTypeValidationOptions,
} from "./core-types";
import type { WorkflowEditorIterationDiagnosticCode } from "./core-iteration";
import { createWorkflowEditorTypeResolver } from "./core-type-resolver";

import {
  compileWorkflowEditorHumanTask,
  isWorkflowEditorHumanTaskNode,
  type CompiledWorkflowHumanTask,
} from "./core-human-tasks";

export {
  validateWorkflowEditorHumanTaskResponse,
  type CompiledWorkflowHumanTask,
  type WorkflowEditorHumanApprovalResponse,
  type WorkflowEditorHumanInputResponse,
} from "./core-human-tasks";

export const compiledWorkflowFormat = "@moritzbrantner/workflow/compiled" as const;
export const compiledWorkflowVersion = 1 as const;
/** Emitted only for documents containing bounded iteration; DAG-only documents stay version 1. */
export const compiledWorkflowIterationVersion = 2 as const;
/**
 * Emitted only for documents that reference other Workflow Documents (TECH-005, #95). Adds the
 * frozen `workflows` dependency closure; documents without references keep version 1 or 2.
 */
export const compiledWorkflowReferenceVersion = 3 as const;

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
    /** Present only when the authored node opts into persisting its result on completion. */
    persistence?: "on-completion";
    /** Human approval or typed-input task contract (`human.task.*` kinds, editor #105). */
    humanTask?: CompiledWorkflowHumanTask;
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
      /**
       * Named, typed values computed by body nodes (TECH-004). The runner reports the last
       * completed iteration's values in `result.measurements`; they are never a quality metric.
       */
      measurements?: Array<
        CompiledWorkflowIterationBoundary & { id: string; type: WorkflowEditorPortType }
      >;
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

/** A referenced workflow's typed boundary: `control.start` outputs and `control.end` inputs. */
export type CompiledWorkflowInterfacePort = {
  /** Port id, matched by the referencing node's port with the same id. */
  id: string;
  nodeId: string;
  portId: string;
  type: WorkflowEditorPortType;
};

/** One resolved, immutable Workflow Document in the compiled dependency closure. */
export type CompiledWorkflowDefinition<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
> = {
  /** Workflow Document id and the library version that was compiled. */
  id: string;
  version: number;
  nodes: Array<
    | CompiledWorkflowNode<TNodeData>
    | CompiledWorkflowIterationNode<TNodeData>
    | CompiledWorkflowReferenceNode<TNodeData>
  >;
  edges: CompiledWorkflowEdge[];
  order: string[];
  typeDeclarations?: string;
  interface: {
    inputs: CompiledWorkflowInterfacePort[];
    outputs: CompiledWorkflowInterfacePort[];
  };
};

/**
 * A node that runs another workflow from `workflows`. Its inputs feed the referenced workflow's
 * interface inputs with the same ids; its outputs carry the interface outputs with the same ids.
 */
export type CompiledWorkflowReferenceNode<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
> = CompiledWorkflowNode<TNodeData> & {
  workflowRef: {
    /** Key into `workflows`: `<documentId>@<version>`. */
    workflow: string;
    /** Finite re-entry bound of a recursive reference; the runner enforces it. */
    maxDepth?: number;
  };
};

export type CompiledWorkflowV3<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
> = Omit<CompiledWorkflowV1<TNodeData>, "version" | "nodes"> & {
  version: typeof compiledWorkflowReferenceVersion;
  nodes: Array<
    | CompiledWorkflowNode<TNodeData>
    | CompiledWorkflowIterationNode<TNodeData>
    | CompiledWorkflowReferenceNode<TNodeData>
  >;
  /** The frozen dependency closure, keyed `<documentId>@<version>`, each definition once. */
  workflows: Record<string, CompiledWorkflowDefinition<TNodeData>>;
};

export type CompiledWorkflow<TNodeData extends Record<string, unknown> = Record<string, unknown>> =
  | CompiledWorkflowV1<TNodeData>
  | CompiledWorkflowV2<TNodeData>
  | CompiledWorkflowV3<TNodeData>;

/** Resolves a Workflow Reference to an immutable library version at compile time. */
export type WorkflowEditorWorkflowReferenceResolver = (reference: {
  documentId: string;
}) => { id: string; version: number; document: WorkflowEditorDocument } | undefined;

export type WorkflowEditorCompileOptions = WorkflowEditorTypeValidationOptions & {
  /**
   * Enables compiling Workflow References (compiled v3). Without it, a reference is reported as
   * `nested-workflow-not-supported`.
   */
  resolveWorkflowReference?: WorkflowEditorWorkflowReferenceResolver;
  /**
   * How composed nodes compile (#19): `reject` (default) reports `composition-not-supported`,
   * `opaque` keeps each composed node as one node, `expand` inlines its embedded subgraph.
   */
  compositions?: WorkflowEditorCompositionMode;
  /**
   * The host's Node Template catalog. When given, linked shared-template nodes (#65) are resolved
   * through it first (compatible newer revisions apply), and a missing template or revision is a
   * compile error. Without it, linked nodes compile from their last resolved content.
   */
  nodeTemplates?: readonly WorkflowEditorNodeTemplate<unknown>[];
};

export type WorkflowEditorCompileDiagnosticCode =
  | "invalid-port-type"
  | "invalid-port-payload"
  | "missing-node-kind"
  | "nested-workflow-not-supported"
  | "composition-not-supported"
  | "missing-linked-template"
  | "missing-linked-template-revision"
  | "port-cardinality"
  | "invalid-dag"
  | "missing-workflow-reference"
  | "workflow-reference-interface"
  | "unbounded-recursive-reference"
  | "invalid-human-task"
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
  const cardinality = port.cardinality;
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
      path: `${scope.pathPrefix}nodes.${node.id}.kind`,
      nodeId: node.id,
    });
  }

  if (node.workflowRef && !scope.allowReferences) {
    diagnostics.push({
      code: "nested-workflow-not-supported",
      message: `Workflow node ${node.id} references another workflow; compiler version 1 does not inline nested workflows yet.`,
      path: `${scope.pathPrefix}nodes.${node.id}.workflowRef`,
      nodeId: node.id,
    });
  }

  if (isWorkflowEditorHumanTaskNode(node)) {
    const humanTask = compileWorkflowEditorHumanTask(node, scope.pathPrefix);
    if ("diagnostics" in humanTask) {
      diagnostics.push(...humanTask.diagnostics);
    }
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
  } else if (node.composition && scope.compositions !== "opaque") {
    diagnostics.push({
      code: "composition-not-supported",
      message: `Workflow node ${node.id} contains an embedded composition; restore or flatten it before compilation.`,
      path: `${scope.pathPrefix}nodes.${node.id}.composition`,
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
  options: WorkflowEditorCompileOptions = {},
): CompiledWorkflow<TNodeData> {
  const {
    resolveWorkflowReference,
    compositions = "reject",
    nodeTemplates,
    ...typeOptions
  } = options;
  if (nodeTemplates) {
    const linked = resolveWorkflowEditorLinkedNodes(
      document as unknown as WorkflowEditorDocument<unknown, unknown>,
      nodeTemplates,
    );
    if (linked.diagnostics.length > 0) {
      throw new WorkflowEditorCompileError(
        linked.diagnostics.map(({ code, message, path, nodeId }) => ({
          code,
          message,
          path,
          nodeId,
        })),
      );
    }
    document = linked.document as unknown as WorkflowEditorDocument<TNodeData, TEdgeData>;
  }
  if (resolveWorkflowReference && documentHasReferences(document)) {
    return compileWorkflowEditorReferenceClosure(
      document as unknown as WorkflowEditorDocument,
      typeOptions,
      resolveWorkflowReference,
      compositions,
    ) as unknown as CompiledWorkflow<TNodeData>;
  }
  return compileWorkflowEditorDocumentBase(document, typeOptions, false, compositions);
}

/** Whether any node, including nodes inside iteration bodies, references another workflow. */
function documentHasReferences(document: {
  nodes?: ReadonlyArray<WorkflowEditorNode<unknown> | undefined>;
}): boolean {
  return (
    Array.isArray(document.nodes) &&
    document.nodes.some(
      (node) =>
        !!node?.workflowRef?.documentId ||
        (!!node?.composition && documentHasReferences(node.composition)),
    )
  );
}

type ReferenceSite = {
  node: WorkflowEditorNode;
  compiledNode?: CompiledWorkflowReferenceNode;
  /** Authoring path prefix of the scope that holds `node`. */
  pathPrefix: string;
};

/** Reference-capable nodes paired with their compiled nodes, descending into iteration bodies. */
function referenceSites(
  nodes: readonly WorkflowEditorNode[],
  compiledNodes: readonly unknown[],
  pathPrefix: string,
): ReferenceSite[] {
  return nodes.flatMap((node) => {
    const compiledNode = compiledNodes.find(
      (candidate) => (candidate as { id?: string }).id === node.id,
    ) as
      | (CompiledWorkflowReferenceNode & { iteration?: { body?: { nodes?: unknown[] } } })
      | undefined;
    const sites: ReferenceSite[] = node.workflowRef?.documentId
      ? [{ node, compiledNode, pathPrefix }]
      : [];
    if (node.composition && isWorkflowEditorIterationNode(node)) {
      sites.push(
        ...referenceSites(
          node.composition.nodes,
          compiledNode?.iteration?.body?.nodes ?? [],
          `${pathPrefix}nodes.${node.id}.composition.`,
        ),
      );
    }
    return sites;
  });
}

function compileWorkflowEditorDocumentBase<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  options: WorkflowEditorTypeValidationOptions,
  allowReferences: boolean,
  compositions: WorkflowEditorCompositionMode = "reject",
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
    allowReferences,
    compositions,
  };
  if (compositions === "expand") {
    normalized = resolveWorkflowEditorDocumentTypes(
      expandWorkflowEditorCompositions(normalized),
      options,
    );
  }
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
  /** Workflow References, top-level or in iteration bodies, compile into the v3 closure. */
  allowReferences?: boolean;
  compositions?: WorkflowEditorCompositionMode;
};

function scopeDiagnostics(
  document: WorkflowEditorDocument,
  scope: CompileScope,
): WorkflowEditorCompileDiagnostic[] {
  const prefix = scope.pathPrefix;
  const cardinalityDiagnostics: WorkflowEditorCompileDiagnostic[] =
    findWorkflowEditorPortMinViolations(document).map((diagnostic) => ({
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
      ...compiledPersistence(node),
      ...compiledHumanTask(node),
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

function compiledHumanTask(node: WorkflowEditorNode): { humanTask?: CompiledWorkflowHumanTask } {
  if (!isWorkflowEditorHumanTaskNode(node)) return {};
  const result = compileWorkflowEditorHumanTask(node);
  return "humanTask" in result ? { humanTask: result.humanTask } : {};
}

function compiledPersistence(node: WorkflowEditorNode): { persistence?: "on-completion" } {
  return node.persistence === "on-completion" ? { persistence: "on-completion" } : {};
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
  const measurements = workflowEditorIterationMeasurements(node);
  const state = node.inputs!.find((port) => port.id === "state")!;
  const { iteration: _iteration, ...data } = (node.data ?? {}) as Record<string, unknown>;

  return {
    id: node.id,
    label: node.label,
    kind: "control.iterate",
    ...(node.inputs?.length ? { inputs: node.inputs.map(compilePort) } : {}),
    ...(node.outputs?.length ? { outputs: node.outputs.map(compilePort) } : {}),
    ...(Object.keys(data).length ? { data } : {}),
    ...compiledPersistence(node),
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
        outputs: {
          next,
          ...(converged ? { converged } : {}),
          ...(measurements.length ? { measurements } : {}),
        },
      },
    },
  };
}

export {
  expandWorkflowEditorCompositions,
  type WorkflowEditorCompositionMode,
} from "./compiler-compositions";

export {
  createCompiledWorkflowReport,
  createCompiledWorkflowSourceMap,
  fingerprintCompiledWorkflow,
  getCompiledWorkflowStages,
  serializeCompiledWorkflow,
  type WorkflowEditorCompiledSource,
  type WorkflowEditorCompiledSourceMap,
  type WorkflowEditorCompiledWorkflowReport,
} from "./compiler-report";

type ReferenceEdge = { from: string; to: string; bounded: boolean; nodeId: string; path: string };

const rootWorkflowKey = "<root>";

/**
 * Compiles a document whose top-level nodes reference other Workflow Documents (TECH-005). Every
 * referenced definition is resolved once, frozen by `<id>@<version>` and compiled with its own
 * types; recursive reference cycles need a finite `maxDepth` on one of their references.
 */
function compileWorkflowEditorReferenceClosure(
  root: WorkflowEditorDocument,
  options: WorkflowEditorTypeValidationOptions,
  resolve: WorkflowEditorWorkflowReferenceResolver,
  compositions: WorkflowEditorCompositionMode = "reject",
): CompiledWorkflowV3 {
  const diagnostics: WorkflowEditorCompileDiagnostic[] = [];
  const workflows = new Map<string, CompiledWorkflowDefinition | null>();
  const referenceEdges: ReferenceEdge[] = [];

  const compileOne = (
    document: WorkflowEditorDocument,
    key: string,
    pathPrefix: string,
  ): CompiledWorkflow | undefined => {
    let compiled: CompiledWorkflow;
    try {
      compiled = compileWorkflowEditorDocumentBase(document, options, true, compositions);
    } catch (error) {
      if (error instanceof WorkflowEditorCompileError) {
        diagnostics.push(
          ...error.diagnostics.map((diagnostic) => ({
            ...diagnostic,
            path: `${pathPrefix}${diagnostic.path}`,
          })),
        );
        return undefined;
      }
      throw error;
    }

    const declarations = document.typeDeclarations;
    const sitesDocument =
      compositions === "expand" ? expandWorkflowEditorCompositions(document) : document;
    for (const site of referenceSites(sitesDocument.nodes, compiled.nodes, pathPrefix)) {
      const { node } = site;
      const reference = node.workflowRef!;
      const path = `${site.pathPrefix}nodes.${node.id}.workflowRef`;
      const target = resolve({ documentId: reference.documentId });
      if (!target) {
        diagnostics.push({
          code: "missing-workflow-reference",
          message: `Workflow node ${node.id} references missing workflow "${reference.documentId}".`,
          path,
          nodeId: node.id,
        });
        continue;
      }
      const targetKey = `${target.id}@${target.version}`;
      referenceEdges.push({
        from: key,
        to: targetKey,
        bounded: typeof reference.maxDepth === "number" && reference.maxDepth > 0,
        nodeId: node.id,
        path,
      });
      const targetInterface = workflowInterface(target.document);
      diagnostics.push(
        ...referenceInterfaceDiagnostics(node, targetInterface, target, {
          typeDefinitions: options.typeDefinitions,
          typeDeclarations: [declarations, target.document.typeDeclarations]
            .filter(Boolean)
            .join("\n"),
          path: `${site.pathPrefix}nodes.${node.id}`,
        }),
      );
      const compiledNode = site.compiledNode;
      if (compiledNode) {
        compiledNode.workflowRef = {
          workflow: targetKey,
          ...(typeof reference.maxDepth === "number" ? { maxDepth: reference.maxDepth } : {}),
        };
      }
      if (!workflows.has(targetKey)) {
        workflows.set(targetKey, null);
        const definition = compileOne(target.document, targetKey, `workflows.${targetKey}.`);
        if (definition) {
          const { format: _format, version: _version, ...rest } = definition;
          workflows.set(targetKey, {
            id: target.id,
            version: target.version,
            ...(rest as Omit<CompiledWorkflowDefinition, "id" | "version" | "interface">),
            interface: targetInterface,
          });
        }
      }
    }
    return compiled;
  };

  const compiledRoot = compileOne(root, rootWorkflowKey, "");
  diagnostics.push(...unboundedReferenceCycles(referenceEdges));
  if (diagnostics.length > 0 || !compiledRoot) {
    throw new WorkflowEditorCompileError(diagnostics);
  }

  const { format, version: _version, ...rootRest } = compiledRoot;
  return {
    format,
    version: compiledWorkflowReferenceVersion,
    ...(rootRest as Omit<CompiledWorkflowV3, "format" | "version" | "workflows">),
    workflows: Object.fromEntries(
      [...workflows.entries()]
        .filter((entry): entry is [string, CompiledWorkflowDefinition] => entry[1] !== null)
        .sort(([a], [b]) => compareIds(a, b)),
    ),
  };
}

function workflowInterface(
  document: WorkflowEditorDocument,
): CompiledWorkflowDefinition["interface"] {
  const collect = (kind: string, side: "inputs" | "outputs") =>
    document.nodes
      .filter((node) => node.kind === kind)
      .flatMap((node) =>
        (node[side] ?? []).map((port) => ({
          id: port.id,
          nodeId: node.id,
          portId: port.id,
          type: port.type,
        })),
      )
      .sort((a, b) => compareIds(a.id, b.id) || compareIds(a.nodeId, b.nodeId));
  return { inputs: collect("control.start", "outputs"), outputs: collect("control.end", "inputs") };
}

function referenceInterfaceDiagnostics(
  node: WorkflowEditorNode,
  targetInterface: CompiledWorkflowDefinition["interface"],
  target: { id: string },
  options: {
    typeDefinitions?: WorkflowEditorTypeValidationOptions["typeDefinitions"];
    typeDeclarations: string;
    path: string;
  },
): WorkflowEditorCompileDiagnostic[] {
  const resolver = createWorkflowEditorTypeResolver(
    options.typeDefinitions,
    options.typeDeclarations,
  );
  const diagnostics: WorkflowEditorCompileDiagnostic[] = [];
  const mismatch = (portId: string, side: "inputs" | "outputs", message: string) =>
    diagnostics.push({
      code: "workflow-reference-interface",
      message: `Workflow node ${node.id} → "${target.id}": ${message}`,
      path: `${options.path}.${side}.${portId}`,
      nodeId: node.id,
      portId,
    });

  for (const [side, interfacePorts, direction] of [
    ["inputs", targetInterface.inputs, "in"],
    ["outputs", targetInterface.outputs, "out"],
  ] as const) {
    const nodePorts = node[side] ?? [];
    const duplicates = interfacePorts.filter(
      (port, index) => interfacePorts.findIndex((other) => other.id === port.id) !== index,
    );
    for (const duplicate of duplicates) {
      mismatch(
        duplicate.id,
        side,
        `the referenced workflow declares ${side === "inputs" ? "input" : "output"} "${duplicate.id}" more than once.`,
      );
    }
    for (const port of nodePorts) {
      const match = interfacePorts.find((candidate) => candidate.id === port.id);
      if (!match) {
        mismatch(
          port.id,
          side,
          `the referenced workflow has no ${side === "inputs" ? "control.start output" : "control.end input"} "${port.id}".`,
        );
        continue;
      }
      const assignable =
        direction === "in"
          ? resolver.isAssignable(port.type, match.type)
          : resolver.isAssignable(match.type, port.type);
      if (!assignable) {
        mismatch(port.id, side, `port "${port.id}" has an incompatible type.`);
      }
    }
    for (const port of interfacePorts) {
      if (!nodePorts.some((candidate) => candidate.id === port.id) && side === "inputs") {
        mismatch(port.id, side, `the referenced workflow input "${port.id}" is not provided.`);
      }
    }
  }
  return diagnostics;
}

/** Reference cycles where no reference declares a finite `maxDepth`. */
function unboundedReferenceCycles(edges: ReferenceEdge[]): WorkflowEditorCompileDiagnostic[] {
  const outgoing = new Map<string, ReferenceEdge[]>();
  for (const edge of edges) {
    outgoing.set(edge.from, [...(outgoing.get(edge.from) ?? []), edge]);
  }
  const diagnostics: WorkflowEditorCompileDiagnostic[] = [];
  const visited = new Set<string>();
  const visit = (key: string, path: ReferenceEdge[]) => {
    visited.add(key);
    for (const edge of outgoing.get(key) ?? []) {
      const start = path.findIndex((step) => step.from === edge.to);
      if (start !== -1 || edge.to === key) {
        const cycle = edge.to === key && start === -1 ? [edge] : [...path.slice(start), edge];
        if (!cycle.some((step) => step.bounded)) {
          diagnostics.push({
            code: "unbounded-recursive-reference",
            message: `Recursive workflow reference ${[...cycle.map((step) => step.from), edge.to].join(" → ")} has no finite maxDepth bound.`,
            path: edge.path,
            nodeId: edge.nodeId,
          });
        }
        continue;
      }
      if (!visited.has(edge.to)) {
        visit(edge.to, [...path, edge]);
      }
    }
  };
  visit(rootWorkflowKey, []);
  return diagnostics;
}
