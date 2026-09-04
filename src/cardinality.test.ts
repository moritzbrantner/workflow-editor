import { describe, expect, it } from "vitest";

import {
  analyzeWorkflowEditorPortCardinality,
  connectWorkflowEditorNodesWithCardinality,
  validateWorkflowEditorConnectionWithCardinality,
  type WorkflowEditorCardinalityPort,
} from "./cardinality";
import { compileWorkflowEditorDocument, WorkflowEditorCompileError } from "./compiler";
import type { WorkflowEditorDocument, WorkflowEditorPort } from "./core-types";

const numberPort = (id: string, cardinality?: WorkflowEditorCardinalityPort["cardinality"]) =>
  ({
    id,
    label: id,
    type: { kind: "number" },
    ...(cardinality ? { cardinality } : {}),
  }) as WorkflowEditorCardinalityPort;

function createDocument(): WorkflowEditorDocument {
  return {
    nodes: [
      {
        id: "source-a",
        label: "Source A",
        kind: "source",
        x: 0,
        y: 0,
        outputs: [numberPort("out", { max: 1 }) as WorkflowEditorPort],
      },
      {
        id: "source-b",
        label: "Source B",
        kind: "source",
        x: 0,
        y: 100,
        outputs: [numberPort("out") as WorkflowEditorPort],
      },
      {
        id: "target-a",
        label: "Target A",
        kind: "target",
        x: 300,
        y: 0,
        inputs: [numberPort("in", { max: 2 }) as WorkflowEditorPort],
      },
      {
        id: "target-b",
        label: "Target B",
        kind: "target",
        x: 300,
        y: 100,
        inputs: [numberPort("in") as WorkflowEditorPort],
      },
    ],
    edges: [
      {
        id: "edge-existing",
        sourceNodeId: "source-a",
        sourcePortId: "out",
        targetNodeId: "target-a",
        targetPortId: "in",
      },
    ],
  };
}

describe("workflow port cardinality", () => {
  it("rejects a connection once an explicit source maximum is reached", () => {
    const validity = validateWorkflowEditorConnectionWithCardinality(createDocument(), {
      sourceNodeId: "source-a",
      sourcePortId: "out",
      targetNodeId: "target-b",
      targetPortId: "in",
    });

    expect(validity).toEqual({ valid: false, reason: "source-cardinality" });
  });

  it("allows an explicitly multi-input port up to its maximum", () => {
    const connection = {
      sourceNodeId: "source-b",
      sourcePortId: "out",
      targetNodeId: "target-a",
      targetPortId: "in",
    };
    const document = createDocument();

    expect(validateWorkflowEditorConnectionWithCardinality(document, connection)).toEqual({
      valid: true,
    });

    const connected = connectWorkflowEditorNodesWithCardinality(document, connection);
    expect(connected.edges).toHaveLength(2);
    expect(connected.edges[1]).toMatchObject(connection);
  });

  it("reports unmet minimum cardinality deterministically", () => {
    const document = createDocument();
    const target = document.nodes.find((node) => node.id === "target-b")!;
    target.inputs = [numberPort("in", { min: 1 }) as WorkflowEditorPort];

    expect(analyzeWorkflowEditorPortCardinality(document)).toEqual([
      expect.objectContaining({
        code: "port-cardinality-min",
        nodeId: "target-b",
        portId: "in",
        direction: "input",
        connectionCount: 0,
        min: 1,
      }),
    ]);
  });

  it("surfaces cardinality failures through compiler diagnostics", () => {
    const document = createDocument();
    const target = document.nodes.find((node) => node.id === "target-b")!;
    target.inputs = [numberPort("in", { min: 1 }) as WorkflowEditorPort];

    expect(() => compileWorkflowEditorDocument(document)).toThrowError(WorkflowEditorCompileError);

    try {
      compileWorkflowEditorDocument(document);
    } catch (error) {
      expect(error).toBeInstanceOf(WorkflowEditorCompileError);
      expect((error as WorkflowEditorCompileError).diagnostics).toEqual([
        expect.objectContaining({
          code: "port-cardinality",
          nodeId: "target-b",
          portId: "in",
        }),
      ]);
    }
  });

  it("preserves declared cardinality in the compiled runtime contract", () => {
    const compiled = compileWorkflowEditorDocument(createDocument());
    const target = compiled.nodes.find((node) => node.id === "target-a")!;

    expect(target.inputs?.[0]?.cardinality).toEqual({ max: 2 });
  });
});
