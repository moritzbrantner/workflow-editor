"use client";

import { type ChangeEvent, type ReactNode, useEffect, useMemo, useRef, useState } from "react";

import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Input,
  WorkbenchToolbar,
  cn,
} from "@moritzbrantner/ui";

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
  type WorkflowEditorDocumentReferenceOption,
  type WorkflowEditorLibrary,
  type WorkflowEditorLibraryEntry,
  type WorkflowEditorStorageAdapter,
} from "./persistence";
import {
  WorkflowWorkbench,
  defaultWorkflowWorkbenchHotkeys,
  useWorkflowWorkbenchController,
  type WorkflowWorkbenchPaletteItem,
  type WorkflowWorkbenchProps,
  type WorkflowWorkbenchSelection,
  type WorkflowWorkbenchController,
} from "./react";
import { formatShortcutLabel } from "./shortcut-label";
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

export type WorkflowEditorSaveState = "loading" | "dirty" | "saving" | "saved" | "error";

export type WorkflowEditorController<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
> = {
  activeDocument: WorkflowEditorDocument<TNodeData, TEdgeData>;
  activeEntry: WorkflowEditorLibraryEntry<TNodeData, TEdgeData> | null;
  documentPath: WorkflowEditorDocumentPathItem[];
  documentPathEntries: Array<{
    documentId: string;
    entry: WorkflowEditorLibraryEntry<TNodeData, TEdgeData> | null;
  }>;
  documentReferenceOptions?: WorkflowEditorDocumentReferenceOption[];
  history: WorkflowEditorHistoryState<TNodeData, TEdgeData>;
  library: WorkflowEditorLibrary<TNodeData, TEdgeData>;
  nameDraft: string;
  readOnly: boolean;
  saveState: WorkflowEditorSaveState;
  selectedVersionId: string;
  selection: WorkflowEditorSelectionState;
  workbench?: WorkflowWorkbenchController<TNodeData, TEdgeData, TTemplateData>;
  actions: {
    createDocument: () => void;
    createWorkflowReference: (node: WorkflowEditorNode<TNodeData>) => void;
    deleteDocument: () => void;
    duplicateDocument: () => void;
    exportDocument: () => void;
    importDocumentFromFile: (file: File) => Promise<void>;
    openWorkflowReference: (node: WorkflowEditorNode<TNodeData>) => void;
    redo: () => void;
    renameDocument: () => void;
    restoreVersion: () => void;
    saveVersion: () => void;
    selectDocument: (documentId: string) => void;
    selectDocumentPathItem: (index: number) => void;
    setNameDraft: (value: string) => void;
    setSelectedVersionId: (versionId: string) => void;
    setSelection: (selection: WorkflowEditorSelectionState) => void;
    undo: () => void;
    updateActiveDocument: (document: WorkflowEditorDocument<TNodeData, TEdgeData>) => void;
  };
};

export type WorkflowEditorChromeRenderer<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
> = (controller: WorkflowEditorController<TNodeData, TEdgeData, TTemplateData>) => ReactNode;

