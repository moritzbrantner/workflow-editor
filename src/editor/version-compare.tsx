import { useMemo, useState } from "react";

import { Button } from "@moritzbrantner/ui";

import {
  diffWorkflowEditorDocuments,
  type WorkflowEditorDiffEntry,
  type WorkflowEditorDocument,
  type WorkflowEditorDocumentDiff,
  type WorkflowEditorSelectionState,
} from "../core";
import type { WorkflowEditorLibraryEntry } from "../persistence";

/** `"draft"` is the current working document; any other value is a saved version id. */
export type WorkflowEditorComparisonSide = "draft" | (string & {});

export type WorkflowEditorComparisonState = {
  left: WorkflowEditorComparisonSide;
  right: WorkflowEditorComparisonSide;
  positions: "include" | "summarize" | "ignore";
  diff: WorkflowEditorDocumentDiff;
};

export type WorkflowEditorPendingRestore = { versionId: string; label: string };

export type WorkflowEditorComparisonActions = {
  /** Opens the comparison of a saved version (default: the selected or newest) with the draft. */
  openComparison: (versionId?: string) => void;
  closeComparison: () => void;
  setComparisonSide: (side: "left" | "right", value: WorkflowEditorComparisonSide) => void;
  setComparisonPositions: (positions: WorkflowEditorComparisonState["positions"]) => void;
  /** Selects the entry's node or edge on the canvas when it exists in the draft. */
  focusDiffEntry: (entry: WorkflowEditorDiffEntry) => void;
  /** Selects every changed node and edge that exists in the draft. */
  highlightDiff: () => void;
  /** Asks for confirmation before restoring a saved version. */
  requestRestoreVersion: (versionId?: string) => void;
  confirmRestoreVersion: () => void;
  cancelRestoreVersion: () => void;
};

export function useWorkflowEditorVersionComparison<TNodeData, TEdgeData>({
  activeEntry,
  activeDocument,
  selectedVersionId,
  readOnly,
  setSelection,
  commitDocument,
}: {
  activeEntry: WorkflowEditorLibraryEntry<TNodeData, TEdgeData> | null;
  activeDocument: WorkflowEditorDocument<TNodeData, TEdgeData>;
  selectedVersionId: string;
  readOnly: boolean;
  setSelection: (selection: WorkflowEditorSelectionState) => void;
  /** Commits a document as one undoable edit of the active entry. */
  commitDocument: (document: WorkflowEditorDocument<TNodeData, TEdgeData>) => void;
}) {
  const [sides, setSides] = useState<Omit<WorkflowEditorComparisonState, "diff"> | null>(null);
  const [pendingRestore, setPendingRestore] = useState<WorkflowEditorPendingRestore | null>(null);
  const versions = activeEntry?.versions ?? [];
  const documentFor = (side: WorkflowEditorComparisonSide) =>
    side === "draft" ? activeDocument : versions.find((version) => version.id === side)?.document;
  const versionLabel = (id: string) => {
    const version = versions.find((candidate) => candidate.id === id);
    return version ? `v${version.version} ${version.name}` : id;
  };

  const leftDocument = sides ? documentFor(sides.left) : undefined;
  const rightDocument = sides ? documentFor(sides.right) : undefined;
  const diff = useMemo(
    () =>
      sides && leftDocument && rightDocument
        ? diffWorkflowEditorDocuments(
            leftDocument as WorkflowEditorDocument<unknown, unknown>,
            rightDocument as WorkflowEditorDocument<unknown, unknown>,
            { positions: sides.positions },
          )
        : null,
    [leftDocument, rightDocument, sides],
  );
  const comparison: WorkflowEditorComparisonState | null =
    sides && diff ? { ...sides, diff } : null;

  const selectInDraft = (nodeIds: string[], edgeIds: string[]) => {
    const nodes = new Set(activeDocument.nodes.map((node) => node.id));
    const edges = new Set(activeDocument.edges.map((edge) => edge.id));
    const nodeSelection = nodeIds.filter((id) => nodes.has(id));
    const edgeSelection = edgeIds.filter((id) => edges.has(id));
    const primary = nodeSelection[0]
      ? { type: "node" as const, id: nodeSelection[0] }
      : edgeSelection[0]
        ? { type: "edge" as const, id: edgeSelection[0] }
        : undefined;
    setSelection({
      nodeIds: nodeSelection,
      edgeIds: edgeSelection,
      ...(primary ? { primary } : {}),
    });
  };

  const actions: WorkflowEditorComparisonActions = {
    openComparison: (versionId) => {
      const left = versionId ?? (selectedVersionId || versions[0]?.id);
      if (!left) return;
      setSides({ left, right: "draft", positions: "summarize" });
    },
    closeComparison: () => setSides(null),
    setComparisonSide: (side, value) =>
      setSides((current) => (current ? { ...current, [side]: value } : current)),
    setComparisonPositions: (positions) =>
      setSides((current) => (current ? { ...current, positions } : current)),
    focusDiffEntry: (entry) =>
      selectInDraft(
        entry.entity === "edge" ? [] : entry.nodeId ? [entry.nodeId] : [],
        entry.entity === "edge" ? [entry.id] : [],
      ),
    highlightDiff: () => {
      if (diff) selectInDraft(diff.changedNodeIds, diff.changedEdgeIds);
    },
    requestRestoreVersion: (versionId) => {
      const id = versionId ?? selectedVersionId;
      if (!id || readOnly || !versions.some((version) => version.id === id)) return;
      setPendingRestore({ versionId: id, label: versionLabel(id) });
    },
    confirmRestoreVersion: () => {
      const restored = pendingRestore ? documentFor(pendingRestore.versionId) : undefined;
      setPendingRestore(null);
      if (!restored || readOnly) return;
      setSelection({ nodeIds: [], edgeIds: [] });
      // One undoable edit: Undo returns to the draft that was replaced.
      commitDocument(restored);
    },
    cancelRestoreVersion: () => setPendingRestore(null),
  };

  return { comparison, pendingRestore, actions, versionLabel };
}

