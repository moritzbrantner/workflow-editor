import { createWorkflowEditorTypeResolver } from "./core-type-resolver";
import type {
  WorkflowEditorDocument,
  WorkflowEditorPortDefaultValue,
  WorkflowEditorPortType,
  WorkflowEditorTypeDefinition,
} from "./core-types";

/**
 * Typed workflow inputs (Decision Atlas 5.12, #115). A Workflow Document's inputs are the output
 * ports of its `control.start` nodes, the same interface a Workflow Reference uses (#95): the port
 * id is the input name, its type the TypeScript type, `optional` / `defaultValue` the required
 * and default state. Named input profiles hold reusable values outside the document.
 */
export type WorkflowEditorInputDeclaration = {
  id: string;
  label: string;
  type: WorkflowEditorPortType;
  required: boolean;
  defaultValue?: WorkflowEditorPortDefaultValue;
  /** Where the input is declared, for source-linked diagnostics. */
  nodeId: string;
};

/** A named, reusable set of input values kept on the library entry, never in the document. */
export type WorkflowEditorInputProfile = {
  id: string;
  name: string;
  values: Record<string, unknown>;
};

export type WorkflowEditorInputDiagnostic = {
  code: "missing-input" | "invalid-input-type" | "unknown-input" | "duplicate-input";
  inputId: string;
  message: string;
  path: string;
};

export function getWorkflowEditorInputDeclarations(
  document: WorkflowEditorDocument<unknown, unknown>,
): WorkflowEditorInputDeclaration[] {
  return document.nodes
    .filter((node) => node.kind === "control.start")
    .flatMap((node) =>
      (node.outputs ?? []).map((port) => ({
        id: port.id,
        label: port.label ?? port.id,
        type: port.type,
        required: port.optional !== true && port.defaultValue === undefined,
        ...(port.defaultValue === undefined ? {} : { defaultValue: port.defaultValue }),
        nodeId: node.id,
      })),
    );
}

/**
 * Validates input values against the document's declarations with the editor's TypeScript checker.
 * Missing optional inputs use their defaults; unknown values are reported, not dropped.
 */
export function validateWorkflowEditorInputValues(
  document: WorkflowEditorDocument<unknown, unknown>,
  values: Readonly<Record<string, unknown>>,
  options: { typeDefinitions?: readonly WorkflowEditorTypeDefinition[] } = {},
): WorkflowEditorInputDiagnostic[] {
  const declarations = getWorkflowEditorInputDeclarations(document);
  const resolver = createWorkflowEditorTypeResolver(options.typeDefinitions, document.typeDeclarations);
  const diagnostics: WorkflowEditorInputDiagnostic[] = [];
  const seen = new Set<string>();
  for (const declaration of declarations) {
    if (seen.has(declaration.id)) {
      diagnostics.push({
        code: "duplicate-input",
        inputId: declaration.id,
        message: `Input "${declaration.id}" is declared by more than one Start node.`,
        path: `nodes.${declaration.nodeId}.outputs.${declaration.id}`,
      });
      continue;
    }
    seen.add(declaration.id);
    const value = values[declaration.id];
    if (value === undefined) {
      if (declaration.required) {
        diagnostics.push({
          code: "missing-input",
          inputId: declaration.id,
          message: `Input "${declaration.label}" is required.`,
          path: `values.${declaration.id}`,
        });
      }
      continue;
    }
    let literal: string | undefined;
    try {
      literal = JSON.stringify(value);
    } catch {
      literal = undefined;
    }
    if (
      literal === undefined ||
      !resolver.isAssignable({ kind: "typescript", source: literal }, declaration.type)
    ) {
      diagnostics.push({
        code: "invalid-input-type",
        inputId: declaration.id,
        message: `Input "${declaration.label}" does not match its type.`,
        path: `values.${declaration.id}`,
      });
    }
  }
  for (const key of Object.keys(values)) {
    if (!seen.has(key)) {
      diagnostics.push({
        code: "unknown-input",
        inputId: key,
        message: `"${key}" is not an input of this workflow.`,
        path: `values.${key}`,
      });
    }
  }
  return diagnostics;
}

/** The values a run receives: profile or form values, with declared defaults filled in. */
export function resolveWorkflowEditorInputValues(
  document: WorkflowEditorDocument<unknown, unknown>,
  values: Readonly<Record<string, unknown>>,
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const declaration of getWorkflowEditorInputDeclarations(document)) {
    const value = values[declaration.id] ?? declaration.defaultValue;
    if (value !== undefined) resolved[declaration.id] = value;
  }
  return resolved;
}
