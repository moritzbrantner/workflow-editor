// Acceptance for issue #14 / Decision Atlas 6.1: document validation is configured through one flat
// per-rule policy with exported presets, every diagnostic carries a severity, a single
// normalization function returns `{ document, diagnostics }` without silently dropping content,
// repair is an explicit separate call, and the compiler validates with the `execution` policy.
import { describe, expect, it } from "vitest";

import { compileWorkflowEditorDocument } from "./compiler";
import * as core from "./core";
import {
  assertWorkflowEditorDocument,
  normalizeWorkflowEditorDocument,
  repairWorkflowEditorDocument,
  validateWorkflowEditorDocument,
  workflowEditorValidationPolicies,
  WorkflowEditorDocumentValidationError,
  type WorkflowEditorDiagnosticSeverity,
  type WorkflowEditorDocument,
  type WorkflowEditorDocumentDiagnostic,
  type WorkflowEditorEdge,
  type WorkflowEditorValidationPolicy,
} from "./core";

type Diagnostic = WorkflowEditorDocumentDiagnostic & { severity: WorkflowEditorDiagnosticSeverity };

function node(id: string) {
  return {
    id,
    label: id.toUpperCase(),
    kind: "noop",
    x: 0,
    y: 0,
    inputs: [{ id: "in", label: "In", type: { kind: "any" as const }, optional: true }],
    outputs: [{ id: "out", label: "Out", type: { kind: "any" as const } }],
  };
}

function edge(
  id: string,
  sourceNodeId: string,
  targetNodeId: string,
  ports: { sourcePortId?: string; targetPortId?: string } = {},
): WorkflowEditorEdge {
  return {
    id,
    sourceNodeId,
    sourcePortId: ports.sourcePortId ?? "out",
    targetNodeId,
    targetPortId: ports.targetPortId ?? "in",
  };
}

const validEdges = [edge("edge-a-b", "a", "b"), edge("edge-b-c", "b", "c")];

function documentWith(...extraEdges: WorkflowEditorEdge[]): WorkflowEditorDocument {
  return {
    nodes: [node("a"), node("b"), node("c")],
    edges: [...validEdges, ...extraEdges],
  };
}

const danglingEdge = edge("edge-dangling", "a", "node-missing");
const selfEdge = edge("edge-self", "b", "b");
const unknownPortEdge = edge("edge-unknown-port", "a", "c", { targetPortId: "port-missing" });
// Appended last so it is the edge that closes the a -> b -> c -> a cycle.
const cycleEdge = edge("edge-cycle", "c", "a");

const policyProblems = [
  { name: "dangling edge", edge: danglingEdge, code: "missing-edge-node" },
  { name: "self edge", edge: selfEdge, code: "self-edge" },
  { name: "unknown port edge", edge: unknownPortEdge, code: "missing-edge-port" },
  { name: "cycle", edge: cycleEdge, code: "cycle" },
] as const;

function edgeIds(document: WorkflowEditorDocument) {
  return document.edges.map((candidate) => candidate.id);
}

function catchValidationError(run: () => unknown): WorkflowEditorDocumentValidationError {
  try {
    run();
  } catch (error) {
    expect(error).toBeInstanceOf(WorkflowEditorDocumentValidationError);
    return error as WorkflowEditorDocumentValidationError;
  }
  throw new Error("Expected a WorkflowEditorDocumentValidationError to be thrown.");
}

function diagnosticsOf(error: WorkflowEditorDocumentValidationError) {
  return error.diagnostics as Diagnostic[];
}

