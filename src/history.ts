import { normalizeWorkflowEditorDocument, type WorkflowEditorDocument } from "./core";

export const defaultWorkflowEditorHistoryLimit = 100;

export type WorkflowEditorHistoryState<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
> = {
  past: Array<WorkflowEditorDocument<TNodeData, TEdgeData>>;
  present: WorkflowEditorDocument<TNodeData, TEdgeData>;
  future: Array<WorkflowEditorDocument<TNodeData, TEdgeData>>;
};

export type WorkflowEditorHistoryOptions = {
  limit?: number;
};

export function createWorkflowEditorHistory<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
): WorkflowEditorHistoryState<TNodeData, TEdgeData> {
  return {
    past: [],
    present: normalizeWorkflowEditorDocument(document),
    future: [],
  };
}

export function commitWorkflowEditorHistory<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  history: WorkflowEditorHistoryState<TNodeData, TEdgeData>,
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  options: WorkflowEditorHistoryOptions = {},
): WorkflowEditorHistoryState<TNodeData, TEdgeData> {
  const nextDocument = normalizeWorkflowEditorDocument(document);
  if (documentsEqual(history.present, nextDocument)) {
    return history;
  }

  const limit = Math.max(1, Math.trunc(options.limit ?? defaultWorkflowEditorHistoryLimit));
  return {
    past: [...history.past, history.present].slice(-limit),
    present: nextDocument,
    future: [],
  };
}

export function undoWorkflowEditorHistory<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  history: WorkflowEditorHistoryState<TNodeData, TEdgeData>,
): WorkflowEditorHistoryState<TNodeData, TEdgeData> {
  const previous = history.past.at(-1);
  if (!previous) {
    return history;
  }

  return {
    past: history.past.slice(0, -1),
    present: previous,
    future: [history.present, ...history.future],
  };
}

export function redoWorkflowEditorHistory<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  history: WorkflowEditorHistoryState<TNodeData, TEdgeData>,
): WorkflowEditorHistoryState<TNodeData, TEdgeData> {
  const next = history.future[0];
  if (!next) {
    return history;
  }

  return {
    past: [...history.past, history.present],
    present: next,
    future: history.future.slice(1),
  };
}

export function resetWorkflowEditorHistory<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
): WorkflowEditorHistoryState<TNodeData, TEdgeData> {
  return createWorkflowEditorHistory(document);
}

export function canUndoWorkflowEditorHistory<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(history: WorkflowEditorHistoryState<TNodeData, TEdgeData>) {
  return history.past.length > 0;
}

export function canRedoWorkflowEditorHistory<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(history: WorkflowEditorHistoryState<TNodeData, TEdgeData>) {
  return history.future.length > 0;
}

function documentsEqual<TNodeData = Record<string, unknown>, TEdgeData = Record<string, unknown>>(
  left: WorkflowEditorDocument<TNodeData, TEdgeData>,
  right: WorkflowEditorDocument<TNodeData, TEdgeData>,
) {
  return (
    stableWorkflowEditorDocumentFingerprint(left) === stableWorkflowEditorDocumentFingerprint(right)
  );
}

function stableWorkflowEditorDocumentFingerprint(value: unknown): string {
  return JSON.stringify(sortWorkflowEditorDocumentValue(value));
}

function sortWorkflowEditorDocumentValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortWorkflowEditorDocumentValue);
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortWorkflowEditorDocumentValue(value[key])]),
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
