import { createWorkflowEditorTypeResolver } from "./core-type-resolver";
import { workflowEditorPortTypeSource } from "./core-type-source";
import type {
  WorkflowEditorDocument,
  WorkflowEditorNode,
  WorkflowEditorNodeComposition,
  WorkflowEditorPort,
  WorkflowEditorPortType,
  WorkflowEditorTypeValidationOptions,
} from "./core-types";

/**
 * Structured bounded iteration (TECH-002). The node's embedded composition is the loop body; the
 * reserved boundaries carry the state in (`state` plus invariant inputs) and the next state and
 * optional stop condition out (`next`, `converged`). Ordinary edges stay acyclic everywhere.
 */
export const workflowEditorIterationNodeKind = "control.iterate";

export const workflowEditorIterationStatePortId = "state";
export const workflowEditorIterationResultPortId = "result";
export const workflowEditorIterationNextBoundaryId = "next";
export const workflowEditorIterationConvergedBoundaryId = "converged";

export type WorkflowEditorIterationConfig = { maxIterations?: number | null };

export type WorkflowEditorIterationDiagnosticCode =
  | "iteration-bound-required"
  | "iteration-bound-invalid"
  | "iteration-body-missing"
  | "iteration-boundary-invalid"
  | "iteration-state-type"
  | "iteration-stop-type"
  /** @deprecated Nested iterations compile since #97; no longer reported. */
  | "nested-iteration-not-supported";

export type WorkflowEditorIterationDiagnostic = {
  code: WorkflowEditorIterationDiagnosticCode;
  message: string;
  path: string;
  nodeId: string;
  portId?: string;
};

export type WorkflowEditorCreateIterationNodeOptions<TNodeData = Record<string, unknown>> = {
  id: string;
  label: string;
  x: number;
  y: number;
  stateType: WorkflowEditorPortType;
  maxIterations: number;
  invariantInputs?: WorkflowEditorPort[];
  body: WorkflowEditorNodeComposition<TNodeData>;
};

export function isWorkflowEditorIterationNode<TNodeData>(node: WorkflowEditorNode<TNodeData>) {
  return node.kind === workflowEditorIterationNodeKind;
}

/** The result contract never claims convergence for a limit-exhausted run (Decision 2.8). */
export function workflowEditorIterationResultType(
  stateType: WorkflowEditorPortType,
): WorkflowEditorPortType {
  const value = workflowEditorPortTypeSource(stateType);
  const member = (status: string) =>
    `{ status: "${status}"; value: ${value}; iterations: number; maxIterations: number }`;
  return { kind: "typescript", source: `${member("converged")} | ${member("limit-exhausted")}` };
}

export function createWorkflowEditorIterationNode<TNodeData = Record<string, unknown>>(
  options: WorkflowEditorCreateIterationNodeOptions<TNodeData>,
): WorkflowEditorNode<TNodeData> {
  return {
    id: options.id,
    label: options.label,
    kind: workflowEditorIterationNodeKind,
    x: options.x,
    y: options.y,
    inputs: [
      { id: workflowEditorIterationStatePortId, label: "State", type: options.stateType },
      ...(options.invariantInputs ?? []),
    ],
    outputs: [
      {
        id: workflowEditorIterationResultPortId,
        label: "Result",
        type: workflowEditorIterationResultType(options.stateType),
      },
    ],
    data: { iteration: { maxIterations: options.maxIterations } } as TNodeData,
    composition: options.body,
  };
}

export function workflowEditorIterationBound<TNodeData>(
  node: WorkflowEditorNode<TNodeData>,
): unknown {
  const data = node.data as { iteration?: WorkflowEditorIterationConfig } | undefined;
  return data?.iteration?.maxIterations;
}

export function updateWorkflowEditorIterationBound<TNodeData, TEdgeData>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  nodeId: string,
  maxIterations: number | null,
): WorkflowEditorDocument<TNodeData, TEdgeData> {
  return updateIterationNode(document, nodeId, (node) => {
    const data = (node.data ?? {}) as Record<string, unknown>;
    const iteration = (data.iteration ?? {}) as Record<string, unknown>;
    return { ...node, data: { ...data, iteration: { ...iteration, maxIterations } } as TNodeData };
  });
}

