import { Fragment, type ReactNode } from "react";

import type { WorkflowEditorNode } from "../core";
import {
  formatWorkflowExecutionDuration,
  getWorkflowExecutionNodeDuration,
  getWorkflowExecutionNodePresentation,
  type WorkflowExecutionSnapshot,
} from "../core-execution";
import type { WorkflowWorkbenchExecutionContext } from "./workbench-types";

export function WorkflowExecutionDetails<TNodeData extends Record<string, unknown>>({
  execution,
  node,
  renderExecutionDetails,
}: {
  execution: WorkflowExecutionSnapshot;
  node: WorkflowEditorNode<TNodeData>;
  renderExecutionDetails?: (context: WorkflowWorkbenchExecutionContext<TNodeData>) => ReactNode;
}) {
  const snapshot = execution.nodes[node.id];
  const duration = snapshot ? getWorkflowExecutionNodeDuration(snapshot) : undefined;
  const rows: Array<[string, string]> = snapshot
    ? [
        ["State", getWorkflowExecutionNodePresentation(snapshot).label],
        ...(snapshot.attempt !== undefined
          ? [["Attempt", String(snapshot.attempt)] as [string, string]]
          : []),
        ...(snapshot.startedAt ? [["Started", snapshot.startedAt] as [string, string]] : []),
        ...(snapshot.endedAt ? [["Ended", snapshot.endedAt] as [string, string]] : []),
        ...(duration !== undefined
          ? [["Duration", formatWorkflowExecutionDuration(duration)] as [string, string]]
          : []),
        ...(snapshot.outputSummary ? [["Output", snapshot.outputSummary] as [string, string]] : []),
        ...(snapshot.errorSummary ? [["Error", snapshot.errorSummary] as [string, string]] : []),
      ]
    : [];

  return (
    <section
      aria-label="Run details"
      data-slot="workflow-execution-details"
      data-run-id={execution.runId}
      className="grid gap-1.5 border-b border-border p-3 text-xs"
    >
      <div className="font-medium">
        {execution.mode === "historical" ? "Past run" : "Run"} {execution.runId}
      </div>
      {snapshot ? (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2 gap-y-1">
          {rows.map(([label, value]) => (
            <Fragment key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="min-w-0 break-words">{value}</dd>
            </Fragment>
          ))}
        </dl>
      ) : (
        <div className="text-muted-foreground">No run state for this node.</div>
      )}
      {renderExecutionDetails?.({ execution, node, ...(snapshot ? { snapshot } : {}) })}
    </section>
  );
}
