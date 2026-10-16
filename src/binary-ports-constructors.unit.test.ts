// Regression for PR #84 review: an expanding JSON constructor receives the edge on a newly created
// input, so payload compatibility is checked against that (buffered) input rather than the add
// placeholder or an occupied input.
import { describe, expect, test } from "vitest";

import {
  analyzeWorkflowEditorPortTypes,
  connectWorkflowEditorNodes,
  defaultWorkflowEditorNodeTemplates,
  normalizeWorkflowEditorDocument,
  validateWorkflowEditorConnection,
  type WorkflowEditorDocument,
  type WorkflowEditorNode,
  type WorkflowEditorPortPayload,
} from "./index";

const arrayTemplate = defaultWorkflowEditorNodeTemplates.find(
  (template) => template.kind === "json.array",
)!;

function source(id: string, payload?: WorkflowEditorPortPayload): WorkflowEditorNode {
  return {
    id,
    label: id,
    kind: "test.source",
    x: 0,
    y: 0,
    outputs: [
      { id: "out", label: "Out", type: { kind: "string" }, ...(payload ? { payload } : {}) },
    ],
  };
}

function documentWith(...sources: WorkflowEditorNode[]): WorkflowEditorDocument {
  return normalizeWorkflowEditorDocument({
    nodes: [...sources, { ...arrayTemplate, id: "array", x: 300, y: 0 } as WorkflowEditorNode],
    edges: [],
  });
}

const toAddItem = (sourceNodeId: string) => ({
  sourceNodeId,
  sourcePortId: "out",
  targetNodeId: "array",
  targetPortId: "item-add",
});

describe("payloads on expanding JSON constructors", () => {
  test("rejects a streamed source, because the created input assembles a complete value", () => {
    const document = documentWith(source("chunks", { mode: "streamed" }));

    expect(validateWorkflowEditorConnection(document, toAddItem("chunks"))).toMatchObject({
      valid: false,
      reason: "payload-mode-mismatch",
    });
  });

  test("checks an occupied input against the input that will be created", () => {
    let document = connectWorkflowEditorNodes(
      documentWith(source("first"), source("second")),
      toAddItem("first"),
    );
    const occupied = document.edges[0]!;
    // An authored streamed contract on the occupied input must not block the new buffered input.
    document = {
      ...document,
      nodes: document.nodes.map((node) =>
        node.id === "array"
          ? {
              ...node,
              inputs: node.inputs?.map((port) =>
                port.id === occupied.targetPortId
                  ? { ...port, payload: { mode: "streamed" } as const }
                  : port,
              ),
            }
          : node,
      ),
    };
    const connection = {
      sourceNodeId: "second",
      sourcePortId: "out",
      targetNodeId: "array",
      targetPortId: occupied.targetPortId,
    };

    expect(validateWorkflowEditorConnection(document, connection)).toEqual({ valid: true });
    const connected = connectWorkflowEditorNodes(document, connection);
    const created = connected.edges.find((edge) => edge.sourceNodeId === "second")!;
    expect(created.targetPortId).not.toBe(occupied.targetPortId);
    expect(
      analyzeWorkflowEditorPortTypes(connected).filter(
        (diagnostic) => diagnostic.edgeId === created.id,
      ),
    ).toEqual([]);
  });
});
