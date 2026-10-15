import type { WorkflowEditorPortType } from "./core-types";
import { workflowEditorPortTypeSource } from "./core-type-source";

const fallbackColors = [
  "#0284c7",
  "#16a34a",
  "#ca8a04",
  "#db2777",
  "#7c3aed",
  "#ea580c",
  "#4f46e5",
  "#0d9488",
] as const;

/** Resolves a visual color by displayed type text, not by TypeScript assignability. */
export function resolveWorkflowEditorPortTypeColor(
  type: WorkflowEditorPortType,
  portTypeColors?: Readonly<Record<string, string>>,
): string {
  const name = workflowEditorPortTypeSource(type).trim();
  const configured = portTypeColors?.[name];
  if (typeof configured === "string" && /^#[0-9a-f]{6}$/i.test(configured)) {
    return configured;
  }

  switch (name) {
    case "string":
      return "#0891b2";
    case "number":
      return "#16a34a";
    case "boolean":
      return "#ca8a04";
    case "object":
      return "#4f46e5";
    case "any":
    case "unknown":
      return "#71717a";
    case "never":
    case "null":
    case "undefined":
      return "#a1a1aa";
  }

  if (/^Array<.+>$/.test(name)) {
    return "#9333ea";
  }
  const hash = Array.from(name).reduce((value, character) => value + character.charCodeAt(0), 0);
  return fallbackColors[hash % fallbackColors.length]!;
}