export type WorkflowEditorChrome<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
> = {
  documentControls?:
    | "default"
    | "compact-menu"
    | "hidden"
    | WorkflowEditorChromeRenderer<TNodeData, TEdgeData, TTemplateData>;
  documentPath?:
    | "default"
    | "hidden"
    | WorkflowEditorChromeRenderer<TNodeData, TEdgeData, TTemplateData>;
  inspector?: WorkflowWorkbenchProps<TNodeData, TEdgeData, TTemplateData>["chrome"] extends infer C
    ? C extends { inspector?: infer I }
      ? I
      : never
    : never;
  palette?: WorkflowWorkbenchProps<TNodeData, TEdgeData, TTemplateData>["chrome"] extends infer C
    ? C extends { palette?: infer P }
      ? P
      : never
    : never;
  workbenchToolbar?: WorkflowWorkbenchProps<
    TNodeData,
    TEdgeData,
    TTemplateData
  >["chrome"] extends infer C
    ? C extends { toolbar?: infer T }
      ? T
      : never
    : never;
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
  compactControls?: boolean;
  layout?: "default" | "unstyled";
  chrome?: WorkflowEditorChrome<TNodeData, TEdgeData, TTemplateData>;
  showDocumentStats?: boolean;
  showDocumentPath?: boolean;
  showWorkbenchStats?: boolean;
  renderChrome?: WorkflowEditorChromeRenderer<TNodeData, TEdgeData, TTemplateData>;
  renderCompactMenuActions?: () => ReactNode;
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

type SaveState = WorkflowEditorSaveState;

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
  compactControls = false,
  layout = "default",
  chrome,
  showDocumentStats = true,
  showDocumentPath = true,
  showWorkbenchStats = true,
  onLibraryChange,
  onDocumentPathChange,
  onError,
  onSelectionChange,
  renderNodeTemplate,
  renderInspector,
  renderToolbarActions,
  renderCompactMenuActions,
  renderChrome,
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

  const importDocumentFromFile = async (file: File) => {
    if (readOnly) {
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

  const workbenchController = useWorkflowWorkbenchController<TNodeData, TEdgeData, TTemplateData>({
    document: activeDocument,
    selectedNodeId,
    selectedEdgeId,
    selectedNodeIds: normalizedSelection.nodeIds,
    selectedEdgeIds: normalizedSelection.edgeIds,
    selectedGroupIds: normalizedSelection.groupIds,
    readOnly,
    nodeTemplates,
    typeDefinitions,
    documentReferences: documentReferenceOptions,
    onOpenWorkflowReference: canOpenNestedWorkflow ? openWorkflowReference : undefined,
    onCreateWorkflowReference: canOpenNestedWorkflow ? createWorkflowReference : undefined,
    onDocumentChange: updateDocument,
    onSelectionChange,
    onSelectionStateChange: setSelection,
    renderNodeTemplate,
    renderInspector,
    renderToolbarActions,
    showGraphStats: showWorkbenchStats,
    showShortcutHint: !compactControls,
  });

  const editorController = {
    activeDocument,
    activeEntry,
    documentPath,
    documentPathEntries,
    documentReferenceOptions,
    history,
    library,
    nameDraft,
    readOnly,
    saveState,
    selectedVersionId,
    selection: normalizedSelection,
    workbench: workbenchController,
    actions: {
      createDocument,
      createWorkflowReference,
      deleteDocument,
      duplicateDocument,
      exportDocument,
      importDocumentFromFile,
      openWorkflowReference,
      redo,
      renameDocument,
      restoreVersion,
      saveVersion,
      selectDocument,
      selectDocumentPathItem,
      setNameDraft,
      setSelectedVersionId,
      setSelection,
      undo,
      updateActiveDocument: updateDocument,
    },
  } satisfies WorkflowEditorController<TNodeData, TEdgeData, TTemplateData>;

  const documentControlsChrome =
    chrome?.documentControls ?? (compactControls ? "compact-menu" : "default");
  const documentPathChrome = chrome?.documentPath ?? "default";

  return (
    <section
      className={cn(layout === "unstyled" ? "min-w-0" : "grid gap-3", className)}
      data-testid="workflow-editor"
    >
      {renderChrome?.(editorController)}
      {typeof documentControlsChrome === "function" ? (
        documentControlsChrome(editorController)
      ) : documentControlsChrome === "hidden" ||
        layout === "unstyled" ? null : documentControlsChrome === "compact-menu" ? (
        <WorkbenchToolbar className="flex items-center justify-between gap-2 border border-border bg-background px-2 py-1">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button type="button" size="sm" variant="outline">
                {activeEntry?.name ?? "Workflow"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-80 p-3"
              onCloseAutoFocus={(event) => event.preventDefault()}
            >
              <div className="grid gap-3" onKeyDown={(event) => event.stopPropagation()}>
                <div className="grid gap-1.5">
                  <DropdownMenuLabel className="px-0">Workflow</DropdownMenuLabel>
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
                </div>

                <div className="grid gap-1.5">
                  <Input
                    aria-label="Document name"
                    className="h-9 rounded-md border border-input bg-background px-2 text-sm"
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

                <div className="grid grid-cols-3 gap-2">
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
                    Duplicate
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={readOnly || !activeEntry || library.documents.length <= 1}
                    onClick={deleteDocument}
                  >
                    Delete
                  </Button>
                </div>

                <DropdownMenuSeparator />

                <div className="grid gap-1.5">
                  <DropdownMenuLabel className="px-0">Versions and files</DropdownMenuLabel>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={readOnly || !activeEntry}
                      onClick={saveVersion}
                    >
                      Save version
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={readOnly || !selectedVersionId}
                      onClick={restoreVersion}
                    >
                      Restore
                    </Button>
                  </div>
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
                  <div className="grid grid-cols-2 gap-2">
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
                </div>

                {renderCompactMenuActions ? (
                  <>
                    <DropdownMenuSeparator />
                    <div className="grid gap-2">{renderCompactMenuActions()}</div>
                  </>
                ) : null}

                <DropdownMenuSeparator />

                <div className="grid gap-1.5 text-xs text-muted-foreground">
                  <DropdownMenuLabel className="px-0 text-foreground">Hotkeys</DropdownMenuLabel>
                  <div className="flex justify-between gap-3">
                    <span>Duplicate selection</span>
                    <span>
                      {formatShortcutLabel(defaultWorkflowWorkbenchHotkeys.duplicateNode)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>Copy selection</span>
                    <span>
                      {formatShortcutLabel(defaultWorkflowWorkbenchHotkeys.copySelection)}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span>Paste selection</span>
                    <span>
                      {formatShortcutLabel(defaultWorkflowWorkbenchHotkeys.pasteSelection)}
                    </span>
                  </div>
                </div>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          <div className="flex items-center gap-2">
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
            <Badge
              variant={saveState === "error" ? "outline" : "secondary"}
              data-testid="save-state"
            >
              {formatSaveState(saveState)}
            </Badge>
          </div>
        </WorkbenchToolbar>
      ) : (
        <>
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
              <Badge
                variant={saveState === "error" ? "outline" : "secondary"}
                data-testid="save-state"
              >
                {formatSaveState(saveState)}
              </Badge>
              {showDocumentStats ? (
                <>
                  <Badge variant="outline" data-testid="active-node-count">
                    {activeDocument.nodes.length} nodes
                  </Badge>
                  <Badge variant="outline" data-testid="active-edge-count">
                    {activeDocument.edges.length} edges
                  </Badge>
                </>
              ) : null}
            </div>
          </WorkbenchToolbar>

          <WorkbenchToolbar className="flex flex-wrap items-center justify-between gap-3 border border-border bg-background px-3 py-2">
            <div className="flex flex-wrap items-center gap-2">
              <Input
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
        </>
      )}

      {typeof documentPathChrome === "function" ? (
        documentPathChrome(editorController)
      ) : documentPathChrome === "hidden" || layout === "unstyled" ? null : enableNestedWorkflows &&
        showDocumentPath ? (
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
        selectedGroupIds={normalizedSelection.groupIds}
        readOnly={readOnly}
        nodeTemplates={nodeTemplates}
        typeDefinitions={typeDefinitions}
        documentReferences={documentReferenceOptions}
        chrome={{
          ...(chrome?.workbenchToolbar ? { toolbar: chrome.workbenchToolbar } : {}),
          ...(chrome?.palette ? { palette: chrome.palette } : {}),
          ...(chrome?.inspector ? { inspector: chrome.inspector } : {}),
        }}
        layout={layout}
        onOpenWorkflowReference={canOpenNestedWorkflow ? openWorkflowReference : undefined}
        onCreateWorkflowReference={canOpenNestedWorkflow ? createWorkflowReference : undefined}
        onDocumentChange={updateDocument}
        onSelectionChange={onSelectionChange}
        onSelectionStateChange={(nextSelection) => setSelection(nextSelection)}
        renderNodeTemplate={renderNodeTemplate}
        renderInspector={renderInspector}
        renderToolbarActions={renderToolbarActions}
        showGraphStats={showWorkbenchStats}
        showShortcutHint={!compactControls}
      />
    </section>
  );
}

export type WorkflowEditorControllerProps<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
> = WorkflowEditorProps<TNodeData, TEdgeData, TTemplateData>;

export function useWorkflowEditorController<
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
  typeDefinitions,
  maxVersions = defaultWorkflowEditorMaxVersions,
  enableNestedWorkflows = true,
  maxNestedWorkflowDepth = 64,
  showWorkbenchStats = true,
  compactControls = false,
  onLibraryChange,
  onDocumentPathChange,
  onError,
  onSelectionChange,
  renderNodeTemplate,
  renderInspector,
  renderToolbarActions,
}: WorkflowEditorControllerProps<TNodeData, TEdgeData, TTemplateData>) {
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
  const activeDocument =
    activeEntry?.document ?? createBlankWorkflowEditorDocument<TNodeData, TEdgeData>();
  const history =
    (activeEntry ? historyByDocumentId[activeEntry.id] : undefined) ??
    createWorkflowEditorHistory(activeDocument);
  const documentReferenceOptions = enableNestedWorkflows
    ? listWorkflowEditorDocumentReferenceOptions(library)
    : undefined;
  const canOpenNestedWorkflow = documentPath.length < Math.max(1, maxNestedWorkflowDepth);
  const normalizedSelection = normalizeWorkflowEditorSelection(activeDocument, selection);
  const selectedNodeId =
    normalizedSelection.primary?.type === "node"
      ? normalizedSelection.primary.id
      : (normalizedSelection.nodeIds[0] ?? null);
  const selectedEdgeId =
    normalizedSelection.primary?.type === "edge"
      ? normalizedSelection.primary.id
      : (normalizedSelection.edgeIds[0] ?? null);
  const documentPathEntries = documentPath.map((item) => ({
    documentId: item.documentId,
    entry: library.documents.find((candidate) => candidate.id === item.documentId) ?? null,
  }));

  const updateLibrary = (nextLibrary: WorkflowEditorLibrary<TNodeData, TEdgeData>) => {
    setSaveState("dirty");
    setLibrary(nextLibrary);
  };

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
        const nextEntry = activeWorkflowEditorEntry(nextLibrary);
        setLibrary(nextLibrary);
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
        onError?.(error instanceof Error ? error : new Error("Failed to load workflow library"));
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
    onDocumentPathChange?.(documentPath);
  }, [documentPath, onDocumentPathChange]);

  useEffect(() => {
    onSelectionChange?.(selectionStateToSingleSelection(activeDocument, normalizedSelection));
  }, [activeDocument, normalizedSelection, onSelectionChange]);

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
  const updateActiveDocument = (document: WorkflowEditorDocument<TNodeData, TEdgeData>) => {
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
    const entry = createWorkflowEditorEntry<TNodeData, TEdgeData>({ name: "Untitled Workflow" });
    setDocumentPath([{ documentId: entry.id }]);
    setHistoryByDocumentId((current) => ({
      ...current,
      [entry.id]: createWorkflowEditorHistory(entry.document),
    }));
    updateLibrary(upsertWorkflowEditorEntry(library, entry, { activate: true }));
  };
  const renameDocument = () => {
    if (activeEntry && !readOnly) {
      updateLibrary(renameWorkflowEditorEntry(library, activeEntry.id, nameDraft));
    }
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
    if (selectedVersionId) {
      setSelection(emptyWorkflowEditorSelection);
      updateActiveEntry((entry) => restoreWorkflowEditorVersion(entry, selectedVersionId), {
        resetHistory: true,
      });
    }
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
  const importDocumentFromFile = async (file: File) => {
    if (readOnly) {
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
  const workbench = useWorkflowWorkbenchController<TNodeData, TEdgeData, TTemplateData>({
    document: activeDocument,
    selectedNodeId,
    selectedEdgeId,
    selectedNodeIds: normalizedSelection.nodeIds,
    selectedEdgeIds: normalizedSelection.edgeIds,
    selectedGroupIds: normalizedSelection.groupIds,
    readOnly,
    nodeTemplates,
    typeDefinitions,
    documentReferences: documentReferenceOptions,
    onOpenWorkflowReference: canOpenNestedWorkflow ? openWorkflowReference : undefined,
    onCreateWorkflowReference: canOpenNestedWorkflow ? createWorkflowReference : undefined,
    onDocumentChange: updateActiveDocument,
    onSelectionChange,
    onSelectionStateChange: setSelection,
    renderNodeTemplate,
    renderInspector,
    renderToolbarActions,
    showGraphStats: showWorkbenchStats,
    showShortcutHint: !compactControls,
  });

  return {
    activeDocument,
    activeEntry,
    documentPath,
    documentPathEntries,
    documentReferenceOptions,
    history,
    library,
    nameDraft,
    readOnly,
    saveState,
    selectedVersionId,
    selection: normalizedSelection,
    workbench,
    actions: {
      createDocument,
      createWorkflowReference,
      deleteDocument,
      duplicateDocument,
      exportDocument,
      importDocumentFromFile,
      openWorkflowReference,
      redo,
      renameDocument,
      restoreVersion,
      saveVersion,
      selectDocument,
      selectDocumentPathItem,
      setNameDraft,
      setSelectedVersionId,
      setSelection,
      undo,
      updateActiveDocument,
    },
  } satisfies WorkflowEditorController<TNodeData, TEdgeData, TTemplateData>;
}

export function WorkflowEditorSaveStateBadge<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
>({ controller }: { controller: WorkflowEditorController<TNodeData, TEdgeData, TTemplateData> }) {
  return (
    <Badge
      variant={controller.saveState === "error" ? "outline" : "secondary"}
      data-testid="save-state"
    >
      {formatSaveState(controller.saveState)}
    </Badge>
  );
}

export function WorkflowEditorHistoryControls<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
>({ controller }: { controller: WorkflowEditorController<TNodeData, TEdgeData, TTemplateData> }) {
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={controller.readOnly || !canUndoWorkflowEditorHistory(controller.history)}
        onClick={controller.actions.undo}
        aria-label="Undo"
      >
        Undo
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={controller.readOnly || !canRedoWorkflowEditorHistory(controller.history)}
        onClick={controller.actions.redo}
        aria-label="Redo"
      >
        Redo
      </Button>
    </div>
  );
}

export function WorkflowEditorDocumentMenu<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
>({ controller }: { controller: WorkflowEditorController<TNodeData, TEdgeData, TTemplateData> }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Workflow document"
        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        value={controller.activeEntry?.id ?? ""}
        disabled={controller.readOnly || controller.library.documents.length === 0}
        onChange={(event) => controller.actions.selectDocument(event.target.value)}
      >
        {controller.library.documents.map((entry) => (
          <option key={entry.id} value={entry.id}>
            {entry.name}
          </option>
        ))}
      </select>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={controller.readOnly}
        onClick={controller.actions.createDocument}
      >
        New
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={controller.readOnly || !controller.activeEntry}
        onClick={controller.actions.duplicateDocument}
      >
        Duplicate document
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={
          controller.readOnly || !controller.activeEntry || controller.library.documents.length <= 1
        }
        onClick={controller.actions.deleteDocument}
      >
        Delete document
      </Button>
    </div>
  );
}

export function WorkflowEditorVersionControls<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
>({ controller }: { controller: WorkflowEditorController<TNodeData, TEdgeData, TTemplateData> }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={controller.readOnly || !controller.activeEntry}
        onClick={controller.actions.saveVersion}
      >
        Save version
      </Button>
      <select
        aria-label="Saved versions"
        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        value={controller.selectedVersionId}
        disabled={
          controller.readOnly ||
          !controller.activeEntry ||
          controller.activeEntry.versions.length === 0
        }
        onChange={(event) => controller.actions.setSelectedVersionId(event.target.value)}
      >
        <option value="">No saved versions</option>
        {controller.activeEntry?.versions.map((version) => (
          <option key={version.id} value={version.id}>
            v{version.version} {version.name}
          </option>
        ))}
      </select>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={controller.readOnly || !controller.selectedVersionId}
        onClick={controller.actions.restoreVersion}
      >
        Restore version
      </Button>
    </div>
  );
}

export function WorkflowEditorImportExportControls<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
>({ controller }: { controller: WorkflowEditorController<TNodeData, TEdgeData, TTemplateData> }) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={inputRef}
        aria-label="Import workflow JSON"
        className="hidden"
        type="file"
        accept="application/json,.json"
        disabled={controller.readOnly}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) {
            void controller.actions.importDocumentFromFile(file);
          }
        }}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={controller.readOnly}
        onClick={() => inputRef.current?.click()}
      >
        Import JSON
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!controller.activeEntry}
        onClick={controller.actions.exportDocument}
      >
        Export JSON
      </Button>
    </div>
  );
}

