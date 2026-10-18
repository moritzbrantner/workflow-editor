import { describe, expect, it } from "vitest";

import {
  isWorkflowEditorCronExpression,
  normalizeWorkflowEditorDocument,
  toWorkflowEditorEngineTriggerInputs,
  validateWorkflowEditorTriggers,
  type WorkflowEditorTrigger,
} from "./core";
import { buildWorkflowEditorDocumentFile, parseWorkflowEditorDocumentFile } from "./persistence";

const triggers: WorkflowEditorTrigger[] = [
  { id: "manual-1", type: "manual" },
  { id: "nightly", type: "cron", cron: "0 2 * * *" },
  { id: "hook", type: "webhook", path: "/hooks/sales", method: "POST", enabled: false },
];

describe("workflow triggers", () => {
  it("survive normalization and document file round-trips; malformed entries are dropped", () => {
    const document = normalizeWorkflowEditorDocument({
      nodes: [],
      edges: [],
      triggers: [...triggers, { id: "x", type: "carrier-pigeon" } as never],
    }).document;
    expect(document.triggers).toEqual(triggers);
    const reopened = parseWorkflowEditorDocumentFile(
      JSON.stringify(buildWorkflowEditorDocumentFile(document)),
    ).document;
    expect(reopened.triggers).toEqual(triggers);
    expect(normalizeWorkflowEditorDocument({ nodes: [], edges: [] }).document).not.toHaveProperty(
      "triggers",
    );
  });

  it("validates schedules, webhook paths and ids", () => {
    expect(isWorkflowEditorCronExpression("*/15 9-17 * * 1-5")).toBe(true);
    expect(isWorkflowEditorCronExpression("every hour")).toBe(false);
    expect(
      validateWorkflowEditorTriggers([
        { id: "a", type: "cron", cron: "every hour" },
        { id: "a", type: "webhook", path: "hooks", method: "TRACE" },
      ]).map((diagnostic) => [diagnostic.code, diagnostic.path]),
    ).toEqual([
      ["invalid-cron", "triggers[0].cron"],
      ["duplicate-trigger-id", "triggers[1].id"],
      ["invalid-webhook", "triggers[1].path"],
      ["invalid-webhook", "triggers[1].method"],
    ]);
  });

  it("produces engine trigger registrations for a workflow version", () => {
    expect(
      toWorkflowEditorEngineTriggerInputs(triggers, { workflowId: "sales", workflowVersion: 3 }),
    ).toEqual([
      { id: "manual-1", workflowId: "sales", workflowVersion: 3, enabled: true, type: "manual" },
      {
        id: "nightly",
        workflowId: "sales",
        workflowVersion: 3,
        enabled: true,
        type: "cron",
        cron: "0 2 * * *",
      },
      {
        id: "hook",
        workflowId: "sales",
        workflowVersion: 3,
        enabled: false,
        type: "webhook",
        path: "/hooks/sales",
        method: "POST",
      },
    ]);
    expect(() =>
      toWorkflowEditorEngineTriggerInputs([{ id: "bad", type: "cron", cron: "x" }], {
        workflowId: "w",
      }),
    ).toThrow(/cron/u);
  });
});
