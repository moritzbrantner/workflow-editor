// Acceptance for issue #15 / Decision Atlas 1.9, 1.10, 6.1, 6.2 (owner-approved 2026-10-17):
// `cardinality` is a field of the core `WorkflowEditorPort` and is enforced by the one core
// `validateWorkflowEditorConnection`. Ordinary inputs default to one connection, outputs to
// unbounded fan-out, expandable JSON constructors keep expanding. A multi-source input declares a
// fixed `T[]` Port Type and each source is checked against `T` by the TypeScript checker; edges
// never rewrite the declared type. Document validation reports excess edges per the new
// `allowExcessConnections` policy flag, repair removes exactly the later excess edges, and the
// compiler rejects excess and under-min ports. `control.merge` has one multi-source `items` input.
// The sidecar `./cardinality` module is removed without a compatibility layer.
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { compileWorkflowEditorDocument, WorkflowEditorCompileError } from "./compiler";
import * as core from "./core";
import {
  connectWorkflowEditorNodes,
  defaultWorkflowEditorNodeTemplates,
  duplicateWorkflowEditorNode,
  normalizeWorkflowEditorDocument,
  removeWorkflowEditorEdge,
  repairWorkflowEditorDocument,
  validateWorkflowEditorConnection,
  validateWorkflowEditorDocument,
  workflowEditorValidationPolicies,
  WorkflowEditorDocumentValidationError,
  type WorkflowEditorConnectionInput,
  type WorkflowEditorDocument,
  type WorkflowEditorDocumentDiagnostic,
  type WorkflowEditorEdge,
  type WorkflowEditorNode,
  type WorkflowEditorPort,
  type WorkflowEditorPortType,
  type WorkflowEditorTypeDefinition,
} from "./core";
import { createWorkflowEditorTypeResolver } from "./core-type-resolver";
import { buildWorkflowEditorDocumentFile, restoreWorkflowEditorDocumentFile } from "./persistence";

type Cardinality = { min?: number; max?: number };
type CardinalityPort = WorkflowEditorPort & { cardinality?: Cardinality };

const stringType = { kind: "string" } as const satisfies WorkflowEditorPortType;
const numberType = { kind: "number" } as const satisfies WorkflowEditorPortType;
const native = (source: string): WorkflowEditorPortType => ({ kind: "typescript", source });
const arrayOf = (element: WorkflowEditorPortType): WorkflowEditorPortType => ({
  kind: "array",
  element,
});

function port(
  id: string,
  type: WorkflowEditorPortType,
  cardinality?: Cardinality,
): WorkflowEditorPort {
  return {
    id,
    label: id === "items" ? "Items" : id.charAt(0).toUpperCase() + id.slice(1),
    type,
    ...(cardinality ? { cardinality } : {}),
  } as CardinalityPort as WorkflowEditorPort;
}

function source(id: string, type: WorkflowEditorPortType = stringType, cardinality?: Cardinality) {
  return {
    id,
    label: `Source ${id}`,
    kind: "test.source",
    x: 0,
    y: 0,
    outputs: [port("out", type, cardinality)],
  } satisfies WorkflowEditorNode;
}

function sink(id: string, type: WorkflowEditorPortType = stringType, cardinality?: Cardinality) {
  return {
    id,
    label: `Sink ${id}`,
    kind: "test.sink",
    x: 400,
    y: 0,
    inputs: [port(id === "fan-in" ? "items" : "in", type, cardinality)],
  } satisfies WorkflowEditorNode;
}

function edge(
  id: string,
  sourceNodeId: string,
  targetNodeId: string,
  targetPortId = "in",
): WorkflowEditorEdge {
  return { id, sourceNodeId, sourcePortId: "out", targetNodeId, targetPortId };
}

function connection(
  sourceNodeId: string,
  targetNodeId: string,
  targetPortId = "in",
): WorkflowEditorConnectionInput {
  return { sourceNodeId, sourcePortId: "out", targetNodeId, targetPortId };
}

function inputPort(document: WorkflowEditorDocument, nodeId: string, portId: string) {
  return document.nodes
    .find((candidate) => candidate.id === nodeId)
    ?.inputs?.find((candidate) => candidate.id === portId) as CardinalityPort | undefined;
}

function outputPort(document: WorkflowEditorDocument, nodeId: string, portId: string) {
  return document.nodes
    .find((candidate) => candidate.id === nodeId)
    ?.outputs?.find((candidate) => candidate.id === portId) as CardinalityPort | undefined;
}

