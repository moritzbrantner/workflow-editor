// Retrospective acceptance (independent agent, PR #62) — not pre-implementation authorship.
// Issue #59 / Decision Atlas 1.1, 1.2, 2.1: the TypeScript checker is authoritative for port
// compatibility, incompatible connections are explained without mutating the graph, branch
// outputs expose possible types, legacy records fail closed, and DAG rules stay unchanged.
import ts from "typescript";
import { describe, expect, test } from "vitest";

import {
  analyzeWorkflowEditorPortTypes,
  buildWorkflowEditorDocumentFile,
  connectWorkflowEditorNodes,
  defaultWorkflowEditorNodeTemplates,
  isWorkflowEditorPortTypeAssignable,
  normalizeWorkflowEditorDocument,
  restoreWorkflowEditorDocumentFile,
  validateWorkflowEditorConnection,
  type WorkflowEditorDocument,
  type WorkflowEditorPortType,
} from "./index";
import { compileWorkflowEditorDocument } from "./compiler";
import { workflowEditorPortTypeSource } from "./core-type-source";

const native = (source: string): WorkflowEditorPortType => ({ kind: "typescript", source });

// Independent oracle: an ordinary assignment checked by the installed compiler against its own
// standard library files. It shares no code with the editor's resolver. The editor documents
// strict checking with exactOptionalPropertyTypes and noUncheckedIndexedAccess; the cases below
// are chosen so that only `optional-undefined` depends on those flags.
// Timing-only test infrastructure: standard library files are parsed once and shared across
// oracle programs, and each (source, target, declarations) verdict is computed once. Inputs,
// compiler options and assertions are unchanged.
const libraryFiles = new Map<string, ts.SourceFile | undefined>();
const verdicts = new Map<string, boolean>();
function oracle(source: string, target: string, declarations = "") {
  const key = JSON.stringify([source, target, declarations]);
  const cached = verdicts.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const verdict = computeOracle(source, target, declarations);
  verdicts.set(key, verdict);
  return verdict;
}
function computeOracle(source: string, target: string, declarations: string) {
  const fileName = "/retrospective-oracle.ts";
  const code = `${declarations}\ndeclare const value: ${source};\nconst result: ${target} = value;\nexport {};`;
  const options: ts.CompilerOptions = {
    strict: true,
    exactOptionalPropertyTypes: true,
    noUncheckedIndexedAccess: true,
    noEmit: true,
    target: ts.ScriptTarget.ES2022,
    types: [],
    skipLibCheck: true,
  };
  const host = ts.createCompilerHost(options);
  const original = host.getSourceFile.bind(host);
  host.getSourceFile = (name, version, onError, fresh) => {
    if (name === fileName) {
      return ts.createSourceFile(name, code, version, true);
    }
    if (!libraryFiles.has(name)) {
      libraryFiles.set(name, original(name, version, onError, fresh));
    }
    return libraryFiles.get(name);
  };
  const program = ts.createProgram([fileName], options, host);
  const diagnostics = [...program.getSyntacticDiagnostics(), ...program.getSemanticDiagnostics()];
  return diagnostics.length === 0;
}

const connection = {
  sourceNodeId: "source",
  sourcePortId: "out",
  targetNodeId: "target",
  targetPortId: "in",
};

function twoNodes(
  source: WorkflowEditorPortType,
  target: WorkflowEditorPortType,
  typeDeclarations?: string,
): WorkflowEditorDocument {
  return {
    ...(typeDeclarations === undefined ? {} : { typeDeclarations }),
    nodes: [
      {
        id: "source",
        label: "Source",
        kind: "data.value",
        x: 0,
        y: 0,
        outputs: [{ id: "out", label: "Out", type: source }],
      },
      {
        id: "target",
        label: "Target",
        kind: "data.input",
        x: 300,
        y: 0,
        inputs: [{ id: "in", label: "In", type: target }],
      },
    ],
    edges: [],
  };
}

const declarations = [
  "interface Customer { id: string; nickname?: string }",
  'interface Admin extends Customer { role: "admin" }',
  "type Named = { name: string };",
  "type Box<T> = { value: T };",
  'type Status = "active" | "archived";',
  "type Pair<A, B> = [A, B];",
  "type Maybe<T> = T extends string ? { text: T } : never;",
].join("\n");

