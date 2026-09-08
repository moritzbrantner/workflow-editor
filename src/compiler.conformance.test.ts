import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { compileWorkflowEditorDocument } from "./compiler";
import type { WorkflowEditorDocument } from "./core-types";

const compiledV1Fixture = JSON.parse(
  readFileSync(resolve(process.cwd(), "fixtures/compiled-v1-simple.json"), "utf8"),
) as unknown;

const sourceDocument: WorkflowEditorDocument = {
  nodes: [
    {
      id: "end",
      label: "End",
      kind: "control.end",
      x: 200,
      y: 0,
      inputs: [
        {
          id: "in",
          label: "In",
          type: { kind: "string" },
          optional: true,
          defaultValue: "fallback",
        },
      ],
      data: { result: "complete" },
    },
    {
      id: "start",
      label: "Start",
      kind: "control.start",
      x: 0,
      y: 0,
      outputs: [{ id: "out", label: "Out", type: { kind: "any" } }],
    },
  ],
  edges: [
    {
      id: "edge",
      sourceNodeId: "start",
      sourcePortId: "out",
      targetNodeId: "end",
      targetPortId: "in",
    },
  ],
};

describe("compiled workflow v1 conformance", () => {
  it("emits the canonical fixture consumed by workflow-engine and workflow-runner", () => {
    expect(compileWorkflowEditorDocument(sourceDocument)).toEqual(compiledV1Fixture);
  });
});
