import ts from "typescript";
import { describe, expect, test } from "vitest";
import { isWorkflowEditorPortTypeAssignable, type WorkflowEditorPortType } from "./core";

const native = (source: string): WorkflowEditorPortType => ({ kind: "typescript", source });

// Independent oracle: the installed compiler loads its own real filesystem libraries and
// reports diagnostics for an ordinary assignment, without the editor adapter or host.
function oracle(source: string, target: string) {
  const fileName = "/oracle.ts";
  const code = `declare const value: ${source}; const result: ${target} = value;`;
  const options = { strict: true, exactOptionalPropertyTypes: true, noEmit: true };
  const host = ts.createCompilerHost(options);
  const original = host.getSourceFile.bind(host);
  host.getSourceFile = (name, languageVersion, onError, shouldCreateNewSourceFile) =>
    name === fileName
      ? ts.createSourceFile(name, code, languageVersion, true)
      : original(name, languageVersion, onError, shouldCreateNewSourceFile);
  const program = ts.createProgram([fileName], options, host);
  return program.getSemanticDiagnostics().length === 0;
}

describe("native TypeScript port semantics", () => {
  test.each([
    ["unknown", "unknown"],
    ["string | number", "number | string"],
    ["{ id: string; label?: string }", "{ id: string }"],
    ["{ id?: string }", "{ id: string }"],
    ["{ x: string | undefined }", "{ x?: string }"],
    ["{ id: string } & { active: boolean }", "{ id: string; active: boolean }"],
    ["ReadonlyArray<string>", "string[]"],
    ['Array<"yes" | "no">', "string[]"],
    ["Partial<{ id: string }>", "{ id: string }"],
    ['{ kind: "a" } | { kind: "b" }', '{ kind: "a" | "b" }'],
    ["(x: string) => string", "(x: number) => string"],
    ["[string, number]", "Array<string | number>"],
  ])("agrees with the checker for %s → %s", (source, target) => {
    expect(isWorkflowEditorPortTypeAssignable(native(source), native(target))).toBe(
      oracle(source, target),
    );
  });
});

import {
  analyzeWorkflowEditorPortTypes,
  connectWorkflowEditorNodes,
  defaultWorkflowEditorNodeTemplates,
  normalizeWorkflowEditorDocument,
  validateWorkflowEditorConnection,
  validateWorkflowEditorDocument,
  type WorkflowEditorDocument,
} from "./core";
import { compileWorkflowEditorDocument } from "./compiler";
import { buildWorkflowEditorDocumentFile, restoreWorkflowEditorDocumentFile } from "./persistence";

const connection = {
  sourceNodeId: "source",
  sourcePortId: "out",
  targetNodeId: "target",
  targetPortId: "in",
};
function documentWithTypes(
  source: string,
  target: string,
  typeDeclarations = "",
): WorkflowEditorDocument {
  return {
    typeDeclarations,
    nodes: [
      {
        id: "source",
        label: "Source",
        kind: "data.value",
        x: 0,
        y: 0,
        outputs: [{ id: "out", label: "Out", type: native(source) }],
      },
      {
        id: "target",
        label: "Target",
        kind: "data.input",
        x: 300,
        y: 0,
        inputs: [{ id: "in", label: "In", type: native(target) }],
      },
    ],
    edges: [],
  };
}

