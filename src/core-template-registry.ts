import { validateWorkflowEditorDocument } from "./core";
import {
  isWorkflowEditorMultiSourceInput,
  workflowEditorPortElementType,
} from "./core-cardinality";
import { createWorkflowEditorTypeResolver } from "./core-type-resolver";
import type {
  WorkflowEditorNodeTemplate,
  WorkflowEditorPort,
  WorkflowEditorPortType,
  WorkflowEditorTypeValidationOptions,
} from "./core-types";

export type WorkflowEditorNodeTemplateDiagnosticCode =
  | "invalid-template"
  | "duplicate-template-id"
  | "duplicate-port-id"
  | "missing-type-reference"
  | "invalid-category-path"
  | "invalid-composition";

export type WorkflowEditorNodeTemplateDiagnostic = {
  code: WorkflowEditorNodeTemplateDiagnosticCode;
  message: string;
  /** Path into the template array, for example `$[3].inputs[0].type`. */
  path: string;
  templateId?: string;
};

export type WorkflowEditorNodeTemplateRegistryEntry<TData = Record<string, unknown>> = {
  template: WorkflowEditorNodeTemplate<TData>;
  index: number;
  categoryPath: readonly string[];
  diagnostics: readonly WorkflowEditorNodeTemplateDiagnostic[];
  /** Invalid templates stay listed (disabled) but cannot create nodes. */
  valid: boolean;
};

export type WorkflowEditorCompatibleTemplate<TData = Record<string, unknown>> = {
  template: WorkflowEditorNodeTemplate<TData>;
  portId: string;
};

