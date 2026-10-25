/**
 * Host-supplied execution state for visualizing a workflow run (W-08 / Decision Atlas 5.7).
 *
 * Snapshots are controlled, transient inputs. They are never written into the Workflow Document,
 * its history, saved versions, serialization or dirty tracking. The editor only renders them.
 */

/** Built-in node run states. Hosts may pass other strings; they render as custom states. */
export type WorkflowExecutionNodeState =
  | "queued"
  | "running"
  | "waiting"
  | "succeeded"
  | "failed"
  | "skipped"
  | "cancelled"
  | "unknown"
  | (string & {});

export type WorkflowExecutionNodeSnapshot = {
  state: WorkflowExecutionNodeState;
  /** Host identifier of this node's run within the workflow run. */
  nodeRunId?: string;
  /** Identifier of the current attempt. */
  attemptId?: string;
  /** Number of attempts started so far (1 for the first attempt). */
  attempt?: number;
  /** Completion fraction from 0 to 1. */
  progress?: number;
  /** ISO 8601 timestamps. */
  startedAt?: string;
  endedAt?: string;
  durationMs?: number;
  /** Short, already-redacted summaries supplied by the host. */
  outputSummary?: string;
  errorSummary?: string;
};

export type WorkflowExecutionEdgeState =
  | "idle"
  | "active"
  | "transferred"
  | "blocked"
  | (string & {});

export type WorkflowExecutionEdgeSnapshot = {
  state: WorkflowExecutionEdgeState;
  summary?: string;
};

export type WorkflowExecutionSnapshot = {
  /** Host identifier of the workflow run. */
  runId: string;
  /** Overall run state, using the same vocabulary as node states. */
  state?: WorkflowExecutionNodeState;
  /** `historical` marks a finished run being inspected; the editor shows it as read-only evidence. */
  mode?: "live" | "historical";
  /** Execution state keyed by Workflow Document node ID. Nodes without an entry show no state. */
  nodes: Readonly<Record<string, WorkflowExecutionNodeSnapshot>>;
  /** Data-flow state keyed by Workflow Document edge ID, independent of edge metadata. */
  edges?: Readonly<Record<string, WorkflowExecutionEdgeSnapshot>>;
};

/** The graph status/tone used to render an execution state. */
export type WorkflowExecutionPresentation = {
  status: "idle" | "running" | "success" | "error" | "warning";
  tone: "neutral" | "info" | "success" | "error" | "warning";
  label: string;
};

const nodePresentation: Record<string, WorkflowExecutionPresentation> = {
  queued: { status: "idle", tone: "neutral", label: "Queued" },
  running: { status: "running", tone: "info", label: "Running" },
  succeeded: { status: "success", tone: "success", label: "Succeeded" },
  failed: { status: "error", tone: "error", label: "Failed" },
  skipped: { status: "idle", tone: "neutral", label: "Skipped" },
  cancelled: { status: "warning", tone: "warning", label: "Cancelled" },
  waiting: { status: "warning", tone: "warning", label: "Waiting" },
  unknown: { status: "idle", tone: "neutral", label: "Unknown" },
};

function titleCase(value: string) {
  const text = value.replace(/[-_]+/g, " ").trim();
  return text ? text[0]!.toUpperCase() + text.slice(1) : "Unknown";
}

/**
 * Presentation of a node execution state. Runtime state takes precedence over a node's
 * design-time `status` and `tone` while an execution snapshot is shown (see docs/execution-overlay.md).
 */
export function getWorkflowExecutionNodePresentation(
  snapshot: WorkflowExecutionNodeSnapshot,
): WorkflowExecutionPresentation {
  const base = nodePresentation[snapshot.state] ?? {
    status: "idle",
    tone: "neutral",
    label: titleCase(snapshot.state),
  };
  const progress =
    snapshot.state === "running" && typeof snapshot.progress === "number"
      ? ` ${Math.round(Math.min(1, Math.max(0, snapshot.progress)) * 100)}%`
      : "";
  const attempt = snapshot.attempt && snapshot.attempt > 1 ? ` · attempt ${snapshot.attempt}` : "";
  return { ...base, label: `${base.label}${progress}${attempt}` };
}

/** Graph edge status used to render an edge's data-flow state. */
export function getWorkflowExecutionEdgeStatus(
  snapshot: WorkflowExecutionEdgeSnapshot,
): "idle" | "running" | "success" | "error" {
  switch (snapshot.state) {
    case "active":
      return "running";
    case "transferred":
      return "success";
    case "blocked":
      return "error";
    default:
      return "idle";
  }
}

/** Duration in milliseconds from explicit duration or start/end timestamps, if known. */
export function getWorkflowExecutionNodeDuration(
  snapshot: WorkflowExecutionNodeSnapshot,
): number | undefined {
  if (typeof snapshot.durationMs === "number") {
    return snapshot.durationMs;
  }
  if (!snapshot.startedAt || !snapshot.endedAt) {
    return undefined;
  }
  const duration = Date.parse(snapshot.endedAt) - Date.parse(snapshot.startedAt);
  return Number.isFinite(duration) && duration >= 0 ? duration : undefined;
}

/** Formats a duration in milliseconds as a compact human-readable string. */
export function formatWorkflowExecutionDuration(durationMs: number): string {
  if (durationMs < 1000) {
    return `${Math.round(durationMs)} ms`;
  }
  const seconds = durationMs / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(seconds < 10 ? 1 : 0)} s`;
  }
  const minutes = Math.floor(seconds / 60);
  return `${minutes} min ${Math.round(seconds - minutes * 60)} s`;
}
