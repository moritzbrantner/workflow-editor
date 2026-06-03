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
  SearchField,
  Textarea,
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
  WorkflowEditorComposedNodesPanel,
  WorkflowEditorCurrentNodeTypesPanel,
  WorkflowEditorCurrentNodesPanel,
  defaultWorkflowWorkbenchHotkeys,
  useWorkflowWorkbenchController,
  type WorkflowWorkbenchPaletteItem,
  type WorkflowWorkbenchProps,
  type WorkflowWorkbenchSelection,
  type WorkflowWorkbenchController,
} from "./react";
import { formatShortcutLabel } from "./shortcut-label";
import {
  analyzeWorkflowEditorPortTypes,
  defaultWorkflowEditorNodeTemplates,
  normalizeWorkflowEditorSelection,
  updateWorkflowEditorNodeWorkflowReference,
  type WorkflowEditorDocument,
  type WorkflowEditorNodeTemplate,
  type WorkflowEditorNode,
  type WorkflowEditorSelectionState,
  type WorkflowEditorTypeDefinition,
} from "./core";

export type WorkflowEditorDocumentPathItem = {
  documentId: string;
};

export type WorkflowEditorSaveState = "loading" | "dirty" | "saving" | "saved" | "error";

export type WorkflowEditorBuiltInSettings = {
  compactControls: boolean;
  enableNestedWorkflows: boolean;
  maxNestedWorkflowDepth: number;
  maxVersions: number;
  readOnly: boolean;
  showDocumentPath: boolean;
  showDocumentStats: boolean;
  showWorkbenchStats: boolean;
};

export type WorkflowEditorSettings<
  TAppSettings extends Record<string, unknown> = Record<string, unknown>,
> = {
  editor: WorkflowEditorBuiltInSettings;
  app?: TAppSettings;
};

export type WorkflowEditorSettingsField<TAppSettings extends Record<string, unknown>> = {
  key: keyof TAppSettings & string;
  label: string;
  description?: string;
  kind: "boolean" | "number" | "string" | "select";
  min?: number;
  max?: number;
  step?: number;
  options?: Array<{ value: string; label: string }>;
};

export const defaultWorkflowEditorBuiltInSettings: WorkflowEditorBuiltInSettings = {
  compactControls: false,
  enableNestedWorkflows: true,
  maxNestedWorkflowDepth: 64,
  maxVersions: defaultWorkflowEditorMaxVersions,
  readOnly: false,
  showDocumentPath: true,
  showDocumentStats: true,
  showWorkbenchStats: true,
};

export type WorkflowEditorCatalogController<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  _TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
  TAppSettings extends Record<string, unknown> = Record<string, unknown>,
> = {
  settings: WorkflowEditorSettings<TAppSettings>;
  settingsFields: readonly WorkflowEditorSettingsField<TAppSettings>[];
  typeDefinitions: readonly WorkflowEditorTypeDefinition[];
  nodeTemplates: readonly WorkflowEditorNodeTemplate<TTemplateData>[];
  writable: {
    settings: boolean;
    typeDefinitions: boolean;
    nodeTemplates: boolean;
  };
  actions: {
    updateSettings(next: WorkflowEditorSettings<TAppSettings>): void;
    updateBuiltInSetting<K extends keyof WorkflowEditorBuiltInSettings>(
      key: K,
      value: WorkflowEditorBuiltInSettings[K],
    ): void;
    updateAppSetting<K extends keyof TAppSettings & string>(key: K, value: TAppSettings[K]): void;
    createTypeDefinition(): void;
    updateTypeDefinition(name: string, next: WorkflowEditorTypeDefinition): void;
    duplicateTypeDefinition(name: string): void;
    deleteTypeDefinition(name: string): void;
    createNodeTemplate(): void;
    updateNodeTemplate(id: string, next: WorkflowEditorNodeTemplate<TTemplateData>): void;
    duplicateNodeTemplate(id: string): void;
    deleteNodeTemplate(id: string): void;
  };
};

export type WorkflowEditorController<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
  TAppSettings extends Record<string, unknown> = Record<string, unknown>,
