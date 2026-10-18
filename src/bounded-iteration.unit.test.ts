import { readFileSync } from "node:fs";
import { resolve } from "node:path";
// Independent acceptance for issue #64 (TECH-002, Decisions 2.1 / 2.6 / 2.8): bounded iteration
// nodes. Authored before implementation from the issue's "Selection and first-slice contract".
//
// New public symbols are read through namespace imports and cast, so a missing export fails the
// affected test at runtime instead of breaking the typecheck of the whole test run.
import { describe, expect, test } from "vitest";

import * as compilerApi from "./compiler";
import { compileWorkflowEditorDocument, WorkflowEditorCompileError } from "./compiler";
import * as coreApi from "./core";
import {
  isWorkflowEditorPortTypeAssignable,
  normalizeWorkflowEditorDocument,
  validateWorkflowEditorConnection,
  WorkflowEditorDocumentValidationError,
} from "./core";
import type {
  WorkflowEditorDocument,
  WorkflowEditorNode,
  WorkflowEditorNodeComposition,
  WorkflowEditorPort,
  WorkflowEditorPortType,
} from "./core-types";
import * as indexApi from "./index";
import { buildWorkflowEditorDocumentFile, restoreWorkflowEditorDocumentFile } from "./persistence";

type IterationDiagnostic = {
  code: string;
  message: string;
  path: string;
  nodeId: string;
  portId?: string;
};

type IterationApi = {
  workflowEditorIterationNodeKind: string;
  createWorkflowEditorIterationNode: (options: {
    id: string;
    label: string;
    x: number;
    y: number;
    stateType: WorkflowEditorPortType;
    maxIterations: number;
    invariantInputs?: WorkflowEditorPort[];
    body: WorkflowEditorNodeComposition;
  }) => WorkflowEditorNode;
  isWorkflowEditorIterationNode: (node: WorkflowEditorNode) => boolean;
  workflowEditorIterationResultType: (stateType: WorkflowEditorPortType) => WorkflowEditorPortType;
  updateWorkflowEditorIterationBound: (
    document: WorkflowEditorDocument,
    nodeId: string,
    maxIterations: number | null,
  ) => WorkflowEditorDocument;
  updateWorkflowEditorIterationStateType: (
    document: WorkflowEditorDocument,
    nodeId: string,
    type: WorkflowEditorPortType,
  ) => WorkflowEditorDocument;
  formatWorkflowEditorIterationSummary: (node: WorkflowEditorNode) => string;
  validateWorkflowEditorIterationNode: (
    node: WorkflowEditorNode,
    options?: unknown,
  ) => IterationDiagnostic[];
};

const api = indexApi as unknown as IterationApi;
const core = coreApi as unknown as IterationApi;
const compiler = compilerApi as unknown as { compiledWorkflowIterationVersion?: number };

const iterationSymbols = [
  "workflowEditorIterationNodeKind",
  "createWorkflowEditorIterationNode",
  "isWorkflowEditorIterationNode",
  "workflowEditorIterationResultType",
  "updateWorkflowEditorIterationBound",
  "updateWorkflowEditorIterationStateType",
  "formatWorkflowEditorIterationSummary",
  "validateWorkflowEditorIterationNode",
] as const;

const ts = (source: string): WorkflowEditorPortType => ({ kind: "typescript", source });
const numberState = ts("number");

// Fallback used only to build literal documents before the feature exists, so normalization and
// persistence tests fail on their assertions rather than on a missing helper.
function resultType(stateType: WorkflowEditorPortType): WorkflowEditorPortType {
  if (typeof api.workflowEditorIterationResultType === "function") {
    return api.workflowEditorIterationResultType(stateType);
  }
  const value = stateType.kind === "typescript" ? stateType.source : "unknown";
  return ts(
    `{ status: "converged"; value: ${value}; iterations: number; maxIterations: number } | { status: "limit-exhausted"; value: ${value}; iterations: number; maxIterations: number }`,
  );
}