function edgeIds(document: WorkflowEditorDocument) {
  return document.edges.map((candidate) => candidate.id);
}

function cardinalityDiagnostics(diagnostics: readonly WorkflowEditorDocumentDiagnostic[]) {
  return diagnostics.filter(
    (diagnostic) =>
      (diagnostic.code as string) === "port-cardinality-max" ||
      (diagnostic.code as string) === "invalid-port-cardinality",
  );
}

function catchError(run: () => unknown): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }
  throw new Error("Expected the call to throw.");
}

const builtIn = (kind: string, id: string): WorkflowEditorNode => ({
  ...defaultWorkflowEditorNodeTemplates.find((template) => template.kind === kind)!,
  id,
  x: 200,
  y: 0,
});

// Lead / QualifiedLead mirror the Pages "Lead Intake Automation" example definitions.
const leadTypeDefinitions: readonly WorkflowEditorTypeDefinition[] = [
  {
    name: "Lead",
    type: {
      kind: "object",
      properties: {
        email: { type: stringType },
        company: { type: stringType },
        source: { type: stringType, optional: true },
        score: { type: numberType, optional: true },
      },
    },
  },
  {
    name: "QualifiedLead",
    extends: ["Lead"],
    type: {
      kind: "object",
      properties: {
        email: { type: stringType },
        company: { type: stringType },
        score: { type: numberType },
        owner: { type: stringType },
      },
    },
  },
];
const leadDeclarations = [
  "interface Lead { email: string; company: string; source?: string; score?: number }",
  "interface QualifiedLead extends Lead { score: number; owner: string }",
].join("\n");

describe("connection validation: default cardinality", () => {
  it("rejects a second source on an ordinary single input with target-cardinality", () => {
    const document: WorkflowEditorDocument = {
      nodes: [source("a"), source("b"), sink("target")],
      edges: [edge("edge-a", "a", "target")],
    };
    const snapshot = structuredClone(document);

    const validity = validateWorkflowEditorConnection(document, connection("b", "target"));

    expect(validity).toMatchObject({ valid: false, reason: "target-cardinality" });
    expect(validity.message).toEqual(expect.any(String));
    expect(validity.message).toMatch(/\bIn\b|\.in\b/);
    expect(validity.message).toMatch(/only one connection/i);
    expect(connectWorkflowEditorNodes(document, connection("b", "target"))).toBe(document);
    expect(document).toEqual(snapshot);
    expect(inputPort(document, "target", "in")?.type).toEqual(stringType);
  });

  it("accepts the first source on an ordinary single input", () => {
    const document: WorkflowEditorDocument = {
      nodes: [source("a"), sink("target")],
      edges: [],
    };
    expect(validateWorkflowEditorConnection(document, connection("a", "target"))).toEqual({
      valid: true,
    });
    const connected = connectWorkflowEditorNodes(document, connection("a", "target"));
    expect(connected.edges).toHaveLength(1);
    expect(inputPort(connected, "target", "in")?.type).toEqual(stringType);
  });

  it("treats an explicit max of 1 exactly like the default single input", () => {
    const document: WorkflowEditorDocument = {
      nodes: [source("a"), source("b"), sink("target", stringType, { max: 1 })],
      edges: [edge("edge-a", "a", "target")],
    };
    expect(validateWorkflowEditorConnection(document, connection("b", "target"))).toMatchObject({
      valid: false,
      reason: "target-cardinality",
    });
  });

  it("keeps default output fan-out unbounded", () => {
    let document: WorkflowEditorDocument = {
      nodes: [source("a"), sink("t1"), sink("t2"), sink("t3")],
      edges: [],
    };
    for (const target of ["t1", "t2", "t3"]) {
      expect(validateWorkflowEditorConnection(document, connection("a", target)).valid).toBe(true);
      document = connectWorkflowEditorNodes(document, connection("a", target));
    }
    expect(document.edges).toHaveLength(3);
    expect(validateWorkflowEditorDocument(document)).toEqual([]);
  });

  it("rejects fan-out once an explicit source maximum is reached with source-cardinality", () => {
    const document: WorkflowEditorDocument = {
      nodes: [source("a", stringType, { max: 1 }), sink("t1"), sink("t2")],
      edges: [edge("edge-a-t1", "a", "t1")],
    };
    const validity = validateWorkflowEditorConnection(document, connection("a", "t2"));
    expect(validity).toMatchObject({ valid: false, reason: "source-cardinality" });
    expect(validity.message).toEqual(expect.any(String));
    expect(connectWorkflowEditorNodes(document, connection("a", "t2"))).toBe(document);
  });

  it("keeps expandable JSON constructors accepting additional sources", () => {
    let document = normalizeWorkflowEditorDocument({
      nodes: [source("a"), source("b"), source("c"), builtIn("json.array", "array")],
      edges: [],
    }).document;
    for (const sourceNodeId of ["a", "b", "c"]) {
      const toAdd = connection(sourceNodeId, "array", "item-add");
      expect(validateWorkflowEditorConnection(document, toAdd).valid).toBe(true);
      document = connectWorkflowEditorNodes(document, toAdd);
    }
    expect(document.edges).toHaveLength(3);
    expect(new Set(document.edges.map((candidate) => candidate.targetPortId)).size).toBe(3);
    // An occupied constructor item still expands instead of reporting cardinality.
    const occupied = document.edges[0]!;
    const extra = { ...source("d"), id: "d" };
    const withExtra = { ...document, nodes: [...document.nodes, extra] };
    expect(
      validateWorkflowEditorConnection(withExtra, {
        ...connection("d", "array", occupied.targetPortId),
      }).valid,
    ).toBe(true);
    expect(cardinalityDiagnostics(validateWorkflowEditorDocument(document))).toEqual([]);
  });
});

