"use client";

import { type ChangeEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import { Badge, Button, WorkbenchToolbar, cn } from "@moritzbrantner/ui";

import {
  canRedoWorkflowEditorHistory,
  canUndoWorkflowEditorHistory,
  commitWorkflowEditorHistory,
  createWorkflowEditorHistory,
  redoWorkflowEditorHistory,
  resetWorkflowEditorHistory,
  undoWorkflowEditorHistory,
  type WorkflowEditorHistoryState,
} from "./history";
import {
  activeWorkflowEditorEntry,
  buildWorkflowEditorDocumentFileFromEntry,
  createBlankWorkflowEditorDocument,
  createLocalStorageWorkflowEditorStorage,
  createWorkflowEditorEntry,
  createWorkflowEditorLibrary,
  createWorkflowEditorVersion,
  defaultWorkflowEditorMaxVersions,
  defaultWorkflowEditorStorageKey,
  downloadWorkflowEditorDocumentJson,
  duplicateWorkflowEditorEntry,
  readWorkflowEditorDocumentFile,
  removeWorkflowEditorEntry,
  renameWorkflowEditorEntry,
  restoreWorkflowEditorVersion,
  saveWorkflowEditorLibrary,
  upsertWorkflowEditorEntry,
  type WorkflowEditorLibrary,
  type WorkflowEditorLibraryEntry,
  type WorkflowEditorStorageAdapter,
} from "./persistence";
import {
  WorkflowWorkbench,
  type WorkflowWorkbenchPaletteItem,
  type WorkflowWorkbenchProps,
  type WorkflowWorkbenchSelection,
} from "./react";
import type { WorkflowEditorDocument } from "./core";

export type WorkflowEditorProps<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
> = {
  storageKey?: string;
  initialLibrary?: WorkflowEditorLibrary<TNodeData, TEdgeData>;
  storage?: WorkflowEditorStorageAdapter<TNodeData, TEdgeData>;
  nodeTemplates?: Array<WorkflowWorkbenchPaletteItem<TTemplateData>>;
  readOnly?: boolean;
  className?: string;
  maxVersions?: number;
  onLibraryChange?: (library: WorkflowEditorLibrary<TNodeData, TEdgeData>) => void;
  onError?: (error: Error) => void;
  onSelectionChange?: (selection: WorkflowWorkbenchSelection<TNodeData, TEdgeData>) => void;
  renderNodeTemplate?: WorkflowWorkbenchProps<
    TNodeData,
    TEdgeData,
    TTemplateData
  >["renderNodeTemplate"];
  renderInspector?: WorkflowWorkbenchProps<TNodeData, TEdgeData, TTemplateData>["renderInspector"];
  renderToolbarActions?: (
    context: Parameters<
      NonNullable<
        WorkflowWorkbenchProps<TNodeData, TEdgeData, TTemplateData>["renderToolbarActions"]
      >
    >[0],
  ) => ReactNode;
};

type SaveState = "loading" | "dirty" | "saving" | "saved" | "error";

export function WorkflowEditor<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
>({
  storageKey = defaultWorkflowEditorStorageKey,
  initialLibrary,
  storage,
  nodeTemplates = [],
  readOnly = false,
  className,
  maxVersions = defaultWorkflowEditorMaxVersions,
  onLibraryChange,
  onError,
  onSelectionChange,
  renderNodeTemplate,
  renderInspector,
  renderToolbarActions,
}: WorkflowEditorProps<TNodeData, TEdgeData, TTemplateData>) {
  const fallbackLibrary = useMemo(
    () => initialLibrary ?? createWorkflowEditorLibrary<TNodeData, TEdgeData>(),
    [initialLibrary],
  );
  const storageAdapter = useMemo(
    () => storage ?? createLocalStorageWorkflowEditorStorage<TNodeData, TEdgeData>(storageKey),
    [storage, storageKey],
  );
  const [library, setLibrary] =
    useState<WorkflowEditorLibrary<TNodeData, TEdgeData>>(fallbackLibrary);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("loading");
  const [selection, setSelection] =
    useState<WorkflowWorkbenchSelection<TNodeData, TEdgeData>>(null);
  const activeEntry = activeWorkflowEditorEntry(library);
  const [nameDraft, setNameDraft] = useState(activeEntry?.name ?? "Untitled Workflow");
  const [selectedVersionId, setSelectedVersionId] = useState(activeEntry?.versions[0]?.id ?? "");
  const [history, setHistory] = useState<WorkflowEditorHistoryState<TNodeData, TEdgeData>>(
    createWorkflowEditorHistory(activeEntry?.document ?? createBlankWorkflowEditorDocument()),
  );
  const importInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let canceled = false;
    setLoaded(false);
    setSaveState("loading");

    storageAdapter
      .loadLibrary()
      .then((storedLibrary) => {
        if (canceled) {
          return;
        }
        const nextLibrary = storedLibrary
          ? createWorkflowEditorLibrary(storedLibrary)
          : fallbackLibrary;
        setLibrary(nextLibrary);
        const nextEntry = activeWorkflowEditorEntry(nextLibrary);
        setHistory(
          createWorkflowEditorHistory(nextEntry?.document ?? createBlankWorkflowEditorDocument()),
        );
        setNameDraft(nextEntry?.name ?? "Untitled Workflow");
        setSelectedVersionId(nextEntry?.versions[0]?.id ?? "");
        setSaveState("saved");
      })
      .catch((error: unknown) => {
        if (canceled) {
          return;
        }
        const nextError =
          error instanceof Error ? error : new Error("Failed to load workflow library");
        onError?.(nextError);
        setLibrary(fallbackLibrary);
        setSaveState("error");
      })
      .finally(() => {
        if (!canceled) {
          setLoaded(true);
        }
      });

    return () => {
      canceled = true;
    };
  }, [fallbackLibrary, onError, storageAdapter]);

  useEffect(() => {
    if (!loaded || readOnly) {
      return;
    }

    let canceled = false;
    setSaveState("saving");
    saveWorkflowEditorLibrary(storageAdapter, library)
      .then(() => {
        if (!canceled) {
          setSaveState("saved");
        }
      })
      .catch((error: unknown) => {
        if (!canceled) {
          setSaveState("error");
          onError?.(error instanceof Error ? error : new Error("Failed to save workflow library"));
        }
      });
    onLibraryChange?.(library);

    return () => {
      canceled = true;
    };
  }, [library, loaded, onError, onLibraryChange, readOnly, storageAdapter]);

  useEffect(() => {
    setNameDraft(activeEntry?.name ?? "Untitled Workflow");
    setSelectedVersionId(activeEntry?.versions[0]?.id ?? "");
    setSelection(null);
    setHistory(
      resetWorkflowEditorHistory(activeEntry?.document ?? createBlankWorkflowEditorDocument()),
    );
  }, [activeEntry?.id]);

  const selectedNodeId = selection?.type === "node" ? selection.id : null;
  const selectedEdgeId = selection?.type === "edge" ? selection.id : null;
  const activeDocument =
    activeEntry?.document ?? createBlankWorkflowEditorDocument<TNodeData, TEdgeData>();

  const updateLibrary = (nextLibrary: WorkflowEditorLibrary<TNodeData, TEdgeData>) => {
    setSaveState("dirty");
    setLibrary(nextLibrary);
  };

  const updateActiveEntry = (
    updater: (
      entry: WorkflowEditorLibraryEntry<TNodeData, TEdgeData>,
    ) => WorkflowEditorLibraryEntry<TNodeData, TEdgeData>,
    options: { resetHistory?: boolean } = {},
  ) => {
    if (!activeEntry || readOnly) {
      return;
    }

    const nextEntry = updater(activeEntry);
    updateLibrary(upsertWorkflowEditorEntry(library, nextEntry, { activate: true }));
    if (options.resetHistory) {
      setHistory(resetWorkflowEditorHistory(nextEntry.document));
    }
  };

  const updateDocument = (document: WorkflowEditorDocument<TNodeData, TEdgeData>) => {
    if (!activeEntry || readOnly) {
      return;
    }

    const nextHistory = commitWorkflowEditorHistory(history, document);
    setHistory(nextHistory);
    updateActiveEntry((entry) => ({
      ...entry,
      updatedAt: new Date().toISOString(),
      document: nextHistory.present,
    }));
  };

  const selectDocument = (documentId: string) => {
    const entry = library.documents.find((candidate) => candidate.id === documentId);
    if (!entry) {
      return;
    }

    setSelection(null);
    setHistory(resetWorkflowEditorHistory(entry.document));
    updateLibrary({ ...library, activeDocumentId: entry.id });
  };

  const createDocument = () => {
    if (readOnly) {
      return;
    }

    const entry = createWorkflowEditorEntry<TNodeData, TEdgeData>({
      name: "Untitled Workflow",
    });
    setHistory(resetWorkflowEditorHistory(entry.document));
    updateLibrary(upsertWorkflowEditorEntry(library, entry, { activate: true }));
  };

  const renameDocument = () => {
    if (!activeEntry || readOnly) {
      return;
    }

    updateLibrary(renameWorkflowEditorEntry(library, activeEntry.id, nameDraft));
  };

  const duplicateDocument = () => {
    if (!activeEntry || readOnly) {
      return;
    }

    const nextLibrary = duplicateWorkflowEditorEntry(library, activeEntry.id);
    const nextEntry = activeWorkflowEditorEntry(nextLibrary);
    setHistory(
      resetWorkflowEditorHistory(nextEntry?.document ?? createBlankWorkflowEditorDocument()),
    );
    updateLibrary(nextLibrary);
  };

  const deleteDocument = () => {
    if (!activeEntry || readOnly) {
      return;
    }

    const nextLibrary = removeWorkflowEditorEntry(library, activeEntry.id);
    const nextEntry = activeWorkflowEditorEntry(nextLibrary);
    setHistory(
      resetWorkflowEditorHistory(nextEntry?.document ?? createBlankWorkflowEditorDocument()),
    );
    updateLibrary(nextLibrary);
  };

  const saveVersion = () => {
    updateActiveEntry((entry) => {
      const nextEntry = createWorkflowEditorVersion(entry, { maxVersions });
      setSelectedVersionId(nextEntry.versions[0]?.id ?? "");
      return nextEntry;
    });
  };

  const restoreVersion = () => {
    if (!selectedVersionId) {
      return;
    }

    setSelection(null);
    updateActiveEntry((entry) => restoreWorkflowEditorVersion(entry, selectedVersionId), {
      resetHistory: true,
    });
  };

  const undo = () => {
    if (!activeEntry || readOnly) {
      return;
    }

    const nextHistory = undoWorkflowEditorHistory(history);
    setHistory(nextHistory);
    updateActiveEntry((entry) => ({
      ...entry,
      updatedAt: new Date().toISOString(),
      document: nextHistory.present,
    }));
  };

  const redo = () => {
    if (!activeEntry || readOnly) {
      return;
    }

    const nextHistory = redoWorkflowEditorHistory(history);
    setHistory(nextHistory);
    updateActiveEntry((entry) => ({
      ...entry,
      updatedAt: new Date().toISOString(),
      document: nextHistory.present,
    }));
  };

  const exportDocument = () => {
    if (!activeEntry) {
      return;
    }

    const file = buildWorkflowEditorDocumentFileFromEntry(activeEntry);
    downloadWorkflowEditorDocumentJson(
      activeEntry.document,
      `${safeFilename(activeEntry.name)}.json`,
      {
        documentId: file.documentId,
        documentName: file.documentName,
        documentVersion: file.documentVersion,
        exportedAt: file.exportedAt,
      },
    );
  };

  const importDocument = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || readOnly) {
      return;
    }

    try {
      const restored = await readWorkflowEditorDocumentFile<TNodeData, TEdgeData>(file);
      const entry = createWorkflowEditorEntry<TNodeData, TEdgeData>({
        name: restored.documentName ?? (file.name.replace(/\.json$/iu, "") || "Imported Workflow"),
        version: restored.documentVersion,
        updatedAt: restored.exportedAt,
        document: restored.document,
      });
      setHistory(resetWorkflowEditorHistory(entry.document));
      updateLibrary(upsertWorkflowEditorEntry(library, entry, { activate: true }));
    } catch (error) {
      setSaveState("error");
      onError?.(error instanceof Error ? error : new Error("Failed to import workflow document"));
    }
  };

  return (
    <section className={cn("grid gap-3", className)} data-testid="workflow-editor">
      <WorkbenchToolbar className="flex flex-wrap items-center justify-between gap-3 border border-border bg-background px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Workflow document"
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={activeEntry?.id ?? ""}
            disabled={readOnly || library.documents.length === 0}
            onChange={(event) => selectDocument(event.target.value)}
          >
            {library.documents.map((entry) => (
              <option key={entry.id} value={entry.id}>
                {entry.name}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={readOnly}
            onClick={createDocument}
          >
            New
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={readOnly || !activeEntry}
            onClick={duplicateDocument}
          >
            Duplicate document
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={readOnly || !activeEntry || library.documents.length <= 1}
            onClick={deleteDocument}
          >
            Delete document
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={saveState === "error" ? "outline" : "secondary"} data-testid="save-state">
            {formatSaveState(saveState)}
          </Badge>
          <Badge variant="outline" data-testid="active-node-count">
            {activeDocument.nodes.length} nodes
          </Badge>
          <Badge variant="outline" data-testid="active-edge-count">
            {activeDocument.edges.length} edges
          </Badge>
        </div>
      </WorkbenchToolbar>

      <WorkbenchToolbar className="flex flex-wrap items-center justify-between gap-3 border border-border bg-background px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            aria-label="Document name"
            className="h-9 min-w-48 rounded-md border border-input bg-background px-2 text-sm"
            value={nameDraft}
            disabled={readOnly || !activeEntry}
            onChange={(event) => setNameDraft(event.target.value)}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={readOnly || !activeEntry}
            onClick={renameDocument}
          >
            Rename
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={readOnly || !canUndoWorkflowEditorHistory(history)}
            onClick={undo}
            aria-label="Undo"
          >
            Undo
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={readOnly || !canRedoWorkflowEditorHistory(history)}
            onClick={redo}
            aria-label="Redo"
          >
            Redo
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={readOnly || !activeEntry}
            onClick={saveVersion}
          >
            Save version
          </Button>
          <select
            aria-label="Saved versions"
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            value={selectedVersionId}
            disabled={readOnly || !activeEntry || activeEntry.versions.length === 0}
            onChange={(event) => setSelectedVersionId(event.target.value)}
          >
            <option value="">No saved versions</option>
            {activeEntry?.versions.map((version) => (
              <option key={version.id} value={version.id}>
                v{version.version} {version.name}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={readOnly || !selectedVersionId}
            onClick={restoreVersion}
          >
            Restore version
          </Button>
          <input
            ref={importInputRef}
            aria-label="Import workflow JSON"
            className="hidden"
            type="file"
            accept="application/json,.json"
            disabled={readOnly}
            onChange={importDocument}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={readOnly}
            onClick={() => importInputRef.current?.click()}
          >
            Import JSON
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!activeEntry}
            onClick={exportDocument}
          >
            Export JSON
          </Button>
        </div>
      </WorkbenchToolbar>

      <WorkflowWorkbench
        document={activeDocument}
        selectedNodeId={selectedNodeId}
        selectedEdgeId={selectedEdgeId}
        readOnly={readOnly}
        nodeTemplates={nodeTemplates}
        onDocumentChange={updateDocument}
        onSelectionChange={(nextSelection) => {
          setSelection(nextSelection);
          onSelectionChange?.(nextSelection);
        }}
        renderNodeTemplate={renderNodeTemplate}
        renderInspector={renderInspector}
        renderToolbarActions={renderToolbarActions}
      />
    </section>
  );
}

function formatSaveState(state: SaveState) {
  switch (state) {
    case "loading":
      return "Loading";
    case "dirty":
      return "Unsaved";
    case "saving":
      return "Saving";
    case "saved":
      return "Saved";
    case "error":
      return "Save error";
  }
}

function safeFilename(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "workflow-document"
  );
}
