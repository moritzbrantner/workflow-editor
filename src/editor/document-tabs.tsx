import { useEffect, useRef, useState } from "react";

import { Button } from "@moritzbrantner/ui";

import { findWorkflowEditorIterationBodyNode } from "../core-iteration-body";
import type { WorkflowEditorLibrary, WorkflowEditorLibraryEntry } from "../persistence";

/** One item of the chain a tab was opened through; `nodeId` marks an iteration body (#94). */
type PathItem = { documentId: string; nodeId?: string };

/**
 * One open tab. `path` is the chain it was opened through (root first). A document tab's `id` is
 * its document id; an iteration body tab (#94) adds the chain of iteration node ids.
 */
export type WorkflowEditorDocumentTab = {
  id: string;
  documentId: string;
  title: string;
  path: PathItem[];
};

/** The iteration node ids a path ends with: the body it shows, or `[]` for a whole document. */
export function workflowEditorIterationBodyPath(path: readonly PathItem[]): string[] {
  const nodeIds: string[] = [];
  for (let index = path.length - 1; index >= 0 && path[index]!.nodeId; index -= 1) {
    nodeIds.unshift(path[index]!.nodeId!);
  }
  return nodeIds;
}

function tabIdForPath(path: readonly PathItem[]) {
  const documentId = path.at(-1)?.documentId ?? "";
  const body = workflowEditorIterationBodyPath(path);
  return body.length ? `${documentId}#${body.join("/")}` : documentId;
}

type TitleLibrary = {
  documents: ReadonlyArray<
    Pick<WorkflowEditorLibraryEntry<unknown, unknown>, "id" | "name" | "document">
  >;
};

/** "<workflow>" for a document, "<workflow> › <iteration> body" for an iteration body (#94). */
export function workflowEditorDocumentPathTitle(
  library: TitleLibrary,
  path: readonly PathItem[],
): string {
  const documentId = path.at(-1)?.documentId;
  const entry = library.documents.find((candidate) => candidate.id === documentId);
  const name = entry?.name ?? documentId ?? "";
  const body = workflowEditorIterationBodyPath(path);
  if (!entry || body.length === 0) return name;
  const labels = body.map(
    (_, index) =>
      findWorkflowEditorIterationBodyNode(entry.document, body.slice(0, index + 1))?.label ??
      body[index]!,
  );
  return `${[name, ...labels].join(" › ")} body`;
}

function resolves(library: TitleLibrary, path: readonly PathItem[]) {
  const entry = library.documents.find((candidate) => candidate.id === path.at(-1)?.documentId);
  const body = workflowEditorIterationBodyPath(path);
  return (
    !!entry && (body.length === 0 || !!findWorkflowEditorIterationBodyNode(entry.document, body))
  );
}