describe("connection validation: explicit multi-source inputs", () => {
  const fanIn = (cardinality: Cardinality, type: WorkflowEditorPortType = arrayOf(stringType)) =>
    sink("fan-in", type, cardinality);

  it("accepts sources up to an explicit max and rejects the next with 'at most N'", () => {
    let document: WorkflowEditorDocument = {
      nodes: [source("a"), source("b"), source("c"), fanIn({ max: 2 })],
      edges: [],
    };
    document = connectWorkflowEditorNodes(document, connection("a", "fan-in", "items"));
    document = connectWorkflowEditorNodes(document, connection("b", "fan-in", "items"));
    expect(document.edges).toHaveLength(2);

    const third = validateWorkflowEditorConnection(document, connection("c", "fan-in", "items"));
    expect(third).toMatchObject({ valid: false, reason: "target-cardinality" });
    expect(third.message).toContain("at most 2");
    expect(third.message).toMatch(/Items|items/);
    expect(connectWorkflowEditorNodes(document, connection("c", "fan-in", "items"))).toBe(document);
  });

  it("treats an omitted max in a declared cardinality as unbounded", () => {
    const sources = ["a", "b", "c", "d", "e"].map((id) => source(id));
    let document: WorkflowEditorDocument = {
      nodes: [...sources, fanIn({ min: 1 })],
      edges: [],
    };
    for (const candidate of sources) {
      const next = connection(candidate.id, "fan-in", "items");
      expect(validateWorkflowEditorConnection(document, next).valid).toBe(true);
      document = connectWorkflowEditorNodes(document, next);
    }
    expect(document.edges).toHaveLength(5);
    expect(validateWorkflowEditorDocument(document)).toEqual([]);
  });

  it("checks each source against the element type with the checker", () => {
    const document: WorkflowEditorDocument = {
      nodes: [source("text", stringType), source("count", numberType), fanIn({ max: 3 })],
      edges: [],
    };
    expect(
      validateWorkflowEditorConnection(document, connection("text", "fan-in", "items")),
    ).toEqual({ valid: true });
    const mismatch = validateWorkflowEditorConnection(
      document,
      connection("count", "fan-in", "items"),
    );
    expect(mismatch).toMatchObject({ valid: false, reason: "type-mismatch" });
    expect(mismatch.message).toContain("number");
    expect(connectWorkflowEditorNodes(document, connection("count", "fan-in", "items"))).toBe(
      document,
    );
  });

  it("checks against the element of a TypeScript source array type", () => {
    const document: WorkflowEditorDocument = {
      nodes: [
        source("text", native("string")),
        source("count", native("number")),
        fanIn({ max: 3 }, native("string[]")),
      ],
      edges: [],
    };
    expect(
      validateWorkflowEditorConnection(document, connection("text", "fan-in", "items")).valid,
    ).toBe(true);
    expect(
      validateWorkflowEditorConnection(document, connection("count", "fan-in", "items")),
    ).toMatchObject({ valid: false, reason: "type-mismatch" });
  });

  it("does not accept a whole array source as one element of a T[] input", () => {
    const document: WorkflowEditorDocument = {
      nodes: [source("list", arrayOf(stringType)), fanIn({ max: 3 })],
      edges: [],
    };
    expect(
      validateWorkflowEditorConnection(document, connection("list", "fan-in", "items")),
    ).toMatchObject({ valid: false, reason: "type-mismatch" });
  });

  it("accepts a subtype source into a supertype array (QualifiedLead into Lead[]) via declarations", () => {
    const document: WorkflowEditorDocument = {
      typeDeclarations: leadDeclarations,
      nodes: [
        source("qualified", native("QualifiedLead")),
        source("lead", native("Lead")),
        source("score", native("number")),
        fanIn({ min: 1, max: 3 }, native("Lead[]")),
      ],
      edges: [],
    };
    expect(
      validateWorkflowEditorConnection(document, connection("qualified", "fan-in", "items")).valid,
    ).toBe(true);
    expect(
      validateWorkflowEditorConnection(document, connection("lead", "fan-in", "items")).valid,
    ).toBe(true);
    expect(
      validateWorkflowEditorConnection(document, connection("score", "fan-in", "items")),
    ).toMatchObject({ valid: false, reason: "type-mismatch" });
  });

  it("accepts a subtype source into a supertype array via host type definitions", () => {
    const options = { typeDefinitions: leadTypeDefinitions };
    let document: WorkflowEditorDocument = {
      nodes: [
        source("qualified", { kind: "ref", name: "QualifiedLead" }),
        source("lead", { kind: "ref", name: "Lead" }),
        fanIn({ min: 1, max: 3 }, arrayOf({ kind: "ref", name: "Lead" })),
      ],
      edges: [],
    };
    for (const sourceNodeId of ["qualified", "lead"]) {
      const next = connection(sourceNodeId, "fan-in", "items");
      expect(validateWorkflowEditorConnection(document, next, options).valid).toBe(true);
      document = connectWorkflowEditorNodes(document, next, options);
    }
    expect(document.edges).toHaveLength(2);
  });

  it("never rewrites the declared input Port Type or cardinality on connect and disconnect", () => {
    const declaredType = arrayOf(stringType);
    let document: WorkflowEditorDocument = {
      nodes: [source("a"), source("b"), fanIn({ min: 1, max: 3 }, declaredType)],
      edges: [],
    };
    document = connectWorkflowEditorNodes(document, connection("a", "fan-in", "items"));
    expect(inputPort(document, "fan-in", "items")?.type).toEqual(declaredType);
    document = connectWorkflowEditorNodes(document, connection("b", "fan-in", "items"));
    expect(document.edges).toHaveLength(2);
    expect(inputPort(document, "fan-in", "items")?.type).toEqual(declaredType);
    expect(inputPort(document, "fan-in", "items")?.cardinality).toEqual({ min: 1, max: 3 });
    expect(document.nodes.find((candidate) => candidate.id === "fan-in")?.inputs).toHaveLength(1);

    for (const id of edgeIds(document)) {
      document = removeWorkflowEditorEdge(document, id);
      expect(inputPort(document, "fan-in", "items")?.type).toEqual(declaredType);
      expect(inputPort(document, "fan-in", "items")?.cardinality).toEqual({ min: 1, max: 3 });
    }
    expect(document.edges).toEqual([]);
  });

  it("does not let a single-input connection rewrite its type either", () => {
    const document: WorkflowEditorDocument = {
      nodes: [source("a", native('"x"')), sink("target", stringType)],
      edges: [],
    };
    const connected = connectWorkflowEditorNodes(document, connection("a", "target"));
    expect(inputPort(connected, "target", "in")?.type).toEqual(stringType);
  });
});

