import type { ReactNode, RefObject } from "react";
import type { GraphWorkbenchController } from "@moritzbrantner/graph-editor/react";

import type {
  WorkflowEditorDocument,
  WorkflowEditorEdge,
  WorkflowEditorGroup,
  WorkflowEditorIterationBoundaries,
  WorkflowEditorIterationDiagnostic,
  WorkflowEditorNode,
  WorkflowEditorNodeTemplate,
  WorkflowEditorNodeTemplateRegistry,
  WorkflowEditorPortType,
  WorkflowEditorSelection,
  WorkflowEditorSelectionState,
  WorkflowEditorTypeDefinition,
  WorkflowEditorViewport,
} from "../core";
import type { WorkflowExecutionNodeSnapshot, WorkflowExecutionSnapshot } from "../core-execution";
import type { WorkflowEditorInspectorFieldDefinition } from "../core-inspector-fields";
import type { WorkflowEditorDocumentReferenceOption } from "../persistence";
import type { WorkflowWorkbenchHumanTasks } from "./human-task-panel";
import type { WorkflowWorkbenchInputProfiles } from "./inputs-panel";
import type { WorkflowWorkbenchInspectorFieldRenderers } from "./inspector-field-sections";
import type {
  WorkflowWorkbenchOverlayPosition,
  WorkflowWorkbenchPanelBehavior,
  WorkflowWorkbenchPanelPlacement,
  WorkflowWorkbenchPanelState,
} from "./overlay-position";
import type {
  WorkflowWorkbenchPaletteCategoryGroup,
  WorkflowWorkbenchPaletteItem,
} from "./palette-model";
import type { WorkflowWorkbenchSharedTemplates } from "./shared-template-panel";
import type { WorkflowWorkbenchTriggerActivation } from "./triggers-panel";

export type WorkflowWorkbenchSelection<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
> = WorkflowEditorSelection<TNodeData, TEdgeData>;

export type WorkflowWorkbenchExecutionContext<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
> = {
  execution: WorkflowExecutionSnapshot;
  node: WorkflowEditorNode<TNodeData>;
  snapshot?: WorkflowExecutionNodeSnapshot;
};

/**
 * The canvas shows an iteration body (#94, Decision Atlas 5.25). Its boundaries are edited in the
 * document settings, shown when nothing is selected.
 */
export type WorkflowWorkbenchIterationBody = {
  /** The iteration node whose body is shown, as stored in the parent document. */
  node: WorkflowEditorNode<Record<string, unknown>>;
  /** Iteration diagnostics for the node, shown while its body is edited. */
  diagnostics: readonly WorkflowEditorIterationDiagnostic[];
  onBoundariesChange?: (boundaries: Partial<WorkflowEditorIterationBoundaries>) => void;
};

export type WorkflowWorkbenchInspectorContext<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
> = {
  document: WorkflowEditorDocument<TNodeData, TEdgeData>;
  /** The host-supplied execution snapshot, when one is shown. */
  execution?: WorkflowExecutionSnapshot;
  documentReferences?: WorkflowEditorDocumentReferenceOption[];
  readOnly: boolean;
  selection: WorkflowEditorSelectionState;
  selectedEdges: Array<WorkflowEditorEdge<TEdgeData>>;
  selectedNodes: Array<WorkflowEditorNode<TNodeData>>;
  selectedEdge?: WorkflowEditorEdge<TEdgeData>;
  selectedNode?: WorkflowEditorNode<TNodeData>;
  openSelectedNodeWorkflow?: () => void;
  createSelectedNodeWorkflow?: () => void;
  /** Opens the selected iteration node's body in its own view (#94). */
  openSelectedIterationBody?: () => void;
  /** Set when the canvas shows an iteration body rather than a whole document (#94). */
  iterationBody?: WorkflowWorkbenchIterationBody;
  updateDocument?: (document: WorkflowEditorDocument<TNodeData, TEdgeData>) => void;
  updateSelectedNode: (patch: Partial<WorkflowEditorNode<TNodeData>>) => void;
  updateSelectedEdge: (patch: Partial<WorkflowEditorEdge<TEdgeData>>) => void;
  updateSelectedNodeWorkflowReference: (documentId: string | null) => void;
  /** Host connection that can activate the document's triggers (#91). */
  triggerActivation?: WorkflowWorkbenchTriggerActivation;
  /** Named input profiles for the document (#115). */
  inputProfiles?: WorkflowWorkbenchInputProfiles;
  /** Linked shared templates (#65): the host catalog and its publish channel. */
  sharedTemplates?: WorkflowWorkbenchSharedTemplates & {
    templates: readonly WorkflowEditorNodeTemplate<TNodeData>[];
  };
  typeDefinitions?: readonly WorkflowEditorTypeDefinition[];
  /** Schema-driven data fields for a node, from the template whose `kind` matches the node. */
  inspectorFields?: (
    node: WorkflowEditorNode<TNodeData>,
  ) => readonly WorkflowEditorInspectorFieldDefinition[];
  inspectorFieldRenderers?: WorkflowWorkbenchInspectorFieldRenderers;
};

