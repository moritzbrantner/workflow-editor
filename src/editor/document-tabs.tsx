import { useEffect, useRef, useState } from "react";

import { Button } from "@moritzbrantner/ui";

import type { WorkflowEditorLibrary, WorkflowEditorLibraryEntry } from "../persistence";

/** One open document tab. `path` is the reference chain it was opened through (root first). */
export type WorkflowEditorDocumentTab = {
  documentId: string;
  path: Array<{ documentId: string }>;
};

export type WorkflowEditorDocumentTabActions = {
  /** Switches to an open tab, restoring the reference chain it was opened through. */
  switchTab: (documentId: string) => void;
  /** Closes a tab; the document stays in the library. The last tab cannot be closed. */
  closeTab: (documentId: string) => void;
  /** Opens a library document in its own tab, or switches to it if already open. */
  openDocument: (documentId: string) => void;
  /** Switches to the tab of the document the active one was opened from. */
  openParentDocument: () => void;
};

/**
 * Multi-document tabs (Decision Atlas 5.14, #100). One tab per Library Entry; each tab keeps the
 * reference chain it was opened through, so "↑ Parent" returns to the opening document (owner
 * decision 2026-10-18). Drafts, history and selection live per document in the editor already.
 */
export function useWorkflowEditorDocumentTabs<TNodeData, TEdgeData>({
  library,
  documentPath,
  activatePath,
  updateLibrary,
}: {
  library: WorkflowEditorLibrary<TNodeData, TEdgeData>;
  documentPath: Array<{ documentId: string }>;
  /** Makes `path` the active chain (its last item becomes the active document). */
  activatePath: (path: Array<{ documentId: string }>) => void;
  updateLibrary: (library: WorkflowEditorLibrary<TNodeData, TEdgeData>) => void;
}) {
  const activeId = documentPath.at(-1)?.documentId ?? null;
  const [tabs, setTabs] = useState<WorkflowEditorDocumentTab[]>(() => {
    const restored = (library.openDocumentIds ?? []).map((documentId) => ({
      documentId,
      path: [{ documentId }],
    }));
    return activeId && !restored.some((tab) => tab.documentId === activeId)
      ? [...restored, { documentId: activeId, path: documentPath }]
      : restored;
  });

  // The active document always has a tab that remembers the chain it was reached through.
  const pathKey = documentPath.map((item) => item.documentId).join("\u001f");
  useEffect(() => {
    if (!activeId) return;
    setTabs((current) =>
      current.some((tab) => tab.documentId === activeId)
        ? current.map((tab) => (tab.documentId === activeId ? { ...tab, path: documentPath } : tab))
        : [...current, { documentId: activeId, path: documentPath }],
    );
    // documentPath identity changes every render; pathKey captures its content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, pathKey]);

  // Tabs restored with a library loaded after mount (for example from storage) are merged in.
  const storedKey = (library.openDocumentIds ?? []).join("\u001f");
  useEffect(() => {
    const stored = library.openDocumentIds ?? [];
    setTabs((current) => {
      const missing = stored.filter((id) => !current.some((tab) => tab.documentId === id));
      return missing.length
        ? [...current, ...missing.map((documentId) => ({ documentId, path: [{ documentId }] }))]
        : current;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storedKey]);

  // Deleted documents lose their tabs.
  const documentIds = library.documents.map((entry) => entry.id).join("\u001f");
  useEffect(() => {
    const ids = new Set(library.documents.map((entry) => entry.id));
    setTabs((current) => {
      const next = current.filter((tab) => ids.has(tab.documentId));
      return next.length === current.length ? current : next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentIds]);

  // Persist the open tabs with the library so they survive a reload.
  const tabKey = tabs.map((tab) => tab.documentId).join("\u001f");
  const libraryRef = useRef(library);
  libraryRef.current = library;
  useEffect(() => {
    const current = libraryRef.current;
    if ((current.openDocumentIds ?? []).join("\u001f") === tabKey) return;
    updateLibrary({ ...current, openDocumentIds: tabs.map((tab) => tab.documentId) });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabKey]);

  const actions: WorkflowEditorDocumentTabActions = {
    switchTab: (documentId) => {
      const tab = tabs.find((candidate) => candidate.documentId === documentId);
      if (tab && documentId !== activeId) activatePath(tab.path);
    },
    closeTab: (documentId) => {
      if (tabs.length <= 1) return;
      const index = tabs.findIndex((tab) => tab.documentId === documentId);
      if (index === -1) return;
      const remaining = tabs.filter((tab) => tab.documentId !== documentId);
      setTabs(remaining);
      if (documentId === activeId) {
        const neighbor = remaining[Math.max(0, index - 1)]!;
        activatePath(neighbor.path);
      }
    },
    openDocument: (documentId) => {
      const tab = tabs.find((candidate) => candidate.documentId === documentId);
      if (tab) {
        if (documentId !== activeId) activatePath(tab.path);
      } else if (library.documents.some((entry) => entry.id === documentId)) {
        activatePath([{ documentId }]);
      }
    },
    openParentDocument: () => {
      if (documentPath.length > 1) activatePath(documentPath.slice(0, -1));
    },
  };

  return { tabs, activeId, actions };
}

type TabsController = {
  readOnly: boolean;
  library: { documents: Array<Pick<WorkflowEditorLibraryEntry<unknown, unknown>, "id" | "name">> };
  documentPath: Array<{ documentId: string }>;
  saveState: string;
  tabs: WorkflowEditorDocumentTab[];
  actions: WorkflowEditorDocumentTabActions;
};

/**
 * The document tab row. It replaces the document select and breadcrumb row (owner decision
 * 2026-10-18): open documents are tabs, "↑ Parent" returns to the opening document, and the
 * "Workflow document" select opens any library document in a tab.
 */
export function WorkflowEditorDocumentTabs({
  controller,
  showOpenSelect = true,
}: {
  controller: TabsController;
  /** The compact menu has its own "Workflow document" select; hide this one there. */
  showOpenSelect?: boolean;
}) {
  const names = new Map(controller.library.documents.map((entry) => [entry.id, entry.name]));
  const activeId = controller.documentPath.at(-1)?.documentId;
  const parentId = controller.documentPath.at(-2)?.documentId;

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1" data-slot="workflow-document-tabs">
      <div
        role="group"
        aria-label="Open workflows"
        className="flex min-w-0 flex-wrap items-center gap-1"
      >
        {controller.tabs.map((tab) => {
          const active = tab.documentId === activeId;
          const name = names.get(tab.documentId) ?? tab.documentId;
          return (
            <div
              key={tab.documentId}
              className={
                active
                  ? "flex items-center rounded-md border border-border bg-secondary"
                  : "flex items-center rounded-md border border-transparent"
              }
            >
              <button
                type="button"
                aria-label={`Switch to ${name}`}
                aria-current={active ? "page" : undefined}
                className="max-w-48 truncate px-2 py-1 text-sm"
                onClick={() => controller.actions.switchTab(tab.documentId)}
              >
                {name}
                {active && controller.saveState === "dirty" ? (
                  <span aria-label="unsaved changes" className="ml-1 text-muted-foreground">
                    •
                  </span>
                ) : null}
              </button>
              {controller.tabs.length > 1 ? (
                <button
                  type="button"
                  aria-label={`Close ${name}`}
                  className="px-1 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => controller.actions.closeTab(tab.documentId)}
                >
                  ×
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
      {parentId ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-label="Open parent workflow"
          onClick={controller.actions.openParentDocument}
        >
          ↑ {names.get(parentId) ?? "Parent"}
        </Button>
      ) : null}
      {showOpenSelect ? (
        <select
          aria-label="Workflow document"
          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          value={activeId ?? ""}
          disabled={controller.library.documents.length === 0}
          onChange={(event) => controller.actions.openDocument(event.target.value)}
        >
          {controller.library.documents.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.name}
            </option>
          ))}
        </select>
      ) : null}
    </div>
  );
}
