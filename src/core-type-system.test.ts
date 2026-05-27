import { describe, expect, test } from "vitest";

import {
  analyzeWorkflowEditorPortTypes,
  connectWorkflowEditorNodes,
  isWorkflowEditorPortTypeAssignable,
  normalizeWorkflowEditorDocument,
  validateWorkflowEditorConnection,
  type WorkflowEditorDocument,
  type WorkflowEditorPortType,
  type WorkflowEditorTypeDefinition,
} from "./core";

const anyType = { kind: "any" } satisfies WorkflowEditorPortType;
const unknownType = { kind: "unknown" } satisfies WorkflowEditorPortType;
const neverType = { kind: "never" } satisfies WorkflowEditorPortType;
const stringType = { kind: "string" } satisfies WorkflowEditorPortType;
const numberType = { kind: "number" } satisfies WorkflowEditorPortType;
const booleanType = { kind: "boolean" } satisfies WorkflowEditorPortType;
const nullType = { kind: "null" } satisfies WorkflowEditorPortType;
const undefinedType = { kind: "undefined" } satisfies WorkflowEditorPortType;

function ref(name: string): WorkflowEditorPortType {
  return { kind: "ref", name };
}

function arrayOf(element: WorkflowEditorPortType): WorkflowEditorPortType {
  return { kind: "array", element };
}

function literal(value: string | number | boolean | null): WorkflowEditorPortType {
  return { kind: "literal", value };
}

function union(...types: WorkflowEditorPortType[]): WorkflowEditorPortType {
  return { kind: "union", types };
}

function intersection(...types: WorkflowEditorPortType[]): WorkflowEditorPortType {
  return { kind: "intersection", types };
}

function objectType(
  properties: Record<
    string,
    {
      type: WorkflowEditorPortType;
      optional?: boolean;
    }
  > = {},
): WorkflowEditorPortType {
  return { kind: "object", properties };
}

function expectAssignable(
  source: WorkflowEditorPortType,
  target: WorkflowEditorPortType,
  typeDefinitions: readonly WorkflowEditorTypeDefinition[] = [],
) {
  expect(isWorkflowEditorPortTypeAssignable(source, target, typeDefinitions)).toBe(true);
}

function expectNotAssignable(
  source: WorkflowEditorPortType,
  target: WorkflowEditorPortType,
  typeDefinitions: readonly WorkflowEditorTypeDefinition[] = [],
) {
  expect(isWorkflowEditorPortTypeAssignable(source, target, typeDefinitions)).toBe(false);
}

function typedDocument(
  sourceType: WorkflowEditorPortType,
  targetType: WorkflowEditorPortType,
  edges: WorkflowEditorDocument["edges"] = [],
): WorkflowEditorDocument {
  return normalizeWorkflowEditorDocument({
    nodes: [
      {
        id: "source",
        label: "Source",
        x: 0,
        y: 0,
        outputs: [{ id: "out", label: "Out", type: sourceType }],
      },
      {
        id: "target",
        label: "Target",
        x: 240,
        y: 0,
        inputs: [{ id: "in", label: "In", type: targetType }],
      },
    ],
    edges,
  });
}

