import type { GraphEditorOperation } from "@moritzbrantner/graph-editor/operations";

import {
  composeWorkflowEditorNodes,
  isWorkflowEditorIterationNode,
  repairWorkflowEditorDocument,
  restoreWorkflowEditorComposedNode,
  validateWorkflowEditorConnection,
  type WorkflowEditorConnectionInput,
  type WorkflowEditorDocument,
  type WorkflowEditorNode,
  type WorkflowEditorPortType,
  type WorkflowEditorSelectionState,
  type WorkflowEditorViewport,
} from "../core";
import type { WorkflowEditorInspectorFieldDefinition } from "../core-inspector-fields";
import { getWorkflowEditorRenderedNodeSize } from "../react-snap";
import type { WorkflowWorkbenchPaletteItem } from "./palette-model";
import type { WorkflowBuilderConnectionValidity } from "./workflow-builder";
import { toUiWorkflowBuilderNodes } from "./workflow-builder-adapters";
import type { WorkflowEditorPoint } from "./workbench-types";

export const emptyWorkflowEditorSelection: WorkflowEditorSelectionState = {
  nodeIds: [],
  edgeIds: [],
};

export const workflowEditorMinZoom = 0.5;
export const workflowEditorMaxZoom = 1.75;
let workflowEditorMemoryClipboard: string | null = null;

/** In-page clipboard shared by every workbench, used when the system clipboard is unavailable. */
export function readWorkflowEditorMemoryClipboard() {
  return workflowEditorMemoryClipboard;
}

export function writeWorkflowEditorMemoryClipboard(text: string) {
  workflowEditorMemoryClipboard = text;
}

export const defaultWorkflowWorkbenchHotkeys = {
  copySelection: "Mod+C",
  deleteSelection: "Delete",
  duplicateNode: "Mod+D",
  fitView: "Mod+0",
  groupSelection: "Mod+G",
  pasteSelection: "Mod+V",
  selectAll: "Mod+A",
  ungroupSelection: "Shift+Mod+G",
  nudgeDown: "ArrowDown",
  nudgeLeft: "ArrowLeft",
  nudgeRight: "ArrowRight",
  nudgeUp: "ArrowUp",
};

export type WorkflowWorkbenchConnectionCoordinates = Pick<
  WorkflowEditorConnectionInput,
  "sourceNodeId" | "sourcePortId" | "targetNodeId" | "targetPortId"
>;

export function toWorkflowWorkbenchConnectionInput(
  connection: WorkflowWorkbenchConnectionCoordinates,
): WorkflowEditorConnectionInput {
  return {
    sourceNodeId: connection.sourceNodeId,
    sourcePortId: connection.sourcePortId,
    targetNodeId: connection.targetNodeId,
    targetPortId: connection.targetPortId,
  };
}

export function getWorkflowWorkbenchConnectionKey(
  connection: WorkflowWorkbenchConnectionCoordinates,
) {
  return `${connection.sourceNodeId}:${connection.sourcePortId}->${connection.targetNodeId}:${connection.targetPortId}`;
}

export function createWorkflowWorkbenchDocumentOperation<
  TNodeData extends Record<string, unknown>,
  TEdgeData extends Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  selectionAfter?: WorkflowEditorSelectionState | null,
  history = true,
): GraphEditorOperation<TNodeData, TEdgeData, WorkflowEditorPortType> {
  const normalizedDocument = repairWorkflowEditorDocument(document).document;

  return {
    id: "graph.replace-document",
    label: "Update workflow document",
    apply: () => normalizedDocument,
    selectionAfter: selectionAfter ?? undefined,
    metadata: {
      graphEditor: {
        history,
      },
    },
  };
}

export function areWorkflowWorkbenchDocumentsEqual(
  first: WorkflowEditorDocument,
  second: WorkflowEditorDocument,
) {
  return JSON.stringify(first) === JSON.stringify(second);
}

export function areWorkflowWorkbenchSelectionsEqual(
  first: WorkflowEditorSelectionState,
  second: WorkflowEditorSelectionState,
) {
  return JSON.stringify(first) === JSON.stringify(second);
}