export type WorkflowWorkbenchController<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
> = {
  graph: GraphWorkbenchController<TNodeData, TEdgeData, WorkflowEditorPortType>;
  document: WorkflowEditorDocument<TNodeData, TEdgeData>;
  readOnly: boolean;
  selection: WorkflowEditorSelectionState;
  selectedEdge?: WorkflowEditorEdge<TEdgeData>;
  selectedEdges: Array<WorkflowEditorEdge<TEdgeData>>;
  selectedGroup?: WorkflowEditorGroup;
  selectedGroups: Array<WorkflowEditorGroup>;
  selectedNode?: WorkflowEditorNode<TNodeData>;
  selectedNodes: Array<WorkflowEditorNode<TNodeData>>;
  workflow: {
    typeDefinitions?: readonly WorkflowEditorTypeDefinition[];
    documentReferences?: WorkflowEditorDocumentReferenceOption[];
    openSelectedNodeWorkflow?: () => void;
    createSelectedNodeWorkflow?: () => void;
  };
  palette: {
    groups: Array<WorkflowWorkbenchPaletteCategoryGroup<TTemplateData>>;
    items: ReadonlyArray<WorkflowWorkbenchPaletteItem<TTemplateData>>;
    /** Validation and lookups for `items`; invalid templates render disabled. */
    registry: WorkflowEditorNodeTemplateRegistry<TTemplateData>;
    filteredItems: ReadonlyArray<WorkflowWorkbenchPaletteItem<TTemplateData>>;
    minimized: boolean;
    placement: WorkflowWorkbenchPanelPlacement;
    position: WorkflowWorkbenchOverlayPosition;
    searchValue: string;
    setMinimized: (minimized: boolean) => void;
    setPlacement: (placement: WorkflowWorkbenchPanelPlacement) => void;
    setPosition: (position: WorkflowWorkbenchOverlayPosition) => void;
    setSearchValue: (value: string) => void;
  };
  inspector: {
    context: WorkflowWorkbenchInspectorContext<TNodeData, TEdgeData>;
    collapsed: boolean;
    minimized: boolean;
    position: WorkflowWorkbenchOverlayPosition;
    setMinimized: (minimized: boolean) => void;
    setPosition: (position: WorkflowWorkbenchOverlayPosition) => void;
  };
  toolbar: {
    showGraphStats: boolean;
    showShortcutHint: boolean;
  };
  canvas: {
    containerRef: RefObject<HTMLDivElement | null>;
  };
  overlays: {
    palette: WorkflowWorkbenchPanelState;
    inspector: WorkflowWorkbenchPanelState;
  };
  configuration: Pick<
    WorkflowWorkbenchProps<TNodeData, TEdgeData, TTemplateData>,
    | "documentReferences"
    | "portTypeColors"
    | "nodeTemplates"
    | "onCreateWorkflowReference"
    | "onOpenWorkflowReference"
    | "onSelectionChange"
    | "onSelectionStateChange"
    | "onViewportChange"
    | "renderInspector"
    | "renderNodeTemplate"
    | "renderToolbarActions"
    | "typeDefinitions"
  >;
  actions: {
    addTemplateNode: (
      template: WorkflowWorkbenchPaletteItem<TTemplateData>,
      position?: WorkflowEditorPoint,
    ) => void;
    arrangeAll: () => void;
    arrangeSelection: () => void;
    copySelection: () => void;
    createSelectedNodeWorkflow: () => void;
    deleteSelection: () => void;
    duplicateSelection: () => void;
    groupSelection: () => void;
    /** Wraps the selected nodes into one composed node (#18). */
    composeSelection: () => void;
    /** Restores a composed node's embedded nodes in place (#18); defaults to the primary node. */
    restoreComposition: (nodeId?: string) => void;
    openSelectedNodeWorkflow: () => void;
    pasteSelection: () => Promise<void>;
    renameSelectedGroup: (label: string) => void;
    setSelection: (selection: WorkflowEditorSelectionState) => void;
    toggleSelectedGroupMinimized: () => void;
    ungroupSelection: () => void;
    updateSelectedGroup: (patch: Partial<WorkflowEditorGroup>) => void;
    updateDocument: (document: WorkflowEditorDocument<TNodeData, TEdgeData>) => void;
    updateSelectedEdge: (patch: Partial<WorkflowEditorEdge<TEdgeData>>) => void;
    updateSelectedNode: (patch: Partial<WorkflowEditorNode<TNodeData>>) => void;
    updateSelectedNodeWorkflowReference: (documentId: string | null) => void;
  };
};

export type WorkflowGraphWorkbenchController<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
  TPortType = WorkflowEditorPortType,
> = GraphWorkbenchController<TNodeData, TEdgeData, TPortType>;

export type WorkflowWorkbenchChromeRenderer<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
> = (controller: WorkflowWorkbenchController<TNodeData, TEdgeData, TTemplateData>) => ReactNode;

