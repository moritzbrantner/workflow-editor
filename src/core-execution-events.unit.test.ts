import { describe, expect, it } from "vitest";

import {
  applyWorkflowRunnerEventToSnapshot,
  createWorkflowExecutionSnapshotFromRunnerEvents,
  getWorkflowExecutionNodePresentation,
  type WorkflowRunnerLifecycleEvent,
} from "./core";

const t = (seconds: number) => new Date(Date.UTC(2026, 9, 18, 9, 0, seconds)).toISOString();

const events: WorkflowRunnerLifecycleEvent[] = [
  { type: "run.started", runId: "r1", timestamp: t(0) },
  { type: "node.started", runId: "r1", nodeId: "fetch", attempt: 1, timestamp: t(1) },
  {
    type: "node.retrying",
    runId: "r1",
    nodeId: "fetch",
    attempt: 1,
    nextAttempt: 2,
    reason: "timeout",
    timestamp: t(2),
  },
  { type: "node.started", runId: "r1", nodeId: "fetch", attempt: 2, timestamp: t(3) },
  {
    type: "node.succeeded",
    runId: "r1",
    nodeId: "fetch",
    attempt: 2,
    timestamp: t(5),
    outputs: { rows: [1, 2], secret: "s" },
  },
  { type: "node.skipped", runId: "r1", nodeId: "fallback", timestamp: t(5) },
  { type: "node.started", runId: "r1", nodeId: "review", attempt: 1, timestamp: t(6) },
  {
    type: "node.suspended",
    runId: "r1",
    nodeId: "review",
    attempt: 1,
    taskId: "task-7",
    timestamp: t(7),
  },
  { type: "run.suspended", runId: "r1", timestamp: t(7) },
];

describe("runner events → execution snapshot", () => {
  it("tracks attempts, retries, durations, skips and waiting tasks without output values", () => {
    const snapshot = createWorkflowExecutionSnapshotFromRunnerEvents(events)!;
    expect(snapshot).toMatchObject({ runId: "r1", state: "waiting", mode: "live" });
    expect(snapshot.nodes.fetch).toEqual({
      state: "succeeded",
      attempt: 2,
      startedAt: t(3),
      endedAt: t(5),
      durationMs: 2000,
      outputSummary: "Outputs: rows, secret",
    });
    expect(snapshot.nodes.fallback).toMatchObject({ state: "skipped" });
    expect(snapshot.nodes.review).toMatchObject({
      state: "waiting",
      outputSummary: "Waiting for task task-7",
    });
    expect(JSON.stringify(snapshot)).not.toContain('"s"');
    expect(getWorkflowExecutionNodePresentation(snapshot.nodes.review!).label).toBe("Waiting");
  });

  it("reports failures and ignores other runs and unknown events", () => {
    let snapshot = createWorkflowExecutionSnapshotFromRunnerEvents(events.slice(0, 2));
    snapshot = applyWorkflowRunnerEventToSnapshot(snapshot, {
      type: "node.failed",
      runId: "r1",
      nodeId: "fetch",
      attempt: 1,
      timestamp: t(4),
      error: { message: "503 from upstream" },
    });
    snapshot = applyWorkflowRunnerEventToSnapshot(snapshot, {
      type: "run.failed",
      runId: "r1",
      timestamp: t(4),
    });
    expect(snapshot).toMatchObject({
      state: "failed",
      nodes: { fetch: { state: "failed", errorSummary: "503 from upstream", durationMs: 3000 } },
    });
    expect(
      applyWorkflowRunnerEventToSnapshot(snapshot, {
        type: "run.started",
        runId: "other",
        timestamp: t(9),
      }),
    ).toBe(snapshot);
    expect(
      applyWorkflowRunnerEventToSnapshot(snapshot, { type: "something.new", runId: "r1" }),
    ).toBe(snapshot);
    expect(
      createWorkflowExecutionSnapshotFromRunnerEvents(events, { mode: "historical" })?.mode,
    ).toBe("historical");
  });
});
