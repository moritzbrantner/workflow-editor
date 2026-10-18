import { createWorkflowEditorTypeResolver } from "./core-type-resolver";
import type {
  WorkflowEditorNode,
  WorkflowEditorNodeTemplate,
  WorkflowEditorPortType,
  WorkflowEditorTypeDefinition,
} from "./core-types";

/**
 * Human task nodes (Decision Atlas 5.16, editor #105). An approval node pauses the run until a
 * person approves or rejects; an input node pauses until a person supplies a typed value. The
 * editor authors and compiles the task contract; Workflow Engine persists the wait and validates
 * the response (Engine TECH-001), and Workflow Runner suspends and resumes the same run.
 */

export const workflowEditorHumanApprovalKind = "human.task.approval";
export const workflowEditorHumanInputKind = "human.task.input";

/** Compiled task contract on a human task node. */
export type CompiledWorkflowHumanTask =
  | {
      kind: "approval";
      prompt: string;
      /** The response's `decision` (`WorkflowEditorHumanApprovalResponse`) names the active output. */
      outcomes: ["approved", "rejected"];
    }
  | {
      kind: "input";
      prompt: string;
      /** Type of the response's `value` (`WorkflowEditorHumanInputResponse`), emitted on `value`. */
      responseType: WorkflowEditorPortType;
    };

/** A host's answer to a waiting approval task. */
export type WorkflowEditorHumanApprovalResponse = {
  decision: "approved" | "rejected";
  comment?: string;
};

/** A host's answer to a waiting typed-input task. */
export type WorkflowEditorHumanInputResponse<TValue = unknown> = {
  value: TValue;
  comment?: string;
};

export type WorkflowEditorHumanTaskDiagnostic = {
  code: "invalid-human-task";
  message: string;
  path: string;
  nodeId: string;
  portId?: string;
};

const anyType = { kind: "any" } satisfies WorkflowEditorPortType;

export const workflowEditorHumanTaskNodeTemplates = [
  {
    id: "human-task-approval",
    label: "Approval",
    description: "Pause until a person approves or rejects; continues on the chosen branch.",
    kind: workflowEditorHumanApprovalKind,
    category: "Human task",
    inputs: [{ id: "request", label: "Request", type: anyType }],
    outputs: [
      {
        id: "approved",
        label: "Approved",
        type: anyType,
        metadata: { workflowTypeInference: "request" },
      },
      {
        id: "rejected",
        label: "Rejected",
        type: anyType,
        metadata: { workflowTypeInference: "request" },
      },
    ],
    data: { prompt: "Approve this request?" },
    inspectorFields: [{ path: "prompt", label: "Prompt", kind: "text", required: true }],
  },
  {
    id: "human-task-input",
    label: "Human input",
    description: "Pause until a person provides or corrects a typed value.",
    kind: workflowEditorHumanInputKind,
    category: "Human task",
    inputs: [{ id: "context", label: "Context", type: anyType, optional: true }],
    outputs: [{ id: "value", label: "Value", type: { kind: "typescript", source: "string" } }],
    data: { prompt: "Provide the missing value." },
    inspectorFields: [{ path: "prompt", label: "Prompt", kind: "text", required: true }],
  },
] satisfies WorkflowEditorNodeTemplate[];

export function isWorkflowEditorHumanTaskNode(node: { kind?: string }) {
  return (
    node.kind === workflowEditorHumanApprovalKind || node.kind === workflowEditorHumanInputKind
  );
}

function promptOf(node: WorkflowEditorNode<unknown>) {
  const data = node.data as { prompt?: unknown } | undefined;
  return typeof data?.prompt === "string" && data.prompt.trim() ? data.prompt.trim() : node.label;
}

/** Validates a human task node's ports and returns its compiled contract. */
export function compileWorkflowEditorHumanTask(
  node: WorkflowEditorNode<unknown>,
  pathPrefix = "",
): { humanTask: CompiledWorkflowHumanTask } | { diagnostics: WorkflowEditorHumanTaskDiagnostic[] } {
  const diagnostics: WorkflowEditorHumanTaskDiagnostic[] = [];
  const at = `${pathPrefix}nodes.${node.id}`;
  const output = (id: string) => node.outputs?.find((port) => port.id === id);
  const require = (side: "inputs" | "outputs", id: string) => {
    if (!(node[side] ?? []).some((port) => port.id === id)) {
      diagnostics.push({
        code: "invalid-human-task",
        message: `Human task ${node.id} needs ${side === "inputs" ? "an input" : "an output"} port "${id}".`,
        path: `${at}.${side}`,
        nodeId: node.id,
        portId: id,
      });
    }
  };

  if (node.kind === workflowEditorHumanApprovalKind) {
    require("inputs", "request");
    require("outputs", "approved");
    require("outputs", "rejected");
    if (diagnostics.length > 0) return { diagnostics };
    return {
      humanTask: {
        kind: "approval",
        prompt: promptOf(node),
        outcomes: ["approved", "rejected"],
      },
    };
  }

  require("outputs", "value");
  if (diagnostics.length > 0) return { diagnostics };
  return {
    humanTask: {
      kind: "input",
      prompt: promptOf(node),
      responseType: output("value")!.type,
    },
  };
}

/**
 * Validates a host response against a compiled human task (the check Engine applies before it
 * resumes a run). Typed values are checked with the same TypeScript checker as ports.
 */
export function validateWorkflowEditorHumanTaskResponse(
  humanTask: CompiledWorkflowHumanTask,
  response: unknown,
  options: {
    typeDeclarations?: string;
    typeDefinitions?: readonly WorkflowEditorTypeDefinition[];
  } = {},
): string[] {
  if (typeof response !== "object" || response === null || Array.isArray(response)) {
    return ["The response must be an object."];
  }
  const record = response as Record<string, unknown>;
  const messages: string[] = [];
  if (record.comment !== undefined && typeof record.comment !== "string") {
    messages.push("The response comment must be text.");
  }
  if (humanTask.kind === "approval") {
    if (record.decision !== "approved" && record.decision !== "rejected") {
      messages.push('The response decision must be "approved" or "rejected".');
    }
    return messages;
  }
  if (!("value" in record)) {
    return [...messages, "The response needs a value."];
  }
  let literal: string;
  try {
    literal = JSON.stringify(record.value);
  } catch {
    return [...messages, "The response value must be JSON."];
  }
  if (literal === undefined) {
    return [...messages, "The response value must be JSON."];
  }
  const resolver = createWorkflowEditorTypeResolver(
    options.typeDefinitions,
    options.typeDeclarations,
  );
  if (!resolver.isAssignable({ kind: "typescript", source: literal }, humanTask.responseType)) {
    messages.push("The response value does not match the requested type.");
  }
  return messages;
}