describe("workflow editor port type assignability", () => {
  test("handles top, bottom, primitive, null, and undefined types", () => {
    expectAssignable(stringType, anyType);
    expectAssignable(anyType, stringType);
    expectAssignable(stringType, unknownType);
    expectAssignable(neverType, stringType);
    expectAssignable(nullType, nullType);
    expectAssignable(undefinedType, undefinedType);

    expectNotAssignable(unknownType, stringType);
    expectNotAssignable(stringType, neverType);
    expectNotAssignable(nullType, undefinedType);
    expectNotAssignable(undefinedType, nullType);
    expectNotAssignable(booleanType, numberType);
  });

  test("widens literals to their primitive type and preserves exact literal targets", () => {
    expectAssignable(literal("ready"), stringType);
    expectAssignable(literal(42), numberType);
    expectAssignable(literal(false), booleanType);
    expectAssignable(literal(null), nullType);
    expectAssignable(literal("ready"), literal("ready"));

    expectNotAssignable(stringType, literal("ready"));
    expectNotAssignable(literal("ready"), literal("done"));
    expectNotAssignable(literal(42), stringType);
  });

  test("checks array element assignability recursively", () => {
    expectAssignable(arrayOf(literal("active")), arrayOf(stringType));
    expectAssignable(arrayOf(objectType({ id: { type: stringType } })), arrayOf(objectType()));
    expectAssignable(arrayOf(neverType), arrayOf(numberType));

    expectNotAssignable(arrayOf(stringType), arrayOf(literal("active")));
    expectNotAssignable(arrayOf(stringType), stringType);
    expectNotAssignable(stringType, arrayOf(stringType));
  });

  test("requires every source union member to satisfy a non-union target", () => {
    expectAssignable(union(literal("queued"), literal("running")), stringType);
    expectAssignable(union(literal(1), literal(2)), numberType);

    expectNotAssignable(union(stringType, numberType), stringType);
    expectNotAssignable(union(literal("queued"), numberType), stringType);
  });

  test("accepts a source type when it satisfies at least one target union member", () => {
    expectAssignable(literal("queued"), union(literal("queued"), literal("running")));
    expectAssignable(numberType, union(stringType, numberType));
    expectAssignable(objectType({ id: { type: stringType } }), union(numberType, objectType()));

    expectNotAssignable(booleanType, union(stringType, numberType));
    expectNotAssignable(literal("failed"), union(literal("queued"), literal("running")));
  });

  test("treats target intersections as multiple simultaneous requirements", () => {
    const target = intersection(
      objectType({ id: { type: stringType } }),
      objectType({ email: { type: stringType } }),
    );

    expectAssignable(
      objectType({
        id: { type: stringType },
        email: { type: stringType },
        name: { type: stringType },
      }),
      target,
    );
    expectNotAssignable(objectType({ id: { type: stringType } }), target);
  });

  test("uses source intersections as object property combinations", () => {
    const source = intersection(
      objectType({ id: { type: stringType } }),
      objectType({ email: { type: stringType } }),
    );

    expectAssignable(
      source,
      objectType({
        id: { type: stringType },
        email: { type: stringType },
      }),
    );
    expectAssignable(source, objectType({ id: { type: stringType } }));
    expectNotAssignable(source, objectType({ role: { type: stringType } }));
  });

  test("checks structural object compatibility with required and optional properties", () => {
    const targetUser = objectType({
      id: { type: stringType },
      email: { type: stringType },
      avatarUrl: { type: stringType, optional: true },
    });

    expectAssignable(
      objectType({
        id: { type: stringType },
        email: { type: stringType },
        role: { type: literal("admin") },
      }),
      targetUser,
    );
    expectAssignable(
      objectType({
        id: { type: stringType },
        email: { type: stringType },
        avatarUrl: { type: literal("https://example.test/avatar.png") },
      }),
      targetUser,
    );

    expectNotAssignable(objectType({ id: { type: stringType } }), targetUser);
    expectNotAssignable(
      objectType({
        id: { type: stringType },
        email: { type: stringType, optional: true },
      }),
      targetUser,
    );
    expectNotAssignable(
      objectType({
        id: { type: stringType },
        email: { type: numberType },
      }),
      targetUser,
    );
  });

  test("checks nested object, array, and union properties", () => {
    const eventEnvelope = objectType({
      event: {
        type: objectType({
          id: { type: stringType },
          status: { type: union(literal("queued"), literal("running"), literal("done")) },
          attempts: { type: arrayOf(numberType) },
        }),
      },
    });

    expectAssignable(
      objectType({
        event: {
          type: objectType({
            id: { type: literal("evt_123") },
            status: { type: literal("running") },
            attempts: { type: arrayOf(literal(1)) },
          }),
        },
      }),
      eventEnvelope,
    );
    expectNotAssignable(
      objectType({
        event: {
          type: objectType({
            id: { type: literal("evt_123") },
            status: { type: literal("failed") },
            attempts: { type: arrayOf(numberType) },
          }),
        },
      }),
      eventEnvelope,
    );
  });

  test("resolves refs, single inheritance, and multiple inheritance", () => {
    const typeDefinitions = [
      {
        name: "Entity",
        type: objectType({ id: { type: stringType } }),
      },
      {
        name: "Timestamped",
        type: objectType({ createdAt: { type: numberType } }),
      },
      {
        name: "User",
        extends: ["Entity"],
        type: objectType({ email: { type: stringType } }),
      },
      {
        name: "AdminUser",
        extends: ["User", "Timestamped"],
        type: objectType({ permissions: { type: arrayOf(stringType) } }),
      },
    ] satisfies WorkflowEditorTypeDefinition[];

    expectAssignable(ref("AdminUser"), ref("User"), typeDefinitions);
    expectAssignable(ref("AdminUser"), ref("Entity"), typeDefinitions);
    expectAssignable(ref("AdminUser"), ref("Timestamped"), typeDefinitions);
    expectAssignable(
      ref("AdminUser"),
      objectType({
        id: { type: stringType },
        email: { type: stringType },
        permissions: { type: arrayOf(stringType) },
      }),
      typeDefinitions,
    );

    expectNotAssignable(ref("User"), ref("AdminUser"), typeDefinitions);
    expectNotAssignable(ref("Timestamped"), ref("User"), typeDefinitions);
    expectNotAssignable(ref("Missing"), stringType, typeDefinitions);
  });

  test("returns false for cyclic refs instead of recursing forever", () => {
    const typeDefinitions = [
      { name: "A", type: ref("B") },
      { name: "B", type: ref("A") },
      { name: "Self", type: ref("Self") },
    ] satisfies WorkflowEditorTypeDefinition[];

    expectNotAssignable(ref("A"), stringType, typeDefinitions);
    expectNotAssignable(ref("Self"), stringType, typeDefinitions);
  });
});