describe("native type document contracts", () => {
  test("generic aliases, conditional/mapped types, and recursive objects use the compiler", () => {
    const declarations =
      "type Box<T> = { value: T }; type Customer = { id: string; next?: Customer }; type Keys<T> = { [K in keyof T]: T[K] };";
    const document = documentWithTypes(
      "Box<Customer>",
      "Keys<{ value: { id: string } }>",
      declarations,
    );
    expect(validateWorkflowEditorConnection(document, connection)).toEqual({ valid: true });
    expect(
      validateWorkflowEditorConnection(
        documentWithTypes("Customer", "number", declarations),
        connection,
      ),
    ).toEqual(
      expect.objectContaining({
        valid: false,
        reason: "type-mismatch",
        message: expect.stringContaining("TS2322"),
      }),
    );
  });
  test("declaration edits invalidate cached checking and missing declarations fail closed", () => {
    const original = documentWithTypes(
      "Customer",
      "{ id: string }",
      "type Customer = { id: string };",
    );
    expect(validateWorkflowEditorConnection(original, connection).valid).toBe(true);
    const edited = { ...original, typeDeclarations: "type Customer = { id: number };" };
    expect(validateWorkflowEditorConnection(edited, connection).valid).toBe(false);
    const missing = { ...original, typeDeclarations: "" };
    expect(validateWorkflowEditorConnection(missing, connection).valid).toBe(false);
    expect(analyzeWorkflowEditorPortTypes(missing)[0]?.message).toContain(
      "Cannot find name 'Customer'",
    );
    expect(validateWorkflowEditorConnection(original, connection).valid).toBe(true);
  });
  test("does not accept expression injection, imports, or unsupported legacy records", () => {
    expect(
      validateWorkflowEditorConnection(
        documentWithTypes("string); const injected = 1; type Extra = (any", "number"),
        connection,
      ).valid,
    ).toBe(false);
    expect(
      validateWorkflowEditorConnection(
        documentWithTypes("any", "any", 'import type { X } from "./x";'),
        connection,
      ).valid,
    ).toBe(false);
    const malformed = documentWithTypes("string", "string");
    malformed.nodes[0]!.outputs![0]!.type = {
      kind: "legacy-opaque",
    } as unknown as WorkflowEditorPortType;
    expect(validateWorkflowEditorDocument(malformed)[0]?.code).toBe("invalid-port-type");
    expect(() => normalizeWorkflowEditorDocument(malformed)).toThrow(
      "Unsupported workflow port type",
    );
  });
  test("roundtrips declarations and type expressions through export and compiler handoff", () => {
    const document = connectWorkflowEditorNodes(
      documentWithTypes(
        "Customer",
        "{ id: string }",
        "type Customer = { id: string; label?: string };",
      ),
      connection,
    );
    const file = buildWorkflowEditorDocumentFile(document, {
      exportedAt: "2026-10-14T00:00:00.000Z",
    });
    const restored = restoreWorkflowEditorDocumentFile(JSON.parse(JSON.stringify(file))).document;
    expect(restored.typeDeclarations).toBe(document.typeDeclarations);
    expect(restored.nodes[0]?.outputs?.[0]?.type).toEqual(native("Customer"));
    const compiled = compileWorkflowEditorDocument(restored);
    expect(compiled.typeDeclarations).toBe(document.typeDeclarations);
    expect(compiled.nodes[0]?.outputs?.[0]?.type).toEqual(native("Customer"));
    expect(compiled.order).toEqual(["source", "target"]);
    expect(() => compileWorkflowEditorDocument({ ...restored, typeDeclarations: "" })).toThrow(
      "Cannot find name 'Customer'",
    );
  });
  test("empty legacy intersections do not become assignable never types", () => {
    expect(
      isWorkflowEditorPortTypeAssignable({ kind: "intersection", types: [] }, native("number")),
    ).toBe(oracle("unknown", "number"));
    expect(
      isWorkflowEditorPortTypeAssignable(native("number"), { kind: "intersection", types: [] }),
    ).toBe(oracle("number", "unknown"));
  });
  test("user comments cannot suppress compatibility checking", () => {
    expect(
      validateWorkflowEditorConnection(
        documentWithTypes("string", "number", "// @ts-nocheck\n"),
        connection,
      ).valid,
    ).toBe(false);
    expect(
      validateWorkflowEditorConnection(
        documentWithTypes("Missing", "number", "// @ts-ignore\n"),
        connection,
      ).valid,
    ).toBe(false);
    expect(
      validateWorkflowEditorConnection(documentWithTypes('"@ts-ignore"', "string"), connection)
        .valid,
    ).toBe(true);
  });
  test("diagnoses invalid declarations even when no ports reference them", () => {
    expect(() =>
      compileWorkflowEditorDocument({
        nodes: [],
        edges: [],
        typeDeclarations: "type Broken = Missing;",
      }),
    ).toThrow("Cannot find name 'Missing'");
  });
  test("compiler includes host catalog definitions instead of dropping their meaning", () => {
    const document = documentWithTypes("Customer", "{ id: string }");
    const typeDefinitions = [{ name: "Customer", type: native("{ id: string }") }];
    const connected = connectWorkflowEditorNodes(document, connection, { typeDefinitions });
    const compiled = compileWorkflowEditorDocument(connected, { typeDefinitions });
    expect(compiled.typeDeclarations).toContain("type Customer = ({ id: string });");
    expect(compiled.nodes[0]?.outputs?.[0]?.type).toEqual(native("Customer"));
  });
  test("propagates branch/filter outputs and merge unions; source edits and removal recompute", () => {
    const builtIn = (kind: string, id: string) => ({
      ...defaultWorkflowEditorNodeTemplates.find((template) => template.kind === kind)!,
      id,
      x: 0,
      y: 0,
    });
    let document: WorkflowEditorDocument = {
      ...documentWithTypes("Customer[]", "unknown", "type Customer = { id: string };"),
      nodes: [
        documentWithTypes("Customer[]", "unknown").nodes[0]!,
        builtIn("collection.filter", "filter"),
        builtIn("control.if", "branch"),
        builtIn("control.merge", "merge"),
        {
          id: "fallback",
          label: "Fallback",
          kind: "data.value",
          x: 0,
          y: 0,
          outputs: [{ id: "out", label: "Out", type: native('"none"') }],
        },
      ],
      edges: [],
    };
    for (const [sourceNodeId, sourcePortId, targetNodeId, targetPortId] of [
      ["source", "out", "filter", "items"],
      ["filter", "items", "branch", "value"],
      ["branch", "true", "merge", "a"],
      ["fallback", "out", "merge", "b"],
    ]) {
      document = connectWorkflowEditorNodes(document, {
        sourceNodeId: sourceNodeId!,
        sourcePortId: sourcePortId!,
        targetNodeId: targetNodeId!,
        targetPortId: targetPortId!,
      });
    }
    const output = (id: string) => document.nodes.find((node) => node.id === id)!.outputs![0]!.type;
    expect(output("filter")).toEqual(native("Customer[]"));
    expect(output("branch")).toEqual(native("Customer[]"));
    expect(output("merge")).toEqual(native('(Customer[]) | ("none")'));
    document = normalizeWorkflowEditorDocument({
      ...document,
      nodes: document.nodes.map((node) =>
        node.id === "source"
          ? { ...node, outputs: [{ id: "out", label: "Out", type: native("number[]") }] }
          : node,
      ),
    });
    expect(output("merge")).toEqual(native('(number[]) | ("none")'));
    document = normalizeWorkflowEditorDocument({ ...document, edges: [] });
    expect(output("branch")).toEqual({ kind: "any" });
    expect(output("filter")).toEqual({ kind: "array", element: { kind: "any" } });
  });
  test("ordinary output fan-out works while occupied input and DAG rules stay unchanged", () => {
    let document = documentWithTypes("string", "string");
    document.nodes.push({ ...document.nodes[1]!, id: "other" });
    document = connectWorkflowEditorNodes(document, connection);
    document = connectWorkflowEditorNodes(document, { ...connection, targetNodeId: "other" });
    expect(document.edges).toHaveLength(2);
    expect(
      validateWorkflowEditorConnection(document, { ...connection, sourceNodeId: "missing" }).valid,
    ).toBe(false);
    expect(connectWorkflowEditorNodes(document, connection)).toBe(document);
  });
});