describe("validation policy presets", () => {
  it("exports the four presets with the approved rule values", () => {
    expect(workflowEditorValidationPolicies.strict).toEqual({
      allowExcessConnections: false,
      allowCycles: false,
      allowDanglingEdges: false,
      allowSelfEdges: false,
      unknownPortBehavior: "error",
    });
    expect(workflowEditorValidationPolicies.execution).toEqual({
      allowExcessConnections: false,
      allowCycles: false,
      allowDanglingEdges: false,
      allowSelfEdges: false,
      unknownPortBehavior: "error",
    });
    expect(workflowEditorValidationPolicies.import).toEqual({
      allowExcessConnections: true,
      allowCycles: false,
      allowDanglingEdges: true,
      allowSelfEdges: true,
      unknownPortBehavior: "warning",
    });
    expect(workflowEditorValidationPolicies.draft).toEqual({
      allowExcessConnections: true,
      allowCycles: true,
      allowDanglingEdges: true,
      allowSelfEdges: true,
      unknownPortBehavior: "warning",
    });
    expect(Object.keys(workflowEditorValidationPolicies).sort()).toEqual([
      "draft",
      "execution",
      "import",
      "strict",
    ]);
  });

  it("exposes the policy API from both the core and the root entrypoints", async () => {
    // Imported lazily so a root-entrypoint environment problem cannot mask the headless tests.
    const index = await import("./index");
    expect(index.workflowEditorValidationPolicies).toBe(core.workflowEditorValidationPolicies);
    expect(index.normalizeWorkflowEditorDocument).toBe(core.normalizeWorkflowEditorDocument);
    expect(index.repairWorkflowEditorDocument).toBe(core.repairWorkflowEditorDocument);
    expect(index.validateWorkflowEditorDocument).toBe(core.validateWorkflowEditorDocument);
    expect(index.assertWorkflowEditorDocument).toBe(core.assertWorkflowEditorDocument);
    expect(typeof core.repairWorkflowEditorDocument).toBe("function");
  });
});

describe("normalizeWorkflowEditorDocument under the default strict policy", () => {
  it("returns the document with no diagnostics for a valid document", () => {
    const result = normalizeWorkflowEditorDocument(documentWith());

    expect(result.diagnostics).toEqual([]);
    expect(edgeIds(result.document)).toEqual(["edge-a-b", "edge-b-c"]);
    expect(result.document.nodes.map((candidate) => candidate.id)).toEqual(["a", "b", "c"]);
  });

  it.each(policyProblems)(
    "throws an error-severity $code diagnostic for a $name",
    ({ edge: problemEdge, code }) => {
      const error = catchValidationError(() =>
        normalizeWorkflowEditorDocument(documentWith(problemEdge)),
      );
      const diagnostic = diagnosticsOf(error).find((candidate) => candidate.code === code);

      expect(diagnostic).toBeDefined();
      expect(diagnostic!.severity).toBe("error");
      expect(typeof diagnostic!.message).toBe("string");
      expect(typeof diagnostic!.path).toBe("string");
      if (code !== "cycle") {
        expect(diagnostic!.edgeId).toBe(problemEdge.id);
      }
    },
  );

  it("treats an explicit strict policy exactly like the default", () => {
    const error = catchValidationError(() =>
      normalizeWorkflowEditorDocument(documentWith(danglingEdge), {
        policy: workflowEditorValidationPolicies.strict,
      }),
    );
    expect(diagnosticsOf(error)).toContainEqual(
      expect.objectContaining({ code: "missing-edge-node", severity: "error" }),
    );
  });

  it("no longer accepts the removed allowCycles and mode options", () => {
    // The old options have no effect: the strict default still rejects the cycle and does not
    // silently repair the dangling edge.
    catchValidationError(() =>
      normalizeWorkflowEditorDocument(documentWith(cycleEdge), {
        // @ts-expect-error The top-level allowCycles option was removed (Decision 6.1).
        allowCycles: true,
      }),
    );
    catchValidationError(() =>
      normalizeWorkflowEditorDocument(documentWith(danglingEdge), {
        // @ts-expect-error The strict/repair mode option was removed (Decision 6.1).
        mode: "repair",
      }),
    );
  });
});

describe("normalizeWorkflowEditorDocument under the execution policy", () => {
  it.each(policyProblems)("rejects a $name like strict", ({ edge: problemEdge, code }) => {
    const error = catchValidationError(() =>
      normalizeWorkflowEditorDocument(documentWith(problemEdge), {
        policy: workflowEditorValidationPolicies.execution,
      }),
    );
    expect(diagnosticsOf(error)).toContainEqual(
      expect.objectContaining({ code, severity: "error" }),
    );
  });
});

