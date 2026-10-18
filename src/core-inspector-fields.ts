/**
 * Serializable inspector field definitions for node data (W-11 / Decision Atlas 5.6). A node
 * template may declare `inspectorFields`; the inspector renders them and writes edited values into
 * the node's `data` at each field's path. Everything here is headless and never mutates input.
 */

export type WorkflowEditorInspectorFieldKind =
  | "text"
  | "number"
  | "boolean"
  | "select"
  | "multi-select"
  | "json"
  | "secret-ref"
  | "expression"
  | "key-value"
  | "custom";

export const workflowEditorInspectorFieldKinds: readonly WorkflowEditorInspectorFieldKind[] = [
  "text",
  "number",
  "boolean",
  "select",
  "multi-select",
  "json",
  "secret-ref",
  "expression",
  "key-value",
  "custom",
];

export type WorkflowEditorInspectorFieldOption = { label: string; value: string };

export type WorkflowEditorInspectorFieldDefinition = {
  /** Dot-separated path into node `data`, for example `request.method`. Also the field identity. */
  path: string;
  label: string;
  kind: WorkflowEditorInspectorFieldKind;
  description?: string;
  /** Used when the node has no value at `path`. */
  defaultValue?: unknown;
  required?: boolean;
  readOnly?: boolean;
  /** Shown only while the value at another path equals one of `equals`. */
  visibleWhen?: { path: string; equals: readonly unknown[] };
  /** `select` / `multi-select` choices. */
  options?: readonly WorkflowEditorInspectorFieldOption[];
  /** Validation hints; the editor reports violations but never coerces values silently. */
  min?: number;
  max?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  placeholder?: string;
  /** Key of a host renderer for `custom` fields (see the workbench `inspectorFieldRenderers`). */
  renderer?: string;
  /** Section title; fields without one appear under "Settings". */
  section?: string;
};

/** Value of a `secret-ref` field: an identifier the host resolves; never the secret itself. */
export type WorkflowEditorSecretReference = { secretRef: string };

export type WorkflowEditorKeyValueRow = { key: string; value: string };

export type WorkflowEditorInspectorFieldDiagnostic = {
  code: "invalid-field" | "duplicate-field-path" | "invalid-field-kind" | "invalid-field-options";
  message: string;
  /** Path relative to the definitions array, for example `[2].path`. */
  path: string;
};

const segmentPattern = /^[A-Za-z_$][\w$-]*$/u;
const unsafeSegments = new Set(["__proto__", "prototype", "constructor"]);