type ComparisonController = {
  readOnly: boolean;
  activeEntry: { versions: Array<{ id: string; version: number; name: string }> } | null;
  comparison: WorkflowEditorComparisonState | null;
  pendingRestore: WorkflowEditorPendingRestore | null;
  actions: WorkflowEditorComparisonActions;
};

const changeLabels = {
  added: "Added",
  removed: "Removed",
  changed: "Changed",
  moved: "Moved",
} as const;

function formatValue(value: unknown) {
  if (value === undefined) return "—";
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > 80 ? `${text.slice(0, 77)}…` : text;
}

/** Restore confirmation and the version comparison panel (summary, list and canvas highlight). */
export function WorkflowEditorVersionComparison({
  controller,
}: {
  controller: ComparisonController;
}) {
  const { comparison, pendingRestore, actions } = controller;
  const versions = controller.activeEntry?.versions ?? [];
  const sideOptions = [
    { value: "draft", label: "Current draft" },
    ...versions.map((version) => ({
      value: version.id,
      label: `v${version.version} ${version.name}`,
    })),
  ];

  return (
    <>
      {pendingRestore ? (
        <div
          role="alertdialog"
          aria-label="Restore version"
          className="flex basis-full flex-wrap items-center justify-between gap-2 rounded-md border border-amber-500/50 bg-amber-500/5 px-2 py-1.5 text-xs"
        >
          <span className="min-w-0 [overflow-wrap:anywhere]">
            Restore {pendingRestore.label} over the current draft? You can undo this.
          </span>
          <span className="flex gap-2">
            <Button
              type="button"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={actions.confirmRestoreVersion}
            >
              Confirm restore
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              onClick={actions.cancelRestoreVersion}
            >
              Cancel
            </Button>
          </span>
        </div>
      ) : null}
      {comparison ? (
        <section
          aria-label="Version comparison"
          className="flex basis-full flex-col gap-2 rounded-md border border-border bg-muted/30 px-2 py-1.5 text-xs"
        >
          <div className="flex flex-wrap items-center gap-2">
            <strong className="font-semibold">Compare</strong>
            <select
              aria-label="Compare from"
              className="h-7 rounded-md border border-input bg-background px-1 text-xs"
              value={comparison.left}
              onChange={(event) => actions.setComparisonSide("left", event.target.value)}
            >
              {sideOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <span aria-hidden="true">→</span>
            <select
              aria-label="Compare to"
              className="h-7 rounded-md border border-input bg-background px-1 text-xs"
              value={comparison.right}
              onChange={(event) => actions.setComparisonSide("right", event.target.value)}
            >
              {sideOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              aria-label="Layout changes"
              className="h-7 rounded-md border border-input bg-background px-1 text-xs"
              value={comparison.positions}
              onChange={(event) =>
                actions.setComparisonPositions(
                  event.target.value as WorkflowEditorComparisonState["positions"],
                )
              }
            >
              <option value="summarize">Summarize layout changes</option>
              <option value="include">List layout changes</option>
              <option value="ignore">Ignore layout changes</option>
            </select>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="ml-auto h-7 px-2 text-xs"
              onClick={actions.closeComparison}
            >
              Close comparison
            </Button>
          </div>
          <p data-testid="version-comparison-summary">
            {comparison.diff.summary.added} added · {comparison.diff.summary.removed} removed ·{" "}
            {comparison.diff.summary.changed} changed · {comparison.diff.summary.moved} moved
          </p>
          {comparison.diff.entries.length === 0 ? (
            <p className="text-muted-foreground">No differences.</p>
          ) : (
            <ul className="grid max-h-64 gap-1 overflow-auto" aria-label="Differences">
              {comparison.diff.entries.map((entry) => (
                <li key={`${entry.entity}:${entry.id}`} className="grid gap-0.5">
                  <button
                    type="button"
                    className="text-left underline-offset-2 hover:underline"
                    onClick={() => actions.focusDiffEntry(entry)}
                  >
                    {changeLabels[entry.change]} {entry.entity} {entry.label ?? entry.id}
                  </button>
                  {entry.fields.length > 0 ? (
                    <ul className="grid gap-0.5 pl-3 text-muted-foreground">
                      {entry.fields.map((field) => (
                        <li key={field.path} className="[overflow-wrap:anywhere]">
                          {field.path}: {formatValue(field.before)} → {formatValue(field.after)}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 px-2 text-xs"
              disabled={comparison.diff.entries.length === 0}
              onClick={actions.highlightDiff}
            >
              Highlight changes on canvas
            </Button>
            {comparison.left !== "draft" ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="h-7 px-2 text-xs"
                disabled={controller.readOnly}
                onClick={() => actions.requestRestoreVersion(comparison.left)}
              >
                Restore compared version
              </Button>
            ) : null}
          </div>
        </section>
      ) : null}
    </>
  );
}

/** Opens the comparison of the selected saved version with the draft. */
export function WorkflowEditorCompareVersionsButton({
  controller,
}: {
  controller: ComparisonController & { selectedVersionId: string };
}) {
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      disabled={!controller.activeEntry || controller.activeEntry.versions.length === 0}
      onClick={() => controller.actions.openComparison(controller.selectedVersionId || undefined)}
    >
      Compare
    </Button>
  );
}