export function clampWorkflowEditorZoom(zoom: number) {
  if (!Number.isFinite(zoom)) {
    return 1;
  }

  return Math.min(Math.max(zoom, workflowEditorMinZoom), workflowEditorMaxZoom);
}

export function normalizeWorkflowEditorViewport(viewport: WorkflowEditorViewport | undefined) {
  const x = viewport?.x;
  const y = viewport?.y;
  const zoom = viewport?.zoom;

  return {
    x: typeof x === "number" && Number.isFinite(x) ? x : 0,
    y: typeof y === "number" && Number.isFinite(y) ? y : 0,
    zoom: clampWorkflowEditorZoom(zoom ?? 1),
  };
}

export function toUiWorkflowNodeTemplate<TData>(template: WorkflowWorkbenchPaletteItem<TData>) {
  return toUiWorkflowBuilderNodes([
    {
      ...template,
      variant: template.variant ?? "compact",
      x: 0,
      y: 0,
    } as WorkflowEditorNode,
  ])[0]!;
}

export function toUiConnectionInvalidReason(
  reason: ReturnType<typeof validateWorkflowEditorConnection>["reason"],
): WorkflowBuilderConnectionValidity["reason"] {
  if (!reason) {
    return undefined;
  }

  if (reason === "missing-node") {
    return "missing-port";
  }

  if (reason === "cycle") {
    return "self-connection";
  }

  // graph-editor's canvas reasons are a closed set; kind-mismatch is the closest for delivery contracts.
  if (reason === "payload-mode-mismatch" || reason === "media-type-mismatch") {
    return "kind-mismatch";
  }

  if (reason === "target-cardinality" || reason === "source-cardinality") {
    return "input-occupied";
  }

  return reason;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createTemplateNodeId<TData extends Record<string, unknown>>(
  nodes: readonly WorkflowEditorNode<TData>[],
  templateId: string,
) {
  const existingIds = new Set(nodes.map((node) => node.id));
  let candidate = templateId;
  let index = 2;

  while (existingIds.has(candidate)) {
    candidate = `${templateId}-${index}`;
    index += 1;
  }

  return candidate;
}

/** Keeps runtime overlay status out of the document when the canvas echoes nodes/edges back. */
export function keepDesignPresentation<
  T extends { id: string; status?: string; tone?: string; eyebrow?: string },
>(
  items: T[],
  designById: ReadonlyMap<string, { status?: string; tone?: string; eyebrow?: string }>,
): T[] {
  return items.map((item) => {
    const design = designById.get(item.id);
    if (!design) {
      return item;
    }
    const next = { ...item, status: design.status };
    if ("tone" in item || "tone" in design) {
      (next as { tone?: string }).tone = design.tone;
    }
    if ("eyebrow" in item || "eyebrow" in design) {
      (next as { eyebrow?: string }).eyebrow = design.eyebrow;
    }
    return next;
  });
}

/** The inspector fields of the first template whose `kind` matches the node. */
export function inspectorFieldsForNode<TTemplateData>(
  templates: ReadonlyArray<WorkflowWorkbenchPaletteItem<TTemplateData>>,
  node: { kind?: string },
): readonly WorkflowEditorInspectorFieldDefinition[] {
  if (!node.kind) {
    return [];
  }
  return (
    templates.find((template) => template.kind === node.kind && template.inspectorFields)
      ?.inspectorFields ?? []
  );
}

/** Composes `nodeIds` and selects the new composed node; `undefined` when nothing changes. */
export function composeWorkflowWorkbenchSelection<TNodeData, TEdgeData>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  nodeIds: readonly string[],
) {
  const nextDocument = composeWorkflowEditorNodes(document, nodeIds);
  if (nextDocument === document) return undefined;
  const previousIds = new Set(document.nodes.map((node) => node.id));
  const composed = nextDocument.nodes.find((node) => !previousIds.has(node.id));
  const selection: WorkflowEditorSelectionState = composed
    ? { nodeIds: [composed.id], edgeIds: [], primary: { type: "node", id: composed.id } }
    : { nodeIds: [], edgeIds: [] };
  return { document: nextDocument, selection };
}

