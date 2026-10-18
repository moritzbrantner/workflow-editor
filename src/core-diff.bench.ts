import { bench, describe } from "vitest";

import { diffWorkflowEditorDocuments, type WorkflowEditorDocument } from "./core";

// Large-document comparison (#24): 2,000 nodes and edges with every tenth node edited.
const nodeCount = 2000;
const before: WorkflowEditorDocument = {
  nodes: Array.from({ length: nodeCount }, (_, index) => ({
    id: `n${index}`,
    label: `Node ${index}`,
    kind: "task",
    x: index * 10,
    y: 0,
    inputs: [{ id: "in", label: "In", type: { kind: "any" } }],
    outputs: [{ id: "out", label: "Out", type: { kind: "any" } }],
    data: { config: { retries: 1, url: `https://example.com/${index}` } },
  })),
  edges: Array.from({ length: nodeCount - 1 }, (_, index) => ({
    id: `e${index}`,
    sourceNodeId: `n${index}`,
    sourcePortId: "out",
    targetNodeId: `n${index + 1}`,
    targetPortId: "in",
  })),
};
const after: WorkflowEditorDocument = {
  ...before,
  nodes: before.nodes.map((node, index) =>
    index % 10 === 0
      ? { ...node, x: node.x + 5, data: { config: { retries: 3, url: "x" } } }
      : node,
  ),
};

describe("document diff", () => {
  bench("diff 2,000-node documents (200 edited)", () => {
    diffWorkflowEditorDocuments(before, after);
  });
});
