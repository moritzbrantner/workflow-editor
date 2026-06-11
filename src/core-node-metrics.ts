import { getGraphEditorNodeSize } from "@moritzbrantner/graph-editor/layout";

import type { WorkflowEditorNode } from "./core-types";
import {
  getWorkflowEditorMinimizedNodeWidth,
  workflowEditorMinimizedNodeHeight,
} from "./core-rendered-node-size";

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
    description: jsonPrimitiveValue === undefined ? node.description : undefined,
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

export function getWorkflowEditorLayoutNodeSize<TData = Record<string, unknown>>(
  node: WorkflowEditorNode<TData>,
) {
  const metrics = toWorkflowEditorNodeMetrics(node);

  if (node.minimized === true && node.variant !== "compact") {
    return {
      width: getWorkflowEditorMinimizedNodeWidth(metrics),
      height: workflowEditorMinimizedNodeHeight,
    };
  }

  return getGraphEditorNodeSize(metrics);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
