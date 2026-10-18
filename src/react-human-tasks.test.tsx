import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import {
  WorkflowWorkbench,
  normalizeWorkflowEditorDocument,
  workflowEditorHumanTaskNodeTemplates,
  type WorkflowWorkbenchPendingHumanTask,
} from "@moritzbrantner/workflow-editor";

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserver {
      disconnect() {}
      observe() {}
      unobserve() {}
    },
  );
});
afterEach(() => cleanup());

const [approvalTemplate, inputTemplate] = workflowEditorHumanTaskNodeTemplates;
const document = normalizeWorkflowEditorDocument({
  nodes: [
    { ...approvalTemplate!, id: "approve", x: 0, y: 0 },
    {
      ...inputTemplate!,
      id: "amount",
      x: 300,
      y: 0,
      outputs: [{ id: "value", label: "Amount", type: { kind: "typescript", source: "number" } }],
    },
  ],
  edges: [],
}).document;

const approvalTask: WorkflowWorkbenchPendingHumanTask = {
  runId: "run-1",
  nodeId: "approve",
  taskId: "task-1",
  humanTask: { kind: "approval", prompt: "Pay this expense?", outcomes: ["approved", "rejected"] },
  request: { amount: 120, by: "ada" },
};
const inputTask: WorkflowWorkbenchPendingHumanTask = {
  runId: "run-1",
  nodeId: "amount",
  taskId: "task-2",
  humanTask: {
    kind: "input",
    prompt: "Correct the amount",
    responseType: { kind: "typescript", source: "number" },
  },
};

describe("pending human tasks of connected runs (#105)", () => {
  test("shows the task with its context and submits an approval", async () => {
    const respond = vi.fn();
    render(
      <WorkflowWorkbench
        document={document}
        selectedNodeId="approve"
        humanTasks={{ pending: [approvalTask, inputTask], respond }}
      />,
    );
    const panel = screen.getByRole("region", { name: "Pending task" });
    expect(panel.textContent).toContain("Pay this expense?");
    expect(screen.getByLabelText("Task context").textContent).toContain('"amount": 120');
    fireEvent.change(screen.getByLabelText("Task comment"), { target: { value: "ok" } });
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));
    await waitFor(() =>
      expect(respond).toHaveBeenCalledWith(approvalTask, { decision: "approved", comment: "ok" }),
    );
  });

  test("validates a typed answer with the port type checker and reports host errors", async () => {
    const respond = vi.fn().mockRejectedValue(new Error("Task task-2 is not waiting."));
    render(
      <WorkflowWorkbench
        document={document}
        selectedNodeId="amount"
        humanTasks={{ pending: [approvalTask, inputTask], respond }}
      />,
    );
    const submit = screen.getByRole("button", { name: "Submit value" }) as HTMLButtonElement;
    fireEvent.change(screen.getByLabelText("Task value"), { target: { value: '"many"' } });
    expect(screen.getAllByRole("alert").length).toBeGreaterThan(0);
    expect(submit.disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Task value"), { target: { value: "42" } });
    expect(submit.disabled).toBe(false);
    fireEvent.click(submit);
    await waitFor(() => expect(respond).toHaveBeenCalledWith(inputTask, { value: 42 }));
    expect(await screen.findByText("Task task-2 is not waiting.")).not.toBeNull();
  });

  test("shows nothing without a pending task for the node", () => {
    render(<WorkflowWorkbench document={document} selectedNodeId="approve" />);
    expect(screen.queryByRole("region", { name: "Pending task" })).toBeNull();
  });
});
