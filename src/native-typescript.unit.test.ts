import {
  validateWorkflowEditorConnectionWithCardinality,
  connectWorkflowEditorNodesWithCardinality,
} from "./cardinality";
import ts from "typescript";
import { describe, expect, test } from "vitest";
import { isWorkflowEditorPortTypeAssignable, type WorkflowEditorPortType } from "./core";

const native = (source: string): WorkflowEditorPortType => ({ kind: "typescript", source });

// Independent oracle: the installed compiler loads its own real filesystem libraries and
// reports diagnostics for an ordinary assignment, without the editor adapter or host.
function oracle(source: string, target: string, declarations = "") {
  const fileName = "/oracle.ts";
  const code = `${declarations}\ndeclare const value: ${source}; const result: ${target} = value;`;
  const options = {
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
  addWorkflowEditorObjectDecompositionOutputToNode,
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
  test("cardinality validation uses document and override declarations", () => {
    const document = documentWithTypes("Customer", "Customer", "type Customer = { id: string };");
    expect(validateWorkflowEditorConnectionWithCardinality(document, connection).valid).toBe(true);
    expect(connectWorkflowEditorNodesWithCardinality(document, connection).edges).toHaveLength(1);
    const branchDocument = documentWithTypes("Customer", "number", document.typeDeclarations);
    branchDocument.nodes.push({
      ...defaultWorkflowEditorNodeTemplates.find((template) => template.kind === "control.if")!,
      id: "branch",
      x: 0,
      y: 0,
    });
    branchDocument.edges.push({
      id: "to-branch",
      sourceNodeId: "source",
      sourcePortId: "out",
      targetNodeId: "branch",
      targetPortId: "value",
    });
    const branchedConnection = { ...connection, sourceNodeId: "branch", sourcePortId: "true" };
    expect(validateWorkflowEditorConnection(branchDocument, branchedConnection).valid).toBe(false);
    expect(
      validateWorkflowEditorConnectionWithCardinality(branchDocument, branchedConnection).valid,
    ).toBe(false);

    expect(
      validateWorkflowEditorConnectionWithCardinality(
        documentWithTypes("Customer", "{ id: string }", "type Customer = { id: number };"),
        connection,
        { typeDeclarations: "type Customer = { id: string };" },
      ).valid,
    ).toBe(true);
  });
  test("connection mutations retain effective host-projected property types", () => {
    const template = defaultWorkflowEditorNodeTemplates.find(
      (candidate) => candidate.kind === "json.object.decompose",
    )!;
    const decompose = addWorkflowEditorObjectDecompositionOutputToNode(
      { ...template, id: "decompose", x: 100, y: 0 },
      { portId: "id", propertyKey: "id" },
    );
    const document = documentWithTypes("Customer", "unknown");
    document.nodes = [document.nodes[0]!, decompose];
    const connection = {
      sourceNodeId: "source",
      sourcePortId: "out",
      targetNodeId: "decompose",
      targetPortId: "object",
    };
    const options = { typeDefinitions: [{ name: "Customer", type: native("{ id: string }") }] };
    for (const connect of [connectWorkflowEditorNodes, connectWorkflowEditorNodesWithCardinality]) {
      const connected = connect(document, connection, options);
      expect(
        connected.nodes
          .find((node) => node.id === "decompose")
          ?.outputs?.find((port) => port.id === "id")?.type,
      ).toEqual({ kind: "string" });
      const overridden = connect(
        { ...document, typeDeclarations: "type Customer = { id: number };" },
        connection,
        { typeDeclarations: "type Customer = { id: string };" },
      );
      expect(
        overridden.nodes
          .find((node) => node.id === "decompose")
          ?.outputs?.find((port) => port.id === "id")?.type,
      ).toEqual({ kind: "string" });
    }
  });
  test("compiler emits property types projected from effective host declarations", () => {
    const template = defaultWorkflowEditorNodeTemplates.find(
      (candidate) => candidate.kind === "json.object.decompose",
    )!;
    const decompose = addWorkflowEditorObjectDecompositionOutputToNode(
      { ...template, id: "decompose", x: 100, y: 0 },
      { portId: "id", propertyKey: "id" },
    );
    const document = documentWithTypes("Customer", "unknown");
    document.nodes = [document.nodes[0]!, decompose];
    document.edges = [
      {
        id: "incoming",
        sourceNodeId: "source",
        sourcePortId: "out",
        targetNodeId: "decompose",
        targetPortId: "object",
      },
    ];
    const compiled = compileWorkflowEditorDocument(document, {
      typeDefinitions: [{ name: "Customer", type: native("{ id: string }") }],
    });
    expect(
      compiled.nodes
        .find((node) => node.id === "decompose")
        ?.outputs?.find((port) => port.id === "id")?.type,
    ).toEqual({ kind: "string" });
    const overridden = compileWorkflowEditorDocument(
      { ...document, typeDeclarations: "type Customer = { id: number };" },
      { typeDeclarations: "type Customer = { id: string };" },
    );
    expect(
      overridden.nodes
        .find((node) => node.id === "decompose")
        ?.outputs?.find((port) => port.id === "id")?.type,
    ).toEqual({ kind: "string" });
  });
  test("opaque legacy catalog names and inheritance retain their meaning", () => {
    const definitions = [
      {
        name: "order-item",
        type: { kind: "object", properties: { id: { type: { kind: "string" } } } },
      },
      {
        name: "class",
        extends: ["order-item"],
        type: { kind: "object", properties: { active: { type: { kind: "boolean" } } } },
      },
    ] as const;
    const typeDefinitions = definitions.map((definition) =>
      Object.assign(
        {},
        definition,
        "extends" in definition ? { extends: [...definition.extends] } : {},
      ),
    );
    expect(
      isWorkflowEditorPortTypeAssignable(
        { kind: "ref", name: "class" },
        { kind: "ref", name: "order-item" },
        typeDefinitions,
      ),
    ).toBe(true);
    const document = documentWithTypes("unknown", "{ id: string }");
    document.nodes[0]!.outputs![0]!.type = { kind: "ref", name: "order-item" };
    expect(validateWorkflowEditorConnection(document, connection, { typeDefinitions }).valid).toBe(
      true,
    );
    const compiled = compileWorkflowEditorDocument(
      connectWorkflowEditorNodes(document, connection, { typeDefinitions }),
      { typeDefinitions },
    );
    expect(compiled.nodes[0]?.outputs?.[0]?.type).toEqual({ kind: "ref", name: "order-item" });
    expect(compiled.typeDeclarations).toContain("__WorkflowCatalog_");
  });
  test("escaped legacy identifiers remain distinct from their decoded names", () => {
    const definitions = [
      { name: "C", type: native("string") },
      { name: "\\u0043", type: native("number") },
    ];
    expect(
      isWorkflowEditorPortTypeAssignable({ kind: "ref", name: "C" }, native("string"), definitions),
    ).toBe(true);
    expect(
      isWorkflowEditorPortTypeAssignable(
        { kind: "ref", name: "\\u0043" },
        native("number"),
        definitions,
      ),
    ).toBe(true);
  });
  test("legacy catalog names can coincide with TypeScript standard globals", () => {
    expect(
      isWorkflowEditorPortTypeAssignable({ kind: "ref", name: "Array" }, native("string"), [
        { name: "Array", type: { kind: "string" } },
      ]),
    ).toBe(true);
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

import { createWorkflowEditorTypeResolver } from "./core-type-resolver";

test("batches a candidate matrix into one compiler build and reuses its results", () => {
  const resolver = createWorkflowEditorTypeResolver([], "type BatchCustomer = { id: number };");
  const checks = Array.from({ length: 40 }, (_, index) => ({
    source: native("BatchCustomer"),
    target: native(`{ id: number; field${index}?: string }`),
  }));
  const before = resolver.programBuildCount;
  resolver.prepareChecks(checks);
  expect(resolver.programBuildCount - before).toBe(1);
  for (const check of checks) {
    expect(resolver.isAssignable(check.source, check.target)).toBe(true);
  }
  resolver.prepareChecks(checks);
  expect(resolver.programBuildCount - before).toBe(1);
  expect(resolver.findResolutionErrors(native("typeof __WorkflowCheckValue_0"))).not.toHaveLength(
    0,
  );
  expect(resolver.findResolutionErrors(native("__WorkflowCheckSource_0"))).not.toHaveLength(0);
});

test("accepts TypeScript empty statements after interfaces and aliases", () => {
  const declarations = "; interface Customer { id: string }; ; type Id = string;;";
  const document = documentWithTypes("Customer", "{ id: Id }", declarations);
  expect(oracle("Customer", "{ id: Id }", declarations)).toBe(true);
  expect(validateWorkflowEditorConnection(document, connection).valid).toBe(true);
});

test.each(["Record<string, number>", "{ [key: string]: number }"])(
  "decomposes %s using the compiler's property access semantics",
  (source) => {
    const fileName = "/property-oracle.ts";
    const code = `declare const value: ${source}; const result = value["foo"];`;
    const options = {
      strict: true,
      noUncheckedIndexedAccess: true,
      noEmit: true,
      target: ts.ScriptTarget.ES2022,
      types: [],
      skipLibCheck: true,
    };
    const host = ts.createCompilerHost(options);
    const original = host.getSourceFile.bind(host);
    host.getSourceFile = (name, version, onError, fresh) =>
      name === fileName
        ? ts.createSourceFile(name, code, version, true)
        : original(name, version, onError, fresh);
    const program = ts.createProgram([fileName], options, host);
    expect(program.getSemanticDiagnostics()).toHaveLength(0);
    const result = (program.getSourceFile(fileName)!.statements[1] as ts.VariableStatement)
      .declarationList.declarations[0]!;
    const checker = program.getTypeChecker();
    const expected = checker.typeToString(checker.getTypeAtLocation(result.initializer!));
    const template = defaultWorkflowEditorNodeTemplates.find(
      (node) => node.kind === "json.object.decompose",
    )!;
    const decompose = addWorkflowEditorObjectDecompositionOutputToNode(
      { ...template, id: "decompose", x: 100, y: 0 },
      { portId: "foo", propertyKey: "foo" },
    );
    const document = documentWithTypes(source, "unknown");
    document.nodes = [document.nodes[0]!, decompose];
    const connected = connectWorkflowEditorNodes(document, {
      sourceNodeId: "source",
      sourcePortId: "out",
      targetNodeId: "decompose",
      targetPortId: "object",
    });
    const output = connected.nodes
      .find((node) => node.id === "decompose")!
      .outputs!.find((port) => port.id === "foo")!;
    expect(output.type).toEqual(native(expected));
    expect(isWorkflowEditorPortTypeAssignable(output.type, native("number"))).toBe(false);
    expect(
      compileWorkflowEditorDocument(connected)
        .nodes.find((node) => node.id === "decompose")!
        .outputs!.find((port) => port.id === "foo")!.type,
    ).toEqual(native(expected));
    const resolver = createWorkflowEditorTypeResolver();
    expect(
      resolver.objectPropertiesFromType(native("{ [key: number]: string }"), ["0", "foo"])?.["0"]
        ?.type,
    ).toEqual(native("string | undefined"));
    expect(
      resolver.objectPropertiesFromType(native("{ [key: number]: string }"), ["0", "foo"])?.foo,
    ).toBeUndefined();
  },
);