/** Whether `path` is a dot path of identifier-like segments (no prototype segments). */
export function isWorkflowEditorInspectorFieldPath(path: unknown): path is string {
  return (
    typeof path === "string" &&
    path.split(".").every((segment) => segmentPattern.test(segment) && !unsafeSegments.has(segment))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Reads the value at a dot path; `undefined` when any segment is missing. */
export function readWorkflowEditorFieldPath(data: unknown, path: string): unknown {
  let current: unknown = data;
  for (const segment of path.split(".")) {
    if (!isRecord(current) || !Object.hasOwn(current, segment)) {
      return undefined;
    }
    current = current[segment];
  }
  return current;
}

/**
 * Returns a copy of `data` with `value` at `path`, creating intermediate objects. `undefined`
 * removes the key. Siblings and unrelated host data are preserved.
 */
export function writeWorkflowEditorFieldPath<T extends Record<string, unknown>>(
  data: T | undefined,
  path: string,
  value: unknown,
): T {
  if (!isWorkflowEditorInspectorFieldPath(path)) {
    throw new Error(`Invalid inspector field path: ${path}`);
  }
  const [head, ...rest] = path.split(".") as [string, ...string[]];
  const source: Record<string, unknown> = isRecord(data) ? data : {};
  const next: Record<string, unknown> = { ...source };
  if (rest.length === 0) {
    if (value === undefined) {
      delete next[head];
    } else {
      next[head] = value;
    }
    return next as T;
  }
  const child = isRecord(source[head]) ? (source[head] as Record<string, unknown>) : undefined;
  next[head] = writeWorkflowEditorFieldPath(child, rest.join("."), value);
  return next as T;
}

/** The field's value in `data`, falling back to its `defaultValue`. */
export function readWorkflowEditorFieldValue(
  field: WorkflowEditorInspectorFieldDefinition,
  data: unknown,
): unknown {
  const value = readWorkflowEditorFieldPath(data, field.path);
  return value === undefined ? field.defaultValue : value;
}

export function isWorkflowEditorInspectorFieldVisible(
  field: WorkflowEditorInspectorFieldDefinition,
  data: unknown,
): boolean {
  if (!field.visibleWhen) {
    return true;
  }
  const actual = readWorkflowEditorFieldPath(data, field.visibleWhen.path);
  return field.visibleWhen.equals.some((expected) => Object.is(expected, actual));
}

export function isWorkflowEditorSecretReference(
  value: unknown,
): value is WorkflowEditorSecretReference {
  return isRecord(value) && typeof value.secretRef === "string" && Object.keys(value).length === 1;
}

/** Validation messages for one value; an empty array means valid. */
export function validateWorkflowEditorFieldValue(
  field: WorkflowEditorInspectorFieldDefinition,
  value: unknown,
): string[] {
  const empty =
    value === undefined ||
    value === null ||
    value === "" ||
    (Array.isArray(value) && value.length === 0) ||
    (isWorkflowEditorSecretReference(value) && !value.secretRef.trim());
  if (empty) {
    return field.required ? [`${field.label} is required.`] : [];
  }
  const messages: string[] = [];
  switch (field.kind) {
    case "number":
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return [`${field.label} must be a number.`];
      }
      if (field.min !== undefined && value < field.min) {
        messages.push(`${field.label} must be at least ${field.min}.`);
      }
      if (field.max !== undefined && value > field.max) {
        messages.push(`${field.label} must be at most ${field.max}.`);
      }
      return messages;
    case "boolean":
      return typeof value === "boolean" ? [] : [`${field.label} must be true or false.`];
    case "select":
      return field.options?.some((option) => option.value === value)
        ? []
        : [`${field.label} must be one of the listed options.`];
    case "multi-select":
      return Array.isArray(value) &&
        value.every((item) => field.options?.some((option) => option.value === item))
        ? []
        : [`${field.label} contains an unknown option.`];
    case "secret-ref":
      return isWorkflowEditorSecretReference(value)
        ? []
        : [`${field.label} must be a secret reference, not a secret value.`];
    case "key-value":
      if (
        !Array.isArray(value) ||
        !value.every(
          (row) => isRecord(row) && typeof row.key === "string" && typeof row.value === "string",
        )
      ) {
        return [`${field.label} must be a list of key-value rows.`];
      }
      if (value.some((row) => !(row as WorkflowEditorKeyValueRow).key.trim())) {
        messages.push(`${field.label} has a row without a key.`);
      }
      if (
        new Set(value.map((row) => (row as WorkflowEditorKeyValueRow).key)).size !== value.length
      ) {
        messages.push(`${field.label} has duplicate keys.`);
      }
      return messages;
    case "text":
    case "expression": {
      if (typeof value !== "string") {
        return [`${field.label} must be text.`];
      }
      if (field.minLength !== undefined && value.length < field.minLength) {
        messages.push(`${field.label} must have at least ${field.minLength} characters.`);
      }
      if (field.maxLength !== undefined && value.length > field.maxLength) {
        messages.push(`${field.label} must have at most ${field.maxLength} characters.`);
      }
      if (field.pattern !== undefined && !new RegExp(field.pattern, "u").test(value)) {
        messages.push(`${field.label} does not match the expected format.`);
      }
      return messages;
    }
    default:
      return [];
  }
}

/** Structural problems in a template's field definitions, reported by the template registry. */
export function validateWorkflowEditorInspectorFieldDefinitions(
  fields: unknown,
): WorkflowEditorInspectorFieldDiagnostic[] {
  if (!Array.isArray(fields)) {
    return [{ code: "invalid-field", message: "inspectorFields must be an array.", path: "" }];
  }
  const diagnostics: WorkflowEditorInspectorFieldDiagnostic[] = [];
  const seen = new Set<string>();
  fields.forEach((field, index) => {
    const at = `[${index}]`;
    if (!isRecord(field)) {
      diagnostics.push({
        code: "invalid-field",
        message: "Field definition must be an object.",
        path: at,
      });
      return;
    }
    if (!isWorkflowEditorInspectorFieldPath(field.path)) {
      diagnostics.push({
        code: "invalid-field",
        message: `Field ${index + 1} needs a dot path of identifiers, got ${JSON.stringify(field.path)}.`,
        path: `${at}.path`,
      });
    } else if (seen.has(field.path)) {
      diagnostics.push({
        code: "duplicate-field-path",
        message: `Field path ${field.path} is declared twice.`,
        path: `${at}.path`,
      });
    } else {
      seen.add(field.path);
    }
    if (typeof field.label !== "string" || !field.label.trim()) {
      diagnostics.push({
        code: "invalid-field",
        message: `Field ${String(field.path)} needs a label.`,
        path: `${at}.label`,
      });
    }
    if (
      !workflowEditorInspectorFieldKinds.includes(field.kind as WorkflowEditorInspectorFieldKind)
    ) {
      diagnostics.push({
        code: "invalid-field-kind",
        message: `Field ${String(field.path)} has unknown kind ${JSON.stringify(field.kind)}.`,
        path: `${at}.kind`,
      });
    }
    if (field.kind === "select" || field.kind === "multi-select") {
      const options = field.options;
      if (
        !Array.isArray(options) ||
        options.length === 0 ||
        !options.every(
          (option) =>
            isRecord(option) &&
            typeof option.label === "string" &&
            typeof option.value === "string",
        )
      ) {
        diagnostics.push({
          code: "invalid-field-options",
          message: `Field ${String(field.path)} needs options with string labels and values.`,
          path: `${at}.options`,
        });
      }
    }
    if (field.kind === "custom" && (typeof field.renderer !== "string" || !field.renderer)) {
      diagnostics.push({
        code: "invalid-field",
        message: `Custom field ${String(field.path)} needs a renderer key.`,
        path: `${at}.renderer`,
      });
    }
    if (field.visibleWhen !== undefined) {
      const visibleWhen = field.visibleWhen;
      if (
        !isRecord(visibleWhen) ||
        !isWorkflowEditorInspectorFieldPath(visibleWhen.path) ||
        !Array.isArray(visibleWhen.equals)
      ) {
        diagnostics.push({
          code: "invalid-field",
          message: `Field ${String(field.path)} has an invalid visibleWhen condition.`,
          path: `${at}.visibleWhen`,
        });
      }
    }
    if (field.pattern !== undefined) {
      try {
        RegExp(String(field.pattern), "u");
      } catch {
        diagnostics.push({
          code: "invalid-field",
          message: `Field ${String(field.path)} has an invalid pattern.`,
          path: `${at}.pattern`,
        });
      }
    }
  });
  return diagnostics;
}

/** Marker for a shared field whose selected nodes hold different values. */
export const workflowEditorMixedFieldValue = Symbol("workflow-editor-mixed-field-value");

export type WorkflowEditorSharedInspectorField = {
  field: WorkflowEditorInspectorFieldDefinition;
  /** The common value, or `workflowEditorMixedFieldValue` when the nodes differ. */
  value: unknown;
};

/**
 * Fields shared by every selected node for multi-node editing: same path, kind and label in each
 * node's definitions. Values that differ are reported as `workflowEditorMixedFieldValue`.
 */
export function getWorkflowEditorSharedInspectorFields(
  entries: ReadonlyArray<{
    data: unknown;
    fields: readonly WorkflowEditorInspectorFieldDefinition[];
  }>,
): WorkflowEditorSharedInspectorField[] {
  const [first, ...rest] = entries;
  if (!first) {
    return [];
  }
  return first.fields.flatMap((field) => {
    const matches = rest.map((entry) =>
      entry.fields.find(
        (candidate) =>
          candidate.path === field.path &&
          candidate.kind === field.kind &&
          candidate.label === field.label,
      ),
    );
    if (matches.some((match) => !match)) {
      return [];
    }
    const values = entries.map((entry) => readWorkflowEditorFieldValue(field, entry.data));
    const serialized = new Set(values.map((value) => JSON.stringify(value) ?? "undefined"));
    return [{ field, value: serialized.size === 1 ? values[0] : workflowEditorMixedFieldValue }];
  });
}
