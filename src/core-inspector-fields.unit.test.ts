import { describe, expect, it } from "vitest";

import {
  createWorkflowEditorNodeTemplateRegistry,
  getWorkflowEditorSharedInspectorFields,
  isWorkflowEditorInspectorFieldVisible,
  readWorkflowEditorFieldPath,
  readWorkflowEditorFieldValue,
  validateWorkflowEditorFieldValue,
  validateWorkflowEditorInspectorFieldDefinitions,
  workflowEditorMixedFieldValue,
  writeWorkflowEditorFieldPath,
  type WorkflowEditorInspectorFieldDefinition,
} from "./core";

const method: WorkflowEditorInspectorFieldDefinition = {
  path: "request.method",
  label: "Method",
  kind: "select",
  options: [
    { label: "GET", value: "GET" },
    { label: "POST", value: "POST" },
  ],
  defaultValue: "GET",
};

describe("inspector field paths", () => {
  it("reads and writes nested paths without mutating or dropping host data", () => {
    const data = { request: { url: "https://x" }, host: { keep: true } };
    const next = writeWorkflowEditorFieldPath(data, "request.method", "POST");
    expect(next).toEqual({ request: { url: "https://x", method: "POST" }, host: { keep: true } });
    expect(data).toEqual({ request: { url: "https://x" }, host: { keep: true } });
    expect(readWorkflowEditorFieldPath(next, "request.method")).toBe("POST");
    expect(readWorkflowEditorFieldPath(next, "request.missing.deep")).toBeUndefined();
    expect(writeWorkflowEditorFieldPath(next, "request.method", undefined)).toEqual(data);
    expect(() => writeWorkflowEditorFieldPath(data, "__proto__.x", 1)).toThrow();
  });

  it("falls back to the default value and evaluates visibility", () => {
    expect(readWorkflowEditorFieldValue(method, {})).toBe("GET");
    const body: WorkflowEditorInspectorFieldDefinition = {
      path: "request.body",
      label: "Body",
      kind: "json",
      visibleWhen: { path: "request.method", equals: ["POST"] },
    };
    expect(isWorkflowEditorInspectorFieldVisible(body, { request: { method: "GET" } })).toBe(false);
    expect(isWorkflowEditorInspectorFieldVisible(body, { request: { method: "POST" } })).toBe(true);
  });
});

describe("inspector field validation", () => {
  it.each([
    [{ path: "a", label: "A", kind: "text", required: true }, "", ["A is required."]],
    [{ path: "a", label: "A", kind: "number", min: 1, max: 5 }, 9, ["A must be at most 5."]],
    [
      { path: "a", label: "A", kind: "text", pattern: "^https://" },
      "http://x",
      ["A does not match the expected format."],
    ],
    [method, "PUT", ["Method must be one of the listed options."]],
    [
      { path: "t", label: "Token", kind: "secret-ref" },
      "sk-raw-secret",
      ["Token must be a secret reference, not a secret value."],
    ],
    [{ path: "t", label: "Token", kind: "secret-ref" }, { secretRef: "vault:token" }, []],
    [
      { path: "h", label: "Headers", kind: "key-value" },
      [
        { key: "a", value: "1" },
        { key: "a", value: "2" },
      ],
      ["Headers has duplicate keys."],
    ],
  ] as const)("validates %o with %o", (field, value, messages) => {
    expect(
      validateWorkflowEditorFieldValue(field as WorkflowEditorInspectorFieldDefinition, value),
    ).toEqual(messages);
  });

  it("reports invalid definitions as template registry diagnostics", () => {
    expect(
      validateWorkflowEditorInspectorFieldDefinitions([
        { path: "ok", label: "Ok", kind: "text" },
        { path: "ok", label: "Again", kind: "text" },
        { path: "bad path", label: "", kind: "nope" },
        { path: "choice", label: "Choice", kind: "select" },
        { path: "c", label: "C", kind: "custom" },
      ]).map((diagnostic) => [diagnostic.code, diagnostic.path]),
    ).toEqual([
      ["duplicate-field-path", "[1].path"],
      ["invalid-field", "[2].path"],
      ["invalid-field", "[2].label"],
      ["invalid-field-kind", "[2].kind"],
      ["invalid-field-options", "[3].options"],
      ["invalid-field", "[4].renderer"],
    ]);
    const registry = createWorkflowEditorNodeTemplateRegistry([
      {
        id: "http",
        label: "HTTP",
        kind: "http.request",
        inspectorFields: [{ path: "url", label: "", kind: "text" }],
      },
    ]);
    expect(registry.entries[0]?.valid).toBe(false);
    expect(registry.diagnostics[0]).toMatchObject({
      code: "invalid-inspector-field",
      path: "$[0].inspectorFields[0].label",
      templateId: "http",
    });
  });
});

describe("shared fields for multi-node editing", () => {
  it("keeps only compatible fields and marks differing values as mixed", () => {
    const url: WorkflowEditorInspectorFieldDefinition = { path: "url", label: "URL", kind: "text" };
    const shared = getWorkflowEditorSharedInspectorFields([
      { data: { url: "a", request: { method: "POST" } }, fields: [url, method] },
      { data: { url: "b", request: { method: "POST" } }, fields: [method, url] },
      { data: { url: "c" }, fields: [url, { ...method, kind: "text" }] },
    ]);
    expect(shared).toEqual([{ field: url, value: workflowEditorMixedFieldValue }]);
    expect(
      getWorkflowEditorSharedInspectorFields([
        { data: { request: { method: "POST" } }, fields: [method] },
        { data: { request: { method: "POST" } }, fields: [method] },
      ]),
    ).toEqual([{ field: method, value: "POST" }]);
  });
});
