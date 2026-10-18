import { describe, expect, test } from "vitest";

import type { WorkflowEditorDocument } from "../core-types";
import {
  describeWorkflowWorkbenchConnectionRejection,
  describeWorkflowWorkbenchDocumentChange,
} from "./workbench-announcements";

const base: WorkflowEditorDocument = {
  nodes: [
    { id: "a", label: "Input", x: 0, y: 0, outputs: [{ id: "out", label: "Out" }] },
    { id: "b", label: "Output", x: 200, y: 0, inputs: [{ id: "in", label: "In" }] },
  ],
  edges: [],
};

describe("workflow workbench announcements", () => {
  test("announces added and removed nodes", () => {
    const added = { ...base, nodes: [...base.nodes, { id: "c", label: "Decision", x: 0, y: 0 }] };
    expect(describeWorkflowWorkbenchDocumentChange(base, added)).toBe("Added node Decision.");
    expect(describeWorkflowWorkbenchDocumentChange(added, base)).toBe("Removed node Decision.");
  });

  test("announces connections with port labels", () => {
    const connected = {
      ...base,
      edges: [
        { id: "e", sourceNodeId: "a", sourcePortId: "out", targetNodeId: "b", targetPortId: "in" },
      ],
    };
    expect(describeWorkflowWorkbenchDocumentChange(base, connected)).toBe(
      "Connected Input Out to Output In.",
    );
    expect(describeWorkflowWorkbenchDocumentChange(connected, base)).toBe("Removed 1 connection.");
  });

  test("announces moves, groups and ignores viewport-only or unrelated documents", () => {
    const moved = { ...base, nodes: [{ ...base.nodes[0]!, x: 10 }, base.nodes[1]!] };
    expect(describeWorkflowWorkbenchDocumentChange(base, moved)).toBe("Moved node Input.");
    const recreated = { ...base, nodes: base.nodes.map((node) => ({ ...node })) };
    expect(describeWorkflowWorkbenchDocumentChange(base, recreated)).toBeNull();

    const grouped = { ...base, groups: [{ id: "g", label: "Group 1", nodeIds: ["a", "b"] }] };
    expect(describeWorkflowWorkbenchDocumentChange(base, grouped)).toBe(
      "Grouped 2 nodes as Group 1.",
    );
    expect(describeWorkflowWorkbenchDocumentChange(grouped, base)).toBe("Ungrouped Group 1.");

    expect(
      describeWorkflowWorkbenchDocumentChange(base, { ...base, viewport: { x: 1, y: 1, zoom: 1 } }),
    ).toBeNull();
    expect(
      describeWorkflowWorkbenchDocumentChange(base, {
        nodes: [{ id: "z", label: "Other", x: 0, y: 0 }],
        edges: [],
      }),
    ).toBeNull();
  });

  test("explains rejected connections", () => {
    expect(describeWorkflowWorkbenchConnectionRejection({ valid: false, reason: "cycle" })).toBe(
      "Connection rejected: it would create a cycle.",
    );
    expect(
      describeWorkflowWorkbenchConnectionRejection({
        valid: false,
        reason: "type-mismatch",
        message: "Type 'number' is not assignable to type 'string'.",
      }),
    ).toBe("Connection rejected: Type 'number' is not assignable to type 'string'.");
  });
});