> = {
  activeDocument: WorkflowEditorDocument<TNodeData, TEdgeData>;
  activeEntry: WorkflowEditorLibraryEntry<TNodeData, TEdgeData> | null;
  catalog: WorkflowEditorCatalogController<TNodeData, TEdgeData, TTemplateData, TAppSettings>;
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
  settings: WorkflowEditorSettings<TAppSettings>;
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
  TAppSettings extends Record<string, unknown> = Record<string, unknown>,
> = (
  controller: WorkflowEditorController<TNodeData, TEdgeData, TTemplateData, TAppSettings>,
) => ReactNode;

export type WorkflowEditorChrome<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
  TAppSettings extends Record<string, unknown> = Record<string, unknown>,
> = {
  documentControls?:
    | "default"
    | "compact-menu"
    | "hidden"
    | WorkflowEditorChromeRenderer<TNodeData, TEdgeData, TTemplateData, TAppSettings>;
  documentPath?:
    | "default"
    | "hidden"
    | WorkflowEditorChromeRenderer<TNodeData, TEdgeData, TTemplateData, TAppSettings>;
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
  TAppSettings extends Record<string, unknown> = Record<string, unknown>,
> = {
  storageKey?: string;
  initialLibrary?: WorkflowEditorLibrary<TNodeData, TEdgeData>;
  storage?: WorkflowEditorStorageAdapter<TNodeData, TEdgeData>;
  nodeTemplates?: ReadonlyArray<WorkflowWorkbenchPaletteItem<TTemplateData>>;
  onNodeTemplatesChange?: (
    templates: ReadonlyArray<WorkflowEditorNodeTemplate<TTemplateData>>,
  ) => void;
  readOnly?: boolean;
  className?: string;
  typeDefinitions?: readonly WorkflowEditorTypeDefinition[];
  onTypeDefinitionsChange?: (definitions: readonly WorkflowEditorTypeDefinition[]) => void;
  maxVersions?: number;
  enableNestedWorkflows?: boolean;
  maxNestedWorkflowDepth?: number;
  compactControls?: boolean;
  settings?: Partial<WorkflowEditorSettings<TAppSettings>>;
  settingsFields?: readonly WorkflowEditorSettingsField<TAppSettings>[];
  onSettingsChange?: (settings: WorkflowEditorSettings<TAppSettings>) => void;
  layout?: "default" | "unstyled";
  chrome?: WorkflowEditorChrome<TNodeData, TEdgeData, TTemplateData, TAppSettings>;
  showDocumentStats?: boolean;
  showDocumentPath?: boolean;
  showWorkbenchStats?: boolean;
  renderChrome?: WorkflowEditorChromeRenderer<TNodeData, TEdgeData, TTemplateData, TAppSettings>;
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

type WorkflowEditorSettingsResolutionProps<
  TAppSettings extends Record<string, unknown> = Record<string, unknown>,
> = {
  compactControls?: boolean;
  enableNestedWorkflows?: boolean;
  maxNestedWorkflowDepth?: number;
  maxVersions?: number;
  readOnly?: boolean;
  settings?: Partial<WorkflowEditorSettings<TAppSettings>>;
  showDocumentPath?: boolean;
  showDocumentStats?: boolean;
  showWorkbenchStats?: boolean;
};

export function resolveWorkflowEditorSettings<
  TAppSettings extends Record<string, unknown> = Record<string, unknown>,
>({
  compactControls,
  enableNestedWorkflows,
  maxNestedWorkflowDepth,
  maxVersions,
  readOnly,
  settings,
  showDocumentPath,
  showDocumentStats,
  showWorkbenchStats,
}: WorkflowEditorSettingsResolutionProps<TAppSettings>): WorkflowEditorSettings<TAppSettings> {
  const editor = {
    ...defaultWorkflowEditorBuiltInSettings,
    ...(settings?.editor ?? {}),
    ...(compactControls !== undefined ? { compactControls } : {}),
    ...(enableNestedWorkflows !== undefined ? { enableNestedWorkflows } : {}),
    ...(maxNestedWorkflowDepth !== undefined ? { maxNestedWorkflowDepth } : {}),
    ...(maxVersions !== undefined ? { maxVersions } : {}),
    ...(readOnly !== undefined ? { readOnly } : {}),
    ...(showDocumentPath !== undefined ? { showDocumentPath } : {}),
    ...(showDocumentStats !== undefined ? { showDocumentStats } : {}),
    ...(showWorkbenchStats !== undefined ? { showWorkbenchStats } : {}),
  };

  return {
    editor,
    ...(settings?.app ? { app: settings.app as TAppSettings } : {}),
  };
}

export function updateWorkflowEditorBuiltInSetting<
  TAppSettings extends Record<string, unknown>,
  K extends keyof WorkflowEditorBuiltInSettings,
>(
  settings: WorkflowEditorSettings<TAppSettings>,
  key: K,
  value: WorkflowEditorBuiltInSettings[K],
): WorkflowEditorSettings<TAppSettings> {
  return { ...settings, editor: { ...settings.editor, [key]: value } };
}

export function updateWorkflowEditorAppSetting<
  TAppSettings extends Record<string, unknown>,
  K extends keyof TAppSettings & string,
>(
  settings: WorkflowEditorSettings<TAppSettings>,
  key: K,
  value: TAppSettings[K],
): WorkflowEditorSettings<TAppSettings> {
  return { ...settings, app: { ...(settings.app ?? ({} as TAppSettings)), [key]: value } };
}

function createWorkflowEditorCatalogController<
  TNodeData extends Record<string, unknown>,
  TEdgeData extends Record<string, unknown>,
  TTemplateData,
  TAppSettings extends Record<string, unknown>,
>({
  settings,
  settingsFields,
  typeDefinitions = [],
  nodeTemplates,
  onSettingsChange,
  onTypeDefinitionsChange,
  onNodeTemplatesChange,
}: {
  settings: WorkflowEditorSettings<TAppSettings>;
  settingsFields: readonly WorkflowEditorSettingsField<TAppSettings>[];
  typeDefinitions?: readonly WorkflowEditorTypeDefinition[];
  nodeTemplates: ReadonlyArray<WorkflowEditorNodeTemplate<TTemplateData>>;
  onSettingsChange?: (settings: WorkflowEditorSettings<TAppSettings>) => void;
  onTypeDefinitionsChange?: (definitions: readonly WorkflowEditorTypeDefinition[]) => void;
  onNodeTemplatesChange?: (
    templates: ReadonlyArray<WorkflowEditorNodeTemplate<TTemplateData>>,
  ) => void;
}): WorkflowEditorCatalogController<TNodeData, TEdgeData, TTemplateData, TAppSettings> {
  const updateSettings = (next: WorkflowEditorSettings<TAppSettings>) => {
    onSettingsChange?.(next);
  };

  return {
    settings,
    settingsFields,
    typeDefinitions,
    nodeTemplates,
    writable: {
      settings: Boolean(onSettingsChange),
      typeDefinitions: Boolean(onTypeDefinitionsChange),
      nodeTemplates: Boolean(onNodeTemplatesChange),
    },
    actions: {
      updateSettings,
      updateBuiltInSetting: (key, value) => {
        updateSettings(updateWorkflowEditorBuiltInSetting(settings, key, value));
      },
      updateAppSetting: (key, value) => {
        updateSettings(updateWorkflowEditorAppSetting(settings, key, value));
      },
      createTypeDefinition: () => {
        if (!onTypeDefinitionsChange) {
          return;
        }
        const names = new Set(typeDefinitions.map((definition) => definition.name));
        const name = createWorkflowEditorUniqueCatalogId(names, "Type");
        onTypeDefinitionsChange([...typeDefinitions, { name, type: { kind: "object" } }]);
      },
      updateTypeDefinition: (name, next) => {
        if (
          !onTypeDefinitionsChange ||
          !next.name.trim() ||
          typeDefinitions.some(
            (definition) => definition.name !== name && definition.name === next.name,
          )
        ) {
          return;
        }
        onTypeDefinitionsChange(
          typeDefinitions.map((definition) => (definition.name === name ? next : definition)),
        );
      },
      duplicateTypeDefinition: (name) => {
        if (!onTypeDefinitionsChange) {
          return;
        }
        const definition = typeDefinitions.find((candidate) => candidate.name === name);
        if (!definition) {
          return;
        }
        const nextName = createWorkflowEditorUniqueCatalogId(
          new Set(typeDefinitions.map((candidate) => candidate.name)),
          `${definition.name}Copy`,
        );
        onTypeDefinitionsChange([...typeDefinitions, { ...definition, name: nextName }]);
      },
      deleteTypeDefinition: (name) => {
        onTypeDefinitionsChange?.(typeDefinitions.filter((definition) => definition.name !== name));
      },
      createNodeTemplate: () => {
        if (!onNodeTemplatesChange) {
          return;
        }
        const ids = new Set(nodeTemplates.map((template) => template.id));
        const id = createWorkflowEditorUniqueCatalogId(ids, "template");
        onNodeTemplatesChange([...nodeTemplates, { id, label: "New node template" }]);
      },
      updateNodeTemplate: (id, next) => {
        if (
          !onNodeTemplatesChange ||
          !next.id.trim() ||
          !next.label.trim() ||
          nodeTemplates.some((template) => template.id !== id && template.id === next.id)
        ) {
          return;
        }
        onNodeTemplatesChange(
          nodeTemplates.map((template) => (template.id === id ? next : template)),
        );
      },
      duplicateNodeTemplate: (id) => {
        if (!onNodeTemplatesChange) {
          return;
        }
        const template = nodeTemplates.find((candidate) => candidate.id === id);
        if (!template) {
          return;
        }
        const nextId = createWorkflowEditorUniqueCatalogId(
          new Set(nodeTemplates.map((candidate) => candidate.id)),
          `${template.id}-copy`,
        );
        onNodeTemplatesChange([
          ...nodeTemplates,
          { ...template, id: nextId, label: `${template.label} Copy` },
        ]);
      },
      deleteNodeTemplate: (id) => {
        onNodeTemplatesChange?.(nodeTemplates.filter((template) => template.id !== id));
      },
    },
  };
}

export function WorkflowEditor<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
  TAppSettings extends Record<string, unknown> = Record<string, unknown>,
>({
  storageKey = defaultWorkflowEditorStorageKey,
  initialLibrary,
  storage,
  nodeTemplates = defaultWorkflowEditorNodeTemplates as ReadonlyArray<
    WorkflowWorkbenchPaletteItem<TTemplateData>
  >,
  onNodeTemplatesChange,
  readOnly: readOnlyProp,
  className,
  typeDefinitions,
  onTypeDefinitionsChange,
  maxVersions: maxVersionsProp,
  enableNestedWorkflows: enableNestedWorkflowsProp,
  maxNestedWorkflowDepth: maxNestedWorkflowDepthProp,
  compactControls: compactControlsProp,
  settings,
  settingsFields = [],
  onSettingsChange,
  layout = "default",
  chrome,
  showDocumentStats: showDocumentStatsProp,
  showDocumentPath: showDocumentPathProp,
  showWorkbenchStats: showWorkbenchStatsProp,
  onLibraryChange,
  onDocumentPathChange,
  onError,
  onSelectionChange,
  renderNodeTemplate,
  renderInspector,
  renderToolbarActions,
  renderCompactMenuActions,
  renderChrome,
}: WorkflowEditorProps<TNodeData, TEdgeData, TTemplateData, TAppSettings>) {
  const resolvedSettings = resolveWorkflowEditorSettings<TAppSettings>({
    compactControls: compactControlsProp,
    enableNestedWorkflows: enableNestedWorkflowsProp,
    maxNestedWorkflowDepth: maxNestedWorkflowDepthProp,
    maxVersions: maxVersionsProp,
    readOnly: readOnlyProp,
    settings,
    showDocumentPath: showDocumentPathProp,
    showDocumentStats: showDocumentStatsProp,
    showWorkbenchStats: showWorkbenchStatsProp,
  });
  const {
    compactControls,
    enableNestedWorkflows,
    maxNestedWorkflowDepth,
    maxVersions,
    readOnly,
    showDocumentPath,
    showDocumentStats,
    showWorkbenchStats,
  } = resolvedSettings.editor;
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

  const catalogController = createWorkflowEditorCatalogController<
    TNodeData,
    TEdgeData,
    TTemplateData,
    TAppSettings
  >({
    settings: resolvedSettings,
    settingsFields,
    typeDefinitions,
    nodeTemplates,
    onSettingsChange,
    onTypeDefinitionsChange,
    onNodeTemplatesChange,
  });

  const editorController = {
    activeDocument,
    activeEntry,
    catalog: catalogController,
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
    settings: resolvedSettings,
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
  } satisfies WorkflowEditorController<TNodeData, TEdgeData, TTemplateData, TAppSettings>;

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
  TAppSettings extends Record<string, unknown> = Record<string, unknown>,
> = WorkflowEditorProps<TNodeData, TEdgeData, TTemplateData, TAppSettings>;

export function useWorkflowEditorController<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
  TAppSettings extends Record<string, unknown> = Record<string, unknown>,
>({
  storageKey = defaultWorkflowEditorStorageKey,
  initialLibrary,
  storage,
  nodeTemplates = defaultWorkflowEditorNodeTemplates as ReadonlyArray<
    WorkflowWorkbenchPaletteItem<TTemplateData>
  >,
  onNodeTemplatesChange,
  readOnly: readOnlyProp,
  typeDefinitions,
  onTypeDefinitionsChange,
  maxVersions: maxVersionsProp,
  enableNestedWorkflows: enableNestedWorkflowsProp,
  maxNestedWorkflowDepth: maxNestedWorkflowDepthProp,
  showDocumentPath: showDocumentPathProp,
  showDocumentStats: showDocumentStatsProp,
  showWorkbenchStats: showWorkbenchStatsProp,
  compactControls: compactControlsProp,
  settings,
  settingsFields = [],
  onSettingsChange,
  onLibraryChange,
  onDocumentPathChange,
  onError,
  onSelectionChange,
  renderNodeTemplate,
  renderInspector,
  renderToolbarActions,
}: WorkflowEditorControllerProps<TNodeData, TEdgeData, TTemplateData, TAppSettings>) {
  const resolvedSettings = resolveWorkflowEditorSettings<TAppSettings>({
    compactControls: compactControlsProp,
    enableNestedWorkflows: enableNestedWorkflowsProp,
    maxNestedWorkflowDepth: maxNestedWorkflowDepthProp,
    maxVersions: maxVersionsProp,
    readOnly: readOnlyProp,
    settings,
    showDocumentPath: showDocumentPathProp,
    showDocumentStats: showDocumentStatsProp,
    showWorkbenchStats: showWorkbenchStatsProp,
  });
  const {
    compactControls,
    enableNestedWorkflows,
    maxNestedWorkflowDepth,
    maxVersions,
    readOnly,
    showWorkbenchStats,
  } = resolvedSettings.editor;
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

  const catalog = createWorkflowEditorCatalogController<
    TNodeData,
    TEdgeData,
    TTemplateData,
    TAppSettings
  >({
    settings: resolvedSettings,
    settingsFields,
    typeDefinitions,
    nodeTemplates,
    onSettingsChange,
    onTypeDefinitionsChange,
    onNodeTemplatesChange,
  });

  return {
    activeDocument,
    activeEntry,
    catalog,
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
    settings: resolvedSettings,
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
  } satisfies WorkflowEditorController<TNodeData, TEdgeData, TTemplateData, TAppSettings>;
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

export function WorkflowEditorSettingsPanel<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
  TAppSettings extends Record<string, unknown> = Record<string, unknown>,
>({
  controller,
}: {
  controller: WorkflowEditorController<TNodeData, TEdgeData, TTemplateData, TAppSettings>;
}) {
  return (
    <section className="grid gap-4 rounded-md border border-border bg-card p-3 text-sm">
      <WorkflowEditorBuiltInSettingsPanel controller={controller} />
      <WorkflowEditorAppSettingsPanel controller={controller} />
    </section>
  );
}

export function WorkflowEditorBuiltInSettingsPanel<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
  TAppSettings extends Record<string, unknown> = Record<string, unknown>,
>({
  controller,
}: {
  controller: WorkflowEditorController<TNodeData, TEdgeData, TTemplateData, TAppSettings>;
}) {
  const disabled = !controller.catalog.writable.settings;
  const editor = controller.catalog.settings.editor;

  return (
    <section className="grid gap-3" aria-label="Editor settings">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Editor settings</h2>
        {!controller.catalog.writable.settings ? <Badge variant="outline">Read only</Badge> : null}
      </div>
      <WorkflowEditorBooleanSetting
        label="Compact controls"
        checked={editor.compactControls}
        disabled={disabled}
        onChange={(value) =>
          controller.catalog.actions.updateBuiltInSetting("compactControls", value)
        }
      />
      <WorkflowEditorBooleanSetting
        label="Enable nested workflows"
        checked={editor.enableNestedWorkflows}
        disabled={disabled}
        onChange={(value) =>
          controller.catalog.actions.updateBuiltInSetting("enableNestedWorkflows", value)
        }
      />
      <WorkflowEditorNumberSetting
        label="Max nested workflow depth"
        value={editor.maxNestedWorkflowDepth}
        min={1}
        step={1}
        disabled={disabled}
        onChange={(value) =>
          controller.catalog.actions.updateBuiltInSetting("maxNestedWorkflowDepth", value)
        }
      />
      <WorkflowEditorNumberSetting
        label="Max versions"
        value={editor.maxVersions}
        min={1}
        step={1}
        disabled={disabled}
        onChange={(value) => controller.catalog.actions.updateBuiltInSetting("maxVersions", value)}
      />
      <WorkflowEditorBooleanSetting
        label="Read only"
        checked={editor.readOnly}
        disabled={disabled}
        onChange={(value) => controller.catalog.actions.updateBuiltInSetting("readOnly", value)}
      />
      <WorkflowEditorBooleanSetting
        label="Show document path"
        checked={editor.showDocumentPath}
        disabled={disabled}
        onChange={(value) =>
          controller.catalog.actions.updateBuiltInSetting("showDocumentPath", value)
        }
      />
      <WorkflowEditorBooleanSetting
        label="Show document stats"
        checked={editor.showDocumentStats}
        disabled={disabled}
        onChange={(value) =>
          controller.catalog.actions.updateBuiltInSetting("showDocumentStats", value)
        }
      />
      <WorkflowEditorBooleanSetting
        label="Show workbench stats"
        checked={editor.showWorkbenchStats}
        disabled={disabled}
        onChange={(value) =>
          controller.catalog.actions.updateBuiltInSetting("showWorkbenchStats", value)
        }
      />
    </section>
  );
}

export function WorkflowEditorAppSettingsPanel<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
  TAppSettings extends Record<string, unknown> = Record<string, unknown>,
>({
  controller,
}: {
  controller: WorkflowEditorController<TNodeData, TEdgeData, TTemplateData, TAppSettings>;
}) {
  if (controller.catalog.settingsFields.length === 0) {
    return null;
  }

  const disabled = !controller.catalog.writable.settings;
  const appSettings = controller.catalog.settings.app ?? ({} as TAppSettings);

  return (
    <section className="grid gap-3" aria-label="App settings">
      <h2 className="text-sm font-semibold">App settings</h2>
      {controller.catalog.settingsFields.map((field) => {
        const value = appSettings[field.key];
        return (
          <label key={field.key} className="grid gap-1.5">
            <span className="text-xs font-medium">{field.label}</span>
            {field.description ? (
              <span className="text-xs text-muted-foreground">{field.description}</span>
            ) : null}
            {field.kind === "boolean" ? (
              <input
                type="checkbox"
                className="size-4"
                checked={value === true}
                disabled={disabled}
                onChange={(event) =>
                  controller.catalog.actions.updateAppSetting(
                    field.key,
                    event.target.checked as TAppSettings[typeof field.key],
                  )
                }
              />
            ) : field.kind === "number" ? (
              <Input
                aria-label={field.label}
                type="number"
                value={typeof value === "number" ? value : 0}
                min={field.min}
                max={field.max}
                step={field.step}
                disabled={disabled}
                onChange={(event) =>
                  controller.catalog.actions.updateAppSetting(
                    field.key,
                    Number(event.target.value) as TAppSettings[typeof field.key],
                  )
                }
              />
            ) : field.kind === "select" ? (
              <select
                aria-label={field.label}
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={typeof value === "string" ? value : ""}
                disabled={disabled}
                onChange={(event) =>
                  controller.catalog.actions.updateAppSetting(
                    field.key,
                    event.target.value as TAppSettings[typeof field.key],
                  )
                }
              >
                {(field.options ?? []).map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : (
              <Input
                aria-label={field.label}
                value={typeof value === "string" ? value : ""}
                disabled={disabled}
                onChange={(event) =>
                  controller.catalog.actions.updateAppSetting(
                    field.key,
                    event.target.value as TAppSettings[typeof field.key],
                  )
                }
              />
            )}
          </label>
        );
      })}
    </section>
  );
}

export function WorkflowEditorTypesPanel<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
  TAppSettings extends Record<string, unknown> = Record<string, unknown>,
>({
  controller,
}: {
  controller: WorkflowEditorController<TNodeData, TEdgeData, TTemplateData, TAppSettings>;
}) {
  const [search, setSearch] = useState("");
  const [selectedName, setSelectedName] = useState<string | null>(
    controller.catalog.typeDefinitions[0]?.name ?? null,
  );
  const filtered = controller.catalog.typeDefinitions.filter((definition) =>
    definition.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const selected =
    controller.catalog.typeDefinitions.find((definition) => definition.name === selectedName) ??
    filtered[0] ??
    null;

  return (
    <section className="grid gap-3 rounded-md border border-border bg-card p-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Types</h2>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!controller.catalog.writable.typeDefinitions}
          onClick={controller.catalog.actions.createTypeDefinition}
        >
          Create
        </Button>
      </div>
      <SearchField
        value={search}
        onValueChange={setSearch}
        placeholder="Search types"
        clearLabel="Clear type search"
        inputProps={{ "aria-label": "Search types" }}
      />
      <div className="grid gap-2">
        {filtered.map((definition) => (
          <Button
            key={definition.name}
            type="button"
            size="sm"
            variant={definition.name === selected?.name ? "secondary" : "ghost"}
            className="justify-start"
            onClick={() => setSelectedName(definition.name)}
          >
            {definition.name}
          </Button>
        ))}
      </div>
      {selected ? (
        <WorkflowEditorTypeDefinitionForm
          key={selected.name}
          controller={controller}
          definition={selected}
        />
      ) : (
        <div className="rounded-md border border-dashed p-3 text-muted-foreground">No types</div>
      )}
    </section>
  );
}

export function WorkflowEditorNodeTemplatesPanel<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
  TAppSettings extends Record<string, unknown> = Record<string, unknown>,
>({
  controller,
}: {
  controller: WorkflowEditorController<TNodeData, TEdgeData, TTemplateData, TAppSettings>;
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(
    controller.catalog.nodeTemplates[0]?.id ?? null,
  );
  const categories = Array.from(
    new Set(controller.catalog.nodeTemplates.flatMap((template) => template.category ?? [])),
  ).filter(Boolean);
  const query = search.trim().toLowerCase();
  const filtered = controller.catalog.nodeTemplates.filter((template) => {
    const text = [
      template.id,
      template.label,
      template.kind,
      template.category,
      template.description,
    ]
      .filter((value): value is string => typeof value === "string")
      .join("\n")
      .toLowerCase();
    return (!query || text.includes(query)) && (!category || template.category === category);
  });
  const selected =
    controller.catalog.nodeTemplates.find((template) => template.id === selectedId) ??
    filtered[0] ??
    null;

  return (
    <section className="grid gap-3 rounded-md border border-border bg-card p-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Node templates</h2>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!controller.catalog.writable.nodeTemplates}
          onClick={controller.catalog.actions.createNodeTemplate}
        >
          Create
        </Button>
      </div>
      <SearchField
        value={search}
        onValueChange={setSearch}
        placeholder="Search templates"
        clearLabel="Clear template search"
        inputProps={{ "aria-label": "Search templates" }}
      />
      <select
        aria-label="Template category"
        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        value={category}
        onChange={(event) => setCategory(event.target.value)}
      >
        <option value="">All categories</option>
        {categories.map((candidate) => (
          <option key={candidate} value={candidate}>
            {candidate}
          </option>
        ))}
      </select>
      <div className="grid gap-2">
        {filtered.map((template) => (
          <Button
            key={template.id}
            type="button"
            size="sm"
            variant={template.id === selected?.id ? "secondary" : "ghost"}
            className="justify-start"
            onClick={() => setSelectedId(template.id)}
          >
            {template.label}
          </Button>
        ))}
      </div>
      {selected ? (
        <WorkflowEditorNodeTemplateForm
          key={selected.id}
          controller={controller}
          template={selected}
        />
      ) : (
        <div className="rounded-md border border-dashed p-3 text-muted-foreground">
          No node templates
        </div>
      )}
    </section>
  );
}

export function WorkflowEditorOverviewPanel<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
  TAppSettings extends Record<string, unknown> = Record<string, unknown>,
>({
  controller,
}: {
  controller: WorkflowEditorController<TNodeData, TEdgeData, TTemplateData, TAppSettings>;
}) {
  return (
    <section className="grid gap-4 rounded-md border border-border bg-card p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{controller.activeDocument.nodes.length} nodes</Badge>
        <Badge variant="outline">{controller.activeDocument.edges.length} edges</Badge>
        <Badge variant="outline">{controller.catalog.typeDefinitions.length} types</Badge>
        <Badge variant="outline">{controller.catalog.nodeTemplates.length} templates</Badge>
      </div>
      <WorkflowEditorSettingsPanel controller={controller} />
      <WorkflowEditorTypesPanel controller={controller} />
      <WorkflowEditorNodeTemplatesPanel controller={controller} />
      {controller.workbench ? (
        <>
          <WorkflowEditorCurrentNodesPanel controller={controller.workbench} />
          <WorkflowEditorCurrentNodeTypesPanel controller={controller.workbench} />
          <WorkflowEditorComposedNodesPanel controller={controller.workbench} />
        </>
      ) : null}
    </section>
  );
}

function WorkflowEditorBooleanSetting({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <input
        aria-label={label}
        type="checkbox"
        className="size-4"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

function WorkflowEditorNumberSetting({
  disabled,
  label,
  max,
  min,
  onChange,
  step,
  value,
}: {
  disabled?: boolean;
  label: string;
  max?: number;
  min?: number;
  onChange: (value: number) => void;
  step?: number;
  value: number;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium">{label}</span>
      <Input
        aria-label={label}
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function WorkflowEditorTypeDefinitionForm<
  TNodeData extends Record<string, unknown>,
  TEdgeData extends Record<string, unknown>,
  TTemplateData,
  TAppSettings extends Record<string, unknown>,
>({
  controller,
  definition,
}: {
  controller: WorkflowEditorController<TNodeData, TEdgeData, TTemplateData, TAppSettings>;
  definition: WorkflowEditorTypeDefinition;
}) {
  const [name, setName] = useState(definition.name);
  const [extendsDraft, setExtendsDraft] = useState((definition.extends ?? []).join(", "));
  const [typeDraft, setTypeDraft] = useState(formatWorkflowEditorJsonDraft(definition.type));
  const [error, setError] = useState("");
  const disabled = !controller.catalog.writable.typeDefinitions;

  const commit = () => {
    const parsed = parseWorkflowEditorJsonDraft(typeDraft, "type");
    if (!parsed.ok) {
      setError(parsed.message);
      return;
    }
    const next: WorkflowEditorTypeDefinition = {
      name: name.trim(),
      type: parsed.value as WorkflowEditorTypeDefinition["type"],
      ...(extendsDraft.trim()
        ? {
            extends: extendsDraft
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean),
          }
        : {}),
    };
    const validation = validateWorkflowEditorTypeDefinitionDraft(
      controller.catalog.typeDefinitions,
      definition.name,
      next,
    );
    if (validation) {
      setError(validation);
      return;
    }
    setError("");
    controller.catalog.actions.updateTypeDefinition(definition.name, next);
  };

  return (
    <div className="grid gap-3 rounded-md border border-border p-3">
      <Input
        aria-label="Type name"
        value={name}
        disabled={disabled}
        onChange={(event) => setName(event.target.value)}
      />
      <Input
        aria-label="Extended types"
        value={extendsDraft}
        disabled={disabled}
        placeholder="BaseType, OtherType"
        onChange={(event) => setExtendsDraft(event.target.value)}
      />
      <Textarea
        aria-label="Type JSON"
        className="min-h-32 font-mono text-xs"
        value={typeDraft}
        disabled={disabled}
        onChange={(event) => setTypeDraft(event.target.value)}
      />
      {error ? <div className="text-xs text-destructive">{error}</div> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={commit}>
          Save
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => controller.catalog.actions.duplicateTypeDefinition(definition.name)}
        >
          Duplicate
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => controller.catalog.actions.deleteTypeDefinition(definition.name)}
        >
          Delete
        </Button>
      </div>
    </div>
  );
}

function WorkflowEditorNodeTemplateForm<
  TNodeData extends Record<string, unknown>,
  TEdgeData extends Record<string, unknown>,
  TTemplateData,
  TAppSettings extends Record<string, unknown>,
>({
  controller,
  template,
}: {
  controller: WorkflowEditorController<TNodeData, TEdgeData, TTemplateData, TAppSettings>;
  template: WorkflowEditorNodeTemplate<TTemplateData>;
}) {
  const [id, setId] = useState(template.id);
  const [label, setLabel] = useState(template.label);
  const [kind, setKind] = useState(template.kind ?? "");
  const [category, setCategory] = useState(template.category ?? "");
  const [description, setDescription] = useState(template.description ?? "");
  const [tags, setTags] = useState((template.tags ?? []).join(", "));
  const [minimized, setMinimized] = useState(template.minimized === true);
  const [inputsDraft, setInputsDraft] = useState(
    formatWorkflowEditorJsonDraft(template.inputs ?? []),
  );
  const [outputsDraft, setOutputsDraft] = useState(
    formatWorkflowEditorJsonDraft(template.outputs ?? []),
  );
  const [dataDraft, setDataDraft] = useState(formatWorkflowEditorJsonDraft(template.data ?? null));
  const [compositionDraft, setCompositionDraft] = useState(
    formatWorkflowEditorJsonDraft(template.composition ?? null),
  );
  const [error, setError] = useState("");
  const disabled = !controller.catalog.writable.nodeTemplates;

  const commit = () => {
    const inputs = parseWorkflowEditorJsonDraft(inputsDraft, "inputs");
    const outputs = parseWorkflowEditorJsonDraft(outputsDraft, "outputs");
    const data = parseWorkflowEditorJsonDraft(dataDraft, "data");
    const composition = parseWorkflowEditorJsonDraft(compositionDraft, "composition");
    const invalid = [inputs, outputs, data, composition].find((result) => !result.ok);
    if (invalid && !invalid.ok) {
      setError(invalid.message);
      return;
    }
    if (!inputs.ok || !outputs.ok || !data.ok || !composition.ok) {
      return;
    }
    const next: WorkflowEditorNodeTemplate<TTemplateData> = {
      ...template,
      id: id.trim(),
      label: label.trim(),
      ...(kind.trim() ? { kind: kind.trim() } : { kind: undefined }),
      ...(category.trim() ? { category: category.trim() } : { category: undefined }),
      ...(description.trim() ? { description: description.trim() } : { description: undefined }),
      ...(tags.trim()
        ? {
            tags: tags
              .split(",")
              .map((value) => value.trim())
              .filter(Boolean),
          }
        : { tags: undefined }),
      minimized,
      inputs: inputs.value as WorkflowEditorNodeTemplate<TTemplateData>["inputs"],
      outputs: outputs.value as WorkflowEditorNodeTemplate<TTemplateData>["outputs"],
      data: data.value === null ? undefined : (data.value as TTemplateData),
      composition:
        composition.value === null
          ? undefined
          : (composition.value as WorkflowEditorNodeTemplate<TTemplateData>["composition"]),
    };
    const validation = validateWorkflowEditorNodeTemplateDraft(
      controller.catalog.nodeTemplates,
      controller.catalog.typeDefinitions,
      template.id,
      next,
    );
    if (validation) {
      setError(validation);
      return;
    }
    setError("");
    controller.catalog.actions.updateNodeTemplate(template.id, next);
  };

  return (
    <div className="grid gap-3 rounded-md border border-border p-3">
      <Input
        aria-label="Template id"
        value={id}
        disabled={disabled}
        onChange={(event) => setId(event.target.value)}
      />
      <Input
        aria-label="Template label"
        value={label}
        disabled={disabled}
        onChange={(event) => setLabel(event.target.value)}
      />
      <Input
        aria-label="Template kind"
        value={kind}
        disabled={disabled}
        onChange={(event) => setKind(event.target.value)}
      />
      <Input
        aria-label="Template category"
        value={category}
        disabled={disabled}
        onChange={(event) => setCategory(event.target.value)}
      />
      <Input
        aria-label="Template description"
        value={description}
        disabled={disabled}
        onChange={(event) => setDescription(event.target.value)}
      />
      <Input
        aria-label="Template tags"
        value={tags}
        disabled={disabled}
        onChange={(event) => setTags(event.target.value)}
      />
      <WorkflowEditorBooleanSetting
        label="Template minimized"
        checked={minimized}
        disabled={disabled}
        onChange={setMinimized}
      />
      <WorkflowEditorJsonDraftArea
        label="Template inputs JSON"
        value={inputsDraft}
        disabled={disabled}
        onChange={setInputsDraft}
      />
      <WorkflowEditorJsonDraftArea
        label="Template outputs JSON"
        value={outputsDraft}
        disabled={disabled}
        onChange={setOutputsDraft}
      />
      <WorkflowEditorJsonDraftArea
        label="Template data JSON"
        value={dataDraft}
        disabled={disabled}
        onChange={setDataDraft}
      />
      <WorkflowEditorJsonDraftArea
        label="Template composition JSON"
        value={compositionDraft}
        disabled={disabled}
        onChange={setCompositionDraft}
      />
      {error ? <div className="text-xs text-destructive">{error}</div> : null}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={commit}>
          Save
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => controller.catalog.actions.duplicateNodeTemplate(template.id)}
        >
          Duplicate
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => controller.catalog.actions.deleteNodeTemplate(template.id)}
        >
          Delete
        </Button>
        {controller.workbench ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={controller.workbench.readOnly}
            onClick={() => controller.workbench?.actions.addTemplateNode(template)}
          >
            Add to document
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function WorkflowEditorJsonDraftArea({
  disabled,
  label,
  onChange,
  value,
}: {
  disabled?: boolean;
  label: string;
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-medium">{label}</span>
      <Textarea
        aria-label={label}
        className="min-h-24 font-mono text-xs"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
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

function createWorkflowEditorUniqueCatalogId(existing: ReadonlySet<string>, base: string) {
  const cleanBase =
    base
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9._-]+/g, "") || "item";
  if (!existing.has(cleanBase)) {
    return cleanBase;
  }

  for (let index = 2; index < 10000; index += 1) {
    const candidate = `${cleanBase}-${index}`;
    if (!existing.has(candidate)) {
      return candidate;
    }
  }

  return `${cleanBase}-${Date.now()}`;
}

function formatWorkflowEditorJsonDraft(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function parseWorkflowEditorJsonDraft(
  value: string,
  label: string,
): { ok: true; value: unknown } | { ok: false; message: string } {
  try {
    return { ok: true, value: JSON.parse(value) };
  } catch (error) {
    return {
      ok: false,
      message: `Invalid JSON in ${label}: ${
        error instanceof Error ? error.message : "Unable to parse value"
      }`,
    };
  }
}

function validateWorkflowEditorTypeDefinitionDraft(
  definitions: readonly WorkflowEditorTypeDefinition[],
  originalName: string,
  next: WorkflowEditorTypeDefinition,
) {
  if (!next.name) {
    return "Type name is required";
  }

  if (
    definitions.some(
      (definition) => definition.name !== originalName && definition.name === next.name,
    )
  ) {
    return `Duplicate type name: ${next.name}`;
  }

  const availableNames = new Set(definitions.map((definition) => definition.name));
  for (const extendedName of next.extends ?? []) {
    if (!availableNames.has(extendedName)) {
      return `Missing extended type: ${extendedName}`;
    }
  }

  return "";
}

function validateWorkflowEditorNodeTemplateDraft<TTemplateData>(
  templates: readonly WorkflowEditorNodeTemplate<TTemplateData>[],
  typeDefinitions: readonly WorkflowEditorTypeDefinition[],
  originalId: string,
  next: WorkflowEditorNodeTemplate<TTemplateData>,
) {
  if (!next.id) {
    return "Template id is required";
  }

  if (!next.label) {
    return "Template label is required";
  }

  if (templates.some((template) => template.id !== originalId && template.id === next.id)) {
    return `Duplicate template id: ${next.id}`;
  }

  const diagnostics = analyzeWorkflowEditorPortTypes(
    { nodes: [{ ...next, x: 0, y: 0 }], edges: [] },
    { typeDefinitions },
  );
  return diagnostics[0]?.message ?? "";
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
