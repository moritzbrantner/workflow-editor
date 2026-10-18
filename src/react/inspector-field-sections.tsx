import type { ReactNode } from "react";

import { Button, Checkbox, Input } from "@moritzbrantner/ui";

import {
  isWorkflowEditorInspectorFieldVisible,
  readWorkflowEditorFieldValue,
  validateWorkflowEditorFieldValue,
  workflowEditorMixedFieldValue,
  writeWorkflowEditorFieldPath,
  type WorkflowEditorInspectorFieldDefinition,
  type WorkflowEditorInspectorFieldKind,
  type WorkflowEditorKeyValueRow,
  type WorkflowEditorNode,
} from "../core";
import type { InspectorFieldDefinition, InspectorFieldValue } from "./inspector-panel";

/** Props a host renderer receives for one inspector field. */
export type WorkflowWorkbenchInspectorFieldRendererProps = {
  field: WorkflowEditorInspectorFieldDefinition;
  /** The field's current draft value (empty for a mixed multi-node value until edited). */
  value: unknown;
  onChange: (value: unknown) => void;
  readOnly: boolean;
  /** The edited node; absent when editing several nodes at once. */
  node?: WorkflowEditorNode<Record<string, unknown>>;
};

export type WorkflowWorkbenchInspectorFieldRenderer = (
  props: WorkflowWorkbenchInspectorFieldRendererProps,
) => ReactNode;

/**
 * Host overrides for schema-driven inspector fields. `fields` is keyed by a field's `renderer`
 * key or its `path` and wins over `kinds`, which replaces a built-in renderer for a whole kind.
 */
export type WorkflowWorkbenchInspectorFieldRenderers = {
  kinds?: Partial<
    Record<WorkflowEditorInspectorFieldKind, WorkflowWorkbenchInspectorFieldRenderer>
  >;
  fields?: Record<string, WorkflowWorkbenchInspectorFieldRenderer>;
};

export const inspectorFieldIdPrefix = "data-field:";

/** Inspector-panel draft for a stored field value (drafts are strings, numbers, booleans or lists). */
function toDraft(
  field: WorkflowEditorInspectorFieldDefinition,
  value: unknown,
): InspectorFieldValue {
  if (value === workflowEditorMixedFieldValue) {
    // An unchanged draft is never written, so a mixed field keeps each node's own value.
    return field.kind === "boolean" ? false : field.kind === "multi-select" ? [] : "";
  }
  switch (field.kind) {
    case "number":
      return typeof value === "number" ? value : "";
    case "boolean":
      return value === true;
    case "multi-select":
      return Array.isArray(value) ? value.map(String) : [];
    case "secret-ref":
      return typeof (value as { secretRef?: unknown } | undefined)?.secretRef === "string"
        ? (value as { secretRef: string }).secretRef
        : "";
    case "json":
    case "key-value":
    case "custom":
      return value === undefined ? "" : JSON.stringify(value, null, 2);
    default:
      return typeof value === "string" ? value : value === undefined ? "" : String(value);
  }
}

/** Parses a draft back into a stored value; `error` when the draft cannot be stored. */
function fromDraft(
  field: WorkflowEditorInspectorFieldDefinition,
  draft: InspectorFieldValue,
): { value: unknown } | { error: string } {
  switch (field.kind) {
    case "number":
      return {
        value: draft === "" || draft === undefined || draft === null ? undefined : Number(draft),
      };
    case "boolean":
      return { value: draft === true };
    case "multi-select":
      return { value: Array.isArray(draft) ? draft : [] };
    case "secret-ref":
      return {
        value: typeof draft === "string" && draft.trim() ? { secretRef: draft.trim() } : undefined,
      };
    case "json":
    case "key-value":
    case "custom": {
      const text = typeof draft === "string" ? draft.trim() : "";
      if (!text) {
        return { value: undefined };
      }
      try {
        return { value: JSON.parse(text) as unknown };
      } catch {
        return { error: `${field.label} is not valid JSON.` };
      }
    }
    default:
      return { value: typeof draft === "string" ? (draft === "" ? undefined : draft) : draft };
  }
}