describe("retrospective: user-authored declarations agree with the TypeScript checker", () => {
  const cases: Array<[name: string, source: string, target: string]> = [
    ["alias to structural object", "Customer", "{ id: string }"],
    ["missing required field", "Customer", "{ id: string; nickname: string }"],
    ["structural object to interface", "{ id: string }", "Customer"],
    ["incompatible primitive", "Customer", "number"],
    ["interface inheritance", "Admin", "Customer"],
    ["reverse inheritance", "Customer", "Admin"],
    ["generic alias", "Box<Customer>", "Box<{ id: string }>"],
    ["generic alias mismatch", "Box<string>", "Box<number>"],
    ["literal union widening", "Status", "string"],
    ["string to literal union", "string", "Status"],
    ["literal member", '"active"', "Status"],
    ["intersection", "Customer & Named", "{ id: string; name: string }"],
    ["union to member", "Customer | Named", "Customer"],
    ["generic tuple", "Pair<string, number>", "[string, number]"],
    ["generic tuple order", "Pair<string, number>", "[number, string]"],
    ["indexed access", 'Box<Status>["value"]', "string"],
    ["readonly mapped utility", "Readonly<Customer>", "Customer"],
    ["conditional alias", 'Maybe<"x">', "{ text: string }"],
    ["optional-undefined", "{ id: string; nickname: undefined }", "Customer"],
  ];

  test("the case table covers both accepted and rejected outcomes", () => {
    const outcomes = new Set(
      cases.map(([, source, target]) => oracle(source, target, declarations)),
    );
    expect(outcomes).toEqual(new Set([true, false]));
  });

  test.each(cases)("%s: %s → %s", (_name, source, target) => {
    const expected = oracle(source, target, declarations);
    const document = twoNodes(native(source), native(target), declarations);
    const result = validateWorkflowEditorConnection(document, connection);
    expect(result.valid).toBe(expected);
    // Cardinality is enforced by the same core validator (#15); a single free input never
    // changes the checker verdict.
    expect(validateWorkflowEditorConnection(document, connection, {}).valid).toBe(expected);
    if (!expected) {
      expect(result).toEqual(expect.objectContaining({ reason: "type-mismatch" }));
    }
  });

  test("legacy structured records are compared through the same checker semantics", () => {
    const legacyCustomer: WorkflowEditorPortType = {
      kind: "object",
      properties: { id: { type: { kind: "string" } } },
    } as WorkflowEditorPortType;
    expect(isWorkflowEditorPortTypeAssignable(legacyCustomer, native("{ id: string }"))).toBe(
      oracle("{ id: string }", "{ id: string }"),
    );
    expect(isWorkflowEditorPortTypeAssignable(legacyCustomer, native("{ id: number }"))).toBe(
      oracle("{ id: string }", "{ id: number }"),
    );
    expect(isWorkflowEditorPortTypeAssignable({ kind: "string" }, native("number"))).toBe(
      oracle("string", "number"),
    );
  });
});

describe("retrospective: rejection is explained deterministically and never mutates", () => {
  test("incompatible connections return the checker diagnostic and keep the document", () => {
    const document = twoNodes(native("Customer"), native("number"), declarations);
    const snapshot = structuredClone(document);
    const first = validateWorkflowEditorConnection(document, connection);
    // Interleave another check so cached state cannot change the reported explanation.
    validateWorkflowEditorConnection(
      twoNodes(native("string"), native("string"), "type Other = 1;"),
      connection,
    );
    const second = validateWorkflowEditorConnection(document, connection);
    expect(first.valid).toBe(false);
    expect(second).toEqual(first);
    const message = (first as { message?: string }).message ?? "";
    expect(message).toContain("Customer");
    expect(message).toContain("number");
    expect(message).not.toContain("__Workflow");

    const connected = connectWorkflowEditorNodes(document, connection);
    expect(connected.edges).toHaveLength(0);
    expect(document).toEqual(snapshot);
  });

  test("document diagnostics for stale declarations are stable across runs", () => {
    const stale = connectWorkflowEditorNodes(
      twoNodes(native("Customer"), native("{ id: string }"), declarations),
      connection,
    );
    expect(stale.edges).toHaveLength(1);
    const withoutCustomer = { ...stale, typeDeclarations: "type Unrelated = string;" };
    const first = analyzeWorkflowEditorPortTypes(withoutCustomer);
    const second = analyzeWorkflowEditorPortTypes(structuredClone(withoutCustomer));
    expect(first.length).toBeGreaterThan(0);
    expect(second).toEqual(first);
    expect(first.map((diagnostic) => diagnostic.message).join(" ")).toContain(
      "Cannot find name 'Customer'",
    );
    // A stale declaration is reported; the saved edge is not silently dropped.
    expect(normalizeWorkflowEditorDocument(withoutCustomer).document.edges).toHaveLength(1);
  });
});

