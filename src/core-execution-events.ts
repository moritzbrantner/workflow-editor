import type {
  WorkflowExecutionNodeSnapshot,
  WorkflowExecutionNodeState,
  WorkflowExecutionSnapshot,
} from "./core-execution";

/**
 * Builds the overlay's `WorkflowExecutionSnapshot` from Workflow Runner lifecycle events
 * (runner #26 / engine #24), so a connected host can feed live progress to the editor (#20).
 * The event shapes are structural: the editor does not depend on the runner package. Node outputs
 * are summarized by their port names only; values never enter the snapshot.
 */
export type WorkflowRunnerLifecycleEvent =
  | { type: "run.started"; runId: string; timestamp: string }
  | { type: "node.started"; runId: string; nodeId: string; attempt: number; timestamp: string }
  | {
      type: "node.succeeded";
      runId: string;
      nodeId: string;
      attempt: number;
      timestamp: string;
      outputs?: Record<string, unknown>;
    }
  | { type: "node.skipped"; runId: string; nodeId: string; timestamp: string }
  | {
      type: "node.retrying";
      runId: string;
      nodeId: string;
      attempt: number;
      nextAttempt: number;
      reason: string;
      timestamp: string;
    }
  | {
      type: "node.failed";
      runId: string;
      nodeId: string;
      attempt: number;
      timestamp: string;
      error: { message?: string };
    }
  | {
      type: "node.suspended";
      runId: string;
      nodeId: string;
      attempt: number;
      taskId: string;
      timestamp: string;
    }
  | {
      type: "node.iteration";
      runId: string;
      nodeId: string;
      iteration: number;
      converged: boolean;
      timestamp: string;
    }
  | { type: "run.succeeded"; runId: string; timestamp: string }
  | { type: "run.failed"; runId: string; timestamp: string }
  | { type: "run.cancelled"; runId: string; timestamp: string }
  | { type: "run.suspended"; runId: string; timestamp: string }
  | { type: "run.resumed"; runId: string; nodeId: string; timestamp: string };

