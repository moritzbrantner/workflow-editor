import { useState } from "react";

import { Button, Input } from "@moritzbrantner/ui";

import {
  validateWorkflowEditorTriggers,
  type WorkflowEditorTrigger,
  type WorkflowEditorTriggerType,
} from "../core";

/** Host connection that registers and activates a document's triggers (Workflow Engine). */
export type WorkflowWorkbenchTriggerActivation = {
  activate: (triggers: WorkflowEditorTrigger[]) => void | Promise<void>;
  /** Shown next to the activate action, for example the connected engine's name. */
  label?: string;
};

const typeLabels: Record<WorkflowEditorTriggerType, string> = {
  manual: "Manual",
  cron: "Schedule (cron)",
  webhook: "Webhook",
};

function nextTriggerId(
  triggers: readonly WorkflowEditorTrigger[],
  type: WorkflowEditorTriggerType,
) {
  let index = 1;
  while (triggers.some((trigger) => trigger.id === `${type}-${index}`)) index += 1;
  return `${type}-${index}`;
}

function changeType(
  trigger: WorkflowEditorTrigger,
  type: WorkflowEditorTriggerType,
): WorkflowEditorTrigger {
  const base = {
    id: trigger.id,
    ...(trigger.enabled === undefined ? {} : { enabled: trigger.enabled }),
  };
  return type === "manual"
    ? { ...base, type }
    : type === "cron"
      ? { ...base, type, cron: "0 * * * *" }
      : { ...base, type, path: "/hooks/workflow", method: "POST" };
}

/**
 * Document-level trigger settings, shown in the inspector when nothing is selected (owner
 * decision 2026-10-18). Edits are one document change; activation needs a connected host.
 */
export function WorkflowTriggersPanel({
  triggers: savedTriggers,
  readOnly,
  activation,
  onApply,
}: {
  triggers: readonly WorkflowEditorTrigger[] | undefined;
  readOnly: boolean;
  activation?: WorkflowWorkbenchTriggerActivation;
  onApply: (triggers: WorkflowEditorTrigger[]) => void;
}) {
  const [draft, setDraft] = useState<WorkflowEditorTrigger[]>(() => [...(savedTriggers ?? [])]);
  const [status, setStatus] = useState<string | null>(null);
  const diagnostics = validateWorkflowEditorTriggers(draft);
  const dirty = JSON.stringify(draft) !== JSON.stringify(savedTriggers ?? []);
  const update = (index: number, trigger: WorkflowEditorTrigger) =>
    setDraft((current) => current.map((item, i) => (i === index ? trigger : item)));
  const messageFor = (id: string) =>
    diagnostics
      .filter((diagnostic) => diagnostic.triggerId === id)
      .map((d) => d.message)
      .join(" ");

  return (
    <section aria-label="Triggers" className="grid gap-3 p-4 text-sm">
      <div>
        <h3 className="text-sm font-semibold">Triggers</h3>
        <p className="text-xs text-muted-foreground">How this workflow may start.</p>
      </div>
      {draft.length === 0 ? (
        <p className="text-xs text-muted-foreground">No triggers yet.</p>
      ) : (
        <ul className="grid gap-2">
          {draft.map((trigger, index) => (
            <li key={trigger.id} className="grid gap-1.5 rounded-md border p-2">
              <div className="flex items-center gap-2">
                <select
                  aria-label={`Trigger ${index + 1} type`}
                  className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-xs"
                  value={trigger.type}
                  disabled={readOnly}
                  onChange={(event) =>
                    update(
                      index,
                      changeType(trigger, event.target.value as WorkflowEditorTriggerType),
                    )
                  }
                >
                  {(Object.keys(typeLabels) as WorkflowEditorTriggerType[]).map((type) => (
                    <option key={type} value={type}>
                      {typeLabels[type]}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={trigger.enabled ?? true}
                    disabled={readOnly}
                    onChange={(event) =>
                      update(index, { ...trigger, enabled: event.target.checked })
                    }
                  />
                  Enabled
                </label>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  disabled={readOnly}
                  aria-label={`Remove trigger ${index + 1}`}
                  onClick={() => setDraft((current) => current.filter((_, i) => i !== index))}
                >
                  ×
                </Button>
              </div>
              {trigger.type === "cron" ? (
                <Input
                  aria-label={`Trigger ${index + 1} schedule`}
                  placeholder="0 * * * *"
                  value={trigger.cron}
                  disabled={readOnly}
                  onChange={(event) =>
                    update(index, { ...trigger, cron: event.currentTarget.value })
                  }
                />
              ) : null}
              {trigger.type === "webhook" ? (
                <div className="grid grid-cols-[6rem_minmax(0,1fr)] gap-1">
                  <select
                    aria-label={`Trigger ${index + 1} method`}
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                    value={trigger.method ?? "POST"}
                    disabled={readOnly}
                    onChange={(event) => update(index, { ...trigger, method: event.target.value })}
                  >
                    {["POST", "GET", "PUT", "PATCH", "DELETE"].map((method) => (
                      <option key={method}>{method}</option>
                    ))}
                  </select>
                  <Input
                    aria-label={`Trigger ${index + 1} path`}
                    value={trigger.path}
                    disabled={readOnly}
                    onChange={(event) =>
                      update(index, { ...trigger, path: event.currentTarget.value })
                    }
                  />
                </div>
              ) : null}
              {messageFor(trigger.id) ? (
                <p role="alert" className="text-xs text-destructive">
                  {messageFor(trigger.id)}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={readOnly}
          onClick={() =>
            setDraft((current) => [
              ...current,
              { id: nextTriggerId(current, "manual"), type: "manual" },
            ])
          }
        >
          Add trigger
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={readOnly || !dirty || diagnostics.length > 0}
          onClick={() => onApply(draft)}
        >
          Apply triggers
        </Button>
      </div>
      <div className="grid gap-1 border-t pt-2 text-xs">
        {activation ? (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={
                readOnly || dirty || diagnostics.length > 0 || (savedTriggers ?? []).length === 0
              }
              onClick={async () => {
                setStatus("Activating…");
                try {
                  await activation.activate([...(savedTriggers ?? [])]);
                  setStatus("Triggers activated.");
                } catch (error) {
                  setStatus(
                    `Activation failed: ${error instanceof Error ? error.message : String(error)}`,
                  );
                }
              }}
            >
              Activate triggers
            </Button>
            {activation.label ? (
              <span className="text-muted-foreground">{activation.label}</span>
            ) : null}
          </div>
        ) : (
          <p className="text-muted-foreground">
            Activation unavailable: no workflow host is connected. Triggers are saved with the
            document.
          </p>
        )}
        {status ? <p role="status">{status}</p> : null}
      </div>
    </section>
  );
}