function newtonBody(): WorkflowEditorNodeComposition {
  return {
    nodes: [
      {
        id: "newton-step",
        label: "Newton step",
        kind: "math.sqrt.newtonStep",
        x: 0,
        y: 0,
        inputs: [
          { id: "estimate", label: "Estimate", type: { kind: "number" } },
          { id: "target", label: "Target", type: { kind: "number" } },
        ],
        outputs: [{ id: "next", label: "Next", type: { kind: "number" } }],
      },
      {
        id: "within-tolerance",
        label: "Within tolerance",
        kind: "math.compare.withinTolerance",
        x: 240,
        y: 0,
        inputs: [
          { id: "previous", label: "Previous", type: { kind: "number" } },
          { id: "next", label: "Next", type: { kind: "number" } },
        ],
        outputs: [{ id: "converged", label: "Converged", type: { kind: "boolean" } }],
        data: { tolerance: 1e-9 },
      },
    ],
    edges: [
      {
        id: "step-next",
        sourceNodeId: "newton-step",
        sourcePortId: "next",
        targetNodeId: "within-tolerance",
        targetPortId: "next",
      },
    ],
    inputBoundaries: [
      { wrapperPortId: "state", nodeId: "newton-step", portId: "estimate" },
      { wrapperPortId: "state", nodeId: "within-tolerance", portId: "previous" },
      { wrapperPortId: "target", nodeId: "newton-step", portId: "target" },
    ],
    outputBoundaries: [
      { wrapperPortId: "next", nodeId: "newton-step", portId: "next" },
      { wrapperPortId: "converged", nodeId: "within-tolerance", portId: "converged" },
    ],
  };
}

const targetInvariant: WorkflowEditorPort = {
  id: "target",
  label: "Target",
  type: { kind: "number" },
};

function literalIterationNode(
  overrides: Partial<WorkflowEditorNode> & { maxIterations?: unknown } = {},
): WorkflowEditorNode {
  const { maxIterations = 10, ...rest } = overrides;
  return {
    id: "refine",
    label: "Refine square root",
    kind: "control.iterate",
    x: 240,
    y: 0,
    inputs: [{ id: "state", label: "State", type: numberState }, targetInvariant],
    outputs: [{ id: "result", label: "Result", type: resultType(numberState) }],
    data: { iteration: { maxIterations } } as Record<string, unknown>,
    composition: newtonBody(),
    ...rest,
  };
}

function newtonDocument(node: WorkflowEditorNode = literalIterationNode()): WorkflowEditorDocument {
  return {
    nodes: [
      {
        id: "target",
        label: "Target",
        kind: "json.number",
        x: 0,
        y: 0,
        outputs: [{ id: "value", label: "Value", type: { kind: "number" } }],
        data: { value: 2, sourceName: "numberValue" },
      },
      {
        id: "initial-guess",
        label: "Initial guess",
        kind: "json.number",
        x: 0,
        y: 160,
        outputs: [{ id: "value", label: "Value", type: { kind: "number" } }],
        data: { value: 1, sourceName: "numberValue" },
      },
      node,
      {
        id: "approximation",
        label: "Approximation",
        kind: "control.end",
        x: 520,
        y: 0,
        inputs: [{ id: "in", label: "In", type: ts("unknown") }],
      },
    ],
    edges: [
      {
        id: "guess-state",
        sourceNodeId: "initial-guess",
        sourcePortId: "value",
        targetNodeId: "refine",
        targetPortId: "state",
      },
      {
        id: "target-invariant",
        sourceNodeId: "target",
        sourcePortId: "value",
        targetNodeId: "refine",
        targetPortId: "target",
      },
      {
        id: "refine-approximation",
        sourceNodeId: "refine",
        sourcePortId: "result",
        targetNodeId: "approximation",
        targetPortId: "in",
      },
    ],
  };
}

function createNewtonNode(overrides: { maxIterations?: number } = {}) {
  return api.createWorkflowEditorIterationNode({
    id: "refine",
    label: "Refine square root",
    x: 240,
    y: 0,
    stateType: numberState,
    maxIterations: overrides.maxIterations ?? 10,
    invariantInputs: [targetInvariant],
    body: newtonBody(),
  });
}

function iterationNodeOf(document: WorkflowEditorDocument) {
  const node = document.nodes.find((candidate) => candidate.id === "refine");
  expect(node, "iteration node refine").toBeDefined();
  return node!;
}

