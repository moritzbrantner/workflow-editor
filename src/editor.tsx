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
  listWorkflowEditorDocumentReferenceOptions,
  readWorkflowEditorDocumentFile,
  removeWorkflowEditorEntry,
  renameWorkflowEditorEntry,
  resolveWorkflowEditorDocumentReference,
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
import {
  defaultWorkflowEditorNodeTemplates,
  normalizeWorkflowEditorSelection,
  updateWorkflowEditorNodeWorkflowReference,
  type WorkflowEditorDocument,
  type WorkflowEditorNode,
  type WorkflowEditorSelectionState,
  type WorkflowEditorTypeDefinition,
} from "./core";

export type WorkflowEditorDocumentPathItem = {
  documentId: string;
};

export type WorkflowEditorProps<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
> = {
  storageKey?: string;
  initialLibrary?: WorkflowEditorLibrary<TNodeData, TEdgeData>;
  storage?: WorkflowEditorStorageAdapter<TNodeData, TEdgeData>;
  nodeTemplates?: ReadonlyArray<WorkflowWorkbenchPaletteItem<TTemplateData>>;
  readOnly?: boolean;
  className?: string;
  typeDefinitions?: readonly WorkflowEditorTypeDefinition[];
  maxVersions?: number;
  enableNestedWorkflows?: boolean;
  maxNestedWorkflowDepth?: number;
  onLibraryChange?: (library: WorkflowEditorLibrary<TNodeData, TEdgeData>) => void;
  onDocumentPathChange?: (path: WorkflowEditorDocumentPathItem[]) => void;
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

const emptyWorkflowEditorSelection: WorkflowEditorSelectionState = {
  nodeIds: [],
  edgeIds: [],
};

export function WorkflowEditor<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
>({
  storageKey = defaultWorkflowEditorStorageKey,
  initialLibrary,
  storage,
  nodeTemplates = defaultWorkflowEditorNodeTemplates as ReadonlyArray<
    WorkflowWorkbenchPaletteItem<TTemplateData>
  >,
  readOnly = false,
  className,
  typeDefinitions,
  maxVersions = defaultWorkflowEditorMaxVersions,
  enableNestedWorkflows = true,
  maxNestedWorkflowDepth = 64,
  onLibraryChange,
  onDocumentPathChange,
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
  const [selection, setSelection] = useState<WorkflowEditorSelectionState>(
    emptyWorkflowEditorSelection,
  );
  const initialActiveEntry = activeWorkflowEditorEntry(fallbackLibrary);
  const [documentPath, setDocumentPath] = useState<WorkflowEditorDocumentPathItem[]>(() =>
    initialActiveEntry ? [{ documentId: initialActiveEntry.id }] : [],
  );
  const [historyByDocumentId, setHistoryByDocumentId] = useState<
    Record<string, WorkflowEditorHistoryState<TNodeData, TEdgeData>>
  >(() =>
    initialActiveEntry
      ? { [initialActiveEntry.id]: createWorkflowEditorHistory(initialActiveEntry.document) }
      : {},
  );
  const activeEntry = workflowEditorEntryForPath(library, documentPath);
  const [nameDraft, setNameDraft] = useState(activeEntry?.name ?? "Untitled Workflow");
  const [selectedVersionId, setSelectedVersionId] = useState(activeEntry?.versions[0]?.id ?? "");
  const importInputRef = useRef<HTMLInputElement | null>(null);
  const activeDocument =
    activeEntry?.document ?? createBlankWorkflowEditorDocument<TNodeData, TEdgeData>();
  const history =
    (activeEntry ? historyByDocumentId[activeEntry.id] : undefined) ??
    createWorkflowEditorHistory(activeDocument);
  const documentReferenceOptions = enableNestedWorkflows
    ? listWorkflowEditorDocumentReferenceOptions(library)
    : undefined;
  const canOpenNestedWorkflow = documentPath.length < Math.max(1, maxNestedWorkflowDepth);

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
        setDocumentPath(nextEntry ? [{ documentId: nextEntry.id }] : []);
        setHistoryByDocumentId(
          nextEntry ? { [nextEntry.id]: createWorkflowEditorHistory(nextEntry.document) } : {},
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
        const nextEntry = activeWorkflowEditorEntry(fallbackLibrary);
        setDocumentPath(nextEntry ? [{ documentId: nextEntry.id }] : []);
        setHistoryByDocumentId(
          nextEntry ? { [nextEntry.id]: createWorkflowEditorHistory(nextEntry.document) } : {},
        );
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
    setSelection(emptyWorkflowEditorSelection);
  }, [activeEntry?.id]);

  useEffect(() => {
    if (!activeEntry) {
      return;
    }

    setHistoryByDocumentId((current) =>
      current[activeEntry.id]
        ? current
        : { ...current, [activeEntry.id]: createWorkflowEditorHistory(activeEntry.document) },
    );
  }, [activeEntry]);

  useEffect(() => {
    onDocumentPathChange?.(documentPath);
  }, [documentPath, onDocumentPathChange]);

  const normalizedSelection = normalizeWorkflowEditorSelection(activeDocument, selection);
  const selectedNodeId =
    normalizedSelection.primary?.type === "node"
      ? normalizedSelection.primary.id
      : (normalizedSelection.nodeIds[0] ?? null);
  const selectedEdgeId =
    normalizedSelection.primary?.type === "edge"
      ? normalizedSelection.primary.id
      : (normalizedSelection.edgeIds[0] ?? null);
  const selectionFingerprint = JSON.stringify(normalizedSelection);
  const documentPathEntries = documentPath.map((item) => ({
    documentId: item.documentId,
    entry: library.documents.find((candidate) => candidate.id === item.documentId) ?? null,
  }));

  const updateLibrary = (nextLibrary: WorkflowEditorLibrary<TNodeData, TEdgeData>) => {
    setSaveState("dirty");
    setLibrary(nextLibrary);
  };

  useEffect(() => {
    onSelectionChange?.(selectionStateToSingleSelection(activeDocument, normalizedSelection));
  }, [activeDocument, onSelectionChange, selectionFingerprint]);

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
      setHistoryByDocumentId((current) => ({
        ...current,
        [nextEntry.id]: resetWorkflowEditorHistory(nextEntry.document),
      }));
    }
  };

  const updateDocument = (document: WorkflowEditorDocument<TNodeData, TEdgeData>) => {
    if (!activeEntry || readOnly) {
      return;
    }

    const nextHistory = commitWorkflowEditorHistory(history, document);
    setHistoryByDocumentId((current) => ({ ...current, [activeEntry.id]: nextHistory }));
    setSelection((current) => normalizeWorkflowEditorSelection(nextHistory.present, current));
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

    setSelection(emptyWorkflowEditorSelection);
    setDocumentPath([{ documentId: entry.id }]);
    setHistoryByDocumentId((current) => ({
      ...current,
      [entry.id]: current[entry.id] ?? createWorkflowEditorHistory(entry.document),
    }));
    updateLibrary({ ...library, activeDocumentId: entry.id });
  };

  const createDocument = () => {
    if (readOnly) {
      return;
    }

    const entry = createWorkflowEditorEntry<TNodeData, TEdgeData>({
      name: "Untitled Workflow",
    });
    setDocumentPath([{ documentId: entry.id }]);
    setHistoryByDocumentId((current) => ({
      ...current,
      [entry.id]: createWorkflowEditorHistory(entry.document),
    }));
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
    setDocumentPath(nextEntry ? [{ documentId: nextEntry.id }] : []);
    setHistoryByDocumentId((current) =>
      nextEntry
        ? { ...current, [nextEntry.id]: resetWorkflowEditorHistory(nextEntry.document) }
        : current,
    );
    updateLibrary(nextLibrary);
  };

  const deleteDocument = () => {
    if (!activeEntry || readOnly) {
      return;
    }

    const nextLibrary = removeWorkflowEditorEntry(library, activeEntry.id);
    const nextPath = reconcileWorkflowEditorDocumentPath(nextLibrary, documentPath);
    const nextEntry = workflowEditorEntryForPath(nextLibrary, nextPath);
    setDocumentPath(nextPath);
    setHistoryByDocumentId((current) => {
      const { [activeEntry.id]: _removed, ...remaining } = current;
      return nextEntry && !remaining[nextEntry.id]
        ? { ...remaining, [nextEntry.id]: resetWorkflowEditorHistory(nextEntry.document) }
        : remaining;
    });
    updateLibrary({
      ...nextLibrary,
      activeDocumentId: nextEntry?.id ?? nextLibrary.activeDocumentId,
    });
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

    setSelection(emptyWorkflowEditorSelection);
    updateActiveEntry((entry) => restoreWorkflowEditorVersion(entry, selectedVersionId), {
      resetHistory: true,
    });
  };

  const undo = () => {
    if (!activeEntry || readOnly) {
      return;
    }

    const nextHistory = undoWorkflowEditorHistory(history);
    setHistoryByDocumentId((current) => ({ ...current, [activeEntry.id]: nextHistory }));
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
    setHistoryByDocumentId((current) => ({ ...current, [activeEntry.id]: nextHistory }));
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
      setDocumentPath([{ documentId: entry.id }]);
      setHistoryByDocumentId((current) => ({
        ...current,
        [entry.id]: resetWorkflowEditorHistory(entry.document),
      }));
      updateLibrary(upsertWorkflowEditorEntry(library, entry, { activate: true }));
    } catch (error) {
      setSaveState("error");
      onError?.(error instanceof Error ? error : new Error("Failed to import workflow document"));
    }
  };

  const openWorkflowReference = (node: WorkflowEditorNode<TNodeData>) => {
    if (!enableNestedWorkflows || !canOpenNestedWorkflow) {
      return;
    }

    const targetEntry = resolveWorkflowEditorDocumentReference(library, node.workflowRef);
    if (!targetEntry) {
      return;
    }

    setSelection(emptyWorkflowEditorSelection);
    setDocumentPath([...documentPath, { documentId: targetEntry.id }]);
    setHistoryByDocumentId((current) => ({
      ...current,
      [targetEntry.id]:
        current[targetEntry.id] ?? createWorkflowEditorHistory(targetEntry.document),
    }));
    updateLibrary({ ...library, activeDocumentId: targetEntry.id });
  };

  const createWorkflowReference = (node: WorkflowEditorNode<TNodeData>) => {
    if (!activeEntry || readOnly || !enableNestedWorkflows || !canOpenNestedWorkflow) {
      return;
    }

    const childEntry = createWorkflowEditorEntry<TNodeData, TEdgeData>({
      name: `${node.label} Workflow`,
    });
    const nextParentDocument = updateWorkflowEditorNodeWorkflowReference(
      activeEntry.document,
      node.id,
      { documentId: childEntry.id },
    );
    const nextParentHistory = commitWorkflowEditorHistory(history, nextParentDocument);
    const nextParentEntry = {
      ...activeEntry,
      updatedAt: new Date().toISOString(),
      document: nextParentHistory.present,
    };
    const nextLibrary = upsertWorkflowEditorEntry(
      upsertWorkflowEditorEntry(library, nextParentEntry),
      childEntry,
      { activate: true },
    );

    setSelection(emptyWorkflowEditorSelection);
    setDocumentPath([...documentPath, { documentId: childEntry.id }]);
    setHistoryByDocumentId((current) => ({
      ...current,
      [activeEntry.id]: nextParentHistory,
      [childEntry.id]: createWorkflowEditorHistory(childEntry.document),
    }));
    updateLibrary(nextLibrary);
  };

  const selectDocumentPathItem = (index: number) => {
    const nextPath = documentPath.slice(0, index + 1);
    const nextEntry = workflowEditorEntryForPath(library, nextPath);
    if (!nextEntry) {
      return;
    }

    setSelection(emptyWorkflowEditorSelection);
    setDocumentPath(nextPath);
    updateLibrary({ ...library, activeDocumentId: nextEntry.id });
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

      {enableNestedWorkflows ? (
        <WorkbenchToolbar
          className="flex flex-wrap items-center gap-2 border border-border bg-background px-3 py-2"
          aria-label="Workflow path"
        >
          <span className="text-xs text-muted-foreground">Path</span>
          {documentPathEntries.map((item, index) => (
            <Button
              key={`${item.documentId}-${index}`}
              type="button"
              size="sm"
              variant={index === documentPathEntries.length - 1 ? "secondary" : "ghost"}
              disabled={!item.entry || index === documentPathEntries.length - 1}
              onClick={() => selectDocumentPathItem(index)}
            >
              {item.entry?.name ?? `Missing: ${item.documentId}`}
            </Button>
          ))}
        </WorkbenchToolbar>
      ) : null}

      <WorkflowWorkbench
        document={activeDocument}
        selectedNodeId={selectedNodeId}
        selectedEdgeId={selectedEdgeId}
        selectedNodeIds={normalizedSelection.nodeIds}
        selectedEdgeIds={normalizedSelection.edgeIds}
        readOnly={readOnly}
        nodeTemplates={nodeTemplates}
        typeDefinitions={typeDefinitions}
        documentReferences={documentReferenceOptions}
        onOpenWorkflowReference={canOpenNestedWorkflow ? openWorkflowReference : undefined}
        onCreateWorkflowReference={canOpenNestedWorkflow ? createWorkflowReference : undefined}
        onDocumentChange={updateDocument}
        onSelectionChange={onSelectionChange}
        onSelectionStateChange={(nextSelection) => setSelection(nextSelection)}
        renderNodeTemplate={renderNodeTemplate}
        renderInspector={renderInspector}
        renderToolbarActions={renderToolbarActions}
      />
    </section>
  );
}