function durationBetween(start?: string, end?: string) {
  if (!start || !end) return undefined;
  const value = Date.parse(end) - Date.parse(start);
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

/** Applies one runner event to a snapshot; unknown events and other runs are ignored. */
export function applyWorkflowRunnerEventToSnapshot(
  snapshot: WorkflowExecutionSnapshot | undefined,
  event: WorkflowRunnerLifecycleEvent | { type: string; runId?: string },
): WorkflowExecutionSnapshot | undefined {
  if (!("runId" in event) || typeof event.runId !== "string") return snapshot;
  if (snapshot && snapshot.runId !== event.runId) return snapshot;
  const current: WorkflowExecutionSnapshot = snapshot ?? {
    runId: event.runId,
    state: "running",
    mode: "live",
    nodes: {},
  };
  const known = event as WorkflowRunnerLifecycleEvent;
  const node = (nodeId: string, update: Partial<WorkflowExecutionNodeSnapshot>) => {
    const previous = current.nodes[nodeId];
    const next: WorkflowExecutionNodeSnapshot = {
      ...previous,
      state: previous?.state ?? "queued",
      ...update,
    };
    return { ...current, nodes: { ...current.nodes, [nodeId]: next } };
  };

  switch (known.type) {
    case "run.started":
      return { ...current, state: "running" };
    case "run.resumed":
      return { ...node(known.nodeId, { state: "running" }), state: "running" };
    case "node.started":
      return node(known.nodeId, {
        state: "running",
        attempt: known.attempt,
        startedAt: known.timestamp,
        endedAt: undefined,
        durationMs: undefined,
        errorSummary: undefined,
      });
    case "node.retrying":
      return node(known.nodeId, {
        state: "running",
        attempt: known.nextAttempt,
        errorSummary: `Retrying after attempt ${known.attempt}: ${known.reason}`,
      });
    case "node.succeeded": {
      const startedAt = current.nodes[known.nodeId]?.startedAt;
      const ports = Object.keys(known.outputs ?? {}).sort();
      return node(known.nodeId, {
        state: "succeeded",
        attempt: known.attempt,
        endedAt: known.timestamp,
        durationMs: durationBetween(startedAt, known.timestamp),
        errorSummary: undefined,
        ...(ports.length ? { outputSummary: `Outputs: ${ports.join(", ")}` } : {}),
      });
    }
    case "node.skipped":
      return node(known.nodeId, { state: "skipped", endedAt: known.timestamp });
    case "node.failed": {
      const startedAt = current.nodes[known.nodeId]?.startedAt;
      return node(known.nodeId, {
        state: "failed",
        attempt: known.attempt,
        endedAt: known.timestamp,
        durationMs: durationBetween(startedAt, known.timestamp),
        errorSummary: known.error?.message ?? "Failed",
      });
    }
    case "node.suspended":
      return node(known.nodeId, {
        state: "waiting",
        attempt: known.attempt,
        outputSummary: `Waiting for task ${known.taskId}`,
      });
    case "node.iteration":
      return node(known.nodeId, {
        state: "running",
        outputSummary: `Iteration ${known.iteration}${known.converged ? " (converged)" : ""}`,
      });
    case "run.succeeded":
      return { ...current, state: "succeeded" };
    case "run.failed":
      return { ...current, state: "failed" };
    case "run.cancelled":
      return { ...current, state: "cancelled" };
    case "run.suspended":
      return { ...current, state: "waiting" };
    default:
      return snapshot;
  }
}

/** Folds a runner event list (one run) into an overlay snapshot. */
export function createWorkflowExecutionSnapshotFromRunnerEvents(
  events: ReadonlyArray<WorkflowRunnerLifecycleEvent | { type: string; runId?: string }>,
  options: { mode?: WorkflowExecutionSnapshot["mode"] } = {},
): WorkflowExecutionSnapshot | undefined {
  let snapshot: WorkflowExecutionSnapshot | undefined;
  for (const event of events) {
    snapshot = applyWorkflowRunnerEventToSnapshot(snapshot, event);
  }
  return snapshot && options.mode ? { ...snapshot, mode: options.mode } : snapshot;
}

/**
 * Live status of a run that Workflow Engine is dispatching (Engine #24, `getLiveRun` /
 * `observeRun`), structurally compatible with the engine's `WorkflowLiveRunStatus`.
 */
export type WorkflowEngineLiveRunStatus = {
  runId: string;
  /** `running` while dispatched; the persisted terminal status in the final notification. */
  status: string;
  nodes: Readonly<
    Record<
      string,
      {
        state: "running" | "retrying" | "succeeded" | "failed" | "skipped" | "suspended" | string;
        attempt?: number;
        updatedAt?: string;
      }
    >
  >;
};

const liveNodeStates: Record<string, WorkflowExecutionNodeState> = {
  running: "running",
  retrying: "running",
  succeeded: "succeeded",
  failed: "failed",
  skipped: "skipped",
  suspended: "waiting",
};

/**
 * Turns an engine live-run notification into an execution snapshot for the overlay (#20). A
 * retrying node shows as running with its attempt; a suspended node (a pending human task) shows
 * as waiting. Live state carries no payloads, so the snapshot has no output summaries.
 */
export function createWorkflowExecutionSnapshotFromLiveRun(
  status: WorkflowEngineLiveRunStatus,
): WorkflowExecutionSnapshot {
  const nodes = Object.fromEntries(
    Object.entries(status.nodes).map(([nodeId, node]) => [
      nodeId,
      {
        state: liveNodeStates[node.state] ?? node.state,
        ...(node.attempt !== undefined ? { attempt: node.attempt } : {}),
        ...(node.state === "succeeded" || node.state === "failed" || node.state === "skipped"
          ? node.updatedAt
            ? { endedAt: node.updatedAt }
            : {}
          : node.updatedAt
            ? { startedAt: node.updatedAt }
            : {}),
      } satisfies WorkflowExecutionNodeSnapshot,
    ]),
  );
  const runState =
    status.status === "running" ? "running" : (liveNodeStates[status.status] ?? status.status);
  return {
    runId: status.runId,
    state: runState,
    mode: status.status === "running" || status.status === "waiting" ? "live" : "historical",
    nodes,
  };
}