export type WorkflowEditorNodeTemplateRegistry<TData = Record<string, unknown>> = {
  entries: readonly WorkflowEditorNodeTemplateRegistryEntry<TData>[];
  diagnostics: readonly WorkflowEditorNodeTemplateDiagnostic[];
  /** The first template with this id. */
  getTemplate(id: string): WorkflowEditorNodeTemplate<TData> | undefined;
  /** The registry entry of a template object from the input array. */
  getEntry(
    template: WorkflowEditorNodeTemplate<TData>,
  ): WorkflowEditorNodeTemplateRegistryEntry<TData> | undefined;
  /** Templates whose category path starts with `path`, in input order. */
  listByCategoryPath(path: readonly string[]): WorkflowEditorNodeTemplate<TData>[];
  /** Valid templates with an input that accepts `outputType` (TypeScript checker). */
  findTemplatesAcceptingOutput(
    outputType: WorkflowEditorPortType,
  ): WorkflowEditorCompatibleTemplate<TData>[];
  /** Valid templates with an output assignable to `inputType` (TypeScript checker). */
  findTemplatesProducingInput(
    inputType: WorkflowEditorPortType,
  ): WorkflowEditorCompatibleTemplate<TData>[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function templateCategoryPath(template: WorkflowEditorNodeTemplate<unknown>): {
  path: readonly string[];
  valid: boolean;
} {
  const { categoryPath, category } = template as { categoryPath?: unknown; category?: unknown };
  if (categoryPath !== undefined) {
    const valid =
      Array.isArray(categoryPath) &&
      categoryPath.every((segment) => typeof segment === "string" && segment.trim() !== "");
    return { path: valid ? (categoryPath as string[]) : [], valid };
  }
  if (category !== undefined) {
    const valid = typeof category === "string" && category.trim() !== "";
    return { path: valid ? [category as string] : [], valid };
  }
  return { path: [], valid: true };
}

/**
 * Validates and indexes a host's node template array. The array stays the only input; palette,
 * catalog and contextual node creation read this registry. Never mutates its input.
 */
export function createWorkflowEditorNodeTemplateRegistry<TData = Record<string, unknown>>(
  templates: readonly WorkflowEditorNodeTemplate<TData>[],
  options: WorkflowEditorTypeValidationOptions = {},
): WorkflowEditorNodeTemplateRegistry<TData> {
  const resolver = createWorkflowEditorTypeResolver(
    options.typeDefinitions,
    options.typeDeclarations,
  );
  const ports = (template: WorkflowEditorNodeTemplate<TData>) =>
    [
      ...(Array.isArray(template.inputs) ? template.inputs : []).map(
        (port, index) => ["inputs", index, port] as const,
      ),
      ...(Array.isArray(template.outputs) ? template.outputs : []).map(
        (port, index) => ["outputs", index, port] as const,
      ),
    ] satisfies ReadonlyArray<readonly [string, number, WorkflowEditorPort]>;
  resolver.prepareChecks(
    templates.flatMap((template) =>
      isRecord(template)
        ? ports(template).flatMap(([, , port]) =>
            isRecord(port) && isRecord(port.type) ? [{ source: port.type }] : [],
          )
        : [],
    ),
  );

  const seenIds = new Set<string>();
  const entries = templates.map((template, index) => {
    const diagnostics: WorkflowEditorNodeTemplateDiagnostic[] = [];
    const at = `$[${index}]`;
    const id = isRecord(template) && typeof template.id === "string" ? template.id : "";
    const add = (code: WorkflowEditorNodeTemplateDiagnosticCode, message: string, path: string) =>
      diagnostics.push({ code, message, path, ...(id ? { templateId: id } : {}) });

    if (!isRecord(template) || !id.trim()) {
      add("invalid-template", "Template id is required.", `${at}.id`);
    } else if (seenIds.has(id)) {
      add("duplicate-template-id", `Duplicate template id: ${id}.`, `${at}.id`);
    } else {
      seenIds.add(id);
    }
    if (isRecord(template) && (typeof template.label !== "string" || !template.label.trim())) {
      add("invalid-template", `Template ${id || index} needs a label.`, `${at}.label`);
    }
    const category = isRecord(template)
      ? templateCategoryPath(template)
      : { path: [], valid: true };
    if (!category.valid) {
      add(
        "invalid-category-path",
        `Template ${id} has an invalid category path; use non-empty strings.`,
        `${at}.categoryPath`,
      );
    }
    if (isRecord(template)) {
      for (const side of ["inputs", "outputs"] as const) {
        const seenPortIds = new Set<string>();
        (Array.isArray(template[side]) ? template[side] : []).forEach((port, portIndex) => {
          const path = `${at}.${side}[${portIndex}]`;
          if (!isRecord(port) || typeof port.id !== "string" || !port.id.trim()) {
            add("invalid-template", `Template ${id} has a port without an id.`, `${path}.id`);
            return;
          }
          if (seenPortIds.has(port.id)) {
            add(
              "duplicate-port-id",
              `Template ${id} declares ${side === "inputs" ? "input" : "output"} ${port.id} twice.`,
              `${path}.id`,
            );
          }
          seenPortIds.add(port.id);
          if (isRecord(port.type)) {
            for (const error of new Set(resolver.findResolutionErrors(port.type))) {
              add(
                "missing-type-reference",
                `Template ${id} port ${port.id}: ${error}`,
                `${path}.type`,
              );
            }
          } else {
            add("invalid-template", `Template ${id} port ${port.id} needs a type.`, `${path}.type`);
          }
        });
      }
      if (template.composition !== undefined) {
        const composition = template.composition as unknown;
        const errors = isRecord(composition)
          ? validateWorkflowEditorDocument({
              nodes: composition.nodes,
              edges: composition.edges,
            }).filter((diagnostic) => diagnostic.severity === "error")
          : [];
        if (!isRecord(composition) || errors.length > 0) {
          add(
            "invalid-composition",
            `Template ${id} has an invalid composition${errors[0] ? `: ${errors[0].message}` : "."}`,
            `${at}.composition`,
          );
        }
      }
    }
    return {
      template,
      index,
      categoryPath: category.path,
      diagnostics,
      valid: diagnostics.length === 0,
    } satisfies WorkflowEditorNodeTemplateRegistryEntry<TData>;
  });

  const entryByTemplate = new Map(entries.map((entry) => [entry.template, entry]));
  const firstById = new Map<string, WorkflowEditorNodeTemplate<TData>>();
  for (const entry of entries) {
    if (typeof entry.template?.id === "string" && !firstById.has(entry.template.id)) {
      firstById.set(entry.template.id, entry.template);
    }
  }
  const validEntries = () => entries.filter((entry) => entry.valid);

  return {
    entries,
    diagnostics: entries.flatMap((entry) => entry.diagnostics),
    getTemplate: (id) => firstById.get(id),
    getEntry: (template) => entryByTemplate.get(template),
    listByCategoryPath: (path) =>
      entries
        .filter((entry) => path.every((segment, index) => entry.categoryPath[index] === segment))
        .map((entry) => entry.template),
    findTemplatesAcceptingOutput: (outputType) =>
      validEntries().flatMap(({ template }) =>
        (template.inputs ?? []).flatMap((port) => {
          const target = isWorkflowEditorMultiSourceInput(port, template)
            ? workflowEditorPortElementType(port.type)
            : port.type;
          return resolver.isAssignable(outputType, target) ? [{ template, portId: port.id }] : [];
        }),
      ),
    findTemplatesProducingInput: (inputType) =>
      validEntries().flatMap(({ template }) =>
        (template.outputs ?? []).flatMap((port) =>
          resolver.isAssignable(port.type, inputType) ? [{ template, portId: port.id }] : [],
        ),
      ),
  };
}