describe("connection validation: rewiring with replacingEdgeId", () => {
  it("ignores the replaced edge when counting a full single input", () => {
    const document: WorkflowEditorDocument = {
      nodes: [source("a"), source("b"), sink("target")],
      edges: [edge("edge-a", "a", "target")],
    };
    const rewire = connection("b", "target");
    expect(
      validateWorkflowEditorConnection(document, rewire, { replacingEdgeId: "edge-a" } as never),
    ).toEqual({ valid: true });
    expect(
      validateWorkflowEditorConnection(document, rewire, {
        replacingEdgeId: "edge-other",
      } as never),
    ).toMatchObject({ valid: false, reason: "target-cardinality" });
  });

  it("ignores the replaced edge when counting a full multi-source input", () => {
    const document: WorkflowEditorDocument = {
      nodes: [
        source("a"),
        source("b"),
        source("c"),
        sink("fan-in", arrayOf(stringType), { max: 2 }),
      ],
      edges: [edge("edge-a", "a", "fan-in", "items"), edge("edge-b", "b", "fan-in", "items")],
    };
    const rewire = connection("c", "fan-in", "items");
    expect(validateWorkflowEditorConnection(document, rewire).valid).toBe(false);
    expect(
      validateWorkflowEditorConnection(document, rewire, { replacingEdgeId: "edge-b" } as never)
        .valid,
    ).toBe(true);
  });

  it("ignores the replaced edge when counting a full source output", () => {
    const document: WorkflowEditorDocument = {
      nodes: [source("a", stringType, { max: 1 }), sink("t1"), sink("t2")],
      edges: [edge("edge-a-t1", "a", "t1")],
    };
    const rewire = connection("a", "t2");
    expect(validateWorkflowEditorConnection(document, rewire).valid).toBe(false);
    expect(
      validateWorkflowEditorConnection(document, rewire, { replacingEdgeId: "edge-a-t1" } as never)
        .valid,
    ).toBe(true);
  });
});