describe("workflow editor type-aware connections", () => {
  test("allows number outputs to connect to any inputs", () => {
    const document = typedDocument(numberType, anyType);
    const connection = {
      sourceNodeId: "source",
      sourcePortId: "out",
      targetNodeId: "target",
      targetPortId: "in",
    };

    expectAssignable(numberType, anyType);
    expect(validateWorkflowEditorConnection(document, connection)).toEqual({ valid: true });
    expect(connectWorkflowEditorNodes(document, connection).edges).toEqual([
      {
        id: "source:out->target:in",
        ...connection,
      },
    ]);
  });

  test("validates connections with supplied type definitions", () => {
    const typeDefinitions = [
      {
        name: "User",
        type: objectType({ id: { type: stringType }, email: { type: stringType } }),
      },
      {
        name: "AdminUser",
        extends: ["User"],
        type: objectType({ permissions: { type: arrayOf(stringType) } }),
      },
    ] satisfies WorkflowEditorTypeDefinition[];
    const document: WorkflowEditorDocument = {
      nodes: [
        {
          id: "admin-source",
          label: "Admin Source",
          x: 0,
          y: 0,
          outputs: [{ id: "out", label: "Out", type: ref("AdminUser") }],
        },
        {
          id: "user-target",
          label: "User Target",
          x: 240,
          y: 0,
          inputs: [{ id: "in", label: "In", type: ref("User") }],
        },
        {
          id: "admin-target",
          label: "Admin Target",
          x: 480,
          y: 0,
          inputs: [{ id: "in", label: "In", type: ref("AdminUser") }],
        },
        {
          id: "user-source",
          label: "User Source",
          x: 0,
          y: 180,
          outputs: [{ id: "out", label: "Out", type: ref("User") }],
        },
      ],
      edges: [],
    };

    expect(
      validateWorkflowEditorConnection(
        document,
        {
          sourceNodeId: "admin-source",
          sourcePortId: "out",
          targetNodeId: "user-target",
          targetPortId: "in",
        },
        { typeDefinitions },
      ),
    ).toEqual({ valid: true });
    expect(
      validateWorkflowEditorConnection(
        document,
        {
          sourceNodeId: "user-source",
          sourcePortId: "out",
          targetNodeId: "admin-target",
          targetPortId: "in",
        },
        { typeDefinitions },
      ),
    ).toEqual({ valid: false, reason: "kind-mismatch" });
    expect(
      validateWorkflowEditorConnection(document, {
        sourceNodeId: "admin-source",
        sourcePortId: "out",
        targetNodeId: "user-target",
        targetPortId: "in",
      }),
    ).toEqual({ valid: false, reason: "kind-mismatch" });
  });

  test("connects only type-compatible ports and keeps incompatible documents unchanged", () => {
    const compatibleDocument = typedDocument(literal("ok"), stringType);
    const incompatibleDocument = typedDocument(stringType, numberType);

    expect(
      connectWorkflowEditorNodes(compatibleDocument, {
        sourceNodeId: "source",
        sourcePortId: "out",
        targetNodeId: "target",
        targetPortId: "in",
      }).edges,
    ).toEqual([
      {
        id: "source:out->target:in",
        sourceNodeId: "source",
        sourcePortId: "out",
        targetNodeId: "target",
        targetPortId: "in",
      },
    ]);
    expect(
      connectWorkflowEditorNodes(incompatibleDocument, {
        sourceNodeId: "source",
        sourcePortId: "out",
        targetNodeId: "target",
        targetPortId: "in",
      }),
    ).toBe(incompatibleDocument);
  });

  test("checks type compatibility before duplicate and cycle checks", () => {
    const existingEdge = {
      id: "source-target",
      sourceNodeId: "source",
      sourcePortId: "out",
      targetNodeId: "target",
      targetPortId: "in",
    };
    const incompatibleDuplicate = typedDocument(stringType, numberType, [existingEdge]);

    expect(
      validateWorkflowEditorConnection(incompatibleDuplicate, {
        sourceNodeId: "source",
        sourcePortId: "out",
        targetNodeId: "target",
        targetPortId: "in",
      }),
    ).toEqual({ valid: false, reason: "kind-mismatch" });
  });
});

