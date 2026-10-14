import { workflowStandardTypeNames } from "./core-type-libraries";
import ts from "typescript";
import type { WorkflowEditorPortType, WorkflowEditorTypeDefinition } from "./core-types";

/** Converts persisted legacy records to syntax; TypeScript alone decides their meaning. */
export function workflowEditorPortTypeSource(type: WorkflowEditorPortType): string {
  switch (type.kind) {
    case "typescript":
      return type.source;
    case "ref":
      return workflowEditorLegacyTypeName(type.name);
    case "literal":
      return JSON.stringify(type.value);
    case "array":
      return `Array<${workflowEditorPortTypeSource(type.element)}>`;
    case "object":
      if (type.properties === undefined) {
        return "object";
      }
      return `{ ${Object.entries(type.properties ?? {})
        .map(
          ([name, property]) =>
            `${JSON.stringify(name)}${property.optional ? "?" : ""}: ${workflowEditorPortTypeSource(property.type)}`,
        )
        .join("; ")} }`;
    case "union":
    case "intersection":
      if (type.types.length === 0) {
        return type.kind === "union" ? "never" : "unknown";
      }
      return type.types
        .map((part) => `(${workflowEditorPortTypeSource(part)})`)
        .join(type.kind === "union" ? " | " : " & ");
    case "any":
    case "unknown":
    case "never":
    case "string":
    case "number":
    case "boolean":
    case "null":
    case "undefined":
      return type.kind;
    default:
      // Unknown legacy kinds must fail closed rather than being silently interpreted as any.
      return "__UnsupportedWorkflowPortType";
  }
}

export function workflowEditorTypeDefinitionsSource(
  definitions: readonly WorkflowEditorTypeDefinition[],
): string {
  return definitions
    .map(
      (definition) =>
        `type ${workflowEditorLegacyTypeName(definition.name)} = ${[...(definition.extends ?? []).map(workflowEditorLegacyTypeName), workflowEditorPortTypeSource(definition.type)].map((source) => `(${source})`).join(" & ")};`,
    )
    .join("\n");
}

export function workflowEditorLegacyTypeName(name: string): string {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    false,
    ts.LanguageVariant.Standard,
    name,
  );
  if (
    !name.startsWith("__Workflow") &&
    !workflowStandardTypeNames.has(name) &&
    scanner.scan() === ts.SyntaxKind.Identifier &&
    scanner.getTokenText() === name &&
    scanner.getTokenValue() === name &&
    scanner.scan() === ts.SyntaxKind.EndOfFileToken
  ) {
    return name;
  }
  return `__WorkflowCatalog_${[...name].map((character) => character.codePointAt(0)!.toString(16)).join("_")}`;
}
