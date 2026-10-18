import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  compileWorkflowEditorDocument,
  validateWorkflowEditorHumanTaskResponse,
  WorkflowEditorCompileError,
} from "./compiler";
import {
  createWorkflowEditorNodeTemplateRegistry,
  defaultWorkflowEditorNodeTemplates,
  workflowEditorHumanTaskNodeTemplates,
  type WorkflowEditorDocument,
} from "./core";

const [approvalTemplate, inputTemplate] = workflowEditorHumanTaskNodeTemplates;

/** Review an expense: approve or reject it, and ask for a corrected amount on rejection. */
export function humanTaskDocument(): WorkflowEditorDocument {
  return {
    typeDeclarations: "type Expense = { id: string; amount: number };",
    nodes: [
      {
        id: "expense",
        label: "Expense",
        kind: "data.value",
        x: 0,
        y: 0,
        outputs: [{ id: "value", label: "Value", type: { kind: "typescript", source: "Expense" } }],
      },
      {
        ...approvalTemplate!,
        id: "review",
        label: "Manager review",
        x: 300,
        y: 0,
        data: { prompt: "Approve this expense?" },
      },
      {
        ...inputTemplate!,
        id: "correct",
        label: "Corrected amount",
        x: 600,
        y: 120,
        outputs: [{ id: "value", label: "Amount", type: { kind: "typescript", source: "number" } }],
        data: { prompt: "Enter the corrected amount." },
      },
      {
        id: "pay",
        label: "Pay",
        kind: "finance.pay",
        x: 600,
        y: 0,
        inputs: [{ id: "in", label: "In", type: { kind: "any" } }],
      },
      {
        id: "record",
        label: "Record",
        kind: "finance.record",
        x: 900,
        y: 120,
        inputs: [{ id: "in", label: "In", type: { kind: "any" } }],
      },
    ],
    edges: [
      {
        id: "expense-review",
        sourceNodeId: "expense",
        sourcePortId: "value",
        targetNodeId: "review",
        targetPortId: "request",
      },
      {
        id: "review-pay",
        sourceNodeId: "review",
        sourcePortId: "approved",
        targetNodeId: "pay",
        targetPortId: "in",
      },
      {
        id: "review-correct",
        sourceNodeId: "review",
        sourcePortId: "rejected",
        targetNodeId: "correct",
        targetPortId: "context",
      },
      {
        id: "correct-record",
        sourceNodeId: "correct",
        sourcePortId: "value",
        targetNodeId: "record",
        targetPortId: "in",
      },
    ],
  };
}

describe("human task nodes", () => {
  it("ships valid, discoverable approval and input templates", () => {
    expect(defaultWorkflowEditorNodeTemplates).toEqual(
      expect.arrayContaining(workflowEditorHumanTaskNodeTemplates),
    );
    const registry = createWorkflowEditorNodeTemplateRegistry(workflowEditorHumanTaskNodeTemplates);
    expect(registry.diagnostics).toEqual([]);
    expect(registry.listByCategoryPath(["Human task"]).map((template) => template.kind)).toEqual([
      "human.task.approval",
      "human.task.input",
    ]);
  });

  it("compiles the task contracts and matches the shared fixture", () => {
    const compiled = compileWorkflowEditorDocument(humanTaskDocument());
    const humanTasks = Object.fromEntries(
      compiled.nodes.flatMap((node) => (node.humanTask ? [[node.id, node.humanTask]] : [])),
    );
    expect(humanTasks).toEqual({
      review: {
        kind: "approval",
        prompt: "Approve this expense?",
        outcomes: ["approved", "rejected"],
      },
      correct: {
        kind: "input",
        prompt: "Enter the corrected amount.",
        responseType: { kind: "typescript", source: "number" },
      },
    });
    expect(compiled.nodes.find((node) => node.id === "pay")).not.toHaveProperty("humanTask");
    expect(compiled).toEqual(
      JSON.parse(
        readFileSync(resolve(process.cwd(), "fixtures/compiled-v1-human-tasks.json"), "utf8"),
      ),
    );
  });

  it("reports missing task ports", () => {
    const document = humanTaskDocument();
    document.nodes[1] = { ...document.nodes[1]!, outputs: [document.nodes[1]!.outputs![0]!] };
    document.edges = document.edges.filter((edge) => edge.sourcePortId !== "rejected");
    expect(() => compileWorkflowEditorDocument(document)).toThrowError(
      expect.objectContaining({
        diagnostics: [
          expect.objectContaining({
            code: "invalid-human-task",
            nodeId: "review",
            portId: "rejected",
          }),
        ],
      }) as WorkflowEditorCompileError,
    );
  });

  it("validates host responses against the compiled contract", () => {
    const compiled = compileWorkflowEditorDocument(humanTaskDocument());
    const approval = compiled.nodes.find((node) => node.id === "review")!.humanTask!;
    const input = compiled.nodes.find((node) => node.id === "correct")!.humanTask!;

    expect(
      validateWorkflowEditorHumanTaskResponse(approval, {
        decision: "rejected",
        comment: "Too high",
      }),
    ).toEqual([]);
    expect(validateWorkflowEditorHumanTaskResponse(approval, { decision: "maybe" })).toEqual([
      'The response decision must be "approved" or "rejected".',
    ]);
    expect(validateWorkflowEditorHumanTaskResponse(input, { value: 42.5 })).toEqual([]);
    expect(validateWorkflowEditorHumanTaskResponse(input, { value: "42" })).toEqual([
      "The response value does not match the requested type.",
    ]);
    expect(validateWorkflowEditorHumanTaskResponse(input, {})).toEqual([
      "The response needs a value.",
    ]);

    const typed = {
      kind: "input" as const,
      prompt: "Expense",
      responseType: { kind: "typescript" as const, source: "Expense" },
    };
    const declarations = "type Expense = { id: string; amount: number };";
    expect(
      validateWorkflowEditorHumanTaskResponse(
        typed,
        { value: { id: "e1", amount: 3 } },
        { typeDeclarations: declarations },
      ),
    ).toEqual([]);
    expect(
      validateWorkflowEditorHumanTaskResponse(
        typed,
        { value: { id: "e1" } },
        { typeDeclarations: declarations },
      ),
    ).toEqual(["The response value does not match the requested type."]);
  });
});
