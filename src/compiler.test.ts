import { describe, expect, it } from "vitest";

import {
  compileWorkflowEditorDocument,
  compiledWorkflowFormat,
  compiledWorkflowVersion,
  WorkflowEditorCompileError,
} from "./compiler";
import type { WorkflowEditorDocument } from "./core-types";

const simpleDocument: WorkflowEditorDocument = {
  nodes: [
    {
      id: "end",
      label: "End",
      kind: "control.end",
      x: 200,
      y: 0,
      inputs: [{ id: "in", label: "In", type: { kind: "any" } }],
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

describe("compileWorkflowEditorDocument", () => {
  it("produces a deterministic execution-neutral DAG", () => {
    const compiled = compileWorkflowEditorDocument(simpleDocument);

    expect(compiled.format).toBe(compiledWorkflowFormat);
    expect(compiled.version).toBe(compiledWorkflowVersion);
    expect(compiled.order).toEqual(["start", "end"]);
    expect(compiled.nodes.map((node) => node.id)).toEqual(["start", "end"]);
    expect(compiled.edges).toEqual([
      {
        id: "edge",
        sourceNodeId: "start",
        sourcePortId: "out",
        targetNodeId: "end",
        targetPortId: "in",
      },
    ]);
    expect(compiled.nodes[0]?.outputs?.[0]?.type).toEqual({ kind: "any" });
  });

  it("rejects nodes without an executable kind", () => {
    const document: WorkflowEditorDocument = {
      nodes: [{ id: "draft", label: "Draft", x: 0, y: 0 }],
      edges: [],
    };

    expect(() => compileWorkflowEditorDocument(document)).toThrowError(WorkflowEditorCompileError);
    try {
      compileWorkflowEditorDocument(document);
    } catch (error) {
      expect((error as WorkflowEditorCompileError).diagnostics[0]?.code).toBe("missing-node-kind");
    }
  });

  it("keeps nested workflow expansion out of compiler version 1", () => {
    const document: WorkflowEditorDocument = {
      nodes: [
        {
          id: "nested",
          label: "Nested",
          kind: "workflow.call",
          x: 0,
          y: 0,
          workflowRef: { documentId: "child" },
        },
      ],
      edges: [],
    };

    try {
      compileWorkflowEditorDocument(document);
      throw new Error("Expected compilation to fail.");
    } catch (error) {
      expect(error).toBeInstanceOf(WorkflowEditorCompileError);
      expect((error as WorkflowEditorCompileError).diagnostics[0]?.code).toBe(
        "nested-workflow-not-supported",
      );
    }
  });
});