export function updateWorkflowEditorIterationStateType<TNodeData, TEdgeData>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  nodeId: string,
  type: WorkflowEditorPortType,
): WorkflowEditorDocument<TNodeData, TEdgeData> {
  return updateIterationNode(document, nodeId, (node) =>
    syncWorkflowEditorIterationResultPort({
      ...node,
      inputs: node.inputs?.map((port) =>
        port.id === workflowEditorIterationStatePortId ? { ...port, type } : port,
      ),
    }),
  );
}

/** Keeps the generated `result` port in step with the declared state type. */
export function syncWorkflowEditorIterationResultPort<TNodeData>(
  node: WorkflowEditorNode<TNodeData>,
): WorkflowEditorNode<TNodeData> {
  const state = node.inputs?.find((port) => port.id === workflowEditorIterationStatePortId);
  if (!isWorkflowEditorIterationNode(node) || !state) {
    return node;
  }
  const type = workflowEditorIterationResultType(state.type);
  const result = node.outputs?.find((port) => port.id === workflowEditorIterationResultPortId);
  if (result && workflowEditorPortTypeSource(result.type) === workflowEditorPortTypeSource(type)) {
    return node;
  }
  return {
    ...node,
    outputs: result
      ? node.outputs?.map((port) =>
          port.id === workflowEditorIterationResultPortId ? { ...port, type } : port,
        )
      : [
          ...(node.outputs ?? []),
          { id: workflowEditorIterationResultPortId, label: "Result", type },
        ],
  };
}

export function formatWorkflowEditorIterationSummary<TNodeData>(
  node: WorkflowEditorNode<TNodeData>,
): string {
  const bound = workflowEditorIterationBound(node);
  const limit = isValidBound(bound) ? `≤ ${bound} iterations` : "No iteration bound";
  const stops = node.composition?.outputBoundaries.some(
    (boundary) => boundary.wrapperPortId === workflowEditorIterationConvergedBoundaryId,
  );
  return `${limit} · ${stops ? "until converged" : "no stop condition"}`;
}