describe("normalizeWorkflowEditorDocument under the draft policy", () => {
  it("keeps every allowed problem edge and reports each one as a warning", () => {
    const input = documentWith(danglingEdge, selfEdge, unknownPortEdge, cycleEdge);

    const result = normalizeWorkflowEditorDocument(input, {
      policy: workflowEditorValidationPolicies.draft,
    });

    expect(edgeIds(result.document)).toEqual([
      "edge-a-b",
      "edge-b-c",
      "edge-dangling",
      "edge-self",
      "edge-unknown-port",
      "edge-cycle",
    ]);
    const diagnostics = result.diagnostics as Diagnostic[];
    expect(diagnostics.length).toBeGreaterThan(0);
    expect(diagnostics.every((diagnostic) => diagnostic.severity === "warning")).toBe(true);
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "missing-edge-node",
        severity: "warning",
        edgeId: "edge-dangling",
        targetNodeId: "node-missing",
      }),
    );
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "self-edge",
        severity: "warning",
        edgeId: "edge-self",
        sourceNodeId: "b",
        targetNodeId: "b",
      }),
    );
    expect(diagnostics).toContainEqual(
      expect.objectContaining({
        code: "missing-edge-port",
        severity: "warning",
        edgeId: "edge-unknown-port",
      }),
    );
    expect(diagnostics).toContainEqual(
      expect.objectContaining({ code: "cycle", severity: "warning" }),
    );
    for (const diagnostic of diagnostics) {
      expect(typeof diagnostic.message).toBe("string");
      expect(typeof diagnostic.path).toBe("string");
    }
  });

  it("keeps the dangling edge's endpoint and port ids unchanged", () => {
    const result = normalizeWorkflowEditorDocument(documentWith(danglingEdge, unknownPortEdge), {
      policy: workflowEditorValidationPolicies.draft,
    });

    expect(result.document.edges.find((candidate) => candidate.id === "edge-dangling")).toEqual(
      expect.objectContaining({ sourceNodeId: "a", targetNodeId: "node-missing" }),
    );
    expect(result.document.edges.find((candidate) => candidate.id === "edge-unknown-port")).toEqual(
      expect.objectContaining({ targetNodeId: "c", targetPortId: "port-missing" }),
    );
  });

  it("still rejects non-policy structural problems as errors", () => {
    const duplicate = documentWith();
    duplicate.nodes.push(node("a"));
    const duplicateError = catchValidationError(() =>
      normalizeWorkflowEditorDocument(duplicate, {
        policy: workflowEditorValidationPolicies.draft,
      }),
    );
    expect(diagnosticsOf(duplicateError)).toContainEqual(
      expect.objectContaining({ code: "duplicate-node-id", severity: "error" }),
    );

    const invalidPortType = documentWith();
    (invalidPortType.nodes[0]!.outputs![0] as { type: unknown }).type = { kind: "legacy-opaque" };
    const portTypeError = catchValidationError(() =>
      normalizeWorkflowEditorDocument(invalidPortType, {
        policy: workflowEditorValidationPolicies.draft,
      }),
    );
    expect(diagnosticsOf(portTypeError)).toContainEqual(
      expect.objectContaining({ code: "invalid-port-type", severity: "error" }),
    );

    const invalidDocumentError = catchValidationError(() =>
      normalizeWorkflowEditorDocument(
        { nodes: "not nodes", edges: [] } as unknown as WorkflowEditorDocument,
        { policy: workflowEditorValidationPolicies.draft },
      ),
    );
    expect(diagnosticsOf(invalidDocumentError).length).toBeGreaterThan(0);
    expect(diagnosticsOf(invalidDocumentError).every((d) => d.severity === "error")).toBe(true);
  });
});

describe("normalizeWorkflowEditorDocument under the import policy", () => {
  it("keeps dangling, self and unknown-port edges as warnings", () => {
    const result = normalizeWorkflowEditorDocument(
      documentWith(danglingEdge, selfEdge, unknownPortEdge),
      { policy: workflowEditorValidationPolicies.import },
    );

    expect(edgeIds(result.document)).toEqual([
      "edge-a-b",
      "edge-b-c",
      "edge-dangling",
      "edge-self",
      "edge-unknown-port",
    ]);
    const diagnostics = result.diagnostics as Diagnostic[];
    expect(diagnostics.map((diagnostic) => [diagnostic.code, diagnostic.edgeId]).sort()).toEqual(
      [
        ["missing-edge-node", "edge-dangling"],
        ["missing-edge-port", "edge-unknown-port"],
        ["self-edge", "edge-self"],
        // #15: the self edge is the second edge into b's single input; import allows the excess.
        ["port-cardinality-max", "edge-self"],
      ].sort(),
    );
    expect(diagnostics.every((diagnostic) => diagnostic.severity === "warning")).toBe(true);
  });

  it("does not treat an allowed self edge as a disallowed cycle", () => {
    const result = normalizeWorkflowEditorDocument(documentWith(selfEdge), {
      policy: workflowEditorValidationPolicies.import,
    });

    expect(edgeIds(result.document)).toContain("edge-self");
    expect(result.diagnostics.map((diagnostic) => diagnostic.code)).not.toContain("cycle");
  });

  it("rejects a cycle fail-closed and never repairs it", () => {
    const error = catchValidationError(() =>
      normalizeWorkflowEditorDocument(documentWith(cycleEdge), {
        policy: workflowEditorValidationPolicies.import,
      }),
    );
    expect(diagnosticsOf(error)).toContainEqual(
      expect.objectContaining({ code: "cycle", severity: "error" }),
    );
  });
});