describe("document validation of cardinality", () => {
  it("adds allowExcessConnections to every preset", () => {
    expect(workflowEditorValidationPolicies.strict).toMatchObject({
      allowExcessConnections: false,
    });
    expect(workflowEditorValidationPolicies.execution).toMatchObject({
      allowExcessConnections: false,
    });
    expect(workflowEditorValidationPolicies.import).toMatchObject({ allowExcessConnections: true });
    expect(workflowEditorValidationPolicies.draft).toMatchObject({ allowExcessConnections: true });
  });

  // Edges into the default single input `target.in`; e2 and e3 exceed max 1 in document order.
  const excessSingle = (): WorkflowEditorDocument => ({
    nodes: [source("a"), source("b"), source("c"), sink("target"), sink("other")],
    edges: [
      edge("e1", "a", "target"),
      edge("ok", "a", "other"),
      edge("e2", "b", "target"),
      edge("e3", "c", "target"),
    ],
  });

  it("reports one error per edge beyond an input's max, in document order, under strict", () => {
    const diagnostics = cardinalityDiagnostics(validateWorkflowEditorDocument(excessSingle()));
    expect(diagnostics).toEqual([
      expect.objectContaining({
        code: "port-cardinality-max",
        severity: "error",
        edgeId: "e2",
        nodeId: "target",
      }),
      expect.objectContaining({
        code: "port-cardinality-max",
        severity: "error",
        edgeId: "e3",
        nodeId: "target",
      }),
    ]);
    for (const diagnostic of diagnostics) {
      expect(diagnostic.message).toEqual(expect.any(String));
      expect(diagnostic.path).toEqual(expect.any(String));
    }
  });

  it.each(["strict", "execution"] as const)(
    "rejects excess edges when normalizing under %s",
    (name) => {
      const error = catchError(() =>
        normalizeWorkflowEditorDocument(excessSingle(), {
          policy: workflowEditorValidationPolicies[name],
        }),
      );
      expect(error).toBeInstanceOf(WorkflowEditorDocumentValidationError);
      expect((error as WorkflowEditorDocumentValidationError).diagnostics).toContainEqual(
        expect.objectContaining({ code: "port-cardinality-max", severity: "error", edgeId: "e2" }),
      );
    },
  );

  it.each(["import", "draft"] as const)(
    "keeps excess edges as warnings when normalizing under %s",
    (name) => {
      const result = normalizeWorkflowEditorDocument(excessSingle(), {
        policy: workflowEditorValidationPolicies[name],
      });
      expect(edgeIds(result.document)).toEqual(["e1", "ok", "e2", "e3"]);
      expect(cardinalityDiagnostics(result.diagnostics)).toEqual([
        expect.objectContaining({
          code: "port-cardinality-max",
          severity: "warning",
          edgeId: "e2",
        }),
        expect.objectContaining({
          code: "port-cardinality-max",
          severity: "warning",
          edgeId: "e3",
        }),
      ]);
    },
  );

  it("honours a custom policy flag independently of the presets", () => {
    const policy = { ...workflowEditorValidationPolicies.strict, allowExcessConnections: true };
    const result = normalizeWorkflowEditorDocument(excessSingle(), { policy } as never);
    expect(edgeIds(result.document)).toEqual(["e1", "ok", "e2", "e3"]);
    expect(
      cardinalityDiagnostics(result.diagnostics).every(
        (diagnostic) => diagnostic.severity === "warning",
      ),
    ).toBe(true);
  });

  it("reports only the edges beyond an explicit input max", () => {
    const document: WorkflowEditorDocument = {
      nodes: [
        source("a"),
        source("b"),
        source("c"),
        source("d"),
        sink("fan-in", arrayOf(stringType), { max: 2 }),
      ],
      edges: [
        edge("f1", "a", "fan-in", "items"),
        edge("f2", "b", "fan-in", "items"),
        edge("f3", "c", "fan-in", "items"),
        edge("f4", "d", "fan-in", "items"),
      ],
    };
    expect(cardinalityDiagnostics(validateWorkflowEditorDocument(document))).toEqual([
      expect.objectContaining({ code: "port-cardinality-max", edgeId: "f3", nodeId: "fan-in" }),
      expect.objectContaining({ code: "port-cardinality-max", edgeId: "f4", nodeId: "fan-in" }),
    ]);
  });

  it("reports the edges beyond an explicit output max against the source node", () => {
    const document: WorkflowEditorDocument = {
      nodes: [source("a", stringType, { max: 1 }), sink("t1"), sink("t2")],
      edges: [edge("o1", "a", "t1"), edge("o2", "a", "t2")],
    };
    expect(cardinalityDiagnostics(validateWorkflowEditorDocument(document))).toEqual([
      expect.objectContaining({
        code: "port-cardinality-max",
        severity: "error",
        edgeId: "o2",
        nodeId: "a",
      }),
    ]);
  });

  it("does not report unbounded default outputs or ordinary single connections", () => {
    const document: WorkflowEditorDocument = {
      nodes: [source("a"), sink("t1"), sink("t2"), sink("t3")],
      edges: [edge("o1", "a", "t1"), edge("o2", "a", "t2"), edge("o3", "a", "t3")],
    };
    expect(validateWorkflowEditorDocument(document)).toEqual([]);
  });

  it("does not report a port below its min (under-min is an execution concern)", () => {
    const document: WorkflowEditorDocument = {
      nodes: [source("a"), sink("fan-in", arrayOf(stringType), { min: 2, max: 3 })],
      edges: [edge("f1", "a", "fan-in", "items")],
    };
    for (const policy of Object.values(workflowEditorValidationPolicies)) {
      expect(validateWorkflowEditorDocument(document, { policy })).toEqual([]);
    }
  });

  it.each<[string, Cardinality]>([
    ["max 3", { max: 3 }],
    ["unbounded", {}],
    ["min only (unbounded)", { min: 1 }],
  ])(
    "rejects a multi-source input (%s) with a non-array type as invalid-port-cardinality",
    (_name, cardinality) => {
      const document: WorkflowEditorDocument = {
        nodes: [source("a"), sink("fan-in", stringType, cardinality)],
        edges: [],
      };
      for (const policy of Object.values(workflowEditorValidationPolicies)) {
        expect(
          cardinalityDiagnostics(validateWorkflowEditorDocument(document, { policy })),
        ).toEqual([
          expect.objectContaining({
            code: "invalid-port-cardinality",
            severity: "error",
            nodeId: "fan-in",
          }),
        ]);
      }
      expect(() =>
        normalizeWorkflowEditorDocument(document, {
          policy: workflowEditorValidationPolicies.draft,
        }),
      ).toThrow(WorkflowEditorDocumentValidationError);
    },
  );

  it.each<[string, WorkflowEditorPortType]>([
    ["structured array", arrayOf(stringType)],
    ["TypeScript array", native("string[]")],
  ])("accepts a multi-source input with a %s type", (_name, type) => {
    const document: WorkflowEditorDocument = {
      nodes: [sink("fan-in", type, { min: 1, max: 3 })],
      edges: [],
    };
    expect(validateWorkflowEditorDocument(document)).toEqual([]);
  });

  it("does not require an array type for an output with an explicit max", () => {
    const document: WorkflowEditorDocument = {
      nodes: [source("a", numberType, { max: 3 })],
      edges: [],
    };
    expect(validateWorkflowEditorDocument(document)).toEqual([]);
  });
});