export function validateWorkflowEditorIterationNode<TNodeData>(
  node: WorkflowEditorNode<TNodeData>,
  options: WorkflowEditorTypeValidationOptions = {},
): WorkflowEditorIterationDiagnostic[] {
  const diagnostics: WorkflowEditorIterationDiagnostic[] = [];
  const report = (
    code: WorkflowEditorIterationDiagnosticCode,
    message: string,
    path: string,
    portId?: string,
  ) =>
    diagnostics.push({
      code,
      message,
      path: `nodes.${node.id}.${path}`,
      nodeId: node.id,
      ...(portId ? { portId } : {}),
    });

  const bound = workflowEditorIterationBound(node);
  if (bound === undefined || bound === null) {
    report(
      "iteration-bound-required",
      `Maximum iterations is required for ${node.id}; unbounded repetition is not executable.`,
      "data.iteration.maxIterations",
    );
  } else if (!isValidBound(bound)) {
    report(
      "iteration-bound-invalid",
      `Maximum iterations for ${node.id} is invalid (${String(bound)}); use a whole number of at least 1.`,
      "data.iteration.maxIterations",
    );
  }

  const state = node.inputs?.find((port) => port.id === workflowEditorIterationStatePortId);
  if (!state) {
    report(
      "iteration-boundary-invalid",
      `Iteration ${node.id} has no "${workflowEditorIterationStatePortId}" input.`,
      "inputs",
    );
  }
  for (const output of node.outputs ?? []) {
    if (output.id !== workflowEditorIterationResultPortId) {
      report(
        "iteration-boundary-invalid",
        `Iteration ${node.id} may only output "${workflowEditorIterationResultPortId}", not "${output.id}".`,
        `outputs.${output.id}`,
        output.id,
      );
    }
  }

  const body = node.composition;
  const next = body?.outputBoundaries.filter(
    (boundary) => boundary.wrapperPortId === workflowEditorIterationNextBoundaryId,
  );
  if (!body || !next?.length) {
    report(
      "iteration-body-missing",
      `Iteration ${node.id} needs a body whose "${workflowEditorIterationNextBoundaryId}" output produces the next state.`,
      "composition",
    );
    return diagnostics;
  }

  const bodyNodes = new Map(body.nodes.map((bodyNode) => [bodyNode.id, bodyNode]));
  const wrapperInputs = new Set((node.inputs ?? []).map((port) => port.id));
  const bodyPort = (nodeId: string, portId: string, direction: "inputs" | "outputs") =>
    bodyNodes.get(nodeId)?.[direction]?.find((port) => port.id === portId);
  const resolver = createWorkflowEditorTypeResolver(
    options.typeDefinitions,
    options.typeDeclarations,
  );

  if (!body.inputBoundaries.some((b) => b.wrapperPortId === workflowEditorIterationStatePortId)) {
    report(
      "iteration-boundary-invalid",
      `Iteration ${node.id} body never receives the "${workflowEditorIterationStatePortId}".`,
      "composition.inputBoundaries",
    );
  }
  for (const boundary of body.inputBoundaries) {
    const target = bodyPort(boundary.nodeId, boundary.portId, "inputs");
    if (!wrapperInputs.has(boundary.wrapperPortId) || !target) {
      report(
        "iteration-boundary-invalid",
        `Iteration ${node.id} body input "${boundary.wrapperPortId}" → ${boundary.nodeId}.${boundary.portId} does not match a node input and a body port.`,
        "composition.inputBoundaries",
        boundary.wrapperPortId,
      );
    } else if (
      state &&
      boundary.wrapperPortId === workflowEditorIterationStatePortId &&
      !resolver.isAssignable(state.type, target.type)
    ) {
      report(
        "iteration-state-type",
        `Iteration ${node.id} state is not assignable to body input ${boundary.nodeId}.${boundary.portId}.`,
        "composition.inputBoundaries",
        workflowEditorIterationStatePortId,
      );
    }
  }

  for (const boundary of body.outputBoundaries) {
    const source = bodyPort(boundary.nodeId, boundary.portId, "outputs");
    const reserved =
      boundary.wrapperPortId === workflowEditorIterationNextBoundaryId ||
      boundary.wrapperPortId === workflowEditorIterationConvergedBoundaryId;
    if (!reserved || !source) {
      report(
        "iteration-boundary-invalid",
        `Iteration ${node.id} body output "${boundary.wrapperPortId}" ← ${boundary.nodeId}.${boundary.portId} must be "next" or "converged" and name a body output.`,
        "composition.outputBoundaries",
        boundary.wrapperPortId,
      );
    } else if (boundary.wrapperPortId === workflowEditorIterationNextBoundaryId) {
      if (state && !resolver.isAssignable(source.type, state.type)) {
        report(
          "iteration-state-type",
          `Iteration ${node.id} next state from ${boundary.nodeId}.${boundary.portId} is not assignable to its state type ${workflowEditorPortTypeSource(state.type)}.`,
          "composition.outputBoundaries",
          workflowEditorIterationNextBoundaryId,
        );
      }
    } else if (!resolver.isAssignable(source.type, { kind: "boolean" })) {
      report(
        "iteration-stop-type",
        `Iteration ${node.id} stop condition ${boundary.nodeId}.${boundary.portId} must be a boolean.`,
        "composition.outputBoundaries",
        workflowEditorIterationConvergedBoundaryId,
      );
    }
  }
  for (const key of ["next", "converged"]) {
    if (body.outputBoundaries.filter((boundary) => boundary.wrapperPortId === key).length > 1) {
      report(
        "iteration-boundary-invalid",
        `Iteration ${node.id} body declares more than one "${key}" output.`,
        "composition.outputBoundaries",
        key,
      );
    }
  }

  // Nested iterations are allowed (#97); each one validates its own bound and body when compiled.
  return diagnostics;
}

function isValidBound(bound: unknown): bound is number {
  return typeof bound === "number" && Number.isSafeInteger(bound) && bound >= 1;
}

function updateIterationNode<TNodeData, TEdgeData>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  nodeId: string,
  update: (node: WorkflowEditorNode<TNodeData>) => WorkflowEditorNode<TNodeData>,
): WorkflowEditorDocument<TNodeData, TEdgeData> {
  return {
    ...document,
    nodes: document.nodes.map((node) =>
      node.id === nodeId && isWorkflowEditorIterationNode(node) ? update(node) : node,
    ),
  };
}
