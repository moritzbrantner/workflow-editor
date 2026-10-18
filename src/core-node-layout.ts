import type { GraphEditorNodeLayoutOptions } from "@moritzbrantner/graph-editor/layout";

import { validateWorkflowEditorObjectConstructorExpression } from "./core";
import {
  getWorkflowEditorMinimizedNodeWidth,
  isWorkflowEditorJsonPrimitiveKind,
} from "./core-rendered-node-size";

/** The node fields the geometry depends on; canvas (UI) nodes and document nodes both fit. */
export type WorkflowEditorNodeLayoutInput = {
  id?: string;
  kind?: string;
  label: string;
  minimized?: boolean;
  variant?: string;
};

/**
 * One geometry model for workflow nodes (#48). The canvas, snapping, layout and overlays all use
 * graph-editor's node metrics with these options instead of CSS size patches: inline minimized
 * nodes, no port column headers, the composed body height and a per-node width.
 */
export type WorkflowEditorNodeLayoutDrafts = {
  /** In-progress object constructor expressions by node id; they size the expression editor. */
  objectConstructorExpressions?: Readonly<Record<string, string>>;
  /** The current expression of an object constructor node, used when it has no draft. */
  objectConstructorExpression?: (node: WorkflowEditorNodeLayoutInput) => string | undefined;
};

/** Body height reserved for an expanded JSON value node's editor. */
export const workflowJsonPrimitiveBodyHeight = 48;
/** Body height for a dynamic-port node's add action. */
export const workflowDynamicPortBodyHeight = 40;

const objectConstructorMinWidth = 460;

function isDynamicPortKind(kind: string | undefined) {
  return kind === "json.object" || kind === "json.array" || kind === "json.object.decompose";
}

export function workflowObjectConstructorBodyHeight(draft: string | undefined) {
  const invalid =
    draft !== undefined && validateWorkflowEditorObjectConstructorExpression(draft).length > 0;
  return workflowDynamicPortBodyHeight + (invalid ? 92 : 72);
}

export function getWorkflowEditorNodeBodyHeight(
  node: { kind?: string; id?: string },
  drafts: WorkflowEditorNodeLayoutDrafts = {},
) {
  if (isWorkflowEditorJsonPrimitiveKind(node.kind)) return workflowJsonPrimitiveBodyHeight;
  if (node.kind === "json.object") {
    return workflowObjectConstructorBodyHeight(
      node.id ? drafts.objectConstructorExpressions?.[node.id] : undefined,
    );
  }
  return isDynamicPortKind(node.kind) ? workflowDynamicPortBodyHeight : 0;
}

export function getWorkflowEditorNodeWidth(
  node: WorkflowEditorNodeLayoutInput,
  drafts: WorkflowEditorNodeLayoutDrafts = {},
): number | undefined {
  if (node.variant === "compact") return undefined;
  if (node.minimized === true || isWorkflowEditorJsonPrimitiveKind(node.kind)) {
    return getWorkflowEditorMinimizedNodeWidth(node);
  }
  if (node.kind === "json.object") {
    const draft = node.id ? drafts.objectConstructorExpressions?.[node.id] : undefined;
    const expression = draft ?? drafts.objectConstructorExpression?.(node) ?? "";
    const message =
      draft === undefined
        ? undefined
        : validateWorkflowEditorObjectConstructorExpression(draft)[0]?.message;
    const longestLine = Math.max(
      ...expression.split("\n").map((line) => line.length),
      message?.length ?? 0,
      0,
    );
    return Math.max(objectConstructorMinWidth, 260 + Math.max(0, longestLine - 24) * 6);
  }
  return undefined;
}

export function createWorkflowEditorNodeLayoutOptions(
  drafts: WorkflowEditorNodeLayoutDrafts = {},
): GraphEditorNodeLayoutOptions {
  return {
    showPortColumnHeaders: false,
    minimizedLayout: "inline",
    nodeBodyHeight: (node) => getWorkflowEditorNodeBodyHeight(node, drafts),
    nodeWidth: (node) =>
      getWorkflowEditorNodeWidth(node as unknown as WorkflowEditorNodeLayoutInput, drafts),
  };
}
