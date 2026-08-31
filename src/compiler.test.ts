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
      data: { editorLabel: "Continue" },
    },
  ],
  groups: [{ id: "flow", label: "Flow", nodeIds: ["start", "end"] }],
  viewport: { x: 100, y: 50, zoom: 1.5 },
};

describe("compileWorkflowEditorDocument", () => {
  it("produces a deterministic execution-neutral DAG", () => {
    const compiled = compileWorkflowEditorDocument(simpleDocument);

    expect(compiled).toEqual({
      format: compiledWorkflowFormat,
      version: compiledWorkflowVersion,
      nodes: [
        {
          id: "start",
          label: "Start",
          kind: "control.start",
          outputs: [{ id: "out", type: { kind: "any" } }],
        },
        {
          id: "end",
          label: "End",
          kind: "control.end",
          inputs: [
            {
              id: "in",
              type: { kind: "string" },
              optional: true,
              defaultValue: "fallback",
            },
          ],
          data: { result: "complete" },
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
      order: ["start", "end"],
    });
  });

  it("uses locale-independent ordering for otherwise independent nodes", () => {
    const document: WorkflowEditorDocument = {
      nodes: [
        { id: "ä", label: "Umlaut", kind: "noop", x: 0, y: 0 },
        { id: "z", label: "Zed", kind: "noop", x: 0, y: 0 },
      ],
      edges: [],
    };

    expect(compileWorkflowEditorDocument(document).order).toEqual(["z", "ä"]);
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

  it("keeps embedded composition expansion out of compiler version 1", () => {
    const document: WorkflowEditorDocument = {
      nodes: [
        {
          id: "composed",
          label: "Composed",
          kind: "workflow.composed",
          x: 0,
          y: 0,
          composition: {
            nodes: [{ id: "inner", label: "Inner", kind: "noop", x: 0, y: 0 }],
            edges: [],
            inputBoundaries: [],
            outputBoundaries: [],
          },
        },
      ],
      edges: [],
    };

    expect(() => compileWorkflowEditorDocument(document)).toThrowError(
      expect.objectContaining({
        diagnostics: [expect.objectContaining({ code: "composition-not-supported" })],
      }),
    );
  });

  it("reports cyclic documents as invalid compiler DAGs", () => {
    const document: WorkflowEditorDocument = {
      nodes: [
        { id: "a", label: "A", kind: "noop", x: 0, y: 0 },
        { id: "b", label: "B", kind: "noop", x: 0, y: 0 },
      ],
      edges: [
        { id: "a-b", sourceNodeId: "a", targetNodeId: "b" },
        { id: "b-a", sourceNodeId: "b", targetNodeId: "a" },
      ],
    };

    expect(() => compileWorkflowEditorDocument(document)).toThrowError(
      expect.objectContaining({
        diagnostics: [expect.objectContaining({ code: "invalid-dag" })],
      }),
    );
  });
});