function maxIterationsOf(node: WorkflowEditorNode) {
  return (node.data as { iteration?: { maxIterations?: unknown } } | undefined)?.iteration
    ?.maxIterations;
}

function codes(diagnostics: readonly { code: string }[]) {
  return diagnostics.map((diagnostic) => diagnostic.code);
}

describe("bounded iteration public API", () => {
  test.each(iterationSymbols)("exports %s from the package root and core", (name) => {
    expect((indexApi as Record<string, unknown>)[name], `index.${name}`).toBeDefined();
    expect((coreApi as Record<string, unknown>)[name], `core.${name}`).toBeDefined();
    expect((coreApi as Record<string, unknown>)[name]).toBe(
      (indexApi as Record<string, unknown>)[name],
    );
  });

  test("names the iteration node kind control.iterate", () => {
    expect(api.workflowEditorIterationNodeKind).toBe("control.iterate");
    expect(core.workflowEditorIterationNodeKind).toBe("control.iterate");
  });

  test("compiler exports compiled v2 for iteration without changing compiled v1", () => {
    expect(compiler.compiledWorkflowIterationVersion).toBe(2);
    expect(compilerApi.compiledWorkflowVersion).toBe(1);
  });
});

describe("creating an iteration node", () => {
  test("creates a control.iterate node with state, invariant inputs, result and body", () => {
    const body = newtonBody();
    const node = api.createWorkflowEditorIterationNode({
      id: "refine",
      label: "Refine square root",
      x: 240,
      y: 16,
      stateType: numberState,
      maxIterations: 10,
      invariantInputs: [targetInvariant],
      body,
    });

    expect(node.id).toBe("refine");
    expect(node.label).toBe("Refine square root");
    expect(node.kind).toBe("control.iterate");
    expect([node.x, node.y]).toEqual([240, 16]);
    expect(maxIterationsOf(node)).toBe(10);
    expect(node.inputs?.map((port) => port.id)).toEqual(["state", "target"]);
    expect(node.inputs?.[0]?.type).toEqual(numberState);
    expect(node.inputs?.[1]?.type).toEqual({ kind: "number" });
    expect(node.outputs?.map((port) => port.id)).toEqual(["result"]);
    expect(node.outputs?.[0]?.type).toEqual(api.workflowEditorIterationResultType(numberState));
    expect(node.composition).toEqual(newtonBody());
    expect(api.isWorkflowEditorIterationNode(node)).toBe(true);
  });

  test("creates a node without invariant inputs", () => {
    const body = newtonBody();
    body.inputBoundaries = body.inputBoundaries.filter((b) => b.wrapperPortId === "state");
    const node = api.createWorkflowEditorIterationNode({
      id: "loop",
      label: "Loop",
      x: 0,
      y: 0,
      stateType: numberState,
      maxIterations: 3,
      body,
    });
    expect(node.inputs?.map((port) => port.id)).toEqual(["state"]);
    expect(maxIterationsOf(node)).toBe(3);
  });

  test("recognizes only iteration nodes", () => {
    expect(api.isWorkflowEditorIterationNode(literalIterationNode())).toBe(true);
    expect(
      api.isWorkflowEditorIterationNode({
        id: "plain",
        label: "Plain",
        kind: "json.number",
        x: 0,
        y: 0,
      }),
    ).toBe(false);
  });
});

describe("iteration result type", () => {
  const status = '"converged" | "limit-exhausted"';

  test("is a native TypeScript type", () => {
    expect(api.workflowEditorIterationResultType(numberState).kind).toBe("typescript");
  });

  test("is a union over converged and limit-exhausted carrying value, iterations and maxIterations", () => {
    const result = api.workflowEditorIterationResultType(numberState);
    expect(
      isWorkflowEditorPortTypeAssignable(
        result,
        ts(`{ status: ${status}; value: number; iterations: number; maxIterations: number }`),
      ),
    ).toBe(true);
    // limit-exhausted is a member: the result does not always claim convergence.
    expect(
      isWorkflowEditorPortTypeAssignable(
        result,
        ts('{ status: "converged"; value: number; iterations: number; maxIterations: number }'),
      ),
    ).toBe(false);
    expect(
      isWorkflowEditorPortTypeAssignable(
        result,
        ts(
          '{ status: "limit-exhausted"; value: number; iterations: number; maxIterations: number }',
        ),
      ),
    ).toBe(false);
    // Both statuses are constructible members of the union.
    for (const member of ["converged", "limit-exhausted"]) {
      expect(
        isWorkflowEditorPortTypeAssignable(
          ts(`{ status: "${member}"; value: number; iterations: number; maxIterations: number }`),
          result,
        ),
        member,
      ).toBe(true);
    }
  });

  test("carries the state type as value", () => {
    expect(
      isWorkflowEditorPortTypeAssignable(
        api.workflowEditorIterationResultType(numberState),
        ts(`{ status: ${status}; value: string; iterations: number; maxIterations: number }`),
      ),
    ).toBe(false);
    expect(
      isWorkflowEditorPortTypeAssignable(
        api.workflowEditorIterationResultType(ts("string")),
        ts(`{ status: ${status}; value: string; iterations: number; maxIterations: number }`),
      ),
    ).toBe(true);
  });
});

