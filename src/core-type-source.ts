import type { WorkflowEditorPortType, WorkflowEditorTypeDefinition } from "./core-types";

/** Converts persisted legacy records to syntax; TypeScript alone decides their meaning. */
export function workflowEditorPortTypeSource(type: WorkflowEditorPortType): string {
  switch (type.kind) {
    case "typescript":
      return type.source;
    case "ref":
      return type.name;
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
        `type ${definition.name} = ${[...(definition.extends ?? []), workflowEditorPortTypeSource(definition.type)].map((source) => `(${source})`).join(" & ")};`,
    )
    .join("\n");
}