describe("unknownPortBehavior", () => {
  const withUnknownPort = (
    unknownPortBehavior: WorkflowEditorValidationPolicy["unknownPortBehavior"],
  ) =>
    ({
      ...workflowEditorValidationPolicies.strict,
      unknownPortBehavior,
    }) satisfies WorkflowEditorValidationPolicy;

  it("error rejects the edge with an error-severity diagnostic", () => {
    const error = catchValidationError(() =>
      normalizeWorkflowEditorDocument(documentWith(unknownPortEdge), {
        policy: withUnknownPort("error"),
      }),
    );
    expect(diagnosticsOf(error)).toContainEqual(
      expect.objectContaining({
        code: "missing-edge-port",
        severity: "error",
        edgeId: "edge-unknown-port",
      }),
    );
  });

  it("warning keeps the edge and reports a warning", () => {
    const result = normalizeWorkflowEditorDocument(documentWith(unknownPortEdge), {
      policy: withUnknownPort("warning"),
    });
    expect(edgeIds(result.document)).toContain("edge-unknown-port");
    expect(result.diagnostics).toEqual([
      expect.objectContaining({
        code: "missing-edge-port",
        severity: "warning",
        edgeId: "edge-unknown-port",
      }),
    ]);
  });

  it("ignore keeps the edge and produces no diagnostic", () => {
    const policy = withUnknownPort("ignore");
    const result = normalizeWorkflowEditorDocument(documentWith(unknownPortEdge), { policy });

    expect(edgeIds(result.document)).toContain("edge-unknown-port");
    expect(result.diagnostics).toEqual([]);
    expect(validateWorkflowEditorDocument(documentWith(unknownPortEdge), { policy })).toEqual([]);
  });

  it("applies each allow flag independently of the others", () => {
    const onlyDangling = {
      ...workflowEditorValidationPolicies.strict,
      allowDanglingEdges: true,
    } satisfies WorkflowEditorValidationPolicy;

    expect(
      normalizeWorkflowEditorDocument(documentWith(danglingEdge), { policy: onlyDangling })
        .diagnostics,
    ).toEqual([expect.objectContaining({ code: "missing-edge-node", severity: "warning" })]);
    const error = catchValidationError(() =>
      normalizeWorkflowEditorDocument(documentWith(selfEdge), { policy: onlyDangling }),
    );
    expect(diagnosticsOf(error)).toContainEqual(
      expect.objectContaining({ code: "self-edge", severity: "error" }),
    );
  });
});

describe("validateWorkflowEditorDocument and assertWorkflowEditorDocument", () => {
  const problems = () => documentWith(danglingEdge, selfEdge, unknownPortEdge, cycleEdge);

  it("validate returns every diagnostic with a severity and never throws", () => {
    const strict = validateWorkflowEditorDocument(problems()) as Diagnostic[];
    expect(strict.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining(["missing-edge-node", "self-edge", "missing-edge-port", "cycle"]),
    );
    expect(strict.every((diagnostic) => diagnostic.severity === "error")).toBe(true);

    const draft = validateWorkflowEditorDocument(problems(), {
      policy: workflowEditorValidationPolicies.draft,
    }) as Diagnostic[];
    expect(draft.map((diagnostic) => diagnostic.code)).toEqual(
      expect.arrayContaining(["missing-edge-node", "self-edge", "missing-edge-port", "cycle"]),
    );
    expect(draft.every((diagnostic) => diagnostic.severity === "warning")).toBe(true);

    const invalid = validateWorkflowEditorDocument({ nodes: "not nodes" }) as Diagnostic[];
    expect(invalid.length).toBeGreaterThan(0);
    expect(invalid.every((diagnostic) => diagnostic.severity === "error")).toBe(true);
    expect(validateWorkflowEditorDocument(documentWith())).toEqual([]);
  });

  it("validate under import mixes warnings and the cycle error", () => {
    const diagnostics = validateWorkflowEditorDocument(problems(), {
      policy: workflowEditorValidationPolicies.import,
    }) as Diagnostic[];
    expect(diagnostics).toContainEqual(
      expect.objectContaining({ code: "cycle", severity: "error" }),
    );
    expect(diagnostics).toContainEqual(
      expect.objectContaining({ code: "missing-edge-node", severity: "warning" }),
    );
  });

  it("assert throws only when an error-severity diagnostic exists", () => {
    expect(() =>
      assertWorkflowEditorDocument(problems(), { policy: workflowEditorValidationPolicies.draft }),
    ).not.toThrow();
    expect(() =>
      assertWorkflowEditorDocument(documentWith(danglingEdge, selfEdge, unknownPortEdge), {
        policy: workflowEditorValidationPolicies.import,
      }),
    ).not.toThrow();
    expect(() => assertWorkflowEditorDocument(documentWith())).not.toThrow();

    const strictError = catchValidationError(() => assertWorkflowEditorDocument(problems()));
    expect(diagnosticsOf(strictError).every((diagnostic) => diagnostic.severity === "error")).toBe(
      true,
    );
    const importError = catchValidationError(() =>
      assertWorkflowEditorDocument(problems(), { policy: workflowEditorValidationPolicies.import }),
    );
    expect(diagnosticsOf(importError)).toContainEqual(
      expect.objectContaining({ code: "cycle", severity: "error" }),
    );
  });
});