describe("retrospective: possible branch outputs", () => {
  const builtIn = (kind: string, id: string) => ({
    ...defaultWorkflowEditorNodeTemplates.find((template) => template.kind === kind)!,
    id,
    x: 0,
    y: 0,
  });

  test("both If branches expose the routed type and merging them stays that type", () => {
    let document: WorkflowEditorDocument = {
      ...twoNodes(native('"active"'), native("unknown"), declarations),
      nodes: [
        twoNodes(native("Status"), native("unknown")).nodes[0]!,
        builtIn("control.if", "branch"),
        builtIn("control.merge", "merge"),
      ],
    };
    for (const [sourceNodeId, sourcePortId, targetNodeId, targetPortId] of [
      ["source", "out", "branch", "value"],
      // control.merge has one multi-source `items` input (#15, Decision 1.9/1.10).
      ["branch", "true", "merge", "items"],
      ["branch", "false", "merge", "items"],
    ] as const) {
      const next = connectWorkflowEditorNodes(document, {
        sourceNodeId,
        sourcePortId,
        targetNodeId,
        targetPortId,
      });
      expect(next.edges.length).toBe(document.edges.length + 1);
      document = next;
    }
    const output = (nodeId: string, portId: string) =>
      document.nodes
        .find((node) => node.id === nodeId)!
        .outputs!.find((port) => port.id === portId)!.type;
    // Static analysis must not claim which branch runs or narrow to a runtime value.
    expect(output("branch", "true")).toEqual(native("Status"));
    expect(output("branch", "false")).toEqual(native("Status"));
    const merged = output("merge", "out");
    // The merge output is an array of the union of the connected source types: Status[].
    const mergedSource = workflowEditorPortTypeSource(merged);
    expect(oracle(mergedSource, "Status[]", declarations)).toBe(true);
    expect(oracle("Status[]", mergedSource, declarations)).toBe(true);

    const compiled = compileWorkflowEditorDocument(document);
    expect(compiled.typeDeclarations).toContain("type Status");
    expect(
      compiled.nodes
        .find((node) => node.id === "merge")!
        .outputs!.find((port) => port.id === "out")!.type,
    ).toEqual(merged);
  });
});

describe("retrospective: DAG and fan-out rules are unchanged by native typing", () => {
  test("a type-compatible connection that closes a cycle is still rejected", () => {
    const passthrough = (id: string) => ({
      id,
      label: id,
      kind: "data.transform",
      x: 0,
      y: 0,
      inputs: [{ id: "in", label: "In", type: native("Customer") }],
      outputs: [{ id: "out", label: "Out", type: native("Customer") }],
    });
    let document: WorkflowEditorDocument = {
      typeDeclarations: declarations,
      nodes: [passthrough("a"), passthrough("b")],
      edges: [],
    };
    document = connectWorkflowEditorNodes(document, {
      sourceNodeId: "a",
      sourcePortId: "out",
      targetNodeId: "b",
      targetPortId: "in",
    });
    expect(document.edges).toHaveLength(1);
    const back = { sourceNodeId: "b", sourcePortId: "out", targetNodeId: "a", targetPortId: "in" };
    expect(validateWorkflowEditorConnection(document, back)).toEqual(
      expect.objectContaining({ valid: false, reason: "cycle" }),
    );
    expect(connectWorkflowEditorNodes(document, back).edges).toHaveLength(1);
  });

  test("one typed output may feed several compatible inputs (Decision 1.7)", () => {
    let document = twoNodes(native("Customer"), native("{ id: string }"), declarations);
    document.nodes.push({ ...document.nodes[1]!, id: "second" });
    document = connectWorkflowEditorNodes(document, connection);
    document = connectWorkflowEditorNodes(document, { ...connection, targetNodeId: "second" });
    expect(document.edges).toHaveLength(2);
  });
});

describe("retrospective: persistence keeps type intent and fails closed", () => {
  test("legacy structured records roundtrip unchanged instead of being rewritten", () => {
    const legacy: WorkflowEditorPortType = {
      kind: "object",
      properties: { id: { type: { kind: "string" } } },
    } as WorkflowEditorPortType;
    const document = connectWorkflowEditorNodes(
      twoNodes(legacy, native("{ id: string }"), ""),
      connection,
    );
    expect(document.edges).toHaveLength(1);
    const restored = restoreWorkflowEditorDocumentFile(
      JSON.parse(JSON.stringify(buildWorkflowEditorDocumentFile(document))),
    ).document;
    expect(restored.nodes[0]!.outputs![0]!.type).toEqual(legacy);
    expect(restored.nodes[1]!.inputs![0]!.type).toEqual(native("{ id: string }"));
    expect(restored.edges).toHaveLength(1);
  });

  test("an imported file with an unsupported port record is reported, not rewritten", () => {
    const file = JSON.parse(
      JSON.stringify(
        buildWorkflowEditorDocumentFile(twoNodes(native("string"), native("string"), "")),
      ),
    );
    file.document.nodes[0].outputs[0].type = { kind: "legacy-opaque", schema: "v0" };
    expect(() => restoreWorkflowEditorDocumentFile(file)).toThrow(/Unsupported workflow port type/);
  });

  test("declarations survive export and import byte-for-byte", () => {
    const document = twoNodes(native("Box<Customer>"), native("Box<{ id: string }>"), declarations);
    const restored = restoreWorkflowEditorDocumentFile(
      JSON.parse(JSON.stringify(buildWorkflowEditorDocumentFile(document))),
    ).document;
    expect(restored.typeDeclarations).toBe(declarations);
    expect(restored.nodes[0]!.outputs![0]!.type).toEqual(native("Box<Customer>"));
    expect(validateWorkflowEditorConnection(restored, connection).valid).toBe(true);
  });
});