describe("iteration commands", () => {
  test("updates the bound in a new document", () => {
    const document = newtonDocument(createNewtonNode());
    const before = structuredClone(document);

    const next = api.updateWorkflowEditorIterationBound(document, "refine", 25);

    expect(next).not.toBe(document);
    expect(document).toEqual(before);
    expect(maxIterationsOf(iterationNodeOf(next))).toBe(25);
  });

  test("clearing the bound leaves a node the validator rejects as bound-required", () => {
    const next = api.updateWorkflowEditorIterationBound(
      newtonDocument(createNewtonNode()),
      "refine",
      null,
    );
    const node = iterationNodeOf(next);
    expect(maxIterationsOf(node) ?? null).toBeNull();
    expect(codes(api.validateWorkflowEditorIterationNode(node))).toContain(
      "iteration-bound-required",
    );
  });

  test("updates the state type and the result type follows it", () => {
    const document = newtonDocument(createNewtonNode());
    const before = structuredClone(document);

    const next = api.updateWorkflowEditorIterationStateType(document, "refine", ts("string"));
    const node = iterationNodeOf(next);

    expect(document).toEqual(before);
    expect(node.inputs?.find((port) => port.id === "state")?.type).toEqual(ts("string"));
    expect(node.outputs?.find((port) => port.id === "result")?.type).toEqual(
      api.workflowEditorIterationResultType(ts("string")),
    );
    // The body still produces numbers, so the state contract is now violated.
    expect(codes(api.validateWorkflowEditorIterationNode(node))).toContain("iteration-state-type");
  });
});

describe("iteration summary", () => {
  test("names the bound and the convergence stop condition", () => {
    expect(api.formatWorkflowEditorIterationSummary(createNewtonNode())).toBe(
      "≤ 10 iterations · until converged",
    );
  });

  test("states when the body has no stop condition", () => {
    const node = createNewtonNode();
    node.composition!.outputBoundaries = node.composition!.outputBoundaries.filter(
      (boundary) => boundary.wrapperPortId !== "converged",
    );
    expect(api.formatWorkflowEditorIterationSummary(node)).toBe(
      "≤ 10 iterations · no stop condition",
    );
  });
});