describe("repairWorkflowEditorDocument removes excess connections", () => {
  it("removes exactly the later excess edges in document order and nothing else", () => {
    const input: WorkflowEditorDocument = {
      nodes: [
        source("a"),
        source("b"),
        source("c"),
        source("d"),
        sink("target"),
        sink("other"),
        sink("fan-in", arrayOf(stringType), { max: 2 }),
      ],
      edges: [
        edge("t1", "a", "target"),
        edge("f1", "a", "fan-in", "items"),
        edge("t2", "b", "target"),
        edge("ok", "b", "other"),
        edge("f2", "b", "fan-in", "items"),
        edge("f3", "c", "fan-in", "items"),
        edge("t3", "d", "target"),
      ],
    };
    const snapshot = structuredClone(input);

    const result = repairWorkflowEditorDocument(input);

    expect(edgeIds(result.document)).toEqual(["t1", "f1", "ok", "f2"]);
    expect(result.document.nodes.map((candidate) => candidate.id)).toEqual(
      input.nodes.map((candidate) => candidate.id),
    );
    expect(inputPort(result.document, "fan-in", "items")?.cardinality).toEqual({ max: 2 });
    expect(inputPort(result.document, "fan-in", "items")?.type).toEqual(arrayOf(stringType));
    expect(result.diagnostics.map((diagnostic) => diagnostic.edgeId).sort()).toEqual(
      ["t2", "f3", "t3"].sort(),
    );
    expect(input).toEqual(snapshot);
    expect(normalizeWorkflowEditorDocument(result.document).diagnostics).toEqual([]);
  });

  it("removes excess fan-out beyond an explicit output max", () => {
    const result = repairWorkflowEditorDocument({
      nodes: [source("a", stringType, { max: 1 }), sink("t1"), sink("t2")],
      edges: [edge("o1", "a", "t1"), edge("o2", "a", "t2")],
    });
    expect(edgeIds(result.document)).toEqual(["o1"]);
  });

  it("leaves documents that only miss a min untouched", () => {
    const result = repairWorkflowEditorDocument({
      nodes: [source("a"), sink("fan-in", arrayOf(stringType), { min: 2 })],
      edges: [edge("f1", "a", "fan-in", "items")],
    });
    expect(edgeIds(result.document)).toEqual(["f1"]);
    expect(result.diagnostics).toEqual([]);
  });
});