export type WorkflowEditorDocumentTabActions = {
  /** Switches to an open tab (by tab id), restoring the chain it was opened through. */
  switchTab: (tabId: string) => void;
  /** Closes a tab; the document stays in the library. The last tab cannot be closed. */
  closeTab: (tabId: string) => void;
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
  documentPath: PathItem[];
  /** Makes `path` the active chain (its last item becomes the active document or body). */
  activatePath: (path: PathItem[]) => void;
  updateLibrary: (library: WorkflowEditorLibrary<TNodeData, TEdgeData>) => void;
}) {
  type TabState = Omit<WorkflowEditorDocumentTab, "title">;
  const activeId = documentPath.length ? tabIdForPath(documentPath) : null;
  const [tabState, setTabs] = useState<TabState[]>(() => {
    const restored = (library.openDocumentIds ?? []).map((documentId) => ({
      id: documentId,
      documentId,
      path: [{ documentId }],
    }));
    return activeId && !restored.some((tab) => tab.id === activeId)
      ? [
          ...restored,
          { id: activeId, documentId: documentPath.at(-1)!.documentId, path: documentPath },
        ]
      : restored;
  });

  // The active document always has a tab that remembers the chain it was reached through.
  const pathKey = documentPath
    .map((item) => `${item.documentId}#${item.nodeId ?? ""}`)
    .join("\u001f");
  useEffect(() => {
    if (!activeId) return;
    const documentId = documentPath.at(-1)!.documentId;
    setTabs((current) =>
      current.some((tab) => tab.id === activeId)
        ? current.map((tab) => (tab.id === activeId ? { ...tab, path: documentPath } : tab))
        : [...current, { id: activeId, documentId, path: documentPath }],
    );
    // documentPath identity changes every render; pathKey captures its content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId, pathKey]);

  // Tabs restored with a library loaded after mount (for example from storage) are merged in.
  const storedKey = (library.openDocumentIds ?? []).join("\u001f");
  useEffect(() => {
    const stored = library.openDocumentIds ?? [];
    setTabs((current) => {
      const missing = stored.filter((id) => !current.some((tab) => tab.id === id));
      return missing.length
        ? [
            ...current,
            ...missing.map((documentId) => ({
              id: documentId,
              documentId,
              path: [{ documentId }],
            })),
          ]
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

  // Body tabs whose iteration node no longer exists are hidden; titles follow renames.
  const tabs: WorkflowEditorDocumentTab[] = tabState
    .filter((tab) => tab.id === activeId || resolves(library, tab.path))
    .map((tab) => ({ ...tab, title: workflowEditorDocumentPathTitle(library, tab.path) }));

  // Persist the open document tabs with the library so they survive a reload. Iteration body
  // tabs are views of their document and are not restored.
  const documentTabIds = tabState.filter((tab) => tab.id === tab.documentId).map((tab) => tab.id);
  const tabKey = documentTabIds.join("\u001f");
  const libraryRef = useRef(library);
  libraryRef.current = library;
  useEffect(() => {
    const current = libraryRef.current;
    if ((current.openDocumentIds ?? []).join("\u001f") === tabKey) return;
    updateLibrary({ ...current, openDocumentIds: documentTabIds });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabKey]);

  const actions: WorkflowEditorDocumentTabActions = {
    switchTab: (tabId) => {
      const tab = tabs.find((candidate) => candidate.id === tabId);
      if (tab && tabId !== activeId) activatePath(tab.path);
    },
    closeTab: (tabId) => {
      if (tabs.length <= 1) return;
      const index = tabs.findIndex((tab) => tab.id === tabId);
      if (index === -1) return;
      const remaining = tabs.filter((tab) => tab.id !== tabId);
      setTabs((current) => current.filter((tab) => tab.id !== tabId));
      if (tabId === activeId) {
        const neighbor = remaining[Math.max(0, index - 1)]!;
        activatePath(neighbor.path);
      }
    },
    openDocument: (documentId) => {
      const tab = tabs.find((candidate) => candidate.id === documentId);
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
  library: TitleLibrary;
  documentPath: PathItem[];
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
  const activeId = controller.documentPath.length
    ? tabIdForPath(controller.documentPath)
    : undefined;
  const activeDocumentId = controller.documentPath.at(-1)?.documentId;
  const parentPath = controller.documentPath.slice(0, -1);

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1" data-slot="workflow-document-tabs">
      <div
        role="group"
        aria-label="Open workflows"
        className="flex min-w-0 flex-wrap items-center gap-1"
      >
        {controller.tabs.map((tab) => {
          const active = tab.id === activeId;
          const name = tab.title;
          return (
            <div
              key={tab.id}
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
                onClick={() => controller.actions.switchTab(tab.id)}
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
                  onClick={() => controller.actions.closeTab(tab.id)}
                >
                  ×
                </button>
              ) : null}
            </div>
          );
        })}
      </div>
      {parentPath.length ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-label="Open parent workflow"
          onClick={controller.actions.openParentDocument}
        >
          ↑ {workflowEditorDocumentPathTitle(controller.library, parentPath) || "Parent"}
        </Button>
      ) : null}
      {showOpenSelect ? (
        <select
          aria-label="Workflow document"
          className="h-8 rounded-md border border-input bg-background px-2 text-sm"
          value={activeDocumentId ?? ""}
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