describe("repairWorkflowEditorDocument", () => {
  it("removes exactly the invalid edges and describes each removal", () => {
    const input = documentWith(danglingEdge, selfEdge, unknownPortEdge, cycleEdge);
    const snapshot = structuredClone(input);

    const result = repairWorkflowEditorDocument(input);

    expect(edgeIds(result.document)).toEqual(["edge-a-b", "edge-b-c"]);
    expect(result.document.nodes.map((candidate) => candidate.id)).toEqual(["a", "b", "c"]);
    const describedEdgeIds = (result.diagnostics as Diagnostic[]).map((d) => d.edgeId);
    expect(describedEdgeIds).toEqual(
      expect.arrayContaining(["edge-dangling", "edge-self", "edge-unknown-port"]),
    );
    expect(
      (result.diagnostics as Diagnostic[]).some(
        (diagnostic) => diagnostic.code === "cycle" || diagnostic.edgeId === "edge-cycle",
      ),
    ).toBe(true);
    expect(input).toEqual(snapshot);
  });

  it("produces a document that then normalizes cleanly under strict", () => {
    const repaired = repairWorkflowEditorDocument(
      documentWith(danglingEdge, selfEdge, unknownPortEdge, cycleEdge),
    );
    expect(normalizeWorkflowEditorDocument(repaired.document).diagnostics).toEqual([]);
  });

  it("leaves a valid document untouched", () => {
    const result = repairWorkflowEditorDocument(documentWith());
    expect(edgeIds(result.document)).toEqual(["edge-a-b", "edge-b-c"]);
    expect(result.document.nodes.map((candidate) => candidate.id)).toEqual(["a", "b", "c"]);
    expect(result.diagnostics).toEqual([]);
  });

  it("is never performed implicitly by normalization", () => {
    const draft = normalizeWorkflowEditorDocument(documentWith(danglingEdge, selfEdge), {
      policy: workflowEditorValidationPolicies.draft,
    });
    expect(edgeIds(draft.document)).toEqual(["edge-a-b", "edge-b-c", "edge-dangling", "edge-self"]);
    catchValidationError(() => normalizeWorkflowEditorDocument(documentWith(danglingEdge)));
  });
});

describe("compiler validates with the execution policy", () => {
  it("compiles the valid document", () => {
    expect(() => compileWorkflowEditorDocument(documentWith())).not.toThrow();
  });

  it.each(policyProblems)("fails compilation for a $name", ({ edge: problemEdge }) => {
    let thrown: unknown;
    try {
      compileWorkflowEditorDocument(documentWith(problemEdge));
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    const diagnostics = (thrown as { diagnostics?: unknown[] }).diagnostics;
    expect(Array.isArray(diagnostics)).toBe(true);
    expect(diagnostics!.length).toBeGreaterThan(0);
  });

  it("fails compilation even for documents the draft policy accepts", () => {
    const document = documentWith(danglingEdge, selfEdge, unknownPortEdge);
    const draft = normalizeWorkflowEditorDocument(document, {
      policy: workflowEditorValidationPolicies.draft,
    });

    expect(() => compileWorkflowEditorDocument(draft.document)).toThrow();
  });
});