describe("iteration validation", () => {
  test("accepts the Newton square-root node", () => {
    expect(api.validateWorkflowEditorIterationNode(createNewtonNode())).toEqual([]);
    expect(api.validateWorkflowEditorIterationNode(literalIterationNode())).toEqual([]);
  });

  test("accepts a body without a stop condition (limit-only)", () => {
    const node = literalIterationNode();
    node.composition!.outputBoundaries = node.composition!.outputBoundaries.filter(
      (boundary) => boundary.wrapperPortId === "next",
    );
    expect(api.validateWorkflowEditorIterationNode(node)).toEqual([]);
  });

  test("requires a bound", () => {
    const withoutBound = literalIterationNode({ data: { iteration: {} } });
    const nullBound = literalIterationNode({ maxIterations: null });
    const withoutData = literalIterationNode({ data: undefined });
    for (const node of [withoutBound, nullBound, withoutData]) {
      const diagnostics = api.validateWorkflowEditorIterationNode(node);
      expect(codes(diagnostics)).toContain("iteration-bound-required");
      const diagnostic = diagnostics.find((d) => d.code === "iteration-bound-required")!;
      expect(diagnostic.nodeId).toBe("refine");
      expect(diagnostic.message).toMatch(/maximum iterations|bound/i);
      expect(typeof diagnostic.path).toBe("string");
    }
  });

  test.each([0, -1, 1.5, Number.POSITIVE_INFINITY, Number.NaN])(
    "rejects the bound %s as invalid",
    (maxIterations) => {
      const diagnostics = api.validateWorkflowEditorIterationNode(
        literalIterationNode({ maxIterations }),
      );
      expect(codes(diagnostics)).toContain("iteration-bound-invalid");
      expect(codes(diagnostics)).not.toContain("iteration-bound-required");
    },
  );

  test("accepts a bound of exactly 1", () => {
    expect(
      api.validateWorkflowEditorIterationNode(literalIterationNode({ maxIterations: 1 })),
    ).toEqual([]);
  });

  test("requires a body", () => {
    const node = literalIterationNode({ composition: undefined });
    expect(codes(api.validateWorkflowEditorIterationNode(node))).toContain(
      "iteration-body-missing",
    );
  });

  test("requires a next output boundary", () => {
    const node = literalIterationNode();
    node.composition!.outputBoundaries = node.composition!.outputBoundaries.filter(
      (boundary) => boundary.wrapperPortId !== "next",
    );
    expect(codes(api.validateWorkflowEditorIterationNode(node))).toContain(
      "iteration-body-missing",
    );
  });

  test("rejects an input boundary naming an unknown wrapper input", () => {
    const node = literalIterationNode();
    node.composition!.inputBoundaries.push({
      wrapperPortId: "missing",
      nodeId: "newton-step",
      portId: "target",
    });
    expect(codes(api.validateWorkflowEditorIterationNode(node))).toContain(
      "iteration-boundary-invalid",
    );
  });

  test("rejects an output boundary whose name is not a measurement identifier", () => {
    const node = literalIterationNode();
    node.composition!.outputBoundaries.push({
      wrapperPortId: "bad name",
      nodeId: "newton-step",
      portId: "next",
    });
    expect(codes(api.validateWorkflowEditorIterationNode(node))).toContain(
      "iteration-boundary-invalid",
    );
  });

  test("accepts named measurements and compiles them with a typed result (TECH-004)", () => {
    const node = literalIterationNode();
    node.composition!.outputBoundaries.push({
      wrapperPortId: "estimate",
      nodeId: "newton-step",
      portId: "next",
    });
    expect(codes(api.validateWorkflowEditorIterationNode(node))).toEqual([]);
    expect(coreApi.workflowEditorIterationMeasurements(node)).toEqual([
      { id: "estimate", nodeId: "newton-step", portId: "next", type: { kind: "number" } },
    ]);
    const synced = coreApi.syncWorkflowEditorIterationResultPort(node);
    expect(synced.outputs?.find((port) => port.id === "result")?.type).toEqual({
      kind: "typescript",
      source:
        '{ status: "converged"; value: number; iterations: number; maxIterations: number; measurements: { estimate: number } } | { status: "limit-exhausted"; value: number; iterations: number; maxIterations: number; measurements: { estimate: number } }',
    });

    const compiled = compileWorkflowEditorDocument(newtonDocument(synced));
    const iteration = compiled.nodes.find((candidate) => candidate.id === "refine") as {
      iteration: { body: { outputs: { measurements?: unknown } } };
    };
    expect(iteration.iteration.body.outputs.measurements).toEqual([
      { id: "estimate", nodeId: "newton-step", portId: "next", type: { kind: "number" } },
    ]);
    expect(compiled).toEqual(
      JSON.parse(
        readFileSync(
          resolve(process.cwd(), "fixtures/compiled-v2-bounded-iteration-measurements.json"),
          "utf8",
        ),
      ),
    );
    // Without measurements the compiled v2 contract is unchanged.
    const plain = compileWorkflowEditorDocument(newtonDocument()).nodes.find(
      (candidate) => candidate.id === "refine",
    ) as { iteration: { body: { outputs: object } } };
    expect(plain.iteration.body.outputs).not.toHaveProperty("measurements");
  });

  test("rejects duplicate measurement names", () => {
    const node = literalIterationNode();
    node.composition!.outputBoundaries.push(
      { wrapperPortId: "estimate", nodeId: "newton-step", portId: "next" },
      { wrapperPortId: "estimate", nodeId: "newton-step", portId: "next" },
    );
    expect(codes(api.validateWorkflowEditorIterationNode(node))).toContain(
      "iteration-boundary-invalid",
    );
  });

  test("rejects a boundary pointing at a missing body port", () => {
    const node = literalIterationNode();
    node.composition!.outputBoundaries[0] = {
      wrapperPortId: "next",
      nodeId: "newton-step",
      portId: "does-not-exist",
    };
    expect(codes(api.validateWorkflowEditorIterationNode(node))).toContain(
      "iteration-boundary-invalid",
    );
  });

  test("rejects a next output that is not assignable to the state type", () => {
    const node = literalIterationNode();
    node.composition!.nodes[0]!.outputs = [{ id: "next", label: "Next", type: ts("string") }];
    const diagnostics = api.validateWorkflowEditorIterationNode(node);
    expect(codes(diagnostics)).toContain("iteration-state-type");
    expect(diagnostics.find((d) => d.code === "iteration-state-type")?.nodeId).toBe("refine");
  });

  test("rejects a converged output that is not boolean", () => {
    const node = literalIterationNode();
    node.composition!.nodes[1]!.outputs = [
      { id: "converged", label: "Converged", type: { kind: "number" } },
    ];
    expect(codes(api.validateWorkflowEditorIterationNode(node))).toContain("iteration-stop-type");
  });

  test("rejects an iteration node nested in a body", () => {
    const node = literalIterationNode();
    const inner = literalIterationNode({ id: "inner", label: "Inner" });
    node.composition!.nodes.push(inner);
    expect(codes(api.validateWorkflowEditorIterationNode(node))).toContain(
      "nested-iteration-not-supported",
    );
  });
});

