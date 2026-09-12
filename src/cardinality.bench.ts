import { bench, describe } from "vitest";

import { analyzeWorkflowEditorPortCardinality } from "./cardinality";
import type { WorkflowEditorDocument, WorkflowEditorPort } from "./core-types";

const largeDocument = createBenchmarkDocument(1_000, 4);

describe("workflow editor cardinality", () => {
  bench("analyze 1,000 nodes and 3,996 edges", () => {
    analyzeWorkflowEditorPortCardinality(largeDocument);
  });
});

function createBenchmarkDocument(nodeCount: number, portsPerNode: number): WorkflowEditorDocument {
  const nodes = Array.from({ length: nodeCount }, (_, nodeIndex) => ({
    id: `node-${nodeIndex}`,
    label: `Node ${nodeIndex}`,
    kind: "operation",
    x: nodeIndex * 40,
    y: (nodeIndex % 10) * 80,
    inputs:
      nodeIndex === 0
        ? []
        : Array.from({ length: portsPerNode }, (_, portIndex): WorkflowEditorPort => ({
            id: `port-${portIndex}`,
            label: `Input ${portIndex}`,
            type: { kind: "number" },
          })),
    outputs:
      nodeIndex === nodeCount - 1
        ? []
        : Array.from({ length: portsPerNode }, (_, portIndex): WorkflowEditorPort => ({
            id: `port-${portIndex}`,
            label: `Output ${portIndex}`,
            type: { kind: "number" },
          })),
  }));

  const edges = Array.from({ length: Math.max(0, nodeCount - 1) }, (_, nodeIndex) =>
    Array.from({ length: portsPerNode }, (_, portIndex) => ({
      id: `edge-${nodeIndex}-${portIndex}`,
      sourceNodeId: `node-${nodeIndex}`,
      sourcePortId: `port-${portIndex}`,
      targetNodeId: `node-${nodeIndex + 1}`,
      targetPortId: `port-${portIndex}`,
    })),
  ).flat();

  return { nodes, edges };
}
