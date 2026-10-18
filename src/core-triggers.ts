/**
 * Workflow triggers (Decision Atlas 5.11, #91). A Workflow Document declares how it may start:
 * manually, on a cron schedule or from a webhook event. The editor only authors and validates
 * them; Workflow Engine (or another host) registers, activates and dispatches them. The shapes
 * follow workflow-engine's manual / cron / webhook trigger types.
 */
export type WorkflowEditorTrigger =
  | { id: string; type: "manual"; enabled?: boolean }
  | { id: string; type: "cron"; cron: string; enabled?: boolean }
  | { id: string; type: "webhook"; path: string; method?: string; enabled?: boolean };

export type WorkflowEditorTriggerType = WorkflowEditorTrigger["type"];

export type WorkflowEditorTriggerDiagnostic = {
  code: "invalid-trigger" | "duplicate-trigger-id" | "invalid-cron" | "invalid-webhook";
  triggerId?: string;
  message: string;
  path: string;
};

/** Engine-shaped trigger registration input (`WorkflowTriggerInput` in workflow-engine). */
export type WorkflowEditorEngineTriggerInput =
  | { id: string; workflowId: string; workflowVersion?: number; enabled: boolean; type: "manual" }
  | {
      id: string;
      workflowId: string;
      workflowVersion?: number;
      enabled: boolean;
      type: "cron";
      cron: string;
    }
  | {
      id: string;
      workflowId: string;
      workflowVersion?: number;
      enabled: boolean;
      type: "webhook";
      path: string;
      method: string;
    };

const webhookMethods = ["GET", "POST", "PUT", "PATCH", "DELETE"];
const cronField = /^(\*|\d+(-\d+)?)(\/\d+)?(,(\*|\d+(-\d+)?)(\/\d+)?)*$/u;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Whether `value` is a five-field cron expression (minute hour day month weekday). */
export function isWorkflowEditorCronExpression(value: string) {
  const fields = value.trim().split(/\s+/u);
  return fields.length === 5 && fields.every((field) => cronField.test(field));
}

/** Keeps structurally valid triggers (unknown types and malformed entries are dropped). */
export function normalizeWorkflowEditorTriggers(
  value: unknown,
): WorkflowEditorTrigger[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const triggers = value.flatMap((trigger): WorkflowEditorTrigger[] => {
    if (!isRecord(trigger) || typeof trigger.id !== "string" || !trigger.id) return [];
    const enabled = typeof trigger.enabled === "boolean" ? { enabled: trigger.enabled } : {};
    switch (trigger.type) {
      case "manual":
        return [{ id: trigger.id, type: "manual", ...enabled }];
      case "cron":
        return typeof trigger.cron === "string"
          ? [{ id: trigger.id, type: "cron", cron: trigger.cron, ...enabled }]
          : [];
      case "webhook":
        return typeof trigger.path === "string"
          ? [
              {
                id: trigger.id,
                type: "webhook",
                path: trigger.path,
                ...(typeof trigger.method === "string" ? { method: trigger.method } : {}),
                ...enabled,
              },
            ]
          : [];
      default:
        return [];
    }
  });
  return triggers;
}

export function validateWorkflowEditorTriggers(
  triggers: readonly WorkflowEditorTrigger[] | undefined,
): WorkflowEditorTriggerDiagnostic[] {
  const diagnostics: WorkflowEditorTriggerDiagnostic[] = [];
  const seen = new Set<string>();
  (triggers ?? []).forEach((trigger, index) => {
    const path = `triggers[${index}]`;
    if (seen.has(trigger.id)) {
      diagnostics.push({
        code: "duplicate-trigger-id",
        triggerId: trigger.id,
        message: `Trigger id "${trigger.id}" is used more than once.`,
        path: `${path}.id`,
      });
    }
    seen.add(trigger.id);
    if (trigger.type === "cron" && !isWorkflowEditorCronExpression(trigger.cron)) {
      diagnostics.push({
        code: "invalid-cron",
        triggerId: trigger.id,
        message: `Schedule "${trigger.cron}" is not a five-field cron expression (minute hour day month weekday).`,
        path: `${path}.cron`,
      });
    }
    if (trigger.type === "webhook") {
      if (!/^\/[A-Za-z0-9/_.-]*$/u.test(trigger.path)) {
        diagnostics.push({
          code: "invalid-webhook",
          triggerId: trigger.id,
          message: `Webhook path "${trigger.path}" must start with "/" and use letters, digits, "/", "_", "." or "-".`,
          path: `${path}.path`,
        });
      }
      if (trigger.method !== undefined && !webhookMethods.includes(trigger.method)) {
        diagnostics.push({
          code: "invalid-webhook",
          triggerId: trigger.id,
          message: `Webhook method must be one of ${webhookMethods.join(", ")}.`,
          path: `${path}.method`,
        });
      }
    }
  });
  return diagnostics;
}

/**
 * The host-owned deployment descriptor: engine trigger registrations for a registered workflow
 * version. Invalid triggers throw instead of registering a schedule the user did not intend.
 */
export function toWorkflowEditorEngineTriggerInputs(
  triggers: readonly WorkflowEditorTrigger[] | undefined,
  workflow: { workflowId: string; workflowVersion?: number },
): WorkflowEditorEngineTriggerInput[] {
  const diagnostics = validateWorkflowEditorTriggers(triggers);
  if (diagnostics.length > 0) {
    throw new Error(diagnostics.map((diagnostic) => diagnostic.message).join(" "));
  }
  const base = (trigger: WorkflowEditorTrigger) => ({
    id: trigger.id,
    workflowId: workflow.workflowId,
    ...(workflow.workflowVersion === undefined
      ? {}
      : { workflowVersion: workflow.workflowVersion }),
    enabled: trigger.enabled ?? true,
  });
  return (triggers ?? []).map((trigger) =>
    trigger.type === "manual"
      ? { ...base(trigger), type: "manual" }
      : trigger.type === "cron"
        ? { ...base(trigger), type: "cron", cron: trigger.cron.trim() }
        : {
            ...base(trigger),
            type: "webhook",
            path: trigger.path,
            method: trigger.method ?? "POST",
          },
  );
}
