import { bench, describe } from "vitest";

import { analyzeWorkflowEditorPortCardinality } from "./cardinality";
import { createWorkflowEditorDocumentContext } from "./core-context";
import type { WorkflowEditorDocument, WorkflowEditorPort } from "./core-types";

const largeDocument = createBenchmarkDocument();

describe("workflow editor cardinality", () => {
  bench("analyze 1,000 nodes and 3,996 edges", () => {
    analyzeWorkflowEditorPortCardinality(largeDocument);
  });

  bench("index 1,000 nodes and 3,996 edges", () => {
    createWorkflowEditorDocumentContext(largeDocument);
  });
});

function createBenchmarkDocument(): WorkflowEditorDocument {
  const nodes: WorkflowEditorDocument["nodes"] = [];
  const edges: WorkflowEditorDocument["edges"] = [];

  for (let nodeIndex = 0; nodeIndex < 1_000; nodeIndex += 1) {
    const inputs: WorkflowEditorPort[] = [];
    const outputs: WorkflowEditorPort[] = [];

    for (let portIndex = 0; portIndex < 4; portIndex += 1) {
      const portId = `port-${portIndex}`;
      if (nodeIndex > 0) {
        inputs.push(createBenchmarkPort(portId, `Input ${portIndex}`));
      }
      if (nodeIndex < 999) {
        outputs.push(createBenchmarkPort(portId, `Output ${portIndex}`));
        edges.push({
          id: `edge-${nodeIndex}-${portIndex}`,
          sourceNodeId: `node-${nodeIndex}`,
          sourcePortId: portId,
          targetNodeId: `node-${nodeIndex + 1}`,
          targetPortId: portId,
        });
      }
    }

    nodes.push({
      id: `node-${nodeIndex}`,
      label: `Node ${nodeIndex}`,
      kind: "operation",
      x: nodeIndex * 40,
      y: (nodeIndex % 10) * 80,
      inputs,
      outputs,
    });
  }

  return { nodes, edges };
}

function createBenchmarkPort(id: string, label: string): WorkflowEditorPort {
  return { id, label, type: { kind: "number" } };
}
