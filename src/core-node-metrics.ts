import { getGraphEditorNodeSize } from "@moritzbrantner/graph-editor/layout";

import { formatWorkflowEditorObjectConstructorExpression } from "./core";
import { createWorkflowEditorNodeLayoutOptions } from "./core-node-layout";
import type { WorkflowEditorNode } from "./core-types";

export function formatWorkflowEditorJsonPrimitiveNodeValue<TData>(
  node: WorkflowEditorNode<TData>,
): string | undefined {
  const value = isRecord(node.data) ? node.data.value : undefined;

  switch (node.kind) {
    case "json.string":
      return JSON.stringify(typeof value === "string" ? value : "");
    case "json.number":
      return String(typeof value === "number" && Number.isFinite(value) ? value : 0);
    case "json.boolean":
      return value === true ? "true" : "false";
    case "json.null":
      return "null";
    default:
      return undefined;
  }
}

export function toWorkflowEditorNodeMetrics<TData = Record<string, unknown>>(
  node: WorkflowEditorNode<TData>,
) {
  const jsonPrimitiveValue = formatWorkflowEditorJsonPrimitiveNodeValue(node);
  const minimized = node.minimized ?? (jsonPrimitiveValue === undefined ? undefined : true);

  return {
    // The canvas node face shows no description (#47), so layout reserves no room for one.
    inputs: node.inputs,
    kind: node.kind,
    label: node.label,
    minimized,
    outputs: node.outputs?.map((port) => ({
      ...port,
      badge:
        port.badge ?? (port.id === "value" && minimized === true ? jsonPrimitiveValue : undefined),
    })),
    packageLabel: node.packageLabel ?? jsonPrimitiveValue,
    variant: node.variant,
  };
}

/** Layout size from the same geometry model as the canvas (#48). */
export function getWorkflowEditorLayoutNodeSize<TData = Record<string, unknown>>(
  node: WorkflowEditorNode<TData>,
) {
  return getGraphEditorNodeSize(
    { ...toWorkflowEditorNodeMetrics(node), id: node.id } as Parameters<
      typeof getGraphEditorNodeSize
    >[0],
    createWorkflowEditorNodeLayoutOptions({
      objectConstructorExpression: () =>
        formatWorkflowEditorObjectConstructorExpression(node as WorkflowEditorNode),
    }),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