describe("workflow editor port type diagnostics", () => {
  test("reports incompatible edge port types", () => {
    const document = typedDocument(stringType, numberType, [
      {
        id: "source-target",
        sourceNodeId: "source",
        sourcePortId: "out",
        targetNodeId: "target",
        targetPortId: "in",
      },
    ]);

    expect(analyzeWorkflowEditorPortTypes(document)).toEqual([
      {
        type: "incompatible-port-type",
        edgeId: "source-target",
        sourceNodeId: "source",
        sourcePortId: "out",
        targetNodeId: "target",
        targetPortId: "in",
        message: "Output port source.out is not assignable to input port target.in",
      },
    ]);
  });

  test("reports missing nested type definitions once per edge", () => {
    const document = typedDocument(
      objectType({
        primary: { type: ref("Missing") },
        secondary: { type: arrayOf(ref("Missing")) },
      }),
      objectType({
        accepted: { type: ref("Missing") },
      }),
      [
        {
          id: "source-target",
          sourceNodeId: "source",
          sourcePortId: "out",
          targetNodeId: "target",
          targetPortId: "in",
        },
      ],
    );

    expect(analyzeWorkflowEditorPortTypes(document)).toEqual([
      expect.objectContaining({
        type: "missing-type-definition",
        edgeId: "source-target",
        message: "Missing workflow port type definition: Missing",
      }),
    ]);
  });

  test("reports cyclic definitions through aliases and inheritance", () => {
    const document = typedDocument(ref("A"), ref("Child"), [
      {
        id: "source-target",
        sourceNodeId: "source",
        sourcePortId: "out",
        targetNodeId: "target",
        targetPortId: "in",
      },
    ]);
    const typeDefinitions = [
      { name: "A", type: ref("B") },
      { name: "B", type: ref("A") },
      { name: "Parent", extends: ["Child"], type: objectType() },
      { name: "Child", extends: ["Parent"], type: objectType() },
    ] satisfies WorkflowEditorTypeDefinition[];

    expect(analyzeWorkflowEditorPortTypes(document, { typeDefinitions })).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "missing-type-definition",
          message: "Cyclic workflow port type reference: A -> B -> A",
        }),
        expect.objectContaining({
          type: "missing-type-definition",
          message: "Cyclic workflow port type reference: Child -> Parent -> Child",
        }),
      ]),
    );
  });

  test("does not add incompatibility diagnostics when resolution fails", () => {
    const document = typedDocument(ref("Missing"), stringType, [
      {
        id: "source-target",
        sourceNodeId: "source",
        sourcePortId: "out",
        targetNodeId: "target",
        targetPortId: "in",
      },
    ]);

    expect(analyzeWorkflowEditorPortTypes(document).map((diagnostic) => diagnostic.type)).toEqual([
      "missing-type-definition",
    ]);
  });

  test("skips edges whose nodes or ports cannot be resolved", () => {
    const document: WorkflowEditorDocument = {
      nodes: [
        {
          id: "source",
          label: "Source",
          x: 0,
          y: 0,
          outputs: [{ id: "out", label: "Out", type: stringType }],
        },
        {
          id: "target",
          label: "Target",
          x: 240,
          y: 0,
          inputs: [{ id: "in", label: "In", type: numberType }],
        },
      ],
      edges: [
        {
          id: "missing-node",
          sourceNodeId: "source",
          sourcePortId: "out",
          targetNodeId: "deleted",
          targetPortId: "in",
        },
        {
          id: "missing-port",
          sourceNodeId: "source",
          sourcePortId: "deleted",
          targetNodeId: "target",
          targetPortId: "in",
        },
      ],
    };

    expect(analyzeWorkflowEditorPortTypes(document)).toEqual([]);
  });
});