describe("iteration documents: normalization and persistence", () => {
  test("keeps a document with a missing or invalid bound loadable", () => {
    const variants: WorkflowEditorNode[] = [
      // Missing bound: `maxIterations: undefined` would hit literalIterationNode's default of 10.
      literalIterationNode({ data: { iteration: {} } }),
      ...[null, 0, 1.5].map((maxIterations) => literalIterationNode({ maxIterations })),
    ];
    for (const iterationNode of variants) {
      const document = newtonDocument(iterationNode);
      const normalized = normalizeWorkflowEditorDocument(document).document;
      const node = iterationNodeOf(normalized);
      expect(node.kind).toBe("control.iterate");
      expect(node.composition).toEqual(newtonBody());
      expect(api.validateWorkflowEditorIterationNode(node).length).toBeGreaterThan(0);
    }
  });

  test("rejects a cyclic iteration body instead of silently repairing it", () => {
    const node = literalIterationNode();
    node.composition!.nodes[0]!.inputs!.push({
      id: "feedback",
      label: "Feedback",
      type: { kind: "number" },
      optional: true,
    });
    node.composition!.nodes[1]!.outputs!.push({
      id: "delta",
      label: "Delta",
      type: { kind: "number" },
    });
    node.composition!.edges.push({
      id: "feedback-cycle",
      sourceNodeId: "within-tolerance",
      sourcePortId: "delta",
      targetNodeId: "newton-step",
      targetPortId: "feedback",
    });
    const document = newtonDocument(node);

    expect(() => normalizeWorkflowEditorDocument(document).document).toThrow(
      WorkflowEditorDocumentValidationError,
    );
  });

  test("still rejects ordinary top-level cycles", () => {
    const document: WorkflowEditorDocument = {
      nodes: [
        {
          id: "a",
          label: "A",
          kind: "step",
          x: 0,
          y: 0,
          inputs: [{ id: "in", type: { kind: "number" } }],
          outputs: [{ id: "out", type: { kind: "number" } }],
        },
        {
          id: "b",
          label: "B",
          kind: "step",
          x: 200,
          y: 0,
          inputs: [{ id: "in", type: { kind: "number" } }],
          outputs: [{ id: "out", type: { kind: "number" } }],
        },
      ],
      edges: [
        { id: "ab", sourceNodeId: "a", sourcePortId: "out", targetNodeId: "b", targetPortId: "in" },
      ],
    };
    const validity = validateWorkflowEditorConnection(document, {
      sourceNodeId: "b",
      sourcePortId: "out",
      targetNodeId: "a",
      targetPortId: "in",
    }) as { valid: boolean; reason?: string };
    expect(validity.valid).toBe(false);
    expect(validity.reason).toBe("cycle");
  });

  test("round-trips the iteration node through export and restore", () => {
    const document = newtonDocument(createNewtonNode());
    const file = buildWorkflowEditorDocumentFile(document, {
      documentName: "Bounded Approximation (Newton √2)",
    });
    const restored = restoreWorkflowEditorDocumentFile(JSON.parse(JSON.stringify(file))).document;
    const original = iterationNodeOf(document);
    const node = iterationNodeOf(restored);

    expect(node.kind).toBe("control.iterate");
    expect(node.data).toEqual(original.data);
    expect(maxIterationsOf(node)).toBe(10);
    expect(node.inputs).toEqual(original.inputs);
    expect(node.outputs).toEqual(original.outputs);
    expect(node.composition).toEqual(original.composition);
    expect(api.isWorkflowEditorIterationNode(node)).toBe(true);
  });
});