export function WorkflowEditorDocumentControls<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
>({ controller }: { controller: WorkflowEditorController<TNodeData, TEdgeData, TTemplateData> }) {
  return (
    <div className="grid gap-3">
      <WorkbenchToolbar className="flex flex-wrap items-center justify-between gap-3 border border-border bg-background px-3 py-2">
        <WorkflowEditorDocumentMenu controller={controller} />
        <WorkflowEditorSaveStateBadge controller={controller} />
      </WorkbenchToolbar>
      <WorkbenchToolbar className="flex flex-wrap items-center justify-between gap-3 border border-border bg-background px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            aria-label="Document name"
            className="h-9 min-w-48 rounded-md border border-input bg-background px-2 text-sm"
            value={controller.nameDraft}
            disabled={controller.readOnly || !controller.activeEntry}
            onChange={(event) => controller.actions.setNameDraft(event.target.value)}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={controller.readOnly || !controller.activeEntry}
            onClick={controller.actions.renameDocument}
          >
            Rename
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <WorkflowEditorHistoryControls controller={controller} />
          <WorkflowEditorVersionControls controller={controller} />
          <WorkflowEditorImportExportControls controller={controller} />
        </div>
      </WorkbenchToolbar>
    </div>
  );
}

export function WorkflowEditorCompactMenu<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
>({ controller }: { controller: WorkflowEditorController<TNodeData, TEdgeData, TTemplateData> }) {
  return (
    <WorkbenchToolbar className="flex items-center justify-between gap-2 border border-border bg-background px-2 py-1">
      <WorkflowEditorDocumentMenu controller={controller} />
      <div className="flex items-center gap-2">
        <WorkflowEditorHistoryControls controller={controller} />
        <WorkflowEditorSaveStateBadge controller={controller} />
      </div>
    </WorkbenchToolbar>
  );
}

export function WorkflowEditorDocumentPath<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
>({ controller }: { controller: WorkflowEditorController<TNodeData, TEdgeData, TTemplateData> }) {
  if (controller.documentPathEntries.length === 0) {
    return null;
  }

  return (
    <WorkbenchToolbar
      className="flex flex-wrap items-center gap-2 border border-border bg-background px-3 py-2"
      aria-label="Workflow path"
    >
      <span className="text-xs text-muted-foreground">Path</span>
      {controller.documentPathEntries.map((item, index) => (
        <Button
          key={`${item.documentId}-${index}`}
          type="button"
          size="sm"
          variant={index === controller.documentPathEntries.length - 1 ? "secondary" : "ghost"}
          disabled={!item.entry || index === controller.documentPathEntries.length - 1}
          onClick={() => controller.actions.selectDocumentPathItem(index)}
        >
          {item.entry?.name ?? `Missing: ${item.documentId}`}
        </Button>
      ))}
    </WorkbenchToolbar>
  );
}

export function WorkflowEditorDefaultLayout({ children }: { children?: ReactNode }) {
  return <section className="grid gap-3">{children}</section>;
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
