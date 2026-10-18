import { useState } from "react";

import { Button, Input } from "@moritzbrantner/ui";

import {
  validateWorkflowEditorHumanTaskResponse,
  workflowEditorPortTypeSource,
  type CompiledWorkflowHumanTask,
  type WorkflowEditorHumanApprovalResponse,
  type WorkflowEditorHumanInputResponse,
  type WorkflowEditorTypeDefinition,
} from "../core";

/**
 * A waiting human task of a connected run (#105). The host reads it from Workflow Engine
 * (`listPendingTasks`) and answers through it (`respondToTask`); the editor never stores waits.
 */
export type WorkflowWorkbenchPendingHumanTask = {
  runId: string;
  nodeId: string;
  taskId: string;
  humanTask: CompiledWorkflowHumanTask;
  /** The value that reached the task, shown as its context. */
  request?: unknown;
  since?: string;
};

export type WorkflowWorkbenchHumanTaskResponse =
  | WorkflowEditorHumanApprovalResponse
  | WorkflowEditorHumanInputResponse;

/** Host wiring for pending human tasks of connected runs (#105). */
export type WorkflowWorkbenchHumanTasks = {
  pending: readonly WorkflowWorkbenchPendingHumanTask[];
  /**
   * Submits a validated answer; the host authorizes the responder and resumes the same run.
   * A rejected promise is shown to the person (for example a stale or already answered task).
   */
  respond: (
    task: WorkflowWorkbenchPendingHumanTask,
    response: WorkflowWorkbenchHumanTaskResponse,
  ) => void | Promise<void>;
};

function formatContext(value: unknown) {
  if (value === undefined) return undefined;
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

/** Shows a node's pending task with its context and lets a person answer it. */
export function WorkflowPendingHumanTaskPanel({
  task,
  respond,
  readOnly,
  typeDeclarations,
  typeDefinitions,
}: {
  task: WorkflowWorkbenchPendingHumanTask;
  respond: WorkflowWorkbenchHumanTasks["respond"];
  readOnly: boolean;
  typeDeclarations?: string;
  typeDefinitions?: readonly WorkflowEditorTypeDefinition[];
}) {
  const [comment, setComment] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const context = formatContext(task.request);
  const humanTask = task.humanTask;
  const responseTypeSource =
    humanTask.kind === "input" ? workflowEditorPortTypeSource(humanTask.responseType) : undefined;

  const parseValue = () => {
    if (responseTypeSource === "string") return draft;
    try {
      return JSON.parse(draft) as unknown;
    } catch {
      return draft;
    }
  };
  const inputResponse: WorkflowEditorHumanInputResponse | undefined =
    humanTask.kind === "input"
      ? { value: parseValue(), ...(comment.trim() ? { comment: comment.trim() } : {}) }
      : undefined;
  const problems =
    inputResponse && draft.trim() !== ""
      ? validateWorkflowEditorHumanTaskResponse(humanTask, inputResponse, {
          typeDeclarations,
          typeDefinitions,
        })
      : [];

  const submit = async (response: WorkflowWorkbenchHumanTaskResponse) => {
    setBusy(true);
    setError(null);
    try {
      await respond(task, response);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  };
  const disabled = readOnly || busy;

  return (
    <section
      aria-label="Pending task"
      data-slot="workflow-pending-human-task"
      data-task-id={task.taskId}
      className="grid gap-2 border-b border-border p-3 text-xs"
    >
      <div className="font-medium">Waiting for a person · run {task.runId}</div>
      <p className="text-sm">{humanTask.prompt}</p>
      {context ? (
        <pre
          aria-label="Task context"
          className="max-h-40 overflow-auto rounded bg-muted p-2 font-mono text-[11px]"
        >
          {context}
        </pre>
      ) : null}
      {humanTask.kind === "input" ? (
        <label className="grid gap-1">
          <span>
            Value <code className="text-muted-foreground">{responseTypeSource}</code>
          </span>
          <Input
            aria-label="Task value"
            value={draft}
            disabled={disabled}
            onChange={(event) => setDraft(event.currentTarget.value)}
          />
          {problems.map((problem) => (
            <span key={problem} role="alert" className="text-destructive">
              {problem}
            </span>
          ))}
        </label>
      ) : null}
      <Input
        aria-label="Task comment"
        placeholder="Comment (optional)"
        value={comment}
        disabled={disabled}
        onChange={(event) => setComment(event.currentTarget.value)}
      />
      <div className="flex flex-wrap gap-2">
        {humanTask.kind === "approval" ? (
          <>
            <Button
              type="button"
              size="sm"
              disabled={disabled}
              onClick={() =>
                void submit({
                  decision: "approved",
                  ...(comment.trim() ? { comment: comment.trim() } : {}),
                })
              }
            >
              Approve
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={() =>
                void submit({
                  decision: "rejected",
                  ...(comment.trim() ? { comment: comment.trim() } : {}),
                })
              }
            >
              Reject
            </Button>
          </>
        ) : (
          <Button
            type="button"
            size="sm"
            disabled={disabled || draft.trim() === "" || problems.length > 0}
            onClick={() => inputResponse && void submit(inputResponse)}
          >
            Submit value
          </Button>
        )}
      </div>
      {error ? (
        <p role="alert" className="text-destructive">
          {error}
        </p>
      ) : null}
    </section>
  );
}