describe("compiler", () => {
  it("fails on excess connections under the execution policy", () => {
    const error = catchError(() =>
      compileWorkflowEditorDocument({
        nodes: [source("a"), source("b"), sink("target")],
        edges: [edge("e1", "a", "target"), edge("e2", "b", "target")],
      }),
    );
    expect(error).toBeInstanceOf(Error);
    const diagnostics = (error as { diagnostics?: Array<{ code: string }> }).diagnostics ?? [];
    expect(
      diagnostics.some(
        (diagnostic) =>
          diagnostic.code === "port-cardinality-max" || diagnostic.code === "port-cardinality",
      ),
    ).toBe(true);
  });

  it("fails with a port-cardinality diagnostic for a port below its min", () => {
    const error = catchError(() =>
      compileWorkflowEditorDocument({
        nodes: [source("a"), sink("fan-in", arrayOf(stringType), { min: 2, max: 3 })],
        edges: [edge("f1", "a", "fan-in", "items")],
      }),
    );
    expect(error).toBeInstanceOf(WorkflowEditorCompileError);
    expect((error as WorkflowEditorCompileError).diagnostics).toEqual([
      expect.objectContaining({ code: "port-cardinality", nodeId: "fan-in", portId: "items" }),
    ]);
  });

  it("preserves declared input and output cardinality in the compiled contract", () => {
    const compiled = compileWorkflowEditorDocument({
      nodes: [
        source("a", stringType, { max: 2 }),
        source("b"),
        sink("fan-in", arrayOf(stringType), { min: 1, max: 3 }),
      ],
      edges: [edge("f1", "a", "fan-in", "items"), edge("f2", "b", "fan-in", "items")],
    });
    const fanIn = compiled.nodes.find((candidate) => candidate.id === "fan-in")!;
    expect(fanIn.inputs?.[0]).toMatchObject({
      id: "items",
      type: arrayOf(stringType),
      cardinality: { min: 1, max: 3 },
    });
    expect(
      compiled.nodes.find((candidate) => candidate.id === "a")?.outputs?.[0]?.cardinality,
    ).toEqual({ max: 2 });
    expect(
      compiled.nodes.find((candidate) => candidate.id === "b")?.outputs?.[0],
    ).not.toHaveProperty("cardinality");
  });
});

