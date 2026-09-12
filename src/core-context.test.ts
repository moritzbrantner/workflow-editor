import { describe, expect, test } from "vitest";

import { createWorkflowEditorDocumentContext } from "./core-context";
import type { WorkflowEditorDocument } from "./core-types";

describe("workflow editor document context", () => {
  test("keeps node and port ids collision-free", () => {
    const document: WorkflowEditorDocument = {
      nodes: [
        {
          id: "a:b",
          label: "First",
          kind: "operation",
          x: 0,
          y: 0,
          inputs: [{ id: "c", label: "First input", type: { kind: "number" } }],
          outputs: [{ id: "c", label: "First output", type: { kind: "number" } }],
        },
        {
          id: "a",
          label: "Second",
          kind: "operation",
          x: 100,
          y: 0,
          inputs: [{ id: "b:c", label: "Second input", type: { kind: "string" } }],
          outputs: [{ id: "b:c", label: "Second output", type: { kind: "string" } }],
        },
      ],
      edges: [],
    };

    const context = createWorkflowEditorDocumentContext(document);

    expect(context.getInputPort("a:b", "c")?.label).toBe("First input");
    expect(context.getInputPort("a", "b:c")?.label).toBe("Second input");
    expect(context.getOutputPort("a:b", "c")?.label).toBe("First output");
    expect(context.getOutputPort("a", "b:c")?.label).toBe("Second output");
  });
});