export type WorkflowWorkbenchChrome<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
> = {
  toolbar?:
    | "default"
    | "hidden"
    | WorkflowWorkbenchChromeRenderer<TNodeData, TEdgeData, TTemplateData>;
  palette?:
    | "overlay"
    | "hidden"
    | WorkflowWorkbenchChromeRenderer<TNodeData, TEdgeData, TTemplateData>;
  inspector?:
    | "overlay"
    | "hidden"
    | WorkflowWorkbenchChromeRenderer<TNodeData, TEdgeData, TTemplateData>;
  nodeControls?: "default" | "hidden";
};

export type WorkflowWorkbenchProps<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
> = {
  document: WorkflowEditorDocument<TNodeData, TEdgeData>;
  selectedNodeId?: string | null;
  selectedEdgeId?: string | null;
  selectedNodeIds?: readonly string[] | null;
  selectedEdgeIds?: readonly string[] | null;
  selectedGroupIds?: readonly string[] | null;
  readOnly?: boolean;
  nodeTemplates?: ReadonlyArray<WorkflowWorkbenchPaletteItem<TTemplateData>>;
  /** Host connection that registers and activates the document's triggers (#91). */
  triggerActivation?: WorkflowWorkbenchTriggerActivation;
  /** Named input profiles and an optional run seam for the document's inputs (#115). */
  inputProfiles?: WorkflowWorkbenchInputProfiles;
  /** Pending human tasks of connected runs and the host's answer channel (#105). */
  humanTasks?: WorkflowWorkbenchHumanTasks;
  /** Publish channel and instance list for linked shared templates (#65). */
  sharedTemplates?: WorkflowWorkbenchSharedTemplates;
  /** Host renderers that replace built-in inspector field kinds or individual fields. */
  inspectorFieldRenderers?: WorkflowWorkbenchInspectorFieldRenderers;
  typeDefinitions?: readonly WorkflowEditorTypeDefinition[];
  documentReferences?: WorkflowEditorDocumentReferenceOption[];
  portTypeColors?: Readonly<Record<string, string>>;
  className?: string;
  layout?: "default" | "unstyled";
  chrome?: WorkflowWorkbenchChrome<TNodeData, TEdgeData, TTemplateData>;
  overlayBehavior?: {
    palette?: WorkflowWorkbenchPanelBehavior;
    inspector?: WorkflowWorkbenchPanelBehavior;
  };
  showGraphStats?: boolean;
  showShortcutHint?: boolean;
  onDocumentChange?: (document: WorkflowEditorDocument<TNodeData, TEdgeData>) => void;
  onSelectionChange?: (selection: WorkflowWorkbenchSelection<TNodeData, TEdgeData>) => void;
  onSelectionStateChange?: (selection: WorkflowEditorSelectionState) => void;
  onViewportChange?: (viewport: WorkflowEditorViewport) => void;
  onOpenWorkflowReference?: (node: WorkflowEditorNode<TNodeData>) => void;
  /** Opens an iteration node's body in its own view (#94). */
  onOpenIterationBody?: (node: WorkflowEditorNode<TNodeData>) => void;
  /** Set when `document` is an iteration body; its boundaries appear in document settings. */
  iterationBody?: WorkflowWorkbenchIterationBody;
  onCreateWorkflowReference?: (node: WorkflowEditorNode<TNodeData>) => void;
  /**
   * Host-supplied run state shown over the canvas. It is a controlled, transient input: it never
   * enters the document, history, saved versions or dirty tracking. Pass `null` to clear it.
   */
  execution?: WorkflowExecutionSnapshot | null;
  /** Custom status text for a node's execution state (defaults to the state label). */
  formatExecutionLabel?: (
    snapshot: WorkflowExecutionNodeSnapshot,
    node: WorkflowEditorNode<TNodeData>,
  ) => string;
  /** Host content for the selected node's execution details, such as inspect/retry/cancel actions. */
  renderExecutionDetails?: (context: WorkflowWorkbenchExecutionContext<TNodeData>) => ReactNode;
  /**
   * Host-owned document history. When provided, undo/redo commands and their keyboard shortcuts
   * use it instead of the workbench's internal operation history.
   */
  history?: WorkflowWorkbenchHistoryControls;
  renderNodeTemplate?: (template: WorkflowWorkbenchPaletteItem<TTemplateData>) => ReactNode;
  renderInspector?: (context: WorkflowWorkbenchInspectorContext<TNodeData, TEdgeData>) => ReactNode;
  renderToolbarActions?: (
    context: WorkflowWorkbenchInspectorContext<TNodeData, TEdgeData>,
  ) => ReactNode;
};

/** Undo/redo controls supplied by a host that owns the document history. */
export type WorkflowWorkbenchHistoryControls = {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
};

export type WorkflowWorkbenchControllerProps<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
> = WorkflowWorkbenchProps<TNodeData, TEdgeData, TTemplateData>;

export type WorkflowEditorPoint = {
  x: number;
  y: number;
};