function KeyValueRowsEditor({
  label,
  rows,
  readOnly,
  onChange,
}: {
  label: string;
  rows: WorkflowEditorKeyValueRow[];
  readOnly: boolean;
  onChange: (rows: WorkflowEditorKeyValueRow[]) => void;
}) {
  return (
    <div className="grid gap-1.5" role="group" aria-label={label}>
      {rows.map((row, index) => (
        <div key={index} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-1">
          <Input
            aria-label={`${label} key ${index + 1}`}
            value={row.key}
            disabled={readOnly}
            onChange={(event) =>
              onChange(
                rows.map((item, i) =>
                  i === index ? { ...item, key: event.currentTarget.value } : item,
                ),
              )
            }
          />
          <Input
            aria-label={`${label} value ${index + 1}`}
            value={row.value}
            disabled={readOnly}
            onChange={(event) =>
              onChange(
                rows.map((item, i) =>
                  i === index ? { ...item, value: event.currentTarget.value } : item,
                ),
              )
            }
          />
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={readOnly}
            aria-label={`Remove ${label} row ${index + 1}`}
            onClick={() => onChange(rows.filter((_, i) => i !== index))}
          >
            ×
          </Button>
        </div>
      ))}
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={readOnly}
        onClick={() => onChange([...rows, { key: "", value: "" }])}
      >
        Add {label} row
      </Button>
    </div>
  );
}

function parseRows(draft: InspectorFieldValue): WorkflowEditorKeyValueRow[] {
  try {
    const value = typeof draft === "string" && draft.trim() ? (JSON.parse(draft) as unknown) : [];
    return Array.isArray(value)
      ? value.map((row) => ({
          key: String((row as WorkflowEditorKeyValueRow)?.key ?? ""),
          value: String((row as WorkflowEditorKeyValueRow)?.value ?? ""),
        }))
      : [];
  } catch {
    return [];
  }
}