describe("compiling iteration nodes", () => {
  test("compiles the Newton document to compiled v2", () => {
    const compiled = compileWorkflowEditorDocument(
      newtonDocument(createNewtonNode()),
    ) as unknown as {
      version: number;
      nodes: Array<{ id: string; kind: string; data?: Record<string, unknown>; iteration?: any }>;
    };
    expect(compiled.version).toBe(2);
    const refine = compiled.nodes.find((node) => node.id === "refine")!;
    expect(refine.kind).toBe("control.iterate");
    expect(refine.iteration?.maxIterations).toBe(10);
    expect(refine.iteration?.stop).toEqual({ kind: "body-output", outputId: "converged" });
    expect(refine.iteration?.candidate).toBe("latest-state");
    expect(refine.data?.iteration).toBeUndefined();
  });

  test("compiles a body without converged boundary as limit-only", () => {
    const node = createNewtonNode();
    node.composition!.outputBoundaries = node.composition!.outputBoundaries.filter(
      (boundary) => boundary.wrapperPortId === "next",
    );
    const compiled = compileWorkflowEditorDocument(newtonDocument(node)) as unknown as {
      nodes: Array<{ id: string; iteration?: { stop?: unknown; body?: { outputs?: unknown } } }>;
    };
    const refine = compiled.nodes.find((candidate) => candidate.id === "refine")!;
    expect(refine.iteration?.stop).toEqual({ kind: "limit-only" });
    expect(refine.iteration?.body?.outputs).toEqual({
      next: { nodeId: "newton-step", portId: "next" },
    });
  });

  test.each([
    ["iteration-bound-required", () => literalIterationNode({ maxIterations: null })],
    ["iteration-bound-invalid", () => literalIterationNode({ maxIterations: 0 })],
    [
      "iteration-state-type",
      () => {
        const node = literalIterationNode();
        node.composition!.nodes[0]!.outputs = [{ id: "next", label: "Next", type: ts("string") }];
        return node;
      },
    ],
    [
      "iteration-stop-type",
      () => {
        const node = literalIterationNode();
        node.composition!.nodes[1]!.outputs = [
          { id: "converged", label: "Converged", type: { kind: "number" } },
        ];
        return node;
      },
    ],
    [
      "nested-iteration-not-supported",
      () => {
        const node = literalIterationNode();
        node.composition!.nodes.push(literalIterationNode({ id: "inner", label: "Inner" }));
        return node;
      },
    ],
  ])("refuses to compile an iteration node with %s", (code, build) => {
    let error: unknown;
    try {
      compileWorkflowEditorDocument(newtonDocument(build()));
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(WorkflowEditorCompileError);
    expect(codes((error as WorkflowEditorCompileError).diagnostics)).toContain(code);
  });

  test("still rejects an ordinary composed node", () => {
    const document = newtonDocument(literalIterationNode({ kind: "custom.composite" }));
    expect(() => compileWorkflowEditorDocument(document)).toThrow(WorkflowEditorCompileError);
  });
});
