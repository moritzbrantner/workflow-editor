import { describe, expect, test } from "vitest";

import {
  getWorkflowEditorWorkflowInterface,
  syncWorkflowEditorReferenceInterface,
  workflowEditorReferenceMatchesInterface,
  type WorkflowEditorDocument,
} from "./core";

const ts = (source: string) => ({ kind: "typescript" as const, source });

const child: WorkflowEditorDocument = {
  nodes: [
    {
      id: "start",
      label: "Start",
      kind: "control.start",
      x: 0,
      y: 0,
      outputs: [
        { id: "count", label: "Count", type: ts("number") },
        { id: "note", label: "Note", type: ts("string"), optional: true },
      ],
    },
    {
      id: "end",
      label: "End",
      kind: "control.end",
      x: 300,
      y: 0,
      inputs: [{ id: "result", label: "Result", type: ts("string") }],
    },
  ],
  edges: [],
};

describe("workflow interface (#95)", () => {
  test("reads inputs from start outputs and outputs from end inputs", () => {
    expect(getWorkflowEditorWorkflowInterface(child)).toEqual({
      inputs: [
        { id: "count", label: "Count", type: ts("number") },
        { id: "note", label: "Note", type: ts("string"), optional: true },
      ],
      outputs: [{ id: "result", label: "Result", type: ts("string") }],
    });
  });

  test("syncs a reference node's ports and drops connections to removed ports", () => {
    const workflowInterface = getWorkflowEditorWorkflowInterface(child);
    const parent: WorkflowEditorDocument = {
      nodes: [
        {
          id: "source",
          label: "Source",
          x: 0,
          y: 0,
          outputs: [{ id: "out", label: "Out", type: ts("number") }],
        },
        {
          id: "ref",
          label: "Countdown",
          x: 200,
          y: 0,
          workflowRef: { documentId: "child" },
          inputs: [
            { id: "count", label: "How many", type: ts("number") },
            { id: "stale", label: "Stale", type: ts("number") },
          ],
          outputs: [],
        },
      ],
      edges: [
        {
          id: "keep",
          sourceNodeId: "source",
          sourcePortId: "out",
          targetNodeId: "ref",
          targetPortId: "count",
        },
        {
          id: "drop",
          sourceNodeId: "source",
          sourcePortId: "out",
          targetNodeId: "ref",
          targetPortId: "stale",
        },
      ],
    };
    expect(workflowEditorReferenceMatchesInterface(parent.nodes[1]!, workflowInterface)).toBe(
      false,
    );

    const synced = syncWorkflowEditorReferenceInterface(parent, "ref", workflowInterface);
    const ref = synced.nodes.find((node) => node.id === "ref")!;
    expect(ref.inputs?.map((port) => [port.id, port.label])).toEqual([
      ["count", "How many"],
      ["note", "Note"],
    ]);
    expect(ref.outputs?.map((port) => port.id)).toEqual(["result"]);
    expect(synced.edges.map((edge) => edge.id)).toEqual(["keep"]);
    expect(workflowEditorReferenceMatchesInterface(ref, workflowInterface)).toBe(true);
    expect(syncWorkflowEditorReferenceInterface(synced, "ref", workflowInterface)).toBe(synced);
  });
});