/** Restores a composed node and selects its restored nodes; `undefined` when nothing changes. */
export function restoreWorkflowWorkbenchComposition<TNodeData, TEdgeData>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  nodeId: string | undefined,
) {
  const node = nodeId ? document.nodes.find((candidate) => candidate.id === nodeId) : undefined;
  if (!node || !isWorkflowEditorComposedNode(node)) return undefined;
  const nextDocument = restoreWorkflowEditorComposedNode(document, node.id);
  if (nextDocument === document) return undefined;
  const nextIds = new Set(nextDocument.nodes.map((candidate) => candidate.id));
  const restoredIds = (node.composition?.nodes ?? [])
    .map((child) => child.id)
    .filter((id) => nextIds.has(id));
  const selection: WorkflowEditorSelectionState = {
    nodeIds: restoredIds,
    edgeIds: [],
    ...(restoredIds[0] ? { primary: { type: "node", id: restoredIds[0] } } : {}),
  };
  return { document: nextDocument, selection };
}

export function isWorkflowEditorComposedNode(node: WorkflowEditorNode<unknown>) {
  return !!node.composition && !isWorkflowEditorIterationNode(node);
}

export function hasWorkflowWorkbenchSelection(selection: WorkflowEditorSelectionState) {
  return (
    selection.nodeIds.length > 0 ||
    selection.edgeIds.length > 0 ||
    (selection.groupIds?.length ?? 0) > 0
  );
}

/** Selects what a duplicate or paste inserted; a new group is primary over a new node. */
export function createWorkflowWorkbenchInsertedSelection(result: {
  nodeIds: string[];
  edgeIds: string[];
  groupIds?: string[];
}): WorkflowEditorSelectionState {
  return {
    nodeIds: result.nodeIds,
    edgeIds: result.edgeIds,
    ...(result.groupIds?.length ? { groupIds: result.groupIds } : {}),
    ...(result.groupIds?.[0]
      ? { primary: { type: "group", id: result.groupIds[0] } }
      : result.nodeIds[0]
        ? { primary: { type: "node", id: result.nodeIds[0] } }
        : {}),
  };
}

/** Builds the node a palette template creates; only the canvas drop centers it on the pointer. */
export function createWorkflowWorkbenchTemplateNode<
  TNodeData extends Record<string, unknown>,
  TTemplateData,
>(
  nodes: readonly WorkflowEditorNode<TNodeData>[],
  template: WorkflowWorkbenchPaletteItem<TTemplateData>,
  position?: WorkflowEditorPoint,
  options: { centerOnPosition?: boolean } = {},
) {
  const id = createTemplateNodeId(nodes, template.id);
  const node: WorkflowEditorNode<TNodeData> = {
    id,
    label: template.label,
    description: template.description,
    kind: template.kind,
    category: template.category,
    categoryPath: template.categoryPath ? [...template.categoryPath] : undefined,
    eyebrow: template.eyebrow,
    packageLabel: template.packageLabel,
    status: template.status,
    tone: template.tone,
    variant: template.variant,
    minimized: template.minimized,
    tags: template.tags,
    x: position?.x ?? 120 + nodes.length * 36,
    y: position?.y ?? 120 + nodes.length * 28,
    inputs: template.inputs,
    outputs: template.outputs,
    data: template.data as TNodeData | undefined,
    workflowRef: template.workflowRef,
    ...(template.shared
      ? {
          templateRef: {
            templateId: template.shared.templateId,
            revision: template.shared.revision,
          },
        }
      : {}),
    composition: template.composition as WorkflowEditorNode<TNodeData>["composition"],
  };

  if (position && options.centerOnPosition) {
    const size = getWorkflowEditorRenderedNodeSize(node);
    node.x = Math.round(position.x - size.width / 2);
    node.y = Math.round(position.y - size.height / 2);
  }

  if (!Number.isFinite(node.x)) {
    node.x = 120 + nodes.length * 36;
  }
  if (!Number.isFinite(node.y)) {
    node.y = 120 + nodes.length * 28;
  }

  return { id, node };
}
