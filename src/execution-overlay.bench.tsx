// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { afterAll, bench, describe } from "vitest";

import { normalizeWorkflowEditorDocument, type WorkflowExecutionSnapshot } from "./core";
import { WorkflowWorkbench } from "./react";

// Render-update cost of a live run snapshot on a 200-node chain (#20): each update replaces the
// snapshot as a host would on every runner progress event.

const nodeCount = 200;
const document = normalizeWorkflowEditorDocument({
  nodes: Array.from({ length: nodeCount }, (_, index) => ({
    id: `n${index}`,
    label: `Node ${index}`,
    kind: "task",
    x: (index % 20) * 260,
    y: Math.floor(index / 20) * 180,
    inputs: index === 0 ? [] : [{ id: "in", label: "In", type: { kind: "any" as const } }],
    outputs: [{ id: "out", label: "Out", type: { kind: "any" as const } }],
  })),
  edges: Array.from({ length: nodeCount - 1 }, (_, index) => ({
    id: `e${index}`,
    sourceNodeId: `n${index}`,
    sourcePortId: "out",
    targetNodeId: `n${index + 1}`,
    targetPortId: "in",
  })),
}).document;

function snapshotAt(step: number): WorkflowExecutionSnapshot {
  const nodes: Record<string, WorkflowExecutionSnapshot["nodes"][string]> = {};
  for (let index = 0; index < nodeCount; index += 1) {
    nodes[`n${index}`] = {
      state: index < step ? "succeeded" : index === step ? "running" : "queued",
      attempt: 1,
    };
  }
  return { runId: "bench-run", state: "running", nodes };
}

describe("execution overlay render updates", () => {
  const view = render(<WorkflowWorkbench document={document} execution={snapshotAt(0)} />);
  let step = 0;

  afterAll(() => cleanup());

  bench("apply one live snapshot update (200 nodes)", () => {
    step = (step + 1) % nodeCount;
    view.rerender(<WorkflowWorkbench document={document} execution={snapshotAt(step)} />);
  });
});