function workflowEditorEntryForPath<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(library: WorkflowEditorLibrary<TNodeData, TEdgeData>, path: WorkflowEditorDocumentPathItem[]) {
  const pathEntry = path.at(-1);
  if (pathEntry) {
    const entry = library.documents.find((candidate) => candidate.id === pathEntry.documentId);
    if (entry) {
      return entry;
    }
  }

  return activeWorkflowEditorEntry(library);
}

function reconcileWorkflowEditorDocumentPath<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(library: WorkflowEditorLibrary<TNodeData, TEdgeData>, path: WorkflowEditorDocumentPathItem[]) {
  const documentIds = new Set(library.documents.map((entry) => entry.id));
  const nextPath: WorkflowEditorDocumentPathItem[] = [];

  for (const item of path) {
    if (!documentIds.has(item.documentId)) {
      break;
    }

    nextPath.push(item);
  }

  if (nextPath.length > 0) {
    return nextPath;
  }

  const fallbackEntry = activeWorkflowEditorEntry(library) ?? library.documents[0];
  return fallbackEntry ? [{ documentId: fallbackEntry.id }] : [];
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

function selectionStateToSingleSelection<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  selection: WorkflowEditorSelectionState,
): WorkflowWorkbenchSelection<TNodeData, TEdgeData> {
  const primary = selection.primary;

  if (primary?.type === "node") {
    const node = document.nodes.find((candidate) => candidate.id === primary.id);
    return node ? { type: "node", id: primary.id, node } : null;
  }

  if (primary?.type === "edge") {
    const edge = document.edges.find((candidate) => candidate.id === primary.id);
    return edge ? { type: "edge", id: primary.id, edge } : null;
  }

  const node = document.nodes.find((candidate) => candidate.id === selection.nodeIds[0]);
  if (node) {
    return { type: "node", id: node.id, node };
  }

  const edge = document.edges.find((candidate) => candidate.id === selection.edgeIds[0]);
  return edge ? { type: "edge", id: edge.id, edge } : null;
}
