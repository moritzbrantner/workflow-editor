import { describe, expect, it } from "vitest";

import {
  getWorkflowEditorInputDeclarations,
  resolveWorkflowEditorInputValues,
  validateWorkflowEditorInputValues,
  type WorkflowEditorDocument,
} from "./core";
import {
  createWorkflowEditorEntry,
  createWorkflowEditorLibrary,
  parseWorkflowEditorLibrary,
  removeWorkflowEditorInputProfile,
  upsertWorkflowEditorInputProfile,
} from "./persistence";

export const parameterDocument: WorkflowEditorDocument = {
  typeDeclarations: 'type Region = "eu" | "us";',
  nodes: [
    {
      id: "start",
      label: "Start",
      kind: "control.start",
      x: 0,
      y: 0,
      outputs: [
        { id: "region", label: "Region", type: { kind: "typescript", source: "Region" } },
        {
          id: "limit",
          label: "Limit",
          type: { kind: "typescript", source: "number" },
          defaultValue: 100,
        },
        {
          id: "note",
          label: "Note",
          type: { kind: "typescript", source: "string" },
          optional: true,
        },
      ],
    },
  ],
  edges: [],
};

describe("workflow inputs", () => {
  it("declares inputs from Start node outputs", () => {
    expect(
      getWorkflowEditorInputDeclarations(parameterDocument).map(({ id, required }) => [
        id,
        required,
      ]),
    ).toEqual([
      ["region", true],
      ["limit", false],
      ["note", false],
    ]);
  });

  it("validates typed values and fills defaults", () => {
    expect(validateWorkflowEditorInputValues(parameterDocument, {})).toEqual([
      expect.objectContaining({ code: "missing-input", inputId: "region" }),
    ]);
    expect(
      validateWorkflowEditorInputValues(parameterDocument, {
        region: "asia",
        limit: "ten",
        extra: 1,
      }).map((diagnostic) => [diagnostic.code, diagnostic.inputId]),
    ).toEqual([
      ["invalid-input-type", "region"],
      ["invalid-input-type", "limit"],
      ["unknown-input", "extra"],
    ]);
    expect(validateWorkflowEditorInputValues(parameterDocument, { region: "eu" })).toEqual([]);
    expect(resolveWorkflowEditorInputValues(parameterDocument, { region: "eu" })).toEqual({
      region: "eu",
      limit: 100,
    });
  });

  it("keeps named profiles on the library entry through save and load", () => {
    let entry = createWorkflowEditorEntry({ id: "w", document: parameterDocument });
    entry = upsertWorkflowEditorInputProfile(entry, {
      id: "eu",
      name: "EU nightly",
      values: { region: "eu" },
    });
    entry = upsertWorkflowEditorInputProfile(entry, {
      id: "us",
      name: "US",
      values: { region: "us", limit: 5 },
    });
    const loaded = parseWorkflowEditorLibrary(
      JSON.stringify(createWorkflowEditorLibrary({ documents: [entry] })),
    );
    expect(loaded.status === "loaded" && loaded.library.documents[0]?.inputProfiles).toEqual([
      { id: "eu", name: "EU nightly", values: { region: "eu" } },
      { id: "us", name: "US", values: { region: "us", limit: 5 } },
    ]);
    // Profiles never touch the document.
    expect(
      loaded.status === "loaded" && JSON.stringify(loaded.library.documents[0]?.document),
    ).not.toContain("EU nightly");
    expect(
      removeWorkflowEditorInputProfile(removeWorkflowEditorInputProfile(entry, "eu"), "us"),
    ).not.toHaveProperty("inputProfiles");
  });
});