function toPanelField(
  field: WorkflowEditorInspectorFieldDefinition,
  renderers: WorkflowWorkbenchInspectorFieldRenderers | undefined,
  readOnly: boolean,
  node: WorkflowEditorNode<Record<string, unknown>> | undefined,
  mixed: boolean,
): InspectorFieldDefinition {
  const id = `${inspectorFieldIdPrefix}${field.path}`;
  const description = [field.description, mixed ? "Mixed values across the selection." : undefined]
    .filter(Boolean)
    .join(" ");
  const base = {
    id,
    label: field.required ? `${field.label} *` : field.label,
    readOnly: readOnly || field.readOnly,
    ...(description ? { description } : {}),
    ...(mixed
      ? { placeholder: "Mixed" }
      : field.placeholder
        ? { placeholder: field.placeholder }
        : {}),
  };
  const hostRenderer =
    (field.renderer ? renderers?.fields?.[field.renderer] : undefined) ??
    renderers?.fields?.[field.path] ??
    renderers?.kinds?.[field.kind];
  if (hostRenderer) {
    return {
      ...base,
      type: "custom",
      render: (draft, onChange) => {
        const parsed = fromDraft(field, draft);
        return hostRenderer({
          field,
          value: "value" in parsed ? parsed.value : undefined,
          readOnly: !!base.readOnly,
          ...(node ? { node } : {}),
          onChange: (value) => onChange(toDraft(field, value)),
        });
      },
    };
  }
  switch (field.kind) {
    case "number":
      return { ...base, type: "number", min: field.min, max: field.max };
    case "boolean":
      return { ...base, type: "boolean" };
    case "select":
      return {
        ...base,
        type: "select",
        options: (field.options ?? []).map((option) => ({
          label: option.label,
          value: option.value,
        })),
      };
    case "json":
    case "custom":
      return { ...base, type: "code" };
    case "secret-ref":
      return {
        ...base,
        type: "text",
        placeholder: field.placeholder ?? "Secret reference, e.g. vault:api-token",
      };
    case "multi-select":
      return {
        ...base,
        type: "custom",
        render: (draft, onChange) => {
          const selected = new Set(Array.isArray(draft) ? draft : []);
          return (
            <div className="grid gap-1" role="group" aria-label={field.label}>
              {(field.options ?? []).map((option) => (
                <label key={option.value} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={selected.has(option.value)}
                    disabled={!!base.readOnly}
                    onCheckedChange={(checked) => {
                      const next = new Set(selected);
                      if (checked === true) next.add(option.value);
                      else next.delete(option.value);
                      onChange(
                        (field.options ?? [])
                          .map((item) => item.value)
                          .filter((value) => next.has(value)),
                      );
                    }}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          );
        },
      };
    case "key-value":
      return {
        ...base,
        type: "custom",
        render: (draft, onChange) => (
          <KeyValueRowsEditor
            label={field.label}
            rows={parseRows(draft)}
            readOnly={!!base.readOnly}
            onChange={(rows) => onChange(JSON.stringify(rows))}
          />
        ),
      };
    default:
      return { ...base, type: "text" };
  }
}

/** Inspector sections, default drafts and helpers for a set of schema-driven fields. */
export function createInspectorFieldSections({
  fields,
  values,
  renderers,
  readOnly,
  node,
}: {
  fields: readonly WorkflowEditorInspectorFieldDefinition[];
  /** Stored value per field path (may be `workflowEditorMixedFieldValue`). */
  values: (field: WorkflowEditorInspectorFieldDefinition) => unknown;
  renderers?: WorkflowWorkbenchInspectorFieldRenderers;
  readOnly: boolean;
  node?: WorkflowEditorNode<Record<string, unknown>>;
}) {
  const sectionOrder: string[] = [];
  const bySection = new Map<string, InspectorFieldDefinition[]>();
  const defaultValues: Record<string, InspectorFieldValue> = {};
  for (const field of fields) {
    const title = field.section ?? "Settings";
    if (!bySection.has(title)) {
      bySection.set(title, []);
      sectionOrder.push(title);
    }
    const value = values(field);
    bySection
      .get(title)!
      .push(
        toPanelField(field, renderers, readOnly, node, value === workflowEditorMixedFieldValue),
      );
    defaultValues[`${inspectorFieldIdPrefix}${field.path}`] = toDraft(field, value);
  }
  return {
    defaultValues,
    sections: sectionOrder.map((title) => ({
      id: `fields-${title.toLowerCase().replace(/[^a-z0-9]+/gu, "-")}`,
      title,
      fields: bySection.get(title)!,
    })),
  };
}

/** Validation messages for the current drafts, keyed by inspector field id. */
export function validateInspectorFieldDrafts(
  fields: readonly WorkflowEditorInspectorFieldDefinition[],
  drafts: Record<string, InspectorFieldValue>,
  /** When given, drafts equal to these baseline values are not validated (untouched mixes). */
  unchangedBaseline?: Record<string, InspectorFieldValue>,
): Record<string, string> {
  const messages: Record<string, string> = {};
  for (const field of fields) {
    const id = `${inspectorFieldIdPrefix}${field.path}`;
    if (!(id in drafts)) continue;
    if (unchangedBaseline && JSON.stringify(drafts[id]) === JSON.stringify(unchangedBaseline[id])) {
      continue;
    }
    const parsed = fromDraft(field, drafts[id]);
    const problems =
      "error" in parsed ? [parsed.error] : validateWorkflowEditorFieldValue(field, parsed.value);
    if (problems.length > 0) {
      messages[id] = problems.join(" ");
    }
  }
  return messages;
}

/**
 * Writes changed drafts into node data. Mixed or unparsable drafts leave the stored value alone,
 * and only fields whose draft differs from `initial` are written (multi-node edits keep mixes).
 */
export function applyInspectorFieldDrafts<TData extends Record<string, unknown>>(
  data: TData | undefined,
  fields: readonly WorkflowEditorInspectorFieldDefinition[],
  drafts: Record<string, InspectorFieldValue>,
  initial: Record<string, InspectorFieldValue>,
): TData | undefined {
  let next = data;
  for (const field of fields) {
    const id = `${inspectorFieldIdPrefix}${field.path}`;
    if (!(id in drafts) || JSON.stringify(drafts[id]) === JSON.stringify(initial[id])) continue;
    const parsed = fromDraft(field, drafts[id]);
    if (!("value" in parsed)) continue;
    next = writeWorkflowEditorFieldPath(next, field.path, parsed.value);
  }
  return next;
}

/** Visible fields for one node's data. */
export function visibleInspectorFields(
  fields: readonly WorkflowEditorInspectorFieldDefinition[],
  data: unknown,
) {
  return fields.filter((field) => isWorkflowEditorInspectorFieldVisible(field, data));
}

export { readWorkflowEditorFieldValue };
