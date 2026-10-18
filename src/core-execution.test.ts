import { describe, expect, test } from "vitest";

import {
  formatWorkflowExecutionDuration,
  getWorkflowExecutionEdgeStatus,
  getWorkflowExecutionNodeDuration,
  getWorkflowExecutionNodePresentation,
} from "./core-execution";

describe("workflow execution presentation", () => {
  test("maps built-in and custom node states", () => {
    expect(getWorkflowExecutionNodePresentation({ state: "failed" })).toEqual({
      status: "error",
      tone: "error",
      label: "Failed",
    });
    expect(getWorkflowExecutionNodePresentation({ state: "running", progress: 1.4 }).label).toBe(
      "Running 100%",
    );
    expect(getWorkflowExecutionNodePresentation({ state: "waiting_for_input" })).toEqual({
      status: "idle",
      tone: "neutral",
      label: "Waiting for input",
    });
  });

  test("maps edge states and durations", () => {
    expect(getWorkflowExecutionEdgeStatus({ state: "active" })).toBe("running");
    expect(getWorkflowExecutionEdgeStatus({ state: "blocked" })).toBe("error");
    expect(
      getWorkflowExecutionNodeDuration({
        state: "succeeded",
        startedAt: "2026-10-18T10:00:00.000Z",
        endedAt: "2026-10-18T10:01:05.000Z",
      }),
    ).toBe(65_000);
    expect(formatWorkflowExecutionDuration(65_000)).toBe("1 min 5 s");
    expect(formatWorkflowExecutionDuration(250)).toBe("250 ms");
  });
});
