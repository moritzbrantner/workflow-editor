// Issue #16 / Decision Atlas 5.18: one Node Template registry derived from the host array.
import { describe, expect, it } from "vitest";

import {
  createWorkflowEditorNodeTemplateRegistry,
  defaultWorkflowEditorNodeTemplates,
  type WorkflowEditorNodeTemplate,
} from "./core";
import * as index from "./index";

const stringType = { kind: "string" } as const;
const numberType = { kind: "number" } as const;

const templates: WorkflowEditorNodeTemplate[] = [
  {
    id: "text-source",
    label: "Text source",
    categoryPath: ["Sources", "Text"],
    outputs: [{ id: "out", label: "Out", type: stringType }],
  },
  {
    id: "number-sink",
    label: "Number sink",
    category: "Sinks",
    inputs: [{ id: "in", label: "In", type: numberType }],
  },
  {
    id: "text-sink",
    label: "Text sink",
    category: "Sinks",
    inputs: [{ id: "in", label: "In", type: stringType }],
  },
];

describe("createWorkflowEditorNodeTemplateRegistry", () => {
  it("is exported from the root entrypoint", () => {
    expect(index.createWorkflowEditorNodeTemplateRegistry).toBe(
      createWorkflowEditorNodeTemplateRegistry,
    );
  });

  it("accepts the built-in templates without diagnostics", () => {
    const registry = createWorkflowEditorNodeTemplateRegistry(defaultWorkflowEditorNodeTemplates);
    expect(registry.diagnostics).toEqual([]);
    expect(registry.entries.every((entry) => entry.valid)).toBe(true);
  });

  it("looks templates up by id and category path", () => {
    const registry = createWorkflowEditorNodeTemplateRegistry(templates);
    expect(registry.getTemplate("number-sink")).toBe(templates[1]);
    expect(registry.getTemplate("missing")).toBeUndefined();
    expect(registry.listByCategoryPath(["Sinks"]).map((template) => template.id)).toEqual([
      "number-sink",
      "text-sink",
    ]);
    expect(registry.listByCategoryPath(["Sources"]).map((template) => template.id)).toEqual([
      "text-source",
    ]);
    expect(registry.listByCategoryPath([]).length).toBe(3);
  });

  it("finds type-compatible templates in both directions", () => {
    const registry = createWorkflowEditorNodeTemplateRegistry(templates);
    expect(
      registry
        .findTemplatesAcceptingOutput(stringType)
        .map(({ template, portId }) => [template.id, portId]),
    ).toEqual([["text-sink", "in"]]);
    expect(
      registry.findTemplatesProducingInput(stringType).map(({ template }) => template.id),
    ).toEqual(["text-source"]);
    expect(registry.findTemplatesProducingInput(numberType)).toEqual([]);
  });

  it("matches a multi-source input by its element type", () => {
    const registry = createWorkflowEditorNodeTemplateRegistry(defaultWorkflowEditorNodeTemplates);
    expect(
      registry
        .findTemplatesAcceptingOutput(stringType)
        .some(({ template, portId }) => template.kind === "control.merge" && portId === "items"),
    ).toBe(true);
  });

  it("reports stable, path-addressed diagnostics without mutating input", () => {
    const broken: WorkflowEditorNodeTemplate[] = [
      ...templates,
      { id: "text-sink", label: "Duplicate", inputs: [] },
      {
        id: "ports",
        label: "Ports",
        inputs: [
          { id: "a", label: "A", type: stringType },
          { id: "a", label: "A again", type: stringType },
        ],
      },
      {
        id: "missing-type",
        label: "Missing type",
        inputs: [{ id: "in", label: "In", type: { kind: "ref", name: "NoSuchType" } }],
      },
      { id: "bad-category", label: "Bad category", categoryPath: ["ok", ""] },
      {
        id: "bad-composition",
        label: "Bad composition",
        composition: {
          nodes: [{ id: "x", label: "X", x: 0, y: 0 }],
          edges: [
            {
              id: "dangling",
              sourceNodeId: "x",
              sourcePortId: "out",
              targetNodeId: "nowhere",
              targetPortId: "in",
            },
          ],
        },
      },
      { id: "", label: "No id" },
    ];
    const snapshot = structuredClone(broken);

    const registry = createWorkflowEditorNodeTemplateRegistry(broken);

    expect(broken).toEqual(snapshot);
    const codes = registry.diagnostics.map((diagnostic) => [diagnostic.code, diagnostic.path]);
    expect(codes).toEqual(
      expect.arrayContaining([
        ["duplicate-template-id", "$[3].id"],
        ["duplicate-port-id", "$[4].inputs[1].id"],
        ["missing-type-reference", "$[5].inputs[0].type"],
        ["invalid-category-path", "$[6].categoryPath"],
        ["invalid-composition", "$[7].composition"],
        ["invalid-template", "$[8].id"],
      ]),
    );
    expect(registry.entries.slice(0, 3).every((entry) => entry.valid)).toBe(true);
    expect(registry.entries.slice(3).every((entry) => !entry.valid)).toBe(true);
    // The first template keeps its id; the later duplicate is the invalid one.
    expect(registry.getTemplate("text-sink")).toBe(broken[2]);
    expect(registry.getEntry(broken[3]!)?.valid).toBe(false);
  });

  it("resolves references through host type definitions", () => {
    const template: WorkflowEditorNodeTemplate = {
      id: "lead",
      label: "Lead",
      inputs: [{ id: "in", label: "In", type: { kind: "ref", name: "Lead" } }],
    };
    expect(createWorkflowEditorNodeTemplateRegistry([template]).entries[0]?.valid).toBe(false);
    expect(
      createWorkflowEditorNodeTemplateRegistry([template], {
        typeDefinitions: [{ name: "Lead", type: { kind: "object" } }],
      }).entries[0]?.valid,
    ).toBe(true);
  });

  it("excludes invalid templates from compatibility lookups", () => {
    const registry = createWorkflowEditorNodeTemplateRegistry([
      ...templates,
      {
        id: "text-sink",
        label: "Duplicate text sink",
        inputs: [{ id: "in", label: "In", type: stringType }],
      },
    ]);
    expect(registry.findTemplatesAcceptingOutput(stringType)).toHaveLength(1);
  });
});