describe("control.merge template", () => {
  const mergeTemplate = () =>
    defaultWorkflowEditorNodeTemplates.find((template) => template.id === "control-flow-merge")!;

  it("declares exactly one multi-source items input and one out output", () => {
    const template = mergeTemplate();
    expect(template.kind).toBe("control.merge");
    expect(template.inputs).toEqual([
      {
        id: "items",
        label: "Items",
        type: { kind: "array", element: { kind: "any" } },
        cardinality: { min: 1 },
      },
    ]);
    expect(template.outputs?.map((candidate) => candidate.id)).toEqual(["out"]);
  });

  it("infers the output as an array of the union of the connected source types", () => {
    let document: WorkflowEditorDocument = {
      nodes: [
        source("text", stringType),
        source("count", numberType),
        builtIn("control.merge", "merge"),
      ],
      edges: [],
    };
    for (const sourceNodeId of ["text", "count"]) {
      const next = connection(sourceNodeId, "merge", "items");
      expect(validateWorkflowEditorConnection(document, next).valid).toBe(true);
      document = connectWorkflowEditorNodes(document, next);
    }
    expect(document.edges).toHaveLength(2);
    expect(inputPort(document, "merge", "items")?.type).toEqual({
      kind: "array",
      element: { kind: "any" },
    });

    const out = outputPort(document, "merge", "out")!.type;
    const resolver = createWorkflowEditorTypeResolver([], "");
    expect(resolver.isAssignable(out, native("(string | number)[]"))).toBe(true);
    expect(resolver.isAssignable(native("(string | number)[]"), out)).toBe(true);
    expect(resolver.isAssignable(out, native("string[]"))).toBe(false);

    const compiled = compileWorkflowEditorDocument(document);
    const compiledOut = compiled.nodes.find((candidate) => candidate.id === "merge")!.outputs![0]!;
    expect(resolver.isAssignable(compiledOut.type, native("(string | number)[]"))).toBe(true);
  });

  it("requires at least one source at compile time", () => {
    const error = catchError(() =>
      compileWorkflowEditorDocument({ nodes: [builtIn("control.merge", "merge")], edges: [] }),
    );
    expect(error).toBeInstanceOf(WorkflowEditorCompileError);
    expect((error as WorkflowEditorCompileError).diagnostics).toContainEqual(
      expect.objectContaining({ code: "port-cardinality", nodeId: "merge", portId: "items" }),
    );
  });
});

describe("cardinality metadata survives document operations", () => {
  const document = (): WorkflowEditorDocument => ({
    nodes: [
      source("a", stringType, { max: 4 }),
      sink("fan-in", arrayOf(stringType), { min: 1, max: 3 }),
    ],
    edges: [edge("f1", "a", "fan-in", "items")],
  });

  it("roundtrips through export and restore", () => {
    const file = buildWorkflowEditorDocumentFile(document(), {
      exportedAt: "2026-10-17T00:00:00.000Z",
    });
    const restored = restoreWorkflowEditorDocumentFile(JSON.parse(JSON.stringify(file))).document;
    expect(inputPort(restored, "fan-in", "items")?.cardinality).toEqual({ min: 1, max: 3 });
    expect(inputPort(restored, "fan-in", "items")?.type).toEqual(arrayOf(stringType));
    expect(outputPort(restored, "a", "out")?.cardinality).toEqual({ max: 4 });
  });

  it("is kept when duplicating a node", () => {
    const original = document();
    const duplicated = duplicateWorkflowEditorNode(original, "fan-in");
    const copy = duplicated.nodes.find(
      (candidate) => !original.nodes.some((existing) => existing.id === candidate.id),
    )!;
    expect(copy).toBeDefined();
    expect((copy.inputs?.[0] as CardinalityPort | undefined)?.cardinality).toEqual({
      min: 1,
      max: 3,
    });
  });
});

describe("removed sidecar cardinality API", () => {
  it("is not exported from the core or root entrypoints", async () => {
    const index = await import("./index");
    for (const name of [
      "validateWorkflowEditorConnectionWithCardinality",
      "connectWorkflowEditorNodesWithCardinality",
      "validateWorkflowEditorConnectionCardinality",
      "getWorkflowEditorPortConnectionCount",
      "analyzeWorkflowEditorPortCardinality",
    ]) {
      expect(name in core).toBe(false);
      expect(name in index).toBe(false);
    }
    expect(index.validateWorkflowEditorConnection).toBe(core.validateWorkflowEditorConnection);
    expect(index.connectWorkflowEditorNodes).toBe(core.connectWorkflowEditorNodes);
    expect(index.repairWorkflowEditorDocument).toBe(core.repairWorkflowEditorDocument);
  });

  it("has no ./cardinality module or package entrypoint", async () => {
    const modulePath = "./cardinality";
    await expect(import(/* @vite-ignore */ modulePath)).rejects.toThrow();
    const pkg = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8")) as {
      exports: Record<string, unknown>;
      scripts: Record<string, string>;
    };
    expect(pkg.exports["./cardinality"]).toBeUndefined();
    expect(pkg.scripts.build).not.toContain("cardinality");
  });
});
