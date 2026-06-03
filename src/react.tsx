"use client";

import {
  type DragEvent as ReactDragEvent,
  type Dispatch,
  type KeyboardEvent as ReactKeyboardEvent,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type CSSProperties,
  type RefObject,
  type ReactNode,
  type SetStateAction,
  type SyntheticEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Maximize2Icon,
  Minimize2Icon,
  MoreHorizontalIcon,
  PinIcon,
  Trash2Icon,
} from "lucide-react";

import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  Input,
  SearchField,
  Textarea,
  Toggle,
  cn,
} from "@moritzbrantner/ui";
import { createPortal } from "react-dom";
import {
  WorkflowBuilder,
  type WorkflowBuilderConnectionValidity,
  type WorkflowBuilderSelection,
} from "./react/workflow-builder";
import { WorkflowNode } from "./react/workflow-node";
import {
  InspectorPanel,
  type InspectorFieldDefinition,
  type InspectorFieldValue,
} from "./react/inspector-panel";
import {
  createWorkflowWorkbenchPaletteCategoryGroups,
  filterWorkflowWorkbenchPaletteTemplates,
  type WorkflowWorkbenchPaletteCategoryGroup,
  type WorkflowWorkbenchPaletteItem,
} from "./react/palette-model";
import {
  clampWorkflowOverlayPosition,
  getWorkflowOverlayMaxHeight,
  getWorkflowPalettePinnedStyle,
  workflowWorkbenchOverlayMargin,
  type WorkflowWorkbenchOverlayPosition,
  type WorkflowWorkbenchPanelBehavior,
  type WorkflowWorkbenchPanelPlacement,
  type WorkflowWorkbenchPanelState,
} from "./react/overlay-position";

import {
  addWorkflowEditorArrayConstructorInputToNode,
  addWorkflowEditorObjectDecompositionOutputToNode,
  addWorkflowEditorObjectConstructorInputToNode,
  connectWorkflowEditorNodes,
  copyWorkflowEditorSelection,
  createWorkflowEditorGroup,
  createWorkflowEditorDocumentContext,
  createWorkflowEditorGraphIndex,
  defaultWorkflowEditorNodeTemplates,
  duplicateWorkflowEditorNode,
  duplicateWorkflowEditorSelection,
  formatWorkflowEditorArrayConstructorExpression,
  formatWorkflowEditorObjectDecompositionExpression,
  formatWorkflowEditorObjectConstructorExpression,
  fromUiWorkflowBuilderEdges,
  fromUiWorkflowBuilderNodes,
  getWorkflowEditorArrayConstructorInputs,
  getWorkflowEditorNodeGroupId,
  getWorkflowEditorObjectDecompositionOutputs,
  getWorkflowEditorObjectConstructorInputs,
  isWorkflowEditorArrayConstructorNode,
  isWorkflowEditorObjectDecompositionNode,
  isWorkflowEditorObjectConstructorNode,
  normalizeWorkflowEditorDocument,
  normalizeWorkflowEditorSelection,
  pasteWorkflowEditorClipboardPayload,
  moveWorkflowEditorGroup,
  removeWorkflowEditorArrayConstructorInput,
  removeWorkflowEditorNode,
  removeWorkflowEditorObjectDecompositionOutput,
  removeWorkflowEditorObjectConstructorInput,
  removeWorkflowEditorSelection,
  restoreWorkflowEditorComposedNode,
  toUiWorkflowBuilderEdges,
  toUiWorkflowBuilderNodes,
  ungroupWorkflowEditorGroup,
  updateWorkflowEditorGroup,
  updateWorkflowEditorNode,
  updateWorkflowEditorObjectDecompositionPropertiesInNode,
  updateWorkflowEditorObjectConstructorExpression,
  updateWorkflowEditorObjectConstructorPropertiesInNode,
  updateWorkflowEditorNodeWorkflowReference,
  validateWorkflowEditorConnection,
  validateWorkflowEditorObjectConstructorExpression,
  type WorkflowEditorConnectionInput,
  type WorkflowEditorDocument,
  type WorkflowEditorEdge,
  type WorkflowEditorGroup,
  type WorkflowEditorNode,
  type WorkflowEditorSelection,
  type WorkflowEditorSelectionState,
  type WorkflowEditorTypeDefinition,
  type WorkflowEditorViewport,
} from "./core";
import { layoutWorkflowEditorDocument } from "./core-layout";
import type { WorkflowEditorDocumentReferenceOption } from "./persistence";
import {
  selectionStateToSingleSelection,
  toggleWorkflowEditorSelectionItem,
} from "./react-selection";
import {
  getWorkflowEditorObjectConstructorOutputPanelHeight,
  getWorkflowEditorObjectConstructorRenderedWidth,
  getWorkflowEditorObjectConstructorTextAreaHeight,
  getWorkflowEditorPortCenterOffset,
  getWorkflowEditorRenderedNodeSize,
  snapWorkflowEditorNodePositionToCompatiblePort,
  snapWorkflowEditorNodeToCompatiblePort,
} from "./react-snap";
import { getWorkflowEditorMinimizedNodeWidth } from "./core-rendered-node-size";
import { formatShortcutLabel } from "./shortcut-label";

export {
  createWorkflowWorkbenchPaletteCategoryGroups,
  filterWorkflowWorkbenchPaletteTemplates,
  getWorkflowWorkbenchPaletteCategoryPath,
  getWorkflowWorkbenchPaletteTemplateSearchText,
} from "./react/palette-model";
export type {
  WorkflowWorkbenchPaletteCategoryGroup,
  WorkflowWorkbenchPaletteItem,
} from "./react/palette-model";
export {
  clampWorkflowOverlayPosition,
  getWorkflowOverlayMaxHeight,
  getWorkflowPalettePinnedStyle,
  workflowWorkbenchOverlayMargin,
} from "./react/overlay-position";
export type {
  WorkflowWorkbenchOverlayPosition,
  WorkflowWorkbenchPanelBehavior,
  WorkflowWorkbenchPanelPlacement,
  WorkflowWorkbenchPanelState,
} from "./react/overlay-position";

const emptyWorkflowEditorSelection: WorkflowEditorSelectionState = {
  nodeIds: [],
  edgeIds: [],
};
const workflowWorkbenchOverlayInteractionSelector =
  "[data-slot='workflow-palette-overlay'], [data-slot='workflow-inspector-overlay'], [data-slot='workflow-node-rename-control'], [data-slot='workflow-json-primitive-node-control'], [data-slot='workflow-object-constructor-node-control'], [data-slot='select-content'], [data-slot='dropdown-menu-content']";
const workflowWorkbenchOverlaySelectionPreservationMs = 1500;

const workflowEditorPaletteDragType = "application/x-workflow-editor-node-template";
const workflowEditorPaletteMargin = workflowWorkbenchOverlayMargin;
const workflowEditorPanActivationDistance = 3;
const workflowEditorMinZoom = 0.5;
const workflowEditorMaxZoom = 1.75;
let workflowEditorMemoryClipboard: string | null = null;
const workflowNodeControlFrameClassName = "pointer-events-auto absolute z-20";
const workflowNodeTextControlClassName =
  "border-zinc-300 bg-white/95 text-[11px] font-medium text-zinc-950 shadow-sm [--ui-input-height:1.5rem] [--ui-input-padding-x:0.5rem] [--ui-input-radius:0.25rem] focus-visible:ring-zinc-950/35 disabled:opacity-70";
const workflowNodeTextareaControlClassName =
  "resize-none rounded border-zinc-300 bg-white/95 px-2 py-1.5 font-mono text-[11px] leading-4 text-zinc-950 shadow-sm focus-visible:ring-zinc-950/35 disabled:bg-white/95 disabled:opacity-70";
const workflowNodeToggleGroupControlClassName =
  "h-6 w-full overflow-hidden rounded border border-zinc-300 bg-white/95 p-0 shadow-sm";
const workflowNodeToggleItemClassName =
  "h-full min-w-0 flex-1 rounded-none border-0 px-2 text-[11px] font-semibold uppercase text-zinc-700 shadow-none data-[state=on]:bg-zinc-950 data-[state=on]:text-white";
const workflowJsonPrimitiveNodeControlHeight = 24;

export type WorkflowWorkbenchSelection<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
> = WorkflowEditorSelection<TNodeData, TEdgeData>;

export type WorkflowWorkbenchInspectorContext<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
> = {
  document: WorkflowEditorDocument<TNodeData, TEdgeData>;
  documentReferences?: WorkflowEditorDocumentReferenceOption[];
  readOnly: boolean;
  selection: WorkflowEditorSelectionState;
  selectedEdges: Array<WorkflowEditorEdge<TEdgeData>>;
  selectedNodes: Array<WorkflowEditorNode<TNodeData>>;
  selectedEdge?: WorkflowEditorEdge<TEdgeData>;
  selectedNode?: WorkflowEditorNode<TNodeData>;
  openSelectedNodeWorkflow?: () => void;
  createSelectedNodeWorkflow?: () => void;
  updateDocument?: (document: WorkflowEditorDocument<TNodeData, TEdgeData>) => void;
  updateSelectedNode: (patch: Partial<WorkflowEditorNode<TNodeData>>) => void;
  updateSelectedEdge: (patch: Partial<WorkflowEditorEdge<TEdgeData>>) => void;
  updateSelectedNodeWorkflowReference: (documentId: string | null) => void;
};

export type WorkflowWorkbenchController<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
> = {
  document: WorkflowEditorDocument<TNodeData, TEdgeData>;
  readOnly: boolean;
  selection: WorkflowEditorSelectionState;
  selectedEdge?: WorkflowEditorEdge<TEdgeData>;
  selectedEdges: Array<WorkflowEditorEdge<TEdgeData>>;
  selectedGroup?: WorkflowEditorGroup;
  selectedGroups: Array<WorkflowEditorGroup>;
  selectedNode?: WorkflowEditorNode<TNodeData>;
  selectedNodes: Array<WorkflowEditorNode<TNodeData>>;
  palette: {
    groups: Array<WorkflowWorkbenchPaletteCategoryGroup<TTemplateData>>;
    items: ReadonlyArray<WorkflowWorkbenchPaletteItem<TTemplateData>>;
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
  typeDefinitions?: readonly WorkflowEditorTypeDefinition[];
  documentReferences?: WorkflowEditorDocumentReferenceOption[];
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
  onCreateWorkflowReference?: (node: WorkflowEditorNode<TNodeData>) => void;
  renderNodeTemplate?: (template: WorkflowWorkbenchPaletteItem<TTemplateData>) => ReactNode;
  renderInspector?: (context: WorkflowWorkbenchInspectorContext<TNodeData, TEdgeData>) => ReactNode;
  renderToolbarActions?: (
    context: WorkflowWorkbenchInspectorContext<TNodeData, TEdgeData>,
  ) => ReactNode;
};

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

type WorkflowWorkbenchConnectionCoordinates = Pick<
  WorkflowEditorConnectionInput,
  "sourceNodeId" | "sourcePortId" | "targetNodeId" | "targetPortId"
>;

function toWorkflowWorkbenchConnectionInput(
  connection: WorkflowWorkbenchConnectionCoordinates,
): WorkflowEditorConnectionInput {
  return {
    sourceNodeId: connection.sourceNodeId,
    sourcePortId: connection.sourcePortId,
    targetNodeId: connection.targetNodeId,
    targetPortId: connection.targetPortId,
  };
}

function getWorkflowWorkbenchConnectionKey(connection: WorkflowWorkbenchConnectionCoordinates) {
  return `${connection.sourceNodeId}:${connection.sourcePortId}->${connection.targetNodeId}:${connection.targetPortId}`;
}

export function WorkflowWorkbench<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
>({
  document,
  selectedNodeId,
  selectedEdgeId,
  selectedNodeIds,
  selectedEdgeIds,
  selectedGroupIds,
  readOnly = false,
  nodeTemplates = defaultWorkflowEditorNodeTemplates as ReadonlyArray<
    WorkflowWorkbenchPaletteItem<TTemplateData>
  >,
  typeDefinitions,
  documentReferences,
  className,
  layout = "default",
  chrome,
  overlayBehavior,
  showGraphStats = true,
  showShortcutHint = true,
  onDocumentChange,
  onSelectionChange,
  onSelectionStateChange,
  onViewportChange,
  onOpenWorkflowReference,
  onCreateWorkflowReference,
  renderNodeTemplate,
  renderInspector,
  renderToolbarActions,
}: WorkflowWorkbenchProps<TNodeData, TEdgeData, TTemplateData>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const paletteRef = useRef<HTMLDivElement | null>(null);
  const inspectorRef = useRef<HTMLDivElement | null>(null);
  const connectionInProgressRef = useRef(false);
  const uiCreatedConnectionCommitKeyRef = useRef<string | null>(null);
  const ignoreSelectionClearUntilRef = useRef(0);
  const marqueeRef = useRef<WorkflowSelectionMarquee | null>(null);
  const canvasPanRef = useRef<WorkflowCanvasPanState | null>(null);
  const paletteDragRef = useRef<WorkflowOverlayDragState | null>(null);
  const inspectorDragRef = useRef<WorkflowOverlayDragState | null>(null);
  const pendingNodeSnapRef = useRef<{
    document: WorkflowEditorDocument<TNodeData, TEdgeData>;
    nodeIds: Set<string>;
  } | null>(null);
  const pointerModifierRef = useRef({ additive: false });
  const [internalSelection, setInternalSelection] = useState<WorkflowEditorSelectionState>(
    emptyWorkflowEditorSelection,
  );
  const [inspectorDragging, setInspectorDragging] = useState(false);
  const [inspectorMinimized, setInspectorMinimized] = useState(false);
  const [inspectorPosition, setInspectorPosition] = useState<WorkflowOverlayPosition>(null);
  const [narrowOverlayLayout, setNarrowOverlayLayout] = useState(false);
  const [marquee, setMarquee] = useState<WorkflowSelectionMarquee | null>(null);
  const [paletteMinimized, setPaletteMinimized] = useState(false);
  const [paletteCorner, setPaletteCorner] = useState<WorkflowPaletteCorner>(
    overlayBehavior?.palette?.defaultPlacement ?? "top-left",
  );
  const [paletteDragging, setPaletteDragging] = useState(false);
  const [palettePosition, setPalettePosition] = useState<WorkflowOverlayPosition>(null);
  const [paletteSearchValue, setPaletteSearchValue] = useState("");
  const [renamingNodeId, setRenamingNodeId] = useState<string | null>(null);
  const [objectConstructorExpressionDrafts, setObjectConstructorExpressionDrafts] = useState<
    Record<string, string>
  >({});
  const palettePanelBehavior = overlayBehavior?.palette;
  const inspectorPanelBehavior = overlayBehavior?.inspector;
  const effectivePaletteMinimized =
    palettePanelBehavior?.controlledState?.minimized ?? paletteMinimized;
  const effectivePaletteCorner =
    palettePanelBehavior?.controlledState?.placement ??
    paletteCorner ??
    palettePanelBehavior?.defaultPlacement ??
    "top-left";
  const effectivePalettePosition =
    palettePanelBehavior?.controlledState?.position === undefined
      ? palettePosition
      : palettePanelBehavior.controlledState.position;
  const effectiveInspectorMinimized =
    inspectorPanelBehavior?.controlledState?.minimized ?? inspectorMinimized;
  const effectiveInspectorPosition =
    inspectorPanelBehavior?.controlledState?.position === undefined
      ? inspectorPosition
      : inspectorPanelBehavior.controlledState.position;
  const documentContext = useMemo(() => createWorkflowEditorDocumentContext(document), [document]);
  const externalSelectionProvided =
    selectedNodeIds !== undefined ||
    selectedEdgeIds !== undefined ||
    selectedGroupIds !== undefined ||
    selectedNodeId !== undefined ||
    selectedEdgeId !== undefined;
  const rawSelection = useMemo<WorkflowEditorSelectionState>(() => {
    if (
      selectedNodeIds !== undefined ||
      selectedEdgeIds !== undefined ||
      selectedGroupIds !== undefined
    ) {
      const nodeIds = [...(selectedNodeIds ?? [])];
      const edgeIds = [...(selectedEdgeIds ?? [])];
      const groupIds = [...(selectedGroupIds ?? [])];
      const primary =
        groupIds.length > 0
          ? ({ type: "group", id: groupIds.at(-1)! } as const)
          : nodeIds.length > 0
            ? ({ type: "node", id: nodeIds.at(-1)! } as const)
            : edgeIds.length > 0
              ? ({ type: "edge", id: edgeIds.at(-1)! } as const)
              : undefined;

      return {
        nodeIds,
        edgeIds,
        ...(groupIds.length > 0 ? { groupIds } : {}),
        ...(primary ? { primary } : {}),
      };
    }

    if (selectedNodeId) {
      return {
        nodeIds: [selectedNodeId],
        edgeIds: [],
        primary: { type: "node", id: selectedNodeId },
      };
    }

    if (selectedEdgeId) {
      return {
        nodeIds: [],
        edgeIds: [selectedEdgeId],
        primary: { type: "edge", id: selectedEdgeId },
      };
    }

    return externalSelectionProvided ? emptyWorkflowEditorSelection : internalSelection;
  }, [
    externalSelectionProvided,
    internalSelection,
    selectedEdgeId,
    selectedEdgeIds,
    selectedGroupIds,
    selectedNodeId,
    selectedNodeIds,
  ]);
  const selection = useMemo(
    () => normalizeWorkflowEditorSelection(document, rawSelection),
    [document, rawSelection],
  );
  const primarySelectedNodeId =
    selection.primary?.type === "node" ? selection.primary.id : selection.nodeIds[0];
  const primarySelectedEdgeId =
    selection.primary?.type === "edge" ? selection.primary.id : selection.edgeIds[0];
  const selectedNode = primarySelectedNodeId
    ? documentContext.nodeById.get(primarySelectedNodeId)
    : undefined;
  const selectedEdge = primarySelectedEdgeId
    ? documentContext.edgeById.get(primarySelectedEdgeId)
    : undefined;
  const primarySelectedGroupId =
    selection.primary?.type === "group" ? selection.primary.id : selection.groupIds?.[0];
  const selectedGroup = primarySelectedGroupId
    ? document.groups?.find((group) => group.id === primarySelectedGroupId)
    : undefined;
  const selectedGroups = (selection.groupIds ?? []).flatMap((id) => {
    const group = document.groups?.find((candidate) => candidate.id === id);
    return group ? [group] : [];
  });
  const inspectorCollapsed = effectiveInspectorMinimized || (!selectedNode && !selectedEdge);
  const selectedNodes = selection.nodeIds.flatMap((id) => {
    const node = documentContext.nodeById.get(id);
    return node ? [node] : [];
  });
  const selectedEdges = selection.edgeIds.flatMap((id) => {
    const edge = documentContext.edgeById.get(id);
    return edge ? [edge] : [];
  });
  const graphIndex = useMemo(() => createWorkflowEditorGraphIndex(document), [document]);
  const uiNodes = useMemo(
    () => toUiWorkflowBuilderNodes(document.nodes, document.edges),
    [document.edges, document.nodes],
  );
  const uiEdges = useMemo(
    () => toUiWorkflowBuilderEdges(document.edges, document.nodes),
    [document.edges, document.nodes],
  );
  const minimizedGroups = useMemo(
    () => (document.groups ?? []).filter((group) => group.minimized === true),
    [document.groups],
  );
  const hiddenNodeIds = useMemo(
    () => minimizedGroups.flatMap((group) => group.nodeIds),
    [minimizedGroups],
  );
  const hiddenEdgeIds = useMemo(() => {
    const minimizedGroupByNodeId = new Map<string, string>();
    for (const group of minimizedGroups) {
      for (const nodeId of group.nodeIds) {
        minimizedGroupByNodeId.set(nodeId, group.id);
      }
    }

    return document.edges.flatMap((edge) => {
      const sourceGroupId = minimizedGroupByNodeId.get(edge.sourceNodeId);
      const targetGroupId = minimizedGroupByNodeId.get(edge.targetNodeId);
      return sourceGroupId && sourceGroupId === targetGroupId ? [edge.id] : [];
    });
  }, [document.edges, minimizedGroups]);
  const filteredNodeTemplates = useMemo(
    () => filterWorkflowWorkbenchPaletteTemplates(nodeTemplates, paletteSearchValue),
    [nodeTemplates, paletteSearchValue],
  );
  const paletteGroups = useMemo(
    () => createWorkflowWorkbenchPaletteCategoryGroups(filteredNodeTemplates),
    [filteredNodeTemplates],
  );

  const commitDocument = (nextDocument: WorkflowEditorDocument<TNodeData, TEdgeData>) => {
    onDocumentChange?.(nextDocument);
  };

  const commitWorkflowEditorConnection = (
    connectionCoordinates: WorkflowWorkbenchConnectionCoordinates,
    options: { fromUiCreatedEdge?: boolean } = {},
  ) => {
    const connection = toWorkflowWorkbenchConnectionInput(connectionCoordinates);
    const connectionKey = getWorkflowWorkbenchConnectionKey(connection);

    if (!options.fromUiCreatedEdge && uiCreatedConnectionCommitKeyRef.current === connectionKey) {
      uiCreatedConnectionCommitKeyRef.current = null;
      return;
    }

    const nextDocument = connectWorkflowEditorNodes(document, connection, { typeDefinitions });

    if (nextDocument === document) {
      return;
    }

    if (options.fromUiCreatedEdge) {
      uiCreatedConnectionCommitKeyRef.current = connectionKey;
      window.setTimeout(() => {
        if (uiCreatedConnectionCommitKeyRef.current === connectionKey) {
          uiCreatedConnectionCommitKeyRef.current = null;
        }
      }, 0);
    }

    commitDocument(nextDocument);
  };

  const commitViewportChange = (viewport: WorkflowEditorViewport) => {
    onViewportChange?.(viewport);
    commitDocument({ ...document, viewport });
  };

  useEffect(() => {
    if (!externalSelectionProvided) {
      setInternalSelection((current) => normalizeWorkflowEditorSelection(document, current));
    }
  }, [document, externalSelectionProvided]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const syncOverlayLayout = () => setNarrowOverlayLayout(mediaQuery.matches);

    syncOverlayLayout();
    mediaQuery.addEventListener("change", syncOverlayLayout);
    return () => mediaQuery.removeEventListener("change", syncOverlayLayout);
  }, []);

  useEffect(() => {
    const ownerDocument = globalThis.document;
    if (!ownerDocument) {
      return;
    }

    const preservePortalSelection = (event: Event) => {
      if (isWorkflowWorkbenchOverlayInteractionTarget(event.target)) {
        ignoreSelectionClearUntilRef.current =
          Date.now() + workflowWorkbenchOverlaySelectionPreservationMs;
      }
    };

    ownerDocument.addEventListener("pointerdown", preservePortalSelection, true);
    ownerDocument.addEventListener("mousedown", preservePortalSelection, true);
    ownerDocument.addEventListener("click", preservePortalSelection, true);
    ownerDocument.addEventListener("focusin", preservePortalSelection, true);
    return () => {
      ownerDocument.removeEventListener("pointerdown", preservePortalSelection, true);
      ownerDocument.removeEventListener("mousedown", preservePortalSelection, true);
      ownerDocument.removeEventListener("click", preservePortalSelection, true);
      ownerDocument.removeEventListener("focusin", preservePortalSelection, true);
    };
  }, []);

  useEffect(() => {
    if (!palettePosition) {
      return;
    }

    const syncPalettePosition = () => {
      setPalettePosition((current) => {
        if (!current) {
          return current;
        }

        const next = clampWorkflowOverlayPosition(
          current,
          containerRef.current,
          paletteRef.current,
        );
        return next.x === current.x && next.y === current.y ? current : next;
      });
    };

    syncPalettePosition();
    window.addEventListener("resize", syncPalettePosition);

    const resizeObserver =
      typeof ResizeObserver === "function" ? new ResizeObserver(syncPalettePosition) : null;
    if (containerRef.current) {
      resizeObserver?.observe(containerRef.current);
    }
    if (paletteRef.current) {
      resizeObserver?.observe(paletteRef.current);
    }

    return () => {
      window.removeEventListener("resize", syncPalettePosition);
      resizeObserver?.disconnect();
    };
  }, [narrowOverlayLayout, paletteMinimized, palettePosition !== null]);

  useEffect(() => {
    if (!inspectorPosition) {
      return;
    }

    const syncInspectorPosition = () => {
      setInspectorPosition((current) => {
        if (!current) {
          return current;
        }

        const next = clampWorkflowOverlayPosition(
          current,
          containerRef.current,
          inspectorRef.current,
        );
        return next.x === current.x && next.y === current.y ? current : next;
      });
    };

    syncInspectorPosition();
    window.addEventListener("resize", syncInspectorPosition);

    const resizeObserver =
      typeof ResizeObserver === "function" ? new ResizeObserver(syncInspectorPosition) : null;
    if (containerRef.current) {
      resizeObserver?.observe(containerRef.current);
    }
    if (inspectorRef.current) {
      resizeObserver?.observe(inspectorRef.current);
    }

    return () => {
      window.removeEventListener("resize", syncInspectorPosition);
      resizeObserver?.disconnect();
    };
  }, [inspectorCollapsed, inspectorPosition !== null, narrowOverlayLayout]);

  const emitSelectionState = (
    nextSelection: WorkflowEditorSelectionState,
    selectionDocument: WorkflowEditorDocument<TNodeData, TEdgeData> = document,
  ) => {
    const normalizedSelection = normalizeWorkflowEditorSelection(selectionDocument, nextSelection);

    if (!externalSelectionProvided) {
      setInternalSelection(normalizedSelection);
    }

    onSelectionStateChange?.(normalizedSelection);
    onSelectionChange?.(selectionStateToSingleSelection(document, normalizedSelection));
  };

  const updateSelectedNode = (patch: Partial<WorkflowEditorNode<TNodeData>>) => {
    if (readOnly || !selectedNode) {
      return;
    }

    commitDocument(updateWorkflowEditorNode(document, selectedNode.id, patch));
  };

  const updateWorkflowJsonPrimitiveNodeValue = (
    nodeId: string,
    value: string | number | boolean | null,
  ) => {
    if (readOnly) {
      return;
    }

    const node = documentContext.nodeById.get(nodeId);
    if (!node || !isWorkflowEditorJsonPrimitiveNode(node)) {
      return;
    }

    commitDocument(
      updateWorkflowEditorNode(document, nodeId, {
        data: {
          ...(isRecord(node.data) ? node.data : {}),
          value,
        } as unknown as TNodeData,
      }),
    );
  };

  const updateWorkflowNodeLabel = (nodeId: string, label: string) => {
    if (readOnly) {
      return;
    }

    commitDocument(updateWorkflowEditorNode(document, nodeId, { label }));
  };

  const updateWorkflowObjectConstructorExpressionValue = (nodeId: string, expression: string) => {
    if (readOnly) {
      return;
    }

    commitDocument(updateWorkflowEditorObjectConstructorExpression(document, nodeId, expression));
  };

  const updateWorkflowObjectConstructorExpressionDraft = (nodeId: string, expression: string) => {
    setObjectConstructorExpressionDrafts((current) =>
      current[nodeId] === expression ? current : { ...current, [nodeId]: expression },
    );
  };

  const selectWorkflowJsonPrimitiveNode = (nodeId: string) => {
    emitSelectionState({
      nodeIds: [nodeId],
      edgeIds: [],
      primary: { type: "node", id: nodeId },
    });
  };

  const updateSelectedEdge = (patch: Partial<WorkflowEditorEdge<TEdgeData>>) => {
    if (readOnly || !selectedEdge) {
      return;
    }

    commitDocument({
      ...document,
      edges: document.edges.map((edge) =>
        edge.id === selectedEdge.id ? { ...edge, ...patch, id: edge.id } : edge,
      ),
    });
  };

  const updateDocument = (nextDocument: WorkflowEditorDocument<TNodeData, TEdgeData>) => {
    if (readOnly) {
      return;
    }

    commitDocument(nextDocument);
  };

  const updateSelectedNodeWorkflowReference = (documentId: string | null) => {
    if (readOnly || !selectedNode) {
      return;
    }

    commitDocument(
      updateWorkflowEditorNodeWorkflowReference(
        document,
        selectedNode.id,
        documentId ? { documentId } : null,
      ),
    );
  };

  const selectedNodeWorkflowReferenceValid =
    !!selectedNode?.workflowRef?.documentId &&
    !!documentReferences?.some(
      (reference) => reference.id === selectedNode.workflowRef?.documentId,
    );
  const selectedNodeHasWorkflowReference = !!selectedNode?.workflowRef?.documentId;

  const openSelectedNodeWorkflow = () => {
    if (!selectedNode || !selectedNodeWorkflowReferenceValid) {
      return;
    }

    onOpenWorkflowReference?.(selectedNode);
  };

  const createSelectedNodeWorkflow = () => {
    if (!selectedNode || readOnly) {
      return;
    }

    onCreateWorkflowReference?.(selectedNode);
  };

  const inspectorContext = {
    document,
    documentReferences,
    readOnly,
    selection,
    selectedEdges,
    selectedNodes,
    createSelectedNodeWorkflow:
      documentReferences && onCreateWorkflowReference ? createSelectedNodeWorkflow : undefined,
    openSelectedNodeWorkflow:
      documentReferences && onOpenWorkflowReference ? openSelectedNodeWorkflow : undefined,
    selectedEdge,
    selectedNode,
    updateDocument,
    updateSelectedEdge,
    updateSelectedNode,
    updateSelectedNodeWorkflowReference,
  } satisfies WorkflowWorkbenchInspectorContext<TNodeData, TEdgeData>;

  const createTemplateNode = (
    template: WorkflowWorkbenchPaletteItem<TTemplateData>,
    position?: WorkflowEditorPoint,
  ) => {
    const id = createTemplateNodeId(document.nodes, template.id);
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
      x: position?.x ?? 120 + document.nodes.length * 36,
      y: position?.y ?? 120 + document.nodes.length * 28,
      inputs: template.inputs,
      outputs: template.outputs,
      data: template.data as TNodeData | undefined,
      workflowRef: template.workflowRef,
      composition: template.composition as WorkflowEditorNode<TNodeData>["composition"],
    };

    if (position) {
      const size = getWorkflowEditorRenderedNodeSize(toUiWorkflowBuilderNodes([node])[0]!);
      node.x = Math.round(position.x - size.width / 2);
      node.y = Math.round(position.y - size.height / 2);
    }

    return { id, node };
  };

  const addTemplateNode = (
    template: WorkflowWorkbenchPaletteItem<TTemplateData>,
    position?: WorkflowEditorPoint,
  ) => {
    if (readOnly) {
      return;
    }

    const { id, node } = createTemplateNode(template, position);
    const nextDocument = {
      ...document,
      nodes: [...document.nodes, node],
    };
    commitDocument(nextDocument);
    emitSelectionState({ nodeIds: [id], edgeIds: [], primary: { type: "node", id } }, nextDocument);
  };

  const startTemplateDrag = (
    event: ReactDragEvent<HTMLElement>,
    template: WorkflowWorkbenchPaletteItem<TTemplateData>,
  ) => {
    if (readOnly) {
      event.preventDefault();
      return;
    }

    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData(workflowEditorPaletteDragType, template.id);
    event.dataTransfer.setData("text/plain", template.label);
  };

  const templateFromDragEvent = (event: ReactDragEvent<HTMLElement>) => {
    const templateId = event.dataTransfer.getData(workflowEditorPaletteDragType);
    return templateId ? nodeTemplates.find((template) => template.id === templateId) : undefined;
  };

  const handleTemplateDragOver = (event: ReactDragEvent<HTMLDivElement>) => {
    if (!readOnly && Array.from(event.dataTransfer.types).includes(workflowEditorPaletteDragType)) {
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    }
  };

  const handleTemplateDrop = (event: ReactDragEvent<HTMLDivElement>) => {
    const template = templateFromDragEvent(event);
    const position = getWorkflowEditorPointFromClient(
      containerRef.current,
      event.clientX,
      event.clientY,
      document.viewport?.zoom ?? 1,
    );

    if (!template || !position) {
      return;
    }

    event.preventDefault();
    addTemplateNode(template, position);
  };

  const completePendingNodeSnap = () => {
    const pendingSnap = pendingNodeSnapRef.current;

    if (!pendingSnap) {
      return;
    }

    pendingNodeSnapRef.current = null;
    let nextDocument = pendingSnap.document;
    let changed = false;

    for (const nodeId of pendingSnap.nodeIds) {
      const snappedDocument = snapWorkflowEditorNodeToCompatiblePort(nextDocument, nodeId, {
        typeDefinitions,
      });

      if (snappedDocument !== nextDocument) {
        changed = true;
      }

      nextDocument = snappedDocument;
    }

    if (changed) {
      commitDocument(nextDocument);
    }
  };

  useEffect(() => {
    const completeSnap = () => completePendingNodeSnap();

    window.addEventListener("pointerup", completeSnap);
    window.addEventListener("mouseup", completeSnap);
    return () => {
      window.removeEventListener("pointerup", completeSnap);
      window.removeEventListener("mouseup", completeSnap);
    };
  });

  useEffect(() => {
    if (!renamingNodeId) {
      return;
    }

    if (readOnly || !documentContext.nodeById.has(renamingNodeId)) {
      setRenamingNodeId(null);
    }
  }, [documentContext, readOnly, renamingNodeId]);

  const deleteSelection = () => {
    if (readOnly) {
      return;
    }

    if (
      selection.nodeIds.length > 0 ||
      selection.edgeIds.length > 0 ||
      (selection.groupIds?.length ?? 0) > 0
    ) {
      commitDocument(removeWorkflowEditorSelection(document, selection));
      emitSelectionState(emptyWorkflowEditorSelection);
    }
  };

  const deleteNode = (nodeId: string) => {
    if (readOnly) {
      return;
    }

    const nextDocument = removeWorkflowEditorNode(document, nodeId);
    commitDocument(nextDocument);
    emitSelectionState(
      {
        nodeIds: selection.nodeIds.filter((selectedNodeId) => selectedNodeId !== nodeId),
        edgeIds: selection.edgeIds,
        primary:
          selection.primary?.type === "node" && selection.primary.id === nodeId
            ? undefined
            : selection.primary,
      },
      nextDocument,
    );
  };

  const duplicateSelection = () => {
    if (
      readOnly ||
      (selection.nodeIds.length === 0 &&
        selection.edgeIds.length === 0 &&
        (selection.groupIds?.length ?? 0) === 0)
    ) {
      return;
    }

    if (selection.nodeIds.length === 1 && selection.edgeIds.length === 0) {
      const nextDocument = duplicateWorkflowEditorNode(document, selection.nodeIds[0]!);
      commitDocument(nextDocument);
      emitSelectionState(
        {
          nodeIds: selection.nodeIds,
          edgeIds: [],
          primary: { type: "node", id: selection.nodeIds[0]! },
        },
        nextDocument,
      );
      return;
    }

    const result = duplicateWorkflowEditorSelection(document, selection);
    commitDocument(result.document);
    emitSelectionState(
      {
        nodeIds: result.nodeIds,
        edgeIds: result.edgeIds,
        ...(result.groupIds?.length ? { groupIds: result.groupIds } : {}),
        ...(result.groupIds?.[0]
          ? { primary: { type: "group", id: result.groupIds[0] } }
          : result.nodeIds[0]
            ? { primary: { type: "node", id: result.nodeIds[0] } }
            : {}),
      },
      result.document,
    );
  };

  const copySelection = () => {
    if (
      selection.nodeIds.length === 0 &&
      selection.edgeIds.length === 0 &&
      (selection.groupIds?.length ?? 0) === 0
    ) {
      return;
    }

    const text = JSON.stringify(copyWorkflowEditorSelection(document, selection));
    workflowEditorMemoryClipboard = text;
    void navigator.clipboard?.writeText(text).catch(() => {});
  };

  const pasteSelection = async () => {
    if (readOnly) {
      return;
    }

    let text = workflowEditorMemoryClipboard;
    if (!text) {
      try {
        text = (await navigator.clipboard?.readText?.()) ?? null;
      } catch {
        text = null;
      }
    }

    if (!text) {
      return;
    }

    try {
      const result = pasteWorkflowEditorClipboardPayload(document, JSON.parse(text));
      commitDocument(result.document);
      emitSelectionState(
        {
          nodeIds: result.nodeIds,
          edgeIds: result.edgeIds,
          ...(result.groupIds?.length ? { groupIds: result.groupIds } : {}),
          ...(result.groupIds?.[0]
            ? { primary: { type: "group", id: result.groupIds[0] } }
            : result.nodeIds[0]
              ? { primary: { type: "node", id: result.nodeIds[0] } }
              : {}),
        },
        result.document,
      );
    } catch {
      return;
    }
  };

  const arrangeSelection = () => {
    const nodeIds = selectedGroup?.nodeIds ?? selection.nodeIds;
    if (readOnly || nodeIds.length === 0) {
      return;
    }

    commitDocument(layoutWorkflowEditorDocument(document, { nodeIds }).document);
  };

  const groupSelection = () => {
    if (readOnly || selection.nodeIds.length < 2) {
      return;
    }

    const nextDocument = createWorkflowEditorGroup(document, selection.nodeIds);
    if (nextDocument === document) {
      return;
    }

    const previousGroupIds = new Set((document.groups ?? []).map((group) => group.id));
    const group = (nextDocument.groups ?? []).find(
      (candidate) => !previousGroupIds.has(candidate.id),
    );

    commitDocument(nextDocument);
    if (group) {
      emitSelectionState(
        {
          nodeIds: [],
          edgeIds: [],
          groupIds: [group.id],
          primary: { type: "group", id: group.id },
        },
        nextDocument,
      );
    }
  };

  const ungroupSelection = () => {
    if (readOnly || !selectedGroup) {
      return;
    }

    const nodeIds = selectedGroup.nodeIds;
    const nextDocument = ungroupWorkflowEditorGroup(document, selectedGroup.id);
    commitDocument(nextDocument);
    emitSelectionState(
      {
        nodeIds,
        edgeIds: [],
        ...(nodeIds[0] ? { primary: { type: "node", id: nodeIds[0] } } : {}),
      },
      nextDocument,
    );
  };

  const updateSelectedGroup = (patch: Partial<WorkflowEditorGroup>) => {
    if (readOnly || !selectedGroup) {
      return;
    }

    commitDocument(updateWorkflowEditorGroup(document, selectedGroup.id, patch));
  };

  const renameSelectedGroup = (label: string) => {
    const normalizedLabel = label.trim();
    if (normalizedLabel) {
      updateSelectedGroup({ label: normalizedLabel });
    }
  };

  const toggleSelectedGroupMinimized = () => {
    if (selectedGroup) {
      updateSelectedGroup({ minimized: selectedGroup.minimized !== true });
    }
  };

  const arrangeAll = () => {
    if (readOnly || document.nodes.length === 0) {
      return;
    }

    commitDocument(layoutWorkflowEditorDocument(document).document);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableEventTarget(event.target)) {
        return;
      }

      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === "a") {
        event.preventDefault();
        emitSelectionState({
          nodeIds: document.nodes.map((node) => node.id),
          edgeIds: [],
          ...(document.nodes[0] ? { primary: { type: "node", id: document.nodes[0].id } } : {}),
        });
        return;
      }

      if (event.key === "Escape") {
        emitSelectionState(emptyWorkflowEditorSelection);
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelection();
        return;
      }

      if (mod && event.key.toLowerCase() === "c") {
        event.preventDefault();
        copySelection();
        return;
      }

      if (mod && event.key.toLowerCase() === "v") {
        event.preventDefault();
        void pasteSelection();
        return;
      }

      if (mod && event.key.toLowerCase() === "d") {
        event.preventDefault();
        duplicateSelection();
        return;
      }

      if (mod && event.key.toLowerCase() === "g") {
        event.preventDefault();
        if (event.shiftKey) {
          ungroupSelection();
        } else {
          groupSelection();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  const handleBuilderSelection = (builderSelection: WorkflowBuilderSelection) => {
    if (connectionInProgressRef.current && builderSelection?.type === "node") {
      return;
    }

    if (!builderSelection) {
      if (Date.now() < ignoreSelectionClearUntilRef.current) {
        return;
      }

      if (!pointerModifierRef.current.additive && !marquee) {
        emitSelectionState(emptyWorkflowEditorSelection);
      }
      return;
    }

    ignoreSelectionClearUntilRef.current = 0;
    const item =
      builderSelection.type === "node"
        ? ({ type: "node", id: builderSelection.id } as const)
        : builderSelection.type === "edge"
          ? ({ type: "edge", id: builderSelection.id } as const)
          : ({ type: "group", id: builderSelection.id } as const);

    if (!pointerModifierRef.current.additive) {
      emitSelectionState({
        nodeIds: item.type === "node" ? [item.id] : [],
        edgeIds: item.type === "edge" ? [item.id] : [],
        ...(item.type === "group" ? { groupIds: [item.id] } : {}),
        primary: item,
      });
      return;
    }

    emitSelectionState(toggleWorkflowEditorSelectionItem(selection, item));
  };

  const startCanvasPointerInteraction = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointerModifierRef.current = { additive: event.shiftKey || event.metaKey || event.ctrlKey };
    const target = event.target;
    if (target instanceof Element && isWorkflowWorkbenchOverlayInteractionTarget(target)) {
      ignoreSelectionClearUntilRef.current =
        Date.now() + workflowWorkbenchOverlaySelectionPreservationMs;
      return;
    }

    if (
      event.button !== 0 ||
      !(target instanceof Element) ||
      target.closest(
        "[data-slot='workflow-builder-node'], [data-slot='workflow-node-port'], [data-slot='workflow-builder-edge'], [data-slot='workflow-builder-edge-hit'], [data-slot='workflow-builder-edge-handle'], button, input, textarea, select",
      )
    ) {
      return;
    }

    if (!event.shiftKey && !event.metaKey && !event.ctrlKey) {
      const currentViewport = normalizeWorkflowEditorViewport(document.viewport);
      canvasPanRef.current = {
        pointerId: event.pointerId,
        startClientX: event.clientX,
        startClientY: event.clientY,
        viewport: currentViewport,
        panning: false,
      };
      return;
    }

    startMarquee(event);
  };

  const startMarquee = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    const nextMarquee = {
      startX: event.clientX - rect.left,
      startY: event.clientY - rect.top,
      currentX: event.clientX - rect.left,
      currentY: event.clientY - rect.top,
    };
    marqueeRef.current = nextMarquee;
    setMarquee(nextMarquee);
  };

  const updateCanvasPointerInteraction = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pan = canvasPanRef.current;
    if (pan && pan.pointerId === event.pointerId) {
      const dx = event.clientX - pan.startClientX;
      const dy = event.clientY - pan.startClientY;

      if (!pan.panning && Math.hypot(dx, dy) < workflowEditorPanActivationDistance) {
        return;
      }

      if (!pan.panning) {
        event.currentTarget.setPointerCapture?.(event.pointerId);
        pan.panning = true;
      }
      event.preventDefault();
      event.stopPropagation();
      commitViewportChange({
        x: Math.round(pan.viewport.x + dx),
        y: Math.round(pan.viewport.y + dy),
        zoom: pan.viewport.zoom,
      });
      return;
    }

    updateMarquee(event);
  };

  const updateMarquee = (event: ReactPointerEvent<HTMLDivElement>) => {
    const currentMarquee = marqueeRef.current;
    if (!currentMarquee) {
      return;
    }

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    const nextMarquee = {
      ...currentMarquee,
      currentX: event.clientX - rect.left,
      currentY: event.clientY - rect.top,
    };
    marqueeRef.current = nextMarquee;
    setMarquee(nextMarquee);
  };

  const completeCanvasPointerInteraction = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pan = canvasPanRef.current;

    if (!pan || pan.pointerId !== event.pointerId) {
      return false;
    }

    canvasPanRef.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }

    if (!pan.panning) {
      if (!pointerModifierRef.current.additive) {
        emitSelectionState(emptyWorkflowEditorSelection);
      }
      return false;
    }

    ignoreSelectionClearUntilRef.current =
      Date.now() + workflowWorkbenchOverlaySelectionPreservationMs;
    event.preventDefault();
    event.stopPropagation();
    return true;
  };

  const cancelCanvasPointerInteraction = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pan = canvasPanRef.current;
    if (pan?.pointerId === event.pointerId) {
      canvasPanRef.current = null;
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      }
    }
  };

  const clearPendingConnectionAfterTargetClick = (event: ReactPointerEvent<HTMLDivElement>) => {
    const target = event.target;
    if (
      !connectionInProgressRef.current ||
      !(target instanceof Element) ||
      target.closest("[data-port-direction='output']")
    ) {
      return;
    }

    window.setTimeout(() => {
      connectionInProgressRef.current = false;
    }, 0);
  };

  const startNodeRenameFromDoubleClick = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (readOnly) {
      return;
    }

    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }

    const selectElement = target.closest("[data-slot='workflow-node-select']");
    if (!selectElement) {
      return;
    }

    if (
      target.closest(
        "[data-slot='workflow-node-port'], [data-slot='workflow-builder-edge'], [data-slot='workflow-builder-edge-hit'], [data-slot='workflow-builder-edge-handle'], input, textarea, select, [contenteditable='true'], [role='textbox'], [data-slot='dropdown-menu-content']",
      )
    ) {
      return;
    }

    const interactiveElement = target.closest("button");
    if (interactiveElement && interactiveElement !== selectElement) {
      return;
    }

    const nodeElement = target.closest<HTMLElement>(
      "[data-slot='workflow-builder-node'][data-node-id]",
    );
    const nodeId = nodeElement?.dataset.nodeId;

    if (!nodeId || !documentContext.nodeById.has(nodeId)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    ignoreSelectionClearUntilRef.current =
      Date.now() + workflowWorkbenchOverlaySelectionPreservationMs;
    emitSelectionState({
      nodeIds: [nodeId],
      edgeIds: [],
      primary: { type: "node", id: nodeId },
    });
    setRenamingNodeId(nodeId);
  };

  const handleCanvasWheel = (event: WheelEvent) => {
    const target = event.target;
    if (target instanceof Element && isWorkflowWorkbenchOverlayInteractionTarget(target)) {
      event.stopPropagation();
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (!event.ctrlKey) {
      const currentViewport = normalizeWorkflowEditorViewport(document.viewport);
      const delta = getWorkflowEditorWheelDelta(event);
      const nextViewport = event.shiftKey
        ? {
            ...currentViewport,
            y: Math.round(currentViewport.y - (delta.y || delta.x)),
          }
        : {
            ...currentViewport,
            x: Math.round(currentViewport.x - (delta.x || delta.y)),
          };

      if (nextViewport.x === currentViewport.x && nextViewport.y === currentViewport.y) {
        return;
      }

      commitViewportChange(nextViewport);
      return;
    }

    const surface = containerRef.current?.querySelector<HTMLElement>(
      "[data-slot='workflow-builder-surface']",
    );
    const rect = surface?.getBoundingClientRect();

    if (!rect) {
      return;
    }

    const currentViewport = normalizeWorkflowEditorViewport(document.viewport);
    const currentZoom = currentViewport.zoom;
    const nextZoom = clampWorkflowEditorZoom(
      currentZoom * Math.exp(-getWorkflowEditorWheelDelta(event).y * 0.002),
    );

    if (nextZoom === currentZoom) {
      return;
    }

    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    const canvasX = (localX - currentViewport.x) / currentZoom;
    const canvasY = (localY - currentViewport.y) / currentZoom;
    const nextViewport = {
      x: Math.round(localX - canvasX * nextZoom),
      y: Math.round(localY - canvasY * nextZoom),
      zoom: nextZoom,
    };

    commitViewportChange(nextViewport);
  };

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    container.addEventListener("wheel", handleCanvasWheel, { capture: true, passive: false });
    return () => container.removeEventListener("wheel", handleCanvasWheel, { capture: true });
  });

  const completeMarquee = () => {
    const currentMarquee = marqueeRef.current;
    if (!currentMarquee) {
      return;
    }

    const container = containerRef.current;
    const containerRect = container?.getBoundingClientRect();
    if (!container || !containerRect) {
      marqueeRef.current = null;
      setMarquee(null);
      return;
    }

    const marqueeRect = normalizeRect(currentMarquee);
    const nodeIds = Array.from(
      container.querySelectorAll<HTMLElement>("[data-slot='workflow-builder-node']"),
    ).flatMap((element) => {
      const nodeId = element.dataset.nodeId;
      const nodeRect = element.getBoundingClientRect();
      const relativeRect = {
        left: nodeRect.left - containerRect.left,
        top: nodeRect.top - containerRect.top,
        right: nodeRect.right - containerRect.left,
        bottom: nodeRect.bottom - containerRect.top,
      };
      return nodeId && rectsIntersect(marqueeRect, relativeRect) ? [nodeId] : [];
    });
    marqueeRef.current = null;
    setMarquee(null);
    emitSelectionState({
      nodeIds,
      edgeIds: [],
      ...(nodeIds[0] ? { primary: { type: "node", id: nodeIds[0] } } : {}),
    });
  };

  const preserveOverlaySelection = () => {
    ignoreSelectionClearUntilRef.current =
      Date.now() + workflowWorkbenchOverlaySelectionPreservationMs;
  };

  const pinPaletteToCorner = (corner: WorkflowPaletteCorner) => {
    setPaletteCorner(corner);
    setPalettePosition(null);
    palettePanelBehavior?.onStateChange?.({
      minimized: effectivePaletteMinimized,
      placement: corner,
      position: null,
    });
  };

  const startOverlayDrag = (
    event: ReactPointerEvent<HTMLDivElement>,
    overlay: HTMLDivElement | null,
    dragRef: MutableRefObject<WorkflowOverlayDragState | null>,
    setDragging: (dragging: boolean) => void,
  ) => {
    preserveOverlaySelection();

    if (
      event.button !== 0 ||
      !(event.target instanceof Element) ||
      event.target.closest(
        "button, input, textarea, select, [contenteditable='true'], [role='textbox'], [data-slot='dropdown-menu-content']",
      )
    ) {
      return;
    }

    const containerRect = containerRef.current?.getBoundingClientRect();
    const overlayRect = overlay?.getBoundingClientRect();
    if (!containerRect || !overlayRect) {
      return;
    }

    const startPosition = clampWorkflowOverlayPosition(
      {
        x: overlayRect.left - containerRect.left,
        y: overlayRect.top - containerRect.top,
      },
      containerRef.current,
      overlay,
      { width: overlayRect.width, height: overlayRect.height },
    );

    dragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: startPosition.x,
      startY: startPosition.y,
      width: overlayRect.width,
      height: overlayRect.height,
    };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  };

  const updateOverlayDrag = (
    event: ReactPointerEvent<HTMLDivElement>,
    overlay: HTMLDivElement | null,
    dragRef: MutableRefObject<WorkflowOverlayDragState | null>,
    setPosition: Dispatch<SetStateAction<WorkflowOverlayPosition>>,
  ) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const nextPosition = clampWorkflowOverlayPosition(
      {
        x: drag.startX + event.clientX - drag.startClientX,
        y: drag.startY + event.clientY - drag.startClientY,
      },
      containerRef.current,
      overlay,
      { width: drag.width, height: drag.height },
    );

    setPosition((current) =>
      current && current.x === nextPosition.x && current.y === nextPosition.y
        ? current
        : nextPosition,
    );
    event.preventDefault();
    event.stopPropagation();
  };

  const completeOverlayDrag = (
    event: ReactPointerEvent<HTMLDivElement>,
    dragRef: MutableRefObject<WorkflowOverlayDragState | null>,
    setDragging: (dragging: boolean) => void,
  ) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    dragRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    event.preventDefault();
    event.stopPropagation();
  };

  const startPaletteDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    startOverlayDrag(event, paletteRef.current, paletteDragRef, setPaletteDragging);
  };

  const updatePaletteDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    updateOverlayDrag(event, paletteRef.current, paletteDragRef, setPalettePosition);
  };

  const completePaletteDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    completeOverlayDrag(event, paletteDragRef, setPaletteDragging);
  };

  const startInspectorDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    startOverlayDrag(event, inspectorRef.current, inspectorDragRef, setInspectorDragging);
  };

  const updateInspectorDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    updateOverlayDrag(event, inspectorRef.current, inspectorDragRef, setInspectorPosition);
  };

  const completeInspectorDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    completeOverlayDrag(event, inspectorDragRef, setInspectorDragging);
  };

  const renderPaletteTemplate = (template: WorkflowWorkbenchPaletteItem<TTemplateData>) =>
    renderNodeTemplate ? (
      <Button
        key={template.id}
        type="button"
        variant="ghost"
        className="h-auto w-full min-w-0 justify-start border border-border bg-background px-3 py-2 text-left"
        disabled={readOnly}
        draggable={!readOnly}
        onDragStart={(event) => startTemplateDrag(event, template)}
        onClick={() => addTemplateNode(template)}
      >
        {renderNodeTemplate(template)}
      </Button>
    ) : (
      <WorkflowNode
        key={template.id}
        node={toUiWorkflowNodeTemplate(template)}
        readOnly={readOnly}
        inputDisabled
        outputDisabled
        className={cn(
          "cursor-pointer transition-colors hover:border-primary/60",
          readOnly && "cursor-not-allowed opacity-60",
        )}
        draggable={!readOnly}
        onDragStart={(event) => startTemplateDrag(event, template)}
        onNodeSelect={readOnly ? undefined : () => addTemplateNode(template)}
      />
    );

  const renderPaletteCategoryGroup = (
    group: WorkflowWorkbenchPaletteCategoryGroup<TTemplateData>,
    depth = 0,
  ): ReactNode => (
    <section key={group.id} aria-label={group.label} className="grid gap-2">
      <div
        className={cn(
          "flex items-center justify-between gap-3 text-[0.68rem] font-semibold uppercase text-muted-foreground",
          depth > 0 && "pl-1",
        )}
      >
        <span className="min-w-0 truncate">{group.label}</span>
        {group.templates.length > 0 ? (
          <Badge variant="secondary" className="flex-none">
            {group.templates.length}
          </Badge>
        ) : null}
      </div>
      {group.templates.length > 0 ? (
        <div className="grid gap-2">{group.templates.map(renderPaletteTemplate)}</div>
      ) : null}
      {group.children.length > 0 ? (
        <div className={cn("grid gap-3", depth > 0 ? "pl-3" : "border-l border-border/60 pl-3")}>
          {group.children.map((child) => renderPaletteCategoryGroup(child, depth + 1))}
        </div>
      ) : null}
    </section>
  );

  const setPaletteMinimizedState = (minimized: boolean) => {
    setPaletteMinimized(minimized);
    palettePanelBehavior?.onStateChange?.({
      minimized,
      placement: effectivePaletteCorner,
      position: effectivePalettePosition,
    });
  };

  const setPalettePositionState = (position: WorkflowOverlayPosition) => {
    setPalettePosition(position);
    palettePanelBehavior?.onStateChange?.({
      minimized: effectivePaletteMinimized,
      placement: effectivePaletteCorner,
      position,
    });
  };

  const setPalettePlacementState = (placement: WorkflowWorkbenchPanelPlacement) => {
    setPaletteCorner(placement);
    setPalettePosition(null);
    palettePanelBehavior?.onStateChange?.({
      minimized: effectivePaletteMinimized,
      placement,
      position: null,
    });
  };

  const setInspectorMinimizedState = (minimized: boolean) => {
    setInspectorMinimized(minimized);
    inspectorPanelBehavior?.onStateChange?.({
      minimized,
      position: effectiveInspectorPosition,
    });
  };

  const setInspectorPositionState = (position: WorkflowOverlayPosition) => {
    setInspectorPosition(position);
    inspectorPanelBehavior?.onStateChange?.({
      minimized: effectiveInspectorMinimized,
      position,
    });
  };

  const workbenchController = {
    document,
    readOnly,
    selection,
    selectedEdge,
    selectedEdges,
    selectedGroup,
    selectedGroups,
    selectedNode,
    selectedNodes,
    palette: {
      groups: paletteGroups,
      items: nodeTemplates,
      filteredItems: filteredNodeTemplates,
      minimized: effectivePaletteMinimized,
      placement: effectivePaletteCorner,
      position: effectivePalettePosition,
      searchValue: paletteSearchValue,
      setMinimized: setPaletteMinimizedState,
      setPlacement: setPalettePlacementState,
      setPosition: setPalettePositionState,
      setSearchValue: setPaletteSearchValue,
    },
    inspector: {
      context: inspectorContext,
      collapsed: inspectorCollapsed,
      minimized: effectiveInspectorMinimized,
      position: effectiveInspectorPosition,
      setMinimized: setInspectorMinimizedState,
      setPosition: setInspectorPositionState,
    },
    toolbar: {
      showGraphStats,
      showShortcutHint,
    },
    canvas: {
      containerRef,
    },
    overlays: {
      palette: {
        minimized: effectivePaletteMinimized,
        placement: effectivePaletteCorner,
        position: effectivePalettePosition,
      },
      inspector: {
        minimized: effectiveInspectorMinimized,
        position: effectiveInspectorPosition,
      },
    },
    configuration: {
      documentReferences,
      nodeTemplates,
      onCreateWorkflowReference,
      onOpenWorkflowReference,
      onSelectionChange,
      onSelectionStateChange,
      onViewportChange,
      renderInspector,
      renderNodeTemplate,
      renderToolbarActions,
      typeDefinitions,
    },
    actions: {
      addTemplateNode,
      arrangeAll,
      arrangeSelection,
      copySelection,
      createSelectedNodeWorkflow,
      deleteSelection,
      duplicateSelection,
      groupSelection,
      openSelectedNodeWorkflow,
      pasteSelection,
      renameSelectedGroup,
      setSelection: emitSelectionState,
      toggleSelectedGroupMinimized,
      ungroupSelection,
      updateDocument,
      updateSelectedGroup,
      updateSelectedEdge,
      updateSelectedNode,
      updateSelectedNodeWorkflowReference,
    },
  } satisfies WorkflowWorkbenchController<TNodeData, TEdgeData, TTemplateData>;

  const paletteOverlayPosition: CSSProperties = effectivePalettePosition
    ? {
        left: effectivePalettePosition.x,
        maxHeight: getWorkflowOverlayMaxHeight(effectivePalettePosition.y),
        top: effectivePalettePosition.y,
      }
    : {
        ...getWorkflowPalettePinnedStyle(effectivePaletteCorner),
        maxHeight: `calc(100% - ${workflowEditorPaletteMargin * 2}px)`,
      };
  const inspectorOverlayPosition: CSSProperties = effectiveInspectorPosition
    ? {
        left: effectiveInspectorPosition.x,
        maxHeight: getWorkflowOverlayMaxHeight(effectiveInspectorPosition.y),
        top: effectiveInspectorPosition.y,
      }
    : { maxHeight: "calc(100% - 4.75rem)", right: "0.75rem", top: "4rem" };

  return (
    <div
      data-slot="workbench-layout"
      className={cn(
        layout === "unstyled"
          ? "min-h-0 min-w-0 text-foreground"
          : "grid min-h-[38rem] min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-md border border-border bg-background text-foreground",
        className,
      )}
    >
      {typeof chrome?.toolbar === "function" ? (
        chrome.toolbar(workbenchController)
      ) : chrome?.toolbar === "hidden" || layout === "unstyled" ? null : (
        <div
          data-slot="workbench-toolbar"
          className="flex min-h-0 min-w-0 flex-nowrap items-center gap-1 overflow-x-auto border-b border-border bg-card/75 px-2 py-0"
        >
          <div className="flex min-w-0 flex-1 items-center justify-between gap-1">
            <div className="flex min-w-max items-center gap-1.5 whitespace-nowrap">
              {showGraphStats ? (
                <>
                  <Badge variant="outline">{document.nodes.length} nodes</Badge>
                  <Badge variant="outline">{document.edges.length} edges</Badge>
                </>
              ) : null}
              <Badge variant="outline" data-testid="selection-count">
                {selection.nodeIds.length +
                  selection.edgeIds.length +
                  (selection.groupIds?.length ?? 0)}{" "}
                selected
              </Badge>
              {showGraphStats ? (
                <Badge variant="secondary">
                  {
                    graphIndex.getSubgraph({ offset: 0, limit: document.nodes.length }).summary
                      .edgeCount
                  }{" "}
                  indexed
                </Badge>
              ) : null}
              {showShortcutHint ? (
                <span className="hidden text-xs text-muted-foreground sm:inline">
                  Duplicate {formatShortcutLabel(defaultWorkflowWorkbenchHotkeys.duplicateNode)}
                </span>
              ) : null}
            </div>
            <div className="flex min-w-max items-center gap-1.5 whitespace-nowrap">
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="!h-6 !min-h-6 !px-2 !text-xs"
                disabled={
                  readOnly ||
                  (selection.nodeIds.length === 0 &&
                    selection.edgeIds.length === 0 &&
                    (selection.groupIds?.length ?? 0) === 0)
                }
                onClick={duplicateSelection}
              >
                Duplicate
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="!h-6 !min-h-6 !px-2 !text-xs"
                disabled={
                  selection.nodeIds.length === 0 &&
                  selection.edgeIds.length === 0 &&
                  (selection.groupIds?.length ?? 0) === 0
                }
                onClick={copySelection}
              >
                Copy
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="!h-6 !min-h-6 !px-2 !text-xs"
                disabled={readOnly}
                onClick={() => void pasteSelection()}
              >
                Paste
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="!h-6 !min-h-6 !px-2 !text-xs"
                disabled={readOnly || (selection.nodeIds.length === 0 && !selectedGroup)}
                onClick={arrangeSelection}
              >
                Arrange selection
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="!h-6 !min-h-6 !px-2 !text-xs"
                disabled={readOnly || selection.nodeIds.length < 2}
                onClick={groupSelection}
              >
                Group
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="!h-6 !min-h-6 !px-2 !text-xs"
                disabled={readOnly || !selectedGroup}
                onClick={ungroupSelection}
              >
                Ungroup
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="!h-6 !min-h-6 !px-2 !text-xs"
                disabled={readOnly || document.nodes.length === 0}
                onClick={arrangeAll}
              >
                Arrange all
              </Button>
              {documentReferences ? (
                selectedNodeHasWorkflowReference ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="!h-6 !min-h-6 !px-2 !text-xs"
                    disabled={!selectedNodeWorkflowReferenceValid || !onOpenWorkflowReference}
                    onClick={openSelectedNodeWorkflow}
                  >
                    Open workflow
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="!h-6 !min-h-6 !px-2 !text-xs"
                    disabled={readOnly || !selectedNode || !onCreateWorkflowReference}
                    onClick={createSelectedNodeWorkflow}
                  >
                    Create nested workflow
                  </Button>
                )
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="!h-6 !min-h-6 !px-2 !text-xs"
                disabled={
                  readOnly ||
                  (selection.nodeIds.length === 0 &&
                    selection.edgeIds.length === 0 &&
                    (selection.groupIds?.length ?? 0) === 0)
                }
                onClick={deleteSelection}
              >
                Delete
              </Button>
              {renderToolbarActions?.(inspectorContext)}
            </div>
          </div>
        </div>
      )}
      <main
        data-slot="workbench-canvas"
        className="relative grid min-h-0 overflow-hidden bg-background"
      >
        <div className="grid min-h-0 min-w-0 p-3">
          <div
            ref={containerRef}
            className="relative min-h-0 min-w-0"
            onPointerDownCapture={startCanvasPointerInteraction}
            onPointerMoveCapture={updateCanvasPointerInteraction}
            onPointerUpCapture={(event) => {
              if (!completeCanvasPointerInteraction(event)) {
                clearPendingConnectionAfterTargetClick(event);
              }
            }}
            onPointerUp={() => {
              completeMarquee();
              completePendingNodeSnap();
            }}
            onPointerCancel={(event) => {
              cancelCanvasPointerInteraction(event);
              marqueeRef.current = null;
              pendingNodeSnapRef.current = null;
              setMarquee(null);
            }}
            onDoubleClickCapture={startNodeRenameFromDoubleClick}
            onDragOver={handleTemplateDragOver}
            onDrop={handleTemplateDrop}
          >
            <WorkflowWorkbenchNodeLayerStyles
              nodes={document.nodes}
              objectConstructorExpressionDrafts={objectConstructorExpressionDrafts}
              primaryNodeId={primarySelectedNodeId}
            />
            <WorkflowBuilder
              className="flex h-full min-h-0 min-w-0 flex-col [&>[data-slot='workflow-builder-surface']]:flex-1 [&>[data-slot='workflow-builder-surface']]:basis-0 [&_[data-slot='workflow-node'][data-minimized='true']]:!h-9 [&_[data-slot='workflow-node'][data-minimized='true']]:!min-h-9 [&_[data-slot='workflow-node'][data-minimized='true']]:!flex-row [&_[data-slot='workflow-node'][data-minimized='true']]:items-stretch [&_[data-slot='workflow-node'][data-minimized='true']>[data-slot='workflow-node-header']]:relative [&_[data-slot='workflow-node'][data-minimized='true']>[data-slot='workflow-node-header']]:z-10 [&_[data-slot='workflow-node'][data-minimized='true']>[data-slot='workflow-node-header']]:!h-9 [&_[data-slot='workflow-node'][data-minimized='true']>[data-slot='workflow-node-header']]:!min-h-9 [&_[data-slot='workflow-node'][data-minimized='true']>[data-slot='workflow-node-header']]:!flex-1 [&_[data-slot='workflow-node'][data-minimized='true']>[data-slot='workflow-node-header']]:!rounded-lg [&_[data-slot='workflow-node'][data-minimized='true']>[data-slot='workflow-node-header']]:!border-b-0 [&_[data-slot='workflow-node'][data-minimized='true']>[data-slot='workflow-node-header']]:!px-2 [&_[data-slot='workflow-node'][data-minimized='true']>[data-slot='workflow-node-header']]:!py-1.5 [&_[data-slot='workflow-node'][data-minimized='true']_[data-slot='workflow-node-header']>div]:items-center [&_[data-slot='workflow-node'][data-minimized='true']_[data-slot='workflow-node-header']>div>div:last-child]:!mt-0 [&_[data-slot='workflow-node'][data-minimized='true']_[data-slot='workflow-node-select']>div+div]:hidden [&_[data-slot='workflow-node'][data-minimized='true']_[data-slot='workflow-node-minimize']]:relative [&_[data-slot='workflow-node'][data-minimized='true']_[data-slot='workflow-node-minimize']]:z-20 [&_[data-slot='workflow-node'][data-minimized='true']>[data-slot='workflow-node-minimized-ports']]:!absolute [&_[data-slot='workflow-node'][data-minimized='true']>[data-slot='workflow-node-minimized-ports']]:inset-0 [&_[data-slot='workflow-node'][data-minimized='true']>[data-slot='workflow-node-minimized-ports']]:z-0 [&_[data-slot='workflow-node'][data-minimized='true']>[data-slot='workflow-node-minimized-ports']]:!h-auto [&_[data-slot='workflow-node'][data-minimized='true']>[data-slot='workflow-node-minimized-ports']]:!border-t-0 [&_[data-slot='workflow-node'][data-minimized='true']>[data-slot='workflow-node-minimized-ports']]:!bg-transparent [&_[data-slot='workflow-node'][data-minimized='true']>[data-slot='workflow-node-minimized-ports']]:pointer-events-none [&_[data-slot='workflow-node'][data-minimized='true']>[data-slot='workflow-node-minimized-ports']>div]:hidden [&_[data-slot='workflow-node'][data-minimized='true']>[data-slot='workflow-node-minimized-ports']>[data-slot='workflow-node-port']]:!z-0 [&_[data-slot='workflow-node'][data-minimized='true']>[data-slot='workflow-node-minimized-ports']>[data-slot='workflow-node-port']]:pointer-events-auto [&_[data-slot='workflow-node'][data-minimized='true']>[data-slot='workflow-node-minimized-ports']>[data-slot='workflow-node-port']]:-translate-y-1/2 [&_[data-slot='workflow-node'][data-compact='true']_[data-slot='workflow-node-port']]:!z-0"
              nodes={uiNodes}
              edges={uiEdges}
              selectedNodeId={primarySelectedNodeId}
              selectedEdgeId={primarySelectedEdgeId}
              selectedGroupId={primarySelectedGroupId}
              hiddenNodeIds={hiddenNodeIds}
              hiddenEdgeIds={hiddenEdgeIds}
              readOnly={readOnly}
              showMiniMap
              showPortColumnHeaders={false}
              surfaceHeight="auto"
              minZoom={workflowEditorMinZoom}
              maxZoom={workflowEditorMaxZoom}
              viewport={document.viewport}
              toolbarLabel="Workflow"
              onNodesChange={(nodes) => {
                if (!readOnly) {
                  const nodeIds = new Set(nodes.map((node) => node.id));
                  const movedNodeIds = nodes
                    .filter((node) => {
                      const currentNode = documentContext.nodeById.get(node.id);
                      return currentNode && (currentNode.x !== node.x || currentNode.y !== node.y);
                    })
                    .map((node) => node.id);
                  const nextDocument = normalizeWorkflowEditorDocument({
                    ...document,
                    nodes: fromUiWorkflowBuilderNodes(nodes, document.nodes),
                    edges: document.edges.filter(
                      (edge) => nodeIds.has(edge.sourceNodeId) && nodeIds.has(edge.targetNodeId),
                    ),
                  });
                  const snappedDocument = movedNodeIds.reduce(
                    (currentDocument, nodeId) =>
                      snapWorkflowEditorNodePositionToCompatiblePort(currentDocument, nodeId, {
                        typeDefinitions,
                      }),
                    nextDocument,
                  );

                  if (movedNodeIds.length > 0) {
                    const pendingSnap = pendingNodeSnapRef.current ?? {
                      document: snappedDocument,
                      nodeIds: new Set<string>(),
                    };
                    pendingSnap.document = snappedDocument;

                    for (const nodeId of movedNodeIds) {
                      pendingSnap.nodeIds.add(nodeId);
                    }

                    pendingNodeSnapRef.current = pendingSnap;
                  }

                  commitDocument(snappedDocument);
                }
              }}
              getNodeDragGroupIds={(nodeId) => {
                const groupId = getWorkflowEditorNodeGroupId(document, nodeId);
                const group = groupId
                  ? document.groups?.find((candidate) => candidate.id === groupId)
                  : undefined;
                return group?.nodeIds ?? [nodeId];
              }}
              onNodePointerSelect={(nodeId) => {
                const groupId = getWorkflowEditorNodeGroupId(document, nodeId);
                return groupId ? { type: "group", id: groupId } : undefined;
              }}
              onEdgesChange={(edges) => {
                if (!readOnly) {
                  const uiCreatedEdge = edges.find(
                    (edge) => !document.edges.some((currentEdge) => currentEdge.id === edge.id),
                  );

                  if (uiCreatedEdge) {
                    commitWorkflowEditorConnection(uiCreatedEdge, { fromUiCreatedEdge: true });
                    return;
                  }

                  commitDocument(
                    normalizeWorkflowEditorDocument({
                      ...document,
                      edges: fromUiWorkflowBuilderEdges(edges, document.edges),
                    }),
                  );
                }
              }}
              onViewportChange={(viewport) => {
                commitViewportChange(viewport);
              }}
              onSelectionChange={handleBuilderSelection}
              onConnectionStart={() => {
                connectionInProgressRef.current = true;
              }}
              onConnectionCancel={() => {
                connectionInProgressRef.current = false;
              }}
              isConnectionValid={(connection) => {
                const validity = validateWorkflowEditorConnection(
                  document,
                  toWorkflowWorkbenchConnectionInput(connection),
                  { typeDefinitions },
                );

                return {
                  valid: validity.valid,
                  reason: toUiConnectionInvalidReason(validity.reason),
                };
              }}
              onConnectionComplete={(connection) => {
                connectionInProgressRef.current = false;
                if (!readOnly) {
                  commitWorkflowEditorConnection(connection);
                }
              }}
              onDoubleClick={() => {
                openSelectedNodeWorkflow();
              }}
            />
            {chrome?.nodeControls === "hidden" ? null : (
              <>
                <WorkflowNodeActionMenus
                  containerRef={containerRef}
                  document={document}
                  readOnly={readOnly}
                  onDeleteNode={deleteNode}
                />
                <WorkflowGroupOverlays
                  document={document}
                  readOnly={readOnly}
                  selectedGroupId={primarySelectedGroupId}
                  zoom={document.viewport?.zoom ?? 1}
                  onDeleteGroup={(groupId) => {
                    emitSelectionState({
                      nodeIds: [],
                      edgeIds: [],
                      groupIds: [groupId],
                      primary: { type: "group", id: groupId },
                    });
                    commitDocument(
                      removeWorkflowEditorSelection(document, {
                        nodeIds: [],
                        edgeIds: [],
                        groupIds: [groupId],
                        primary: { type: "group", id: groupId },
                      }),
                    );
                  }}
                  onMoveGroup={(groupId, delta) => {
                    commitDocument(moveWorkflowEditorGroup(document, groupId, delta));
                  }}
                  onRenameGroup={(groupId, label) => {
                    const nextLabel = label.trim();
                    if (nextLabel) {
                      commitDocument(
                        updateWorkflowEditorGroup(document, groupId, { label: nextLabel }),
                      );
                    }
                  }}
                  onSelectGroup={(groupId) => {
                    emitSelectionState({
                      nodeIds: [],
                      edgeIds: [],
                      groupIds: [groupId],
                      primary: { type: "group", id: groupId },
                    });
                  }}
                  onToggleGroupMinimized={(groupId) => {
                    const group = document.groups?.find((candidate) => candidate.id === groupId);
                    if (group) {
                      commitDocument(
                        updateWorkflowEditorGroup(document, groupId, {
                          minimized: group.minimized !== true,
                        }),
                      );
                    }
                  }}
                  onUngroupGroup={(groupId) => {
                    const group = document.groups?.find((candidate) => candidate.id === groupId);
                    const nextDocument = ungroupWorkflowEditorGroup(document, groupId);
                    commitDocument(nextDocument);
                    emitSelectionState(
                      {
                        nodeIds: group?.nodeIds ?? [],
                        edgeIds: [],
                        ...(group?.nodeIds[0]
                          ? { primary: { type: "node", id: group.nodeIds[0] } }
                          : {}),
                      },
                      nextDocument,
                    );
                  }}
                />
                <WorkflowSelectionOverlay
                  document={document}
                  marquee={marquee}
                  primaryNodeId={primarySelectedNodeId}
                  selection={selection}
                />
                <WorkflowJsonPrimitiveNodeControls
                  containerRef={containerRef}
                  document={document}
                  readOnly={readOnly}
                  onFocusNode={selectWorkflowJsonPrimitiveNode}
                  onValueChange={updateWorkflowJsonPrimitiveNodeValue}
                />
                <WorkflowNodeRenameControls
                  containerRef={containerRef}
                  document={document}
                  nodeId={renamingNodeId}
                  readOnly={readOnly}
                  onCancel={() => setRenamingNodeId(null)}
                  onCommit={(nodeId, label) => {
                    setRenamingNodeId(null);
                    updateWorkflowNodeLabel(nodeId, label);
                  }}
                />
                <WorkflowObjectConstructorNodeControls
                  containerRef={containerRef}
                  document={document}
                  expressionDrafts={objectConstructorExpressionDrafts}
                  readOnly={readOnly}
                  onDraftChange={updateWorkflowObjectConstructorExpressionDraft}
                  onFocusNode={selectWorkflowJsonPrimitiveNode}
                  onValueChange={updateWorkflowObjectConstructorExpressionValue}
                />
              </>
            )}
            {typeof chrome?.palette === "function" ? (
              chrome.palette(workbenchController)
            ) : chrome?.palette === "hidden" ? null : (
              <div
                data-slot="workflow-palette-overlay"
                ref={paletteRef}
                onClickCapture={preserveOverlaySelection}
                onFocusCapture={preserveOverlaySelection}
                onMouseDownCapture={preserveOverlaySelection}
                onPointerDownCapture={preserveOverlaySelection}
                className={cn(
                  "absolute z-[20000] flex max-h-[calc(100%-1.5rem)] max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-md border border-border/70 bg-card/95 text-sm shadow-md supports-backdrop-filter:backdrop-blur-xl",
                  effectivePaletteMinimized ? "w-44 p-2" : "w-96 p-3",
                )}
                style={paletteOverlayPosition}
              >
                <div className="flex min-h-0 flex-col gap-3">
                  <div
                    data-slot="workflow-palette-header"
                    className={cn(
                      "flex flex-none touch-none select-none items-center justify-between gap-3 rounded-sm",
                      paletteDragging ? "cursor-grabbing" : "cursor-grab",
                    )}
                    onPointerCancel={completePaletteDrag}
                    onPointerDown={startPaletteDrag}
                    onPointerMove={updatePaletteDrag}
                    onPointerUp={completePaletteDrag}
                  >
                    <div className="min-w-0 truncate text-sm font-medium">Node palette</div>
                    <div className="flex items-center gap-2">
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            size="icon-sm"
                            variant="ghost"
                            aria-label="Pin node palette"
                          >
                            <PinIcon className="size-3.5" aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="z-[20010] w-40">
                          <DropdownMenuLabel>Pin to corner</DropdownMenuLabel>
                          <DropdownMenuItem onSelect={() => pinPaletteToCorner("top-left")}>
                            Top left
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => pinPaletteToCorner("top-right")}>
                            Top right
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => pinPaletteToCorner("bottom-left")}>
                            Bottom left
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => pinPaletteToCorner("bottom-right")}>
                            Bottom right
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                      <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={
                          effectivePaletteMinimized
                            ? "Expand node palette"
                            : "Minimize node palette"
                        }
                        aria-pressed={effectivePaletteMinimized}
                        onClick={() => setPaletteMinimizedState(!effectivePaletteMinimized)}
                      >
                        {effectivePaletteMinimized ? (
                          <Maximize2Icon className="size-3.5" aria-hidden="true" />
                        ) : (
                          <Minimize2Icon className="size-3.5" aria-hidden="true" />
                        )}
                      </Button>
                    </div>
                  </div>
                  {effectivePaletteMinimized ? null : (
                    <>
                      <SearchField
                        value={paletteSearchValue}
                        onValueChange={setPaletteSearchValue}
                        placeholder="Search nodes"
                        clearLabel="Clear node search"
                        inputProps={{ "aria-label": "Search node palette" }}
                      />
                      <div className="min-h-0 overflow-y-auto pr-1">
                        {filteredNodeTemplates.length > 0 ? (
                          <div className="grid gap-3">
                            {paletteGroups.map((group) => renderPaletteCategoryGroup(group))}
                          </div>
                        ) : nodeTemplates.length > 0 ? (
                          <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                            No matching node templates
                          </div>
                        ) : (
                          <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                            No node templates
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
            {typeof chrome?.inspector === "function" ? (
              chrome.inspector(workbenchController)
            ) : chrome?.inspector === "hidden" ? null : (
              <div
                data-slot="workflow-inspector-overlay"
                ref={inspectorRef}
                onClickCapture={preserveOverlaySelection}
                onFocusCapture={preserveOverlaySelection}
                onMouseDownCapture={preserveOverlaySelection}
                onPointerDownCapture={preserveOverlaySelection}
                className={cn(
                  "absolute z-[20000] flex max-h-[calc(100%-1.5rem)] max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-md border border-border/70 bg-card/95 text-sm shadow-md supports-backdrop-filter:backdrop-blur-xl",
                  inspectorCollapsed ? "w-44 p-2" : "w-[min(20rem,calc(100%-1.5rem))] p-3",
                )}
                style={inspectorOverlayPosition}
              >
                <div className="flex min-h-0 flex-col gap-3">
                  <div
                    data-slot="workflow-inspector-header"
                    className={cn(
                      "flex flex-none touch-none select-none items-center justify-between gap-3 rounded-sm",
                      inspectorDragging ? "cursor-grabbing" : "cursor-grab",
                    )}
                    onPointerCancel={completeInspectorDrag}
                    onPointerDown={startInspectorDrag}
                    onPointerMove={updateInspectorDrag}
                    onPointerUp={completeInspectorDrag}
                  >
                    <div className="min-w-0 truncate text-sm font-medium">Info</div>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      aria-label={inspectorCollapsed ? "Expand info panel" : "Minimize info panel"}
                      aria-pressed={effectiveInspectorMinimized}
                      disabled={!selectedNode && !selectedEdge}
                      onClick={() => setInspectorMinimizedState(!effectiveInspectorMinimized)}
                    >
                      {inspectorCollapsed ? (
                        <Maximize2Icon className="size-3.5" aria-hidden="true" />
                      ) : (
                        <Minimize2Icon className="size-3.5" aria-hidden="true" />
                      )}
                    </Button>
                  </div>
                  {inspectorCollapsed ? null : (
                    <div className="min-h-0 overflow-y-auto">
                      {renderInspector ? (
                        renderInspector(inspectorContext)
                      ) : (
                        <DefaultWorkflowInspector context={inspectorContext} />
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export type WorkflowWorkbenchControllerProps<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
> = WorkflowWorkbenchProps<TNodeData, TEdgeData, TTemplateData>;

export function useWorkflowWorkbenchController<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
>({
  document,
  selectedNodeId,
  selectedEdgeId,
  selectedNodeIds,
  selectedEdgeIds,
  selectedGroupIds,
  readOnly = false,
  nodeTemplates = defaultWorkflowEditorNodeTemplates as ReadonlyArray<
    WorkflowWorkbenchPaletteItem<TTemplateData>
  >,
  typeDefinitions,
  documentReferences,
  showGraphStats = true,
  showShortcutHint = true,
  onDocumentChange,
  onSelectionChange,
  onSelectionStateChange,
  onViewportChange,
  onOpenWorkflowReference,
  onCreateWorkflowReference,
  renderNodeTemplate,
  renderInspector,
  renderToolbarActions,
}: WorkflowWorkbenchControllerProps<TNodeData, TEdgeData, TTemplateData>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [internalSelection, setInternalSelection] = useState<WorkflowEditorSelectionState>(
    emptyWorkflowEditorSelection,
  );
  const [paletteSearchValue, setPaletteSearchValue] = useState("");
  const [paletteMinimized, setPaletteMinimized] = useState(false);
  const [palettePlacement, setPalettePlacement] =
    useState<WorkflowWorkbenchPanelPlacement>("top-left");
  const [palettePosition, setPalettePosition] = useState<WorkflowWorkbenchOverlayPosition>(null);
  const [inspectorMinimized, setInspectorMinimized] = useState(false);
  const [inspectorPosition, setInspectorPosition] =
    useState<WorkflowWorkbenchOverlayPosition>(null);
  const externalSelectionProvided =
    selectedNodeIds !== undefined ||
    selectedEdgeIds !== undefined ||
    selectedGroupIds !== undefined ||
    selectedNodeId !== undefined ||
    selectedEdgeId !== undefined;
  const rawSelection = useMemo<WorkflowEditorSelectionState>(() => {
    if (
      selectedNodeIds !== undefined ||
      selectedEdgeIds !== undefined ||
      selectedGroupIds !== undefined
    ) {
      const nodeIds = [...(selectedNodeIds ?? [])];
      const edgeIds = [...(selectedEdgeIds ?? [])];
      const groupIds = [...(selectedGroupIds ?? [])];
      const primary =
        groupIds.length > 0
          ? ({ type: "group", id: groupIds.at(-1)! } as const)
          : nodeIds.length > 0
            ? ({ type: "node", id: nodeIds.at(-1)! } as const)
            : edgeIds.length > 0
              ? ({ type: "edge", id: edgeIds.at(-1)! } as const)
              : undefined;

      return {
        nodeIds,
        edgeIds,
        ...(groupIds.length > 0 ? { groupIds } : {}),
        ...(primary ? { primary } : {}),
      };
    }

    if (selectedNodeId) {
      return {
        nodeIds: [selectedNodeId],
        edgeIds: [],
        primary: { type: "node", id: selectedNodeId },
      };
    }

    if (selectedEdgeId) {
      return {
        nodeIds: [],
        edgeIds: [selectedEdgeId],
        primary: { type: "edge", id: selectedEdgeId },
      };
    }

    return externalSelectionProvided ? emptyWorkflowEditorSelection : internalSelection;
  }, [
    externalSelectionProvided,
    internalSelection,
    selectedEdgeId,
    selectedEdgeIds,
    selectedGroupIds,
    selectedNodeId,
    selectedNodeIds,
  ]);
  const selection = useMemo(
    () => normalizeWorkflowEditorSelection(document, rawSelection),
    [document, rawSelection],
  );
  const documentContext = useMemo(() => createWorkflowEditorDocumentContext(document), [document]);
  const selectedNode =
    selection.primary?.type === "node"
      ? documentContext.nodeById.get(selection.primary.id)
      : selection.nodeIds[0]
        ? documentContext.nodeById.get(selection.nodeIds[0])
        : undefined;
  const selectedEdge =
    selection.primary?.type === "edge"
      ? documentContext.edgeById.get(selection.primary.id)
      : selection.edgeIds[0]
        ? documentContext.edgeById.get(selection.edgeIds[0])
        : undefined;
  const selectedGroup =
    selection.primary?.type === "group"
      ? document.groups?.find((group) => group.id === selection.primary?.id)
      : selection.groupIds?.[0]
        ? document.groups?.find((group) => group.id === selection.groupIds?.[0])
        : undefined;
  const selectedGroups = (selection.groupIds ?? []).flatMap((id) => {
    const group = document.groups?.find((candidate) => candidate.id === id);
    return group ? [group] : [];
  });
  const selectedNodes = selection.nodeIds.flatMap((id) => {
    const node = documentContext.nodeById.get(id);
    return node ? [node] : [];
  });
  const selectedEdges = selection.edgeIds.flatMap((id) => {
    const edge = documentContext.edgeById.get(id);
    return edge ? [edge] : [];
  });
  const filteredItems = useMemo(
    () => filterWorkflowWorkbenchPaletteTemplates(nodeTemplates, paletteSearchValue),
    [nodeTemplates, paletteSearchValue],
  );
  const groups = useMemo(
    () => createWorkflowWorkbenchPaletteCategoryGroups(filteredItems),
    [filteredItems],
  );

  const setSelection = (nextSelection: WorkflowEditorSelectionState) => {
    const normalizedSelection = normalizeWorkflowEditorSelection(document, nextSelection);
    if (!externalSelectionProvided) {
      setInternalSelection(normalizedSelection);
    }
    onSelectionStateChange?.(normalizedSelection);
    onSelectionChange?.(selectionStateToSingleSelection(document, normalizedSelection));
  };
  const updateDocument = (nextDocument: WorkflowEditorDocument<TNodeData, TEdgeData>) => {
    if (!readOnly) {
      onDocumentChange?.(nextDocument);
    }
  };
  const updateSelectedNode = (patch: Partial<WorkflowEditorNode<TNodeData>>) => {
    if (!readOnly && selectedNode) {
      onDocumentChange?.(updateWorkflowEditorNode(document, selectedNode.id, patch));
    }
  };
  const updateSelectedEdge = (patch: Partial<WorkflowEditorEdge<TEdgeData>>) => {
    if (!readOnly && selectedEdge) {
      onDocumentChange?.({
        ...document,
        edges: document.edges.map((edge) =>
          edge.id === selectedEdge.id ? { ...edge, ...patch, id: edge.id } : edge,
        ),
      });
    }
  };
  const addTemplateNode = (
    template: WorkflowWorkbenchPaletteItem<TTemplateData>,
    position?: WorkflowEditorPoint,
  ) => {
    if (readOnly) {
      return;
    }
    const id = createTemplateNodeId(document.nodes, template.id);
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
      x: position?.x ?? 120 + document.nodes.length * 36,
      y: position?.y ?? 120 + document.nodes.length * 28,
      inputs: template.inputs,
      outputs: template.outputs,
      data: template.data as TNodeData | undefined,
      workflowRef: template.workflowRef,
      composition: template.composition as WorkflowEditorNode<TNodeData>["composition"],
    };
    const nextDocument = { ...document, nodes: [...document.nodes, node] };
    onDocumentChange?.(nextDocument);
    setSelection({ nodeIds: [id], edgeIds: [], primary: { type: "node", id } });
  };
  const deleteSelection = () => {
    if (
      !readOnly &&
      (selection.nodeIds.length > 0 ||
        selection.edgeIds.length > 0 ||
        (selection.groupIds?.length ?? 0) > 0)
    ) {
      const nextDocument = removeWorkflowEditorSelection(document, selection);
      onDocumentChange?.(nextDocument);
      setSelection(emptyWorkflowEditorSelection);
    }
  };
  const duplicateSelection = () => {
    if (
      readOnly ||
      (selection.nodeIds.length === 0 &&
        selection.edgeIds.length === 0 &&
        (selection.groupIds?.length ?? 0) === 0)
    ) {
      return;
    }
    const result = duplicateWorkflowEditorSelection(document, selection);
    onDocumentChange?.(result.document);
    setSelection({
      nodeIds: result.nodeIds,
      edgeIds: result.edgeIds,
      ...(result.groupIds?.length ? { groupIds: result.groupIds } : {}),
      ...(result.groupIds?.[0]
        ? { primary: { type: "group", id: result.groupIds[0] } }
        : result.nodeIds[0]
          ? { primary: { type: "node", id: result.nodeIds[0] } }
          : {}),
    });
  };
  const copySelection = () => {
    if (
      selection.nodeIds.length === 0 &&
      selection.edgeIds.length === 0 &&
      (selection.groupIds?.length ?? 0) === 0
    ) {
      return;
    }
    const text = JSON.stringify(copyWorkflowEditorSelection(document, selection));
    workflowEditorMemoryClipboard = text;
    void navigator.clipboard?.writeText(text).catch(() => {});
  };
  const pasteSelection = async () => {
    if (readOnly) {
      return;
    }
    let text = workflowEditorMemoryClipboard;
    if (!text) {
      try {
        text = (await navigator.clipboard?.readText?.()) ?? null;
      } catch {
        text = null;
      }
    }
    if (!text) {
      return;
    }
    try {
      const result = pasteWorkflowEditorClipboardPayload(document, JSON.parse(text));
      onDocumentChange?.(result.document);
      setSelection({
        nodeIds: result.nodeIds,
        edgeIds: result.edgeIds,
        ...(result.groupIds?.length ? { groupIds: result.groupIds } : {}),
        ...(result.groupIds?.[0]
          ? { primary: { type: "group", id: result.groupIds[0] } }
          : result.nodeIds[0]
            ? { primary: { type: "node", id: result.nodeIds[0] } }
            : {}),
      });
    } catch {
      return;
    }
  };
  const arrangeSelection = () => {
    const nodeIds = selectedGroup?.nodeIds ?? selection.nodeIds;
    if (!readOnly && nodeIds.length > 0) {
      onDocumentChange?.(layoutWorkflowEditorDocument(document, { nodeIds }).document);
    }
  };
  const arrangeAll = () => {
    if (!readOnly && document.nodes.length > 0) {
      onDocumentChange?.(layoutWorkflowEditorDocument(document).document);
    }
  };
  const updateSelectedNodeWorkflowReference = (documentId: string | null) => {
    if (!readOnly && selectedNode) {
      onDocumentChange?.(
        updateWorkflowEditorNodeWorkflowReference(
          document,
          selectedNode.id,
          documentId ? { documentId } : null,
        ),
      );
    }
  };
  const groupSelection = () => {
    if (readOnly || selection.nodeIds.length < 2) {
      return;
    }

    const nextDocument = createWorkflowEditorGroup(document, selection.nodeIds);
    const previousGroupIds = new Set((document.groups ?? []).map((group) => group.id));
    const group = (nextDocument.groups ?? []).find(
      (candidate) => !previousGroupIds.has(candidate.id),
    );
    onDocumentChange?.(nextDocument);
    if (group) {
      setSelection({
        nodeIds: [],
        edgeIds: [],
        groupIds: [group.id],
        primary: { type: "group", id: group.id },
      });
    }
  };
  const ungroupSelection = () => {
    if (readOnly || !selectedGroup) {
      return;
    }
    const nextDocument = ungroupWorkflowEditorGroup(document, selectedGroup.id);
    onDocumentChange?.(nextDocument);
    setSelection({
      nodeIds: selectedGroup.nodeIds,
      edgeIds: [],
      ...(selectedGroup.nodeIds[0]
        ? { primary: { type: "node", id: selectedGroup.nodeIds[0] } }
        : {}),
    });
  };
  const updateSelectedGroup = (patch: Partial<WorkflowEditorGroup>) => {
    if (!readOnly && selectedGroup) {
      onDocumentChange?.(updateWorkflowEditorGroup(document, selectedGroup.id, patch));
    }
  };
  const renameSelectedGroup = (label: string) => {
    const nextLabel = label.trim();
    if (nextLabel) {
      updateSelectedGroup({ label: nextLabel });
    }
  };
  const toggleSelectedGroupMinimized = () => {
    if (selectedGroup) {
      updateSelectedGroup({ minimized: selectedGroup.minimized !== true });
    }
  };
  const inspectorContext = {
    document,
    documentReferences,
    readOnly,
    selection,
    selectedEdges,
    selectedNodes,
    selectedEdge,
    selectedNode,
    openSelectedNodeWorkflow: selectedNode
      ? () => selectedNode && onOpenWorkflowReference?.(selectedNode)
      : undefined,
    createSelectedNodeWorkflow: selectedNode
      ? () => selectedNode && onCreateWorkflowReference?.(selectedNode)
      : undefined,
    updateDocument,
    updateSelectedEdge,
    updateSelectedNode,
    updateSelectedNodeWorkflowReference,
  } satisfies WorkflowWorkbenchInspectorContext<TNodeData, TEdgeData>;

  return {
    document,
    readOnly,
    selection,
    selectedEdge,
    selectedEdges,
    selectedGroup,
    selectedGroups,
    selectedNode,
    selectedNodes,
    palette: {
      groups,
      items: nodeTemplates,
      filteredItems,
      minimized: paletteMinimized,
      placement: palettePlacement,
      position: palettePosition,
      searchValue: paletteSearchValue,
      setMinimized: setPaletteMinimized,
      setPlacement: setPalettePlacement,
      setPosition: setPalettePosition,
      setSearchValue: setPaletteSearchValue,
    },
    inspector: {
      context: inspectorContext,
      collapsed: inspectorMinimized || (!selectedNode && !selectedEdge),
      minimized: inspectorMinimized,
      position: inspectorPosition,
      setMinimized: setInspectorMinimized,
      setPosition: setInspectorPosition,
    },
    toolbar: { showGraphStats, showShortcutHint },
    canvas: { containerRef },
    overlays: {
      palette: {
        minimized: paletteMinimized,
        placement: palettePlacement,
        position: palettePosition,
      },
      inspector: {
        minimized: inspectorMinimized,
        position: inspectorPosition,
      },
    },
    configuration: {
      documentReferences,
      nodeTemplates,
      onCreateWorkflowReference,
      onOpenWorkflowReference,
      onSelectionChange,
      onSelectionStateChange,
      onViewportChange,
      renderInspector,
      renderNodeTemplate,
      renderToolbarActions,
      typeDefinitions,
    },
    actions: {
      addTemplateNode,
      arrangeAll,
      arrangeSelection,
      copySelection,
      createSelectedNodeWorkflow: () => selectedNode && onCreateWorkflowReference?.(selectedNode),
      deleteSelection,
      duplicateSelection,
      groupSelection,
      openSelectedNodeWorkflow: () => selectedNode && onOpenWorkflowReference?.(selectedNode),
      pasteSelection,
      renameSelectedGroup,
      setSelection,
      toggleSelectedGroupMinimized,
      ungroupSelection,
      updateDocument,
      updateSelectedGroup,
      updateSelectedEdge,
      updateSelectedNode,
      updateSelectedNodeWorkflowReference,
    },
  } satisfies WorkflowWorkbenchController<TNodeData, TEdgeData, TTemplateData>;
}

export function WorkflowWorkbenchCanvas<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
>({
  controller,
  className,
}: {
  controller: WorkflowWorkbenchController<TNodeData, TEdgeData, TTemplateData>;
  className?: string;
}) {
  return (
    <WorkflowWorkbench
      className={className}
      document={controller.document}
      readOnly={controller.readOnly}
      selectedNodeIds={controller.selection.nodeIds}
      selectedEdgeIds={controller.selection.edgeIds}
      selectedGroupIds={controller.selection.groupIds}
      nodeTemplates={controller.configuration.nodeTemplates}
      typeDefinitions={controller.configuration.typeDefinitions}
      documentReferences={controller.configuration.documentReferences}
      chrome={{ toolbar: "hidden", palette: "hidden", inspector: "hidden" }}
      onDocumentChange={controller.actions.updateDocument}
      onSelectionChange={controller.configuration.onSelectionChange}
      onSelectionStateChange={controller.actions.setSelection}
      onViewportChange={controller.configuration.onViewportChange}
      onOpenWorkflowReference={controller.configuration.onOpenWorkflowReference}
      onCreateWorkflowReference={controller.configuration.onCreateWorkflowReference}
      renderNodeTemplate={controller.configuration.renderNodeTemplate}
      renderInspector={controller.configuration.renderInspector}
      renderToolbarActions={controller.configuration.renderToolbarActions}
    />
  );
}

export function WorkflowWorkbenchToolbar<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
>({
  controller,
}: {
  controller: WorkflowWorkbenchController<TNodeData, TEdgeData, TTemplateData>;
}) {
  return (
    <div data-slot="workbench-toolbar" className="flex flex-wrap items-center gap-2">
      {controller.toolbar.showGraphStats ? (
        <>
          <Badge variant="outline">{controller.document.nodes.length} nodes</Badge>
          <Badge variant="outline">{controller.document.edges.length} edges</Badge>
        </>
      ) : null}
      <Badge variant="outline">
        {controller.selection.nodeIds.length +
          controller.selection.edgeIds.length +
          (controller.selection.groupIds?.length ?? 0)}{" "}
        selected
      </Badge>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={controller.readOnly}
        onClick={controller.actions.duplicateSelection}
      >
        Duplicate
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={controller.actions.copySelection}>
        Copy
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={controller.readOnly}
        onClick={() => void controller.actions.pasteSelection()}
      >
        Paste
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={controller.readOnly}
        onClick={controller.actions.arrangeAll}
      >
        Arrange all
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={controller.readOnly || controller.selection.nodeIds.length < 2}
        onClick={controller.actions.groupSelection}
      >
        Group
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={controller.readOnly || !controller.selectedGroup}
        onClick={controller.actions.ungroupSelection}
      >
        Ungroup
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={controller.readOnly}
        onClick={controller.actions.deleteSelection}
      >
        Delete
      </Button>
    </div>
  );
}

export function WorkflowWorkbenchPalette<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
>({
  controller,
  mode = "inline",
}: {
  controller: WorkflowWorkbenchController<TNodeData, TEdgeData, TTemplateData>;
  mode?: "inline" | "overlay";
}) {
  return (
    <div
      data-slot={mode === "overlay" ? "workflow-palette-overlay" : "workflow-palette"}
      className="grid min-h-0 gap-3 rounded-md border border-border bg-card p-3 text-sm"
    >
      <SearchField
        value={controller.palette.searchValue}
        onValueChange={controller.palette.setSearchValue}
        placeholder="Search nodes"
        clearLabel="Clear node search"
        inputProps={{ "aria-label": "Search node palette" }}
      />
      <div className="grid min-h-0 gap-3 overflow-y-auto">
        {controller.palette.filteredItems.length > 0 ? (
          controller.palette.groups.map((group) => (
            <WorkflowWorkbenchPaletteGroup key={group.id} controller={controller} group={group} />
          ))
        ) : (
          <div className="rounded-md border border-dashed p-3 text-muted-foreground">
            {controller.palette.items.length > 0
              ? "No matching node templates"
              : "No node templates"}
          </div>
        )}
      </div>
    </div>
  );
}

function WorkflowWorkbenchPaletteGroup<
  TNodeData extends Record<string, unknown>,
  TEdgeData extends Record<string, unknown>,
  TTemplateData,
>({
  controller,
  group,
}: {
  controller: WorkflowWorkbenchController<TNodeData, TEdgeData, TTemplateData>;
  group: WorkflowWorkbenchPaletteCategoryGroup<TTemplateData>;
}) {
  return (
    <section className="grid gap-2" aria-label={group.label}>
      <div className="flex items-center justify-between gap-3 text-[0.68rem] font-semibold uppercase text-muted-foreground">
        <span>{group.label}</span>
        {group.templates.length > 0 ? (
          <Badge variant="secondary">{group.templates.length}</Badge>
        ) : null}
      </div>
      <div className="grid gap-2">
        {group.templates.map((template) => (
          <Button
            key={template.id}
            type="button"
            variant="ghost"
            className="h-auto justify-start border border-border bg-background px-3 py-2 text-left"
            disabled={controller.readOnly}
            onClick={() => controller.actions.addTemplateNode(template)}
          >
            {template.label}
          </Button>
        ))}
      </div>
      {group.children.map((child) => (
        <div key={child.id} className="border-l border-border/60 pl-3">
          <WorkflowWorkbenchPaletteGroup controller={controller} group={child} />
        </div>
      ))}
    </section>
  );
}

export function WorkflowWorkbenchInspector<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
>({
  controller,
}: {
  controller: WorkflowWorkbenchController<TNodeData, TEdgeData, TTemplateData>;
}) {
  return (
    <div data-slot="workflow-inspector" className="min-h-0 overflow-y-auto">
      {controller.configuration.renderInspector ? (
        controller.configuration.renderInspector(controller.inspector.context)
      ) : (
        <DefaultWorkflowInspector context={controller.inspector.context} />
      )}
    </div>
  );
}

export function WorkflowEditorCurrentNodesPanel<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
>({
  controller,
}: {
  controller: WorkflowWorkbenchController<TNodeData, TEdgeData, TTemplateData>;
}) {
  const [search, setSearch] = useState("");
  const query = search.trim().toLowerCase();
  const nodes = controller.document.nodes.filter((node) =>
    [node.id, node.label, node.kind, node.category, node.description]
      .filter((value): value is string => typeof value === "string")
      .join("\n")
      .toLowerCase()
      .includes(query),
  );

  return (
    <section className="grid gap-3 rounded-md border border-border bg-card p-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Current nodes</h2>
        <Badge variant="outline">{nodes.length}</Badge>
      </div>
      <SearchField
        value={search}
        onValueChange={setSearch}
        placeholder="Search current nodes"
        clearLabel="Clear current node search"
        inputProps={{ "aria-label": "Search current nodes" }}
      />
      <div className="grid gap-2">
        {nodes.map((node) => (
          <WorkflowEditorCurrentNodeRow key={node.id} controller={controller} node={node} />
        ))}
        {nodes.length === 0 ? (
          <div className="rounded-md border border-dashed p-3 text-muted-foreground">No nodes</div>
        ) : null}
      </div>
    </section>
  );
}

function WorkflowEditorCurrentNodeRow<
  TNodeData extends Record<string, unknown>,
  TEdgeData extends Record<string, unknown>,
  TTemplateData,
>({
  controller,
  node,
}: {
  controller: WorkflowWorkbenchController<TNodeData, TEdgeData, TTemplateData>;
  node: WorkflowEditorNode<TNodeData>;
}) {
  const selected = controller.selection.nodeIds.includes(node.id);
  const [label, setLabel] = useState(node.label);

  return (
    <div className="grid gap-2 rounded-md border border-border p-2">
      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          size="sm"
          variant={selected ? "secondary" : "ghost"}
          className="min-w-0 justify-start truncate"
          onClick={() =>
            controller.actions.setSelection({
              nodeIds: [node.id],
              edgeIds: [],
              primary: { type: "node", id: node.id },
            })
          }
        >
          {node.label}
        </Button>
        {node.kind ? <Badge variant="outline">{node.kind}</Badge> : null}
      </div>
      <Input
        aria-label={`Rename ${node.label}`}
        value={label}
        disabled={controller.readOnly}
        onChange={(event) => setLabel(event.target.value)}
        onBlur={() =>
          label.trim()
            ? controller.actions.updateDocument(
                updateWorkflowEditorNode(controller.document, node.id, { label: label.trim() }),
              )
            : undefined
        }
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={controller.readOnly}
          onClick={() =>
            controller.actions.updateDocument(
              duplicateWorkflowEditorNode(controller.document, node.id),
            )
          }
        >
          Duplicate
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={controller.readOnly}
          onClick={() =>
            controller.actions.updateDocument(
              layoutWorkflowEditorDocument(controller.document, { nodeIds: [node.id] }).document,
            )
          }
        >
          Arrange selection
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={controller.readOnly}
          onClick={() =>
            controller.actions.updateDocument(
              removeWorkflowEditorNode(controller.document, node.id),
            )
          }
        >
          Delete
        </Button>
      </div>
    </div>
  );
}

export function WorkflowEditorCurrentNodeTypesPanel<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
>({
  controller,
}: {
  controller: WorkflowWorkbenchController<TNodeData, TEdgeData, TTemplateData>;
}) {
  const groups = Array.from(
    controller.document.nodes.reduce((map, node) => {
      const kind = node.kind?.trim() || "Unspecified";
      map.set(kind, [...(map.get(kind) ?? []), node]);
      return map;
    }, new Map<string, Array<WorkflowEditorNode<TNodeData>>>()),
  ).sort(([left], [right]) => left.localeCompare(right));

  return (
    <section className="grid gap-3 rounded-md border border-border bg-card p-3 text-sm">
      <h2 className="text-sm font-semibold">Current node types</h2>
      <div className="grid gap-2">
        {groups.map(([kind, nodes]) => (
          <Button
            key={kind}
            type="button"
            size="sm"
            variant="outline"
            className="justify-between"
            onClick={() =>
              controller.actions.setSelection({
                nodeIds: nodes.map((node) => node.id),
                edgeIds: [],
                primary: { type: "node", id: nodes[0]!.id },
              })
            }
          >
            <span>{kind}</span>
            <Badge variant="secondary">{nodes.length}</Badge>
          </Button>
        ))}
        {groups.length === 0 ? (
          <div className="rounded-md border border-dashed p-3 text-muted-foreground">
            No node types
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function WorkflowEditorComposedNodesPanel<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
>({
  controller,
}: {
  controller: WorkflowWorkbenchController<TNodeData, TEdgeData, TTemplateData>;
}) {
  const nodes = controller.document.nodes.filter((node) => node.composition);

  return (
    <section className="grid gap-3 rounded-md border border-border bg-card p-3 text-sm">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold">Composed nodes</h2>
        <Badge variant="outline">{nodes.length}</Badge>
      </div>
      <div className="grid gap-2">
        {nodes.map((node) => (
          <WorkflowEditorComposedNodeRow key={node.id} controller={controller} node={node} />
        ))}
        {nodes.length === 0 ? (
          <div className="rounded-md border border-dashed p-3 text-muted-foreground">
            No composed nodes
          </div>
        ) : null}
      </div>
    </section>
  );
}

function WorkflowEditorComposedNodeRow<
  TNodeData extends Record<string, unknown>,
  TEdgeData extends Record<string, unknown>,
  TTemplateData,
>({
  controller,
  node,
}: {
  controller: WorkflowWorkbenchController<TNodeData, TEdgeData, TTemplateData>;
  node: WorkflowEditorNode<TNodeData>;
}) {
  const [label, setLabel] = useState(node.label);

  return (
    <div className="grid gap-2 rounded-md border border-border p-2">
      <Button
        type="button"
        size="sm"
        variant={controller.selection.nodeIds.includes(node.id) ? "secondary" : "ghost"}
        className="justify-start"
        onClick={() =>
          controller.actions.setSelection({
            nodeIds: [node.id],
            edgeIds: [],
            primary: { type: "node", id: node.id },
          })
        }
      >
        {node.label}
      </Button>
      <Input
        aria-label={`Rename composed node ${node.label}`}
        value={label}
        disabled={controller.readOnly}
        onChange={(event) => setLabel(event.target.value)}
        onBlur={() =>
          label.trim()
            ? controller.actions.updateDocument(
                updateWorkflowEditorNode(controller.document, node.id, { label: label.trim() }),
              )
            : undefined
        }
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={controller.readOnly}
          onClick={() =>
            controller.actions.updateDocument(
              restoreWorkflowEditorComposedNode(controller.document, node.id),
            )
          }
        >
          Restore
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={controller.readOnly}
          onClick={() =>
            controller.actions.updateDocument(
              duplicateWorkflowEditorNode(controller.document, node.id),
            )
          }
        >
          Duplicate
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={controller.readOnly}
          onClick={() =>
            controller.actions.updateDocument(
              removeWorkflowEditorNode(controller.document, node.id),
            )
          }
        >
          Delete
        </Button>
      </div>
    </div>
  );
}

export function WorkflowWorkbenchOverlayPanel({
  children,
  className,
  style,
}: {
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      data-slot="workflow-overlay-panel"
      className={cn(
        "absolute z-[20000] flex max-h-[calc(100%-1.5rem)] max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-md border border-border/70 bg-card/95 text-sm shadow-md supports-backdrop-filter:backdrop-blur-xl",
        className,
      )}
      style={style}
    >
      {children}
    </div>
  );
}

export function WorkflowWorkbenchNodeControls() {
  return null;
}

export const WorkflowWorkbenchSelectionOverlay = WorkflowSelectionOverlay;

type WorkflowSelectionMarquee = {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
};

type WorkflowCanvasPanState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  viewport: WorkflowEditorViewport;
  panning: boolean;
};

type WorkflowPaletteCorner = WorkflowWorkbenchPanelPlacement;

type WorkflowOverlayPosition = WorkflowWorkbenchOverlayPosition;

type WorkflowOverlayDragState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  width: number;
  height: number;
};

export type WorkflowEditorPoint = {
  x: number;
  y: number;
};

function getWorkflowEditorPointFromClient(
  container: HTMLDivElement | null,
  clientX: number,
  clientY: number,
  zoom: number,
): WorkflowEditorPoint | null {
  const viewport = container?.querySelector<HTMLElement>("[data-slot='workflow-builder-viewport']");
  const rect = viewport?.getBoundingClientRect();

  if (!rect || zoom <= 0) {
    return null;
  }

  return {
    x: (clientX - rect.left) / zoom,
    y: (clientY - rect.top) / zoom,
  };
}

function clampWorkflowEditorZoom(zoom: number) {
  if (!Number.isFinite(zoom)) {
    return 1;
  }

  return Math.min(Math.max(zoom, workflowEditorMinZoom), workflowEditorMaxZoom);
}

function normalizeWorkflowEditorViewport(viewport: WorkflowEditorViewport | undefined) {
  const x = viewport?.x;
  const y = viewport?.y;
  const zoom = viewport?.zoom;

  return {
    x: typeof x === "number" && Number.isFinite(x) ? x : 0,
    y: typeof y === "number" && Number.isFinite(y) ? y : 0,
    zoom: clampWorkflowEditorZoom(zoom ?? 1),
  };
}

function getWorkflowEditorWheelDelta(event: WheelEvent) {
  const multiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 600 : 1;

  return {
    x: event.deltaX * multiplier,
    y: event.deltaY * multiplier,
  };
}

function WorkflowWorkbenchNodeLayerStyles<TNodeData extends Record<string, unknown>>({
  nodes,
  objectConstructorExpressionDrafts,
  primaryNodeId,
}: {
  nodes: Array<WorkflowEditorNode<TNodeData>>;
  objectConstructorExpressionDrafts?: Record<string, string>;
  primaryNodeId?: string;
}) {
  // The UI node body has no data-slot; constrain these overrides to its grid
  // container so INPUTS/OUTPUTS labels stay hidden without affecting portals.
  const styles = [
    `[data-slot="workbench-layout"] [data-slot="workflow-node"]:not([data-compact="true"]) > div.grid:not([data-slot]) > div > div:first-child { display: none !important; }`,
    `[data-slot="workbench-layout"] [data-slot="workflow-builder-node"] [data-slot="workflow-node-menu-trigger"] { visibility: hidden; pointer-events: none; }`,
    ...nodes.map((node, index) => {
      const selector = `[data-slot="workflow-builder-node"][data-node-id="${cssAttributeValue(node.id)}"]`;
      const layer = getWorkflowEditorNodeLayerIndex(index, node.id, primaryNodeId);
      const rules = [`${selector} { z-index: ${layer}; }`];
      const uiNode = toUiWorkflowBuilderNodes([node])[0]!;

      rules.push(...getWorkflowEditorPortColorRules(selector, uiNode));

      if ((node.inputs ?? []).length === 0) {
        rules.push(
          `${selector} [data-slot="workflow-node"]:not([data-compact="true"]):not([data-minimized="true"]) > div.grid:not([data-slot]) { grid-template-columns: minmax(0, 1fr) !important; }`,
          `${selector} [data-slot="workflow-node"]:not([data-compact="true"]):not([data-minimized="true"]) > div.grid:not([data-slot]) > div:first-child { display: none !important; }`,
        );
      }

      if (isWorkflowEditorJsonPrimitiveNode(node)) {
        rules.push(
          `${selector} [data-slot="workflow-node"]:not([data-minimized="true"]) [data-slot="workflow-node-port"][data-port-direction="output"][data-port-id="value"] > div > div > div:first-child { display: none !important; }`,
          `${selector} [data-slot="workflow-node"]:not([data-minimized="true"]) [data-slot="workflow-node-port"][data-port-direction="output"][data-port-id="value"] > div > span:nth-of-type(2) { display: none !important; }`,
          `${selector} [data-slot="workflow-node"][data-minimized="true"] [data-slot="workflow-node-select"] > div { visibility: hidden; }`,
        );
      }

      if (uiNode.minimized === true && node.variant !== "compact") {
        const width = getWorkflowEditorMinimizedNodeWidth(uiNode);
        rules.push(
          `${selector}, ${selector} > [data-slot="workflow-node"] { width: ${width}px !important; }`,
        );
      }

      if (isWorkflowEditorObjectConstructorNode(node) && node.minimized !== true) {
        const expressionDraft = objectConstructorExpressionDrafts?.[node.id];
        const validationMessage =
          expressionDraft === undefined
            ? undefined
            : validateWorkflowEditorObjectConstructorExpression(expressionDraft)[0]?.message;
        const width = getWorkflowEditorObjectConstructorRenderedWidth(
          uiNode,
          expressionDraft,
          validationMessage,
        );
        const height = getWorkflowEditorRenderedNodeSize(uiNode, {
          objectConstructorExpression: expressionDraft,
          objectConstructorValidationMessage: validationMessage,
        }).height;
        const outputPanelHeight = getWorkflowEditorObjectConstructorOutputPanelHeight(
          uiNode,
          expressionDraft,
          validationMessage,
        );
        rules.push(
          `${selector}, ${selector} > [data-slot="workflow-node"] { width: ${width}px !important; }`,
          `${selector} { height: ${height}px !important; }`,
          `${selector} > [data-slot="workflow-node"] { height: ${height}px !important; }`,
          `${selector} [data-slot="workflow-node-port"][data-port-direction="output"][data-port-id="value"] { height: ${outputPanelHeight}px !important; min-height: ${outputPanelHeight}px !important; }`,
        );
      }

      return rules.join("\n");
    }),
  ].join("\n");

  return styles ? <style data-slot="workflow-workbench-layer-styles">{styles}</style> : null;
}

function getWorkflowEditorPortColorRules(
  selector: string,
  node: ReturnType<typeof toUiWorkflowBuilderNodes>[number],
) {
  const rules: string[] = [];

  for (const direction of ["input", "output"] as const) {
    const ports = direction === "input" ? (node.inputs ?? []) : (node.outputs ?? []);
    const minimizedColor = readUiWorkflowNodePortColor(ports[0]);

    if (minimizedColor) {
      rules.push(
        `${selector} [data-slot="workflow-node-minimized-port"][data-port-direction="${direction}"] { color: ${minimizedColor}; border-color: ${minimizedColor}; }`,
      );
    }

    for (const port of ports) {
      const color = readUiWorkflowNodePortColor(port);

      if (!color) {
        continue;
      }

      const portSelector = `${selector} [data-slot="workflow-node-port"][data-port-direction="${direction}"][data-port-id="${cssAttributeValue(port.id)}"]`;
      rules.push(
        `${portSelector} { border-color: color-mix(in oklch, ${color} 58%, var(--border)); background-color: color-mix(in oklch, ${color} ${direction === "input" ? "9%" : "6%"}, transparent); }`,
        `${portSelector} [data-slot="workflow-node-port-dot"] { color: ${color}; }`,
      );
    }
  }

  return rules;
}

function readUiWorkflowNodePortColor(
  port:
    | NonNullable<ReturnType<typeof toUiWorkflowBuilderNodes>[number]["inputs"]>[number]
    | undefined,
) {
  const color =
    (port as { color?: unknown } | undefined)?.color ??
    (port?.metadata as { workflowEditorPortColor?: unknown } | undefined)?.workflowEditorPortColor;

  return typeof color === "string" && isSafeWorkflowEditorCssValue(color) ? color : undefined;
}

function isSafeWorkflowEditorCssValue(value: string) {
  return value.length <= 120 && !/[;{}\n\r<>]/.test(value);
}

function cssAttributeValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function getWorkflowEditorNodeLayerIndex(index: number, nodeId: string, primaryNodeId?: string) {
  return nodeId === primaryNodeId ? 10000 : index * 2 + 1;
}

function isWorkflowEditorDetachedNodeControlVisible<TNodeData extends Record<string, unknown>>(
  node: WorkflowEditorNode<TNodeData>,
) {
  return toUiWorkflowBuilderNodes([node])[0]?.minimized !== true;
}

function useWorkflowWorkbenchNodeElementMap<TNodeData extends Record<string, unknown>>(
  containerRef: RefObject<HTMLDivElement | null>,
  nodes: ReadonlyArray<WorkflowEditorNode<TNodeData>>,
) {
  const nodeFingerprint = nodes.map((node) => node.id).join("\u001f");
  const [nodeElements, setNodeElements] = useState<Map<string, HTMLElement>>(() => new Map());

  useEffect(() => {
    const container = containerRef.current;

    if (!container || nodes.length === 0) {
      setNodeElements((current) => (current.size === 0 ? current : new Map()));
      return;
    }

    const nextElements = new Map<string, HTMLElement>();

    for (const node of nodes) {
      const builderNode = container.querySelector<HTMLElement>(
        `[data-slot="workflow-builder-node"][data-node-id="${cssAttributeValue(node.id)}"]`,
      );
      const workflowNode =
        builderNode?.firstElementChild instanceof HTMLElement &&
        builderNode.firstElementChild.dataset.slot === "workflow-node"
          ? builderNode.firstElementChild
          : builderNode?.querySelector<HTMLElement>("[data-slot='workflow-node']");

      if (workflowNode) {
        nextElements.set(node.id, workflowNode);
      }
    }

    setNodeElements((current) =>
      areWorkflowWorkbenchNodeElementMapsEqual(current, nextElements) ? current : nextElements,
    );
  }, [containerRef, nodeFingerprint, nodes]);

  return nodeElements;
}

function areWorkflowWorkbenchNodeElementMapsEqual(
  current: ReadonlyMap<string, HTMLElement>,
  next: ReadonlyMap<string, HTMLElement>,
) {
  if (current.size !== next.size) {
    return false;
  }

  for (const [id, element] of next) {
    if (current.get(id) !== element) {
      return false;
    }
  }

  return true;
}

function WorkflowNodeRenameControls<
  TNodeData extends Record<string, unknown>,
  TEdgeData extends Record<string, unknown>,
>({
  containerRef,
  document,
  nodeId,
  onCancel,
  onCommit,
  readOnly,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  document: WorkflowEditorDocument<TNodeData, TEdgeData>;
  nodeId: string | null;
  onCancel: () => void;
  onCommit: (nodeId: string, label: string) => void;
  readOnly: boolean;
}) {
  const node = nodeId ? document.nodes.find((candidate) => candidate.id === nodeId) : undefined;
  const editableNodes = node && !readOnly ? [node] : [];
  const nodeElements = useWorkflowWorkbenchNodeElementMap(containerRef, editableNodes);

  if (!node || readOnly) {
    return null;
  }

  const target = nodeElements.get(node.id);
  if (!target) {
    return null;
  }

  const offset = getWorkflowNodeRenameControlOffset(node, target);

  return createPortal(
    <div
      className={workflowNodeControlFrameClassName}
      style={{
        left: offset.x,
        top: offset.y,
        width: offset.width,
      }}
    >
      <WorkflowNodeRenameControl node={node} onCancel={onCancel} onCommit={onCommit} />
    </div>,
    target,
    node.id,
  );
}

function WorkflowNodeRenameControl<TNodeData extends Record<string, unknown>>({
  node,
  onCancel,
  onCommit,
}: {
  node: WorkflowEditorNode<TNodeData>;
  onCancel: () => void;
  onCommit: (nodeId: string, label: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const closedRef = useRef(false);
  const [draft, setDraft] = useState(node.label);

  useEffect(() => {
    setDraft(node.label);
    closedRef.current = false;
  }, [node.id, node.label]);

  useEffect(() => {
    const input = inputRef.current;
    if (!input) {
      return;
    }

    input.focus();
    input.select();
  }, []);

  const commitDraft = () => {
    if (closedRef.current) {
      return;
    }

    closedRef.current = true;
    const nextLabel = draft.trim();

    if (!nextLabel || nextLabel === node.label) {
      onCancel();
      return;
    }

    onCommit(node.id, nextLabel);
  };

  const cancelDraft = () => {
    if (closedRef.current) {
      return;
    }

    closedRef.current = true;
    onCancel();
  };

  const stopInteractionPropagation = (event: SyntheticEvent) => {
    event.stopPropagation();
  };

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    event.stopPropagation();

    if (event.key === "Enter") {
      event.preventDefault();
      commitDraft();
      return;
    }

    if (event.key === "Escape") {
      event.preventDefault();
      cancelDraft();
    }
  };

  return (
    <div
      data-slot="workflow-node-rename-control"
      onPointerDownCapture={stopInteractionPropagation}
      onMouseDownCapture={stopInteractionPropagation}
      onClick={stopInteractionPropagation}
      onDoubleClick={stopInteractionPropagation}
    >
      <Input
        ref={inputRef}
        aria-label={`${node.label} node name`}
        className={cn(workflowNodeTextControlClassName, "h-7 w-full text-sm")}
        value={draft}
        onBlur={commitDraft}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onKeyDown={handleKeyDown}
      />
    </div>
  );
}

function getWorkflowNodeRenameControlOffset<TNodeData>(
  node: WorkflowEditorNode<TNodeData>,
  target: HTMLElement,
) {
  const targetRect = target.getBoundingClientRect();
  const selectElement = target.querySelector<HTMLElement>("[data-slot='workflow-node-select']");
  const selectRect = selectElement?.getBoundingClientRect();

  if (selectRect && targetRect.width > 0 && selectRect.width > 0) {
    return {
      x: Math.max(8, Math.round(selectRect.left - targetRect.left + 8)),
      y: Math.max(6, Math.round(selectRect.top - targetRect.top + 6)),
      width: Math.max(96, Math.round(selectRect.width - 16)),
    };
  }

  const size = getWorkflowEditorRenderedNodeSize(toUiWorkflowBuilderNodes([node])[0]!);
  const compact = node.variant === "compact" || toUiWorkflowBuilderNodes([node])[0]?.minimized;

  return {
    x: compact ? 10 : 12,
    y: compact ? 6 : 12,
    width: Math.max(96, size.width - (compact ? 48 : 24)),
  };
}

function WorkflowJsonPrimitiveNodeControls<
  TNodeData extends Record<string, unknown>,
  TEdgeData extends Record<string, unknown>,
>({
  containerRef,
  document,
  onFocusNode,
  onValueChange,
  readOnly,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  document: WorkflowEditorDocument<TNodeData, TEdgeData>;
  onFocusNode: (nodeId: string) => void;
  onValueChange: (nodeId: string, value: string | number | boolean | null) => void;
  readOnly: boolean;
}) {
  const primitiveNodes = document.nodes.filter(isWorkflowEditorJsonPrimitiveNode);
  const nodeElements = useWorkflowWorkbenchNodeElementMap(containerRef, primitiveNodes);

  if (primitiveNodes.length === 0) {
    return null;
  }

  return (
    <>
      {primitiveNodes.map((node) => {
        const target = nodeElements.get(node.id);
        if (!target) {
          return null;
        }

        const offset = getWorkflowJsonPrimitiveNodeControlOffset(node);

        return createPortal(
          <div
            key={node.id}
            className={workflowNodeControlFrameClassName}
            style={{
              left: offset.x,
              top: offset.y,
              width: offset.width,
            }}
          >
            <WorkflowJsonPrimitiveNodeValueControl
              node={node}
              readOnly={readOnly}
              onFocusNode={onFocusNode}
              onValueChange={onValueChange}
            />
          </div>,
          target,
          node.id,
        );
      })}
    </>
  );
}

function WorkflowJsonPrimitiveNodeValueControl<TNodeData extends Record<string, unknown>>({
  node,
  onFocusNode,
  onValueChange,
  readOnly,
}: {
  node: WorkflowEditorNode<TNodeData>;
  onFocusNode: (nodeId: string) => void;
  onValueChange: (nodeId: string, value: string | number | boolean | null) => void;
  readOnly: boolean;
}) {
  const value = readWorkflowEditorJsonPrimitiveNodeValue(node);
  const label = `${node.label} JSON value`;
  const numberValue = typeof value === "number" && Number.isFinite(value) ? value : 0;
  const [numberDraft, setNumberDraft] = useState(String(numberValue));

  useEffect(() => {
    setNumberDraft(String(numberValue));
  }, [node.id, numberValue]);

  const handleInteractionStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    onFocusNode(node.id);
  };
  const stopInteractionPropagation = (event: SyntheticEvent) => {
    event.stopPropagation();
  };

  switch (node.kind) {
    case "json.string":
      return (
        <div
          data-slot="workflow-json-primitive-node-control"
          onPointerDownCapture={handleInteractionStart}
          onMouseDownCapture={stopInteractionPropagation}
          onClick={stopInteractionPropagation}
        >
          <Input
            aria-label={label}
            className={workflowNodeTextControlClassName}
            disabled={readOnly}
            value={typeof value === "string" ? value : ""}
            onChange={(event) => onValueChange(node.id, event.currentTarget.value)}
          />
        </div>
      );
    case "json.number":
      return (
        <div
          data-slot="workflow-json-primitive-node-control"
          onPointerDownCapture={handleInteractionStart}
          onMouseDownCapture={stopInteractionPropagation}
          onClick={stopInteractionPropagation}
        >
          <Input
            aria-label={label}
            className={workflowNodeTextControlClassName}
            disabled={readOnly}
            inputMode="decimal"
            type="number"
            value={numberDraft}
            onBlur={() => setNumberDraft(String(numberValue))}
            onChange={(event) => {
              const nextValue = event.currentTarget.value;
              const parsedValue = Number(nextValue);
              setNumberDraft(nextValue);

              if (nextValue.trim() !== "" && Number.isFinite(parsedValue)) {
                onValueChange(node.id, parsedValue);
              }
            }}
          />
        </div>
      );
    case "json.boolean": {
      const booleanValue = value === true;
      return (
        <div
          data-slot="workflow-json-primitive-node-control"
          role="group"
          aria-label={label}
          className={cn("inline-flex", workflowNodeToggleGroupControlClassName)}
          onPointerDownCapture={handleInteractionStart}
          onMouseDownCapture={stopInteractionPropagation}
          onClick={stopInteractionPropagation}
        >
          {[false, true].map((option) => (
            <Toggle
              key={String(option)}
              aria-label={`Set ${node.label} to ${option ? "true" : "false"}`}
              className={workflowNodeToggleItemClassName}
              disabled={readOnly}
              pressed={booleanValue === option}
              onPressedChange={() => onValueChange(node.id, option)}
            >
              {option ? "true" : "false"}
            </Toggle>
          ))}
        </div>
      );
    }
    case "json.null":
      return (
        <div
          data-slot="workflow-json-primitive-node-control"
          onPointerDownCapture={handleInteractionStart}
          onMouseDownCapture={stopInteractionPropagation}
          onClick={stopInteractionPropagation}
        >
          <Input
            aria-label={label}
            className={workflowNodeTextControlClassName}
            disabled
            value="null"
            readOnly
          />
        </div>
      );
    default:
      return null;
  }
}

function getWorkflowJsonPrimitiveNodeControlOffset<TNodeData>(node: WorkflowEditorNode<TNodeData>) {
  const uiNode = toUiWorkflowBuilderNodes([node])[0]!;

  if (uiNode.minimized === true && node.variant !== "compact") {
    const size = getWorkflowEditorRenderedNodeSize(uiNode);

    return {
      x: 8,
      y: 6,
      width: Math.max(104, Math.min(128, size.width - 96)),
    };
  }

  if (node.variant === "compact") {
    return { x: 58, y: 13, width: 112 };
  }

  const size = getWorkflowEditorRenderedNodeSize(uiNode);
  const width = Math.min(170, Math.max(112, size.width - 64));
  const outputIndex = Math.max(
    0,
    (node.outputs ?? []).findIndex((output) => output.id === "value"),
  );
  const portCenterY = getWorkflowEditorPortCenterOffset(uiNode, "output", outputIndex);

  return {
    x: Math.round((size.width - width) / 2),
    y: Math.round(portCenterY - workflowJsonPrimitiveNodeControlHeight / 2),
    width,
  };
}

type WorkflowGroupOverlayDragState = {
  groupId: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  committedX: number;
  committedY: number;
};

function WorkflowGroupOverlays<
  TNodeData extends Record<string, unknown>,
  TEdgeData extends Record<string, unknown>,
>({
  document,
  readOnly,
  selectedGroupId,
  zoom,
  onDeleteGroup,
  onMoveGroup,
  onRenameGroup,
  onSelectGroup,
  onToggleGroupMinimized,
  onUngroupGroup,
}: {
  document: WorkflowEditorDocument<TNodeData, TEdgeData>;
  readOnly: boolean;
  selectedGroupId?: string;
  zoom: number;
  onDeleteGroup: (groupId: string) => void;
  onMoveGroup: (groupId: string, delta: WorkflowEditorPoint) => void;
  onRenameGroup: (groupId: string, label: string) => void;
  onSelectGroup: (groupId: string) => void;
  onToggleGroupMinimized: (groupId: string) => void;
  onUngroupGroup: (groupId: string) => void;
}) {
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const dragRef = useRef<WorkflowGroupOverlayDragState | null>(null);

  useEffect(() => {
    const ownerDocument = globalThis.document;
    if (!ownerDocument) {
      return;
    }

    const move = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }

      const nextX = Math.round((event.clientX - drag.startClientX) / zoom);
      const nextY = Math.round((event.clientY - drag.startClientY) / zoom);
      const delta = { x: nextX - drag.committedX, y: nextY - drag.committedY };
      if (delta.x === 0 && delta.y === 0) {
        return;
      }

      drag.committedX = nextX;
      drag.committedY = nextY;
      onMoveGroup(drag.groupId, delta);
    };
    const end = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (drag?.pointerId === event.pointerId) {
        dragRef.current = null;
      }
    };

    ownerDocument.addEventListener("pointermove", move);
    ownerDocument.addEventListener("pointerup", end);
    ownerDocument.addEventListener("pointercancel", end);
    return () => {
      ownerDocument.removeEventListener("pointermove", move);
      ownerDocument.removeEventListener("pointerup", end);
      ownerDocument.removeEventListener("pointercancel", end);
    };
  }, [onMoveGroup, zoom]);

  const groups = document.groups ?? [];
  if (groups.length === 0) {
    return null;
  }

  const stopInteractionPropagation = (event: SyntheticEvent) => {
    event.stopPropagation();
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-[15]" aria-hidden={false}>
      {groups.map((group) => {
        const bounds = getWorkflowEditorRenderedGroupBounds(document, group);
        if (!bounds) {
          return null;
        }

        const selected = group.id === selectedGroupId;
        const minimized = group.minimized === true;
        const open = openGroupId === group.id;
        const frameStyle = minimized
          ? {
              height: 48,
              left: bounds.left,
              top: bounds.top,
              width: Math.max(220, Math.min(360, bounds.width)),
            }
          : {
              height: bounds.height,
              left: bounds.left,
              top: bounds.top,
              width: bounds.width,
            };

        return (
          <div
            key={group.id}
            data-slot="workflow-group"
            data-group-id={group.id}
            data-selected={selected ? "true" : undefined}
            data-minimized={minimized ? "true" : undefined}
            className={cn(
              "absolute rounded-lg border bg-background/35 shadow-sm",
              selected ? "border-primary ring-2 ring-primary/20" : "border-border/80",
              minimized ? "bg-card/95" : "bg-primary/5",
            )}
            style={frameStyle}
            onClick={(event) => {
              event.stopPropagation();
              onSelectGroup(group.id);
            }}
          >
            <div
              data-slot="workflow-group-header"
              className={cn(
                "pointer-events-auto absolute left-2 top-2 flex h-8 min-w-0 items-center gap-1 rounded-md border bg-background/95 px-1.5 shadow-sm",
                minimized &&
                  "left-0 top-0 h-12 w-full rounded-lg border-0 bg-transparent shadow-none",
              )}
              onClick={stopInteractionPropagation}
              onMouseDown={stopInteractionPropagation}
              onPointerDown={(event) => {
                stopInteractionPropagation(event);
                onSelectGroup(group.id);
                if (readOnly || event.button !== 0) {
                  return;
                }

                dragRef.current = {
                  groupId: group.id,
                  pointerId: event.pointerId,
                  startClientX: event.clientX,
                  startClientY: event.clientY,
                  committedX: 0,
                  committedY: 0,
                };
              }}
            >
              <span
                data-slot="workflow-group-drag-handle"
                className="h-4 w-2 cursor-grab rounded-sm bg-muted-foreground/35"
                aria-hidden="true"
              />
              <Input
                aria-label={`${group.label} group label`}
                className="h-6 min-w-0 w-32 border-0 bg-transparent px-1 text-xs font-medium shadow-none focus-visible:ring-1"
                defaultValue={group.label}
                disabled={readOnly}
                onClick={stopInteractionPropagation}
                onPointerDown={stopInteractionPropagation}
                onBlur={(event) => onRenameGroup(group.id, event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
              />
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                className="size-6"
                disabled={readOnly}
                aria-label={
                  minimized ? `Expand ${group.label} group` : `Minimize ${group.label} group`
                }
                onPointerDown={stopInteractionPropagation}
                onClick={(event) => {
                  stopInteractionPropagation(event);
                  onToggleGroupMinimized(group.id);
                }}
              >
                {minimized ? (
                  <Maximize2Icon className="size-3.5" aria-hidden="true" />
                ) : (
                  <Minimize2Icon className="size-3.5" aria-hidden="true" />
                )}
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                className="size-6"
                aria-expanded={open}
                aria-haspopup="menu"
                aria-label={`${group.label} group actions`}
                onPointerDown={stopInteractionPropagation}
                onClick={(event) => {
                  stopInteractionPropagation(event);
                  setOpenGroupId((current) => (current === group.id ? null : group.id));
                }}
              >
                <MoreHorizontalIcon className="size-3.5" aria-hidden="true" />
              </Button>
              {open ? (
                <div
                  role="menu"
                  data-slot="workflow-group-action-menu-content"
                  className="absolute right-0 top-9 z-[20020] grid w-40 gap-1 rounded-md bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
                  onPointerDown={stopInteractionPropagation}
                >
                  <div className="truncate px-1.5 py-1 text-xs font-medium text-muted-foreground">
                    {group.label}
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    className="rounded-sm px-1.5 py-1.5 text-left text-sm outline-none transition-colors hover:bg-accent focus:bg-accent disabled:pointer-events-none disabled:opacity-50"
                    disabled={readOnly}
                    onClick={() => {
                      setOpenGroupId(null);
                      onToggleGroupMinimized(group.id);
                    }}
                  >
                    {minimized ? "Expand" : "Minimize"}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="rounded-sm px-1.5 py-1.5 text-left text-sm outline-none transition-colors hover:bg-accent focus:bg-accent disabled:pointer-events-none disabled:opacity-50"
                    disabled={readOnly}
                    onClick={() => {
                      setOpenGroupId(null);
                      onUngroupGroup(group.id);
                    }}
                  >
                    Ungroup
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="rounded-sm px-1.5 py-1.5 text-left text-sm text-destructive outline-none transition-colors hover:bg-destructive/10 focus:bg-destructive/10 disabled:pointer-events-none disabled:opacity-50"
                    disabled={readOnly}
                    onClick={() => {
                      setOpenGroupId(null);
                      onDeleteGroup(group.id);
                    }}
                  >
                    Delete contents
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getWorkflowEditorRenderedGroupBounds<
  TNodeData extends Record<string, unknown>,
  TEdgeData extends Record<string, unknown>,
>(document: WorkflowEditorDocument<TNodeData, TEdgeData>, group: WorkflowEditorGroup) {
  const nodeIds = new Set(group.nodeIds);
  const nodes = document.nodes.filter((node) => nodeIds.has(node.id));
  if (nodes.length === 0) {
    return null;
  }

  const boxes = nodes.map((node) => {
    const size = getWorkflowEditorRenderedNodeSize(toUiWorkflowBuilderNodes([node])[0]!);
    return {
      left: node.x,
      top: node.y,
      right: node.x + size.width,
      bottom: node.y + size.height,
    };
  });
  const left = Math.min(...boxes.map((box) => box.left)) - 16;
  const top = Math.min(...boxes.map((box) => box.top)) - 42;
  const right = Math.max(...boxes.map((box) => box.right)) + 16;
  const bottom = Math.max(...boxes.map((box) => box.bottom)) + 16;

  return {
    left,
    top,
    width: Math.max(220, right - left),
    height: Math.max(80, bottom - top),
  };
}

function WorkflowObjectConstructorNodeControls<
  TNodeData extends Record<string, unknown>,
  TEdgeData extends Record<string, unknown>,
>({
  containerRef,
  document,
  expressionDrafts,
  onFocusNode,
  onDraftChange,
  onValueChange,
  readOnly,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  document: WorkflowEditorDocument<TNodeData, TEdgeData>;
  expressionDrafts: Record<string, string>;
  onFocusNode: (nodeId: string) => void;
  onDraftChange: (nodeId: string, value: string) => void;
  onValueChange: (nodeId: string, value: string) => void;
  readOnly: boolean;
}) {
  const objectNodes = document.nodes.filter(
    (node) =>
      isWorkflowEditorObjectConstructorNode(node) &&
      isWorkflowEditorDetachedNodeControlVisible(node),
  );
  const nodeElements = useWorkflowWorkbenchNodeElementMap(containerRef, objectNodes);

  if (objectNodes.length === 0) {
    return null;
  }

  return (
    <>
      {objectNodes.map((node) => {
        const target = nodeElements.get(node.id);
        if (!target) {
          return null;
        }

        const expressionDraft = expressionDrafts[node.id];
        const validationMessage =
          expressionDraft === undefined
            ? undefined
            : validateWorkflowEditorObjectConstructorExpression(expressionDraft)[0]?.message;
        const offset = getWorkflowObjectConstructorNodeControlOffset(
          node,
          expressionDraft,
          validationMessage,
        );

        return createPortal(
          <div
            key={node.id}
            className={workflowNodeControlFrameClassName}
            style={{
              height: offset.height,
              left: offset.x,
              top: offset.y,
              width: offset.width,
            }}
          >
            <WorkflowObjectConstructorExpressionControl
              node={node}
              readOnly={readOnly}
              onDraftChange={onDraftChange}
              onFocusNode={onFocusNode}
              onValueChange={onValueChange}
            />
          </div>,
          target,
          node.id,
        );
      })}
    </>
  );
}

function WorkflowObjectConstructorExpressionControl<TNodeData extends Record<string, unknown>>({
  node,
  onDraftChange,
  onFocusNode,
  onValueChange,
  readOnly,
}: {
  node: WorkflowEditorNode<TNodeData>;
  onDraftChange: (nodeId: string, value: string) => void;
  onFocusNode: (nodeId: string) => void;
  onValueChange: (nodeId: string, value: string) => void;
  readOnly: boolean;
}) {
  const expression = formatWorkflowEditorObjectConstructorExpression(node);
  const [draft, setDraft] = useState(expression);
  const [focused, setFocused] = useState(false);
  const validationMessage = validateWorkflowEditorObjectConstructorExpression(draft)[0]?.message;
  const validationMessageId = `${node.id}-object-expression-validation`;

  useEffect(() => {
    if (!focused && !validationMessage) {
      setDraft(expression);
      onDraftChange(node.id, expression);
    }
  }, [focused, node.id, expression, onDraftChange, validationMessage]);

  const handleInteractionStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    onFocusNode(node.id);
  };
  const stopInteractionPropagation = (event: SyntheticEvent) => {
    event.stopPropagation();
  };
  const commitDraft = () => {
    if (!validationMessage && draft !== expression) {
      onValueChange(node.id, draft);
    }
  };
  const updateDraft = (value: string) => {
    setDraft(value);
    onDraftChange(node.id, value);

    if (!validateWorkflowEditorObjectConstructorExpression(value)[0]) {
      onValueChange(node.id, value);
    }
  };

  return (
    <div
      data-slot="workflow-object-constructor-node-control"
      className="flex h-full flex-col gap-1"
      onPointerDownCapture={handleInteractionStart}
      onMouseDownCapture={stopInteractionPropagation}
      onClick={stopInteractionPropagation}
    >
      <Textarea
        aria-label={`${node.label} object expression`}
        aria-describedby={validationMessage ? validationMessageId : undefined}
        aria-invalid={validationMessage ? true : undefined}
        className={cn(workflowNodeTextareaControlClassName, "min-h-0 w-full flex-1")}
        disabled={readOnly}
        spellCheck={false}
        value={draft}
        onBlur={() => {
          setFocused(false);
          commitDraft();
        }}
        onChange={(event) => updateDraft(event.currentTarget.value)}
        onFocus={() => setFocused(true)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            commitDraft();
          }
        }}
      />
      {validationMessage ? (
        <div
          id={validationMessageId}
          className="min-h-4 truncate text-[11px] leading-4 text-red-600"
          role="alert"
        >
          {validationMessage}
        </div>
      ) : null}
    </div>
  );
}

function getWorkflowObjectConstructorNodeControlOffset<TNodeData>(
  node: WorkflowEditorNode<TNodeData>,
  expressionDraft?: string,
  validationMessage?: string,
) {
  const uiNode = toUiWorkflowBuilderNodes([node])[0]!;
  const size = getWorkflowEditorRenderedNodeSize(uiNode, {
    objectConstructorExpression: expressionDraft,
    objectConstructorValidationMessage: validationMessage,
  });
  const outputIndex = Math.max(
    0,
    (node.outputs ?? []).findIndex((output) => output.id === "value"),
  );
  const portCenterY = getWorkflowEditorPortCenterOffset(uiNode, "output", outputIndex, {
    objectConstructorExpression: expressionDraft,
    objectConstructorValidationMessage: validationMessage,
  });
  const outputPanelHeight = getWorkflowEditorObjectConstructorOutputPanelHeight(
    uiNode,
    expressionDraft,
    validationMessage,
  );
  const outputPanelTop = portCenterY - outputPanelHeight / 2;
  const outputColumnX = size.width / 2 + 6;
  const x = Math.round(outputColumnX + 10);
  const width = Math.max(156, Math.round(size.width - x - 26));

  return {
    height:
      getWorkflowEditorObjectConstructorTextAreaHeight(uiNode, expressionDraft, validationMessage) +
      (validationMessage ? 20 : 0),
    x,
    y: Math.max(12, Math.round(outputPanelTop + 42)),
    width,
  };
}

function WorkflowNodeActionMenus<
  TNodeData extends Record<string, unknown>,
  TEdgeData extends Record<string, unknown>,
>({
  containerRef,
  document,
  readOnly,
  onDeleteNode,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  document: WorkflowEditorDocument<TNodeData, TEdgeData>;
  readOnly: boolean;
  onDeleteNode: (nodeId: string) => void;
}) {
  const [openNodeId, setOpenNodeId] = useState<string | null>(null);
  const nodeElements = useWorkflowWorkbenchNodeElementMap(containerRef, document.nodes);

  if (document.nodes.length === 0) {
    return null;
  }

  const stopInteractionPropagation = (event: SyntheticEvent) => {
    event.stopPropagation();
  };

  return (
    <>
      {document.nodes.map((node) => {
        const target = nodeElements.get(node.id);
        if (!target) {
          return null;
        }

        const offset = getWorkflowNodeActionMenuOffset(node, target);
        const open = openNodeId === node.id;

        return createPortal(
          <div
            key={node.id}
            data-slot="workflow-node-action-menu"
            className="pointer-events-auto absolute z-30"
            style={{
              left: offset.x,
              top: offset.y,
            }}
            onClick={stopInteractionPropagation}
            onMouseDown={stopInteractionPropagation}
            onPointerDown={stopInteractionPropagation}
          >
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              className="size-6 border border-zinc-300 bg-white/85 text-zinc-700 shadow-sm hover:bg-white"
              aria-expanded={open}
              aria-haspopup="menu"
              aria-label={`${node.label} node actions`}
              onClick={() => setOpenNodeId((current) => (current === node.id ? null : node.id))}
            >
              <MoreHorizontalIcon className="size-3.5" aria-hidden="true" />
            </Button>
            {open ? (
              <div
                role="menu"
                data-slot="workflow-node-action-menu-content"
                className="absolute right-0 top-7 z-[20010] grid w-36 gap-1 rounded-md bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
              >
                <div className="truncate px-1.5 py-1 text-xs font-medium text-muted-foreground">
                  {node.label}
                </div>
                <button
                  type="button"
                  role="menuitem"
                  className="flex items-center gap-2 rounded-sm px-1.5 py-1.5 text-left text-sm text-destructive outline-none transition-colors hover:bg-destructive/10 focus:bg-destructive/10 disabled:pointer-events-none disabled:opacity-50"
                  disabled={readOnly}
                  onClick={() => {
                    setOpenNodeId(null);
                    onDeleteNode(node.id);
                  }}
                >
                  <Trash2Icon className="size-4" aria-hidden="true" />
                  Delete
                </button>
              </div>
            ) : null}
          </div>,
          target,
          node.id,
        );
      })}
    </>
  );
}

function getWorkflowNodeActionMenuOffset<TNodeData>(
  node: WorkflowEditorNode<TNodeData>,
  target: HTMLElement,
) {
  const targetRect = target.getBoundingClientRect();
  const builtInTrigger = target.querySelector<HTMLElement>(
    "[data-slot='workflow-node-menu-trigger']",
  );
  const triggerRect = builtInTrigger?.getBoundingClientRect();

  if (triggerRect && targetRect.width > 0 && triggerRect.width > 0) {
    const scaleX = target.offsetWidth > 0 ? targetRect.width / target.offsetWidth : 1;
    const scaleY = target.offsetHeight > 0 ? targetRect.height / target.offsetHeight : scaleX;

    return {
      x: Math.round((triggerRect.left - targetRect.left) / Math.max(scaleX, 0.001)),
      y: Math.round((triggerRect.top - targetRect.top) / Math.max(scaleY, 0.001)),
    };
  }

  const minimizeButton = target.querySelector<HTMLElement>("[data-slot='workflow-node-minimize']");
  const minimizeRect = minimizeButton?.getBoundingClientRect();

  if (minimizeRect && targetRect.width > 0 && minimizeRect.width > 0) {
    const scaleX = target.offsetWidth > 0 ? targetRect.width / target.offsetWidth : 1;
    const scaleY = target.offsetHeight > 0 ? targetRect.height / target.offsetHeight : scaleX;
    const actionButtonWidth = 24;
    const gap = 6;

    return {
      x: Math.round(
        (minimizeRect.left - targetRect.left) / Math.max(scaleX, 0.001) - actionButtonWidth - gap,
      ),
      y: Math.round((minimizeRect.top - targetRect.top) / Math.max(scaleY, 0.001)),
    };
  }

  const size = getWorkflowEditorRenderedNodeSize(toUiWorkflowBuilderNodes([node])[0]!);
  return {
    x: Math.round(size.width - 34),
    y: 8,
  };
}

export function WorkflowSelectionOverlay<
  TNodeData extends Record<string, unknown>,
  TEdgeData extends Record<string, unknown>,
>({
  document,
  marquee,
  primaryNodeId,
  selection,
}: {
  document: WorkflowEditorDocument<TNodeData, TEdgeData>;
  marquee: WorkflowSelectionMarquee | null;
  primaryNodeId?: string;
  selection: WorkflowEditorSelectionState;
}) {
  const selectedNodeIds = new Set(selection.nodeIds.filter((id) => id !== primaryNodeId));
  const marqueeRect = marquee ? normalizeRect(marquee) : null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20" aria-hidden="true">
      {document.nodes
        .filter((node) => selectedNodeIds.has(node.id))
        .map((node) => {
          const size = getWorkflowEditorRenderedNodeSize(toUiWorkflowBuilderNodes([node])[0]!);
          return (
            <div
              key={node.id}
              data-testid={`multi-selection-outline-${node.id}`}
              className="absolute rounded-xl border-2 border-primary/70 bg-primary/5"
              style={{
                height: size.height,
                left: node.x,
                top: node.y,
                width: size.width,
              }}
            />
          );
        })}
      {marqueeRect ? (
        <div
          data-testid="selection-marquee"
          className="absolute border border-primary bg-primary/10"
          style={{
            height: marqueeRect.bottom - marqueeRect.top,
            left: marqueeRect.left,
            top: marqueeRect.top,
            width: marqueeRect.right - marqueeRect.left,
          }}
        />
      ) : null}
    </div>
  );
}

function normalizeRect(rect: WorkflowSelectionMarquee) {
  return {
    left: Math.min(rect.startX, rect.currentX),
    top: Math.min(rect.startY, rect.currentY),
    right: Math.max(rect.startX, rect.currentX),
    bottom: Math.max(rect.startY, rect.currentY),
  };
}

function rectsIntersect(
  left: { left: number; top: number; right: number; bottom: number },
  right: { left: number; top: number; right: number; bottom: number },
) {
  return (
    left.left <= right.right &&
    left.right >= right.left &&
    left.top <= right.bottom &&
    left.bottom >= right.top
  );
}

function isEditableEventTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    !!target.closest(
      "input, textarea, select, [contenteditable='true'], [role='textbox'], [data-slot='workflow-json-primitive-node-control']",
    )
  );
}

function isWorkflowWorkbenchOverlayInteractionTarget(target: EventTarget | null) {
  return target instanceof Element && !!target.closest(workflowWorkbenchOverlayInteractionSelector);
}

function toUiWorkflowNodeTemplate<TData>(template: WorkflowWorkbenchPaletteItem<TData>) {
  return toUiWorkflowBuilderNodes([
    {
      ...template,
      variant: template.variant ?? "compact",
      x: 0,
      y: 0,
    } as WorkflowEditorNode,
  ])[0]!;
}

function toUiConnectionInvalidReason(
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

  return reason;
}

export function DefaultWorkflowInspector<
  TNodeData extends Record<string, unknown>,
  TEdgeData extends Record<string, unknown>,
>({ context }: { context: WorkflowWorkbenchInspectorContext<TNodeData, TEdgeData> }) {
  if (context.selectedNode) {
    const node = context.selectedNode;
    const referenceOptions = createWorkflowReferenceOptions(context.documentReferences, node);
    const referencedDocumentId = node.workflowRef?.documentId ?? "";
    const referenceMissing =
      referencedDocumentId !== "" &&
      !context.documentReferences?.some((reference) => reference.id === referencedDocumentId);
    const arrayConstructorInputs = getWorkflowEditorArrayConstructorInputs(node);
    const arrayConstructorExpression = formatWorkflowEditorArrayConstructorExpression(node);
    const arrayConstructorDefaultValues = Object.fromEntries(
      arrayConstructorInputs.map((input) => [
        `arrayItem:${input.id}`,
        input.badge ? String(input.badge) : input.id,
      ]),
    );
    const objectConstructorInputs = getWorkflowEditorObjectConstructorInputs(node);
    const objectConstructorExpression = formatWorkflowEditorObjectConstructorExpression(node);
    const objectConstructorDefaultValues = Object.fromEntries(
      objectConstructorInputs.map((input) => [`objectProperty:${input.id}`, input.label]),
    );
    const objectDecompositionOutputs = getWorkflowEditorObjectDecompositionOutputs(node);
    const objectDecompositionExpression = formatWorkflowEditorObjectDecompositionExpression(node);
    const objectDecompositionDefaultValues = Object.fromEntries(
      objectDecompositionOutputs.map((output) => [`objectOutput:${output.id}`, output.label]),
    );
    const jsonValueField = createWorkflowEditorJsonValueField(node);
    const jsonValueDefault = readWorkflowEditorJsonValueFieldValue(node);

    return (
      <div className="grid gap-3">
        <InspectorPanel
          key={node.id}
          title="Workflow node"
          description={node.kind ?? node.category}
          readOnly={context.readOnly}
          validationMessages={
            referenceMissing
              ? { workflowDocumentId: `Missing workflow document: ${referencedDocumentId}` }
              : undefined
          }
          defaultValues={{
            label: node.label,
            description: node.description ?? "",
            kind: node.kind ?? "",
            category: node.category ?? "",
            x: node.x,
            y: node.y,
            status: node.status ?? "idle",
            workflowDocumentId: referencedDocumentId,
            arrayExpression: arrayConstructorExpression,
            objectExpression: objectConstructorExpression,
            objectDecompositionExpression,
            ...(jsonValueField ? { jsonValue: jsonValueDefault } : {}),
            ...arrayConstructorDefaultValues,
            ...objectConstructorDefaultValues,
            ...objectDecompositionDefaultValues,
          }}
          sections={[
            {
              id: "node",
              title: "Node",
              fields: [
                { id: "label", label: "Label", type: "text" },
                { id: "description", label: "Description", type: "textarea" },
                { id: "kind", label: "Kind", type: "text", readOnly: true },
                { id: "category", label: "Category", type: "text" },
                { id: "x", label: "X", type: "number", step: 10 },
                { id: "y", label: "Y", type: "number", step: 10 },
                { id: "status", label: "Status", type: "text" },
              ],
            },
            ...(context.documentReferences
              ? [
                  {
                    id: "nested-workflow",
                    title: "Nested workflow",
                    fields: [
                      {
                        id: "workflowDocumentId",
                        label: "Workflow document",
                        type: "select" as const,
                        options: referenceOptions,
                        readOnly: context.readOnly,
                      },
                    ],
                  },
                ]
              : []),
            ...(jsonValueField
              ? [
                  {
                    id: "json-value",
                    title: "Output",
                    description: "Choose the value emitted by this source node.",
                    fields: [jsonValueField],
                  },
                ]
              : []),
            ...(isWorkflowEditorArrayConstructorNode(node)
              ? [
                  {
                    id: "array-constructor",
                    title: "Array",
                    description: "Collect input values into array items.",
                    fields: [
                      ...arrayConstructorInputs.map((input, index) =>
                        createWorkflowEditorRemovableInspectorField({
                          id: `arrayItem:${input.id}`,
                          label: input.label,
                          readOnly: true,
                          removeLabel: `Remove array item ${index + 1}`,
                          removeDisabled: context.readOnly,
                          onRemove: () =>
                            context.updateDocument?.(
                              removeWorkflowEditorArrayConstructorInput(
                                context.document,
                                node.id,
                                input.id,
                              ),
                            ),
                        }),
                      ),
                      {
                        id: "arrayExpression",
                        label: "Expression",
                        type: "code" as const,
                        readOnly: true,
                      },
                    ],
                  },
                ]
              : []),
            ...(isWorkflowEditorObjectConstructorNode(node)
              ? [
                  {
                    id: "object-constructor",
                    title: "Object",
                    description: "Map input values to object properties.",
                    fields: [
                      ...objectConstructorInputs.map((input) =>
                        createWorkflowEditorRemovableInspectorField({
                          id: `objectProperty:${input.id}`,
                          label: input.label,
                          placeholder: "propertyName",
                          readOnly: context.readOnly,
                          removeLabel: `Remove property input ${input.label}`,
                          removeDisabled: context.readOnly,
                          onRemove: () =>
                            context.updateDocument?.(
                              removeWorkflowEditorObjectConstructorInput(
                                context.document,
                                node.id,
                                input.id,
                              ),
                            ),
                        }),
                      ),
                      {
                        id: "objectExpression",
                        label: "Expression",
                        type: "code" as const,
                        readOnly: true,
                      },
                    ],
                  },
                ]
              : []),
            ...(isWorkflowEditorObjectDecompositionNode(node)
              ? [
                  {
                    id: "object-decomposition",
                    title: "Object decomposition",
                    description: "Map object properties to output ports.",
                    fields: [
                      ...objectDecompositionOutputs.map((output) =>
                        createWorkflowEditorRemovableInspectorField({
                          id: `objectOutput:${output.id}`,
                          label: output.badge ? `${output.badge}` : output.label,
                          placeholder: "propertyName",
                          readOnly: context.readOnly,
                          removeLabel: `Remove property output ${output.label}`,
                          removeDisabled: context.readOnly,
                          onRemove: () =>
                            context.updateDocument?.(
                              removeWorkflowEditorObjectDecompositionOutput(
                                context.document,
                                node.id,
                                output.id,
                              ),
                            ),
                        }),
                      ),
                      {
                        id: "objectDecompositionExpression",
                        label: "Expression",
                        type: "code" as const,
                        readOnly: true,
                      },
                    ],
                  },
                ]
              : []),
          ]}
          onApply={(values) => {
            const patch: Partial<WorkflowEditorNode<TNodeData>> = {
              label: String(values.label ?? node.label),
              description: String(values.description ?? "") || undefined,
              category: String(values.category ?? "") || undefined,
              x: toNumber(values.x, node.x),
              y: toNumber(values.y, node.y),
              status: String(values.status ?? "") || undefined,
            };

            if (context.documentReferences) {
              patch.workflowRef =
                typeof values.workflowDocumentId === "string" && values.workflowDocumentId
                  ? { documentId: values.workflowDocumentId }
                  : undefined;
            }

            if (isWorkflowEditorObjectConstructorNode(node)) {
              const propertyKeysByPortId = Object.fromEntries(
                objectConstructorInputs.map((input) => [
                  input.id,
                  String(values[`objectProperty:${input.id}`] ?? input.label),
                ]),
              );
              const nextNode = updateWorkflowEditorObjectConstructorPropertiesInNode(
                node,
                propertyKeysByPortId,
              );

              patch.inputs = nextNode.inputs;
              patch.outputs = nextNode.outputs;
              patch.data = nextNode.data;
            }

            if (isWorkflowEditorObjectDecompositionNode(node)) {
              const propertyKeysByPortId = Object.fromEntries(
                objectDecompositionOutputs.map((output) => [
                  output.id,
                  String(values[`objectOutput:${output.id}`] ?? output.label),
                ]),
              );
              const nextNode = updateWorkflowEditorObjectDecompositionPropertiesInNode(
                node,
                propertyKeysByPortId,
              );

              patch.inputs = nextNode.inputs;
              patch.outputs = nextNode.outputs;
              patch.data = nextNode.data;
            }

            if (jsonValueField) {
              patch.data = {
                ...(isRecord(node.data) ? node.data : {}),
                value: parseWorkflowEditorJsonValueFieldValue(node, values.jsonValue),
              } as unknown as TNodeData;
            }

            context.updateSelectedNode(patch);
          }}
        />
        {isWorkflowEditorArrayConstructorNode(node) ? (
          <div className="flex flex-wrap gap-2 px-4">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={context.readOnly}
              onClick={() => {
                const nextNode = addWorkflowEditorArrayConstructorInputToNode(node);
                context.updateSelectedNode({
                  inputs: nextNode.inputs,
                  outputs: nextNode.outputs,
                  data: nextNode.data,
                } as Partial<WorkflowEditorNode<TNodeData>>);
              }}
            >
              Add item input
            </Button>
          </div>
        ) : null}
        {isWorkflowEditorObjectConstructorNode(node) ? (
          <div className="flex flex-wrap gap-2 px-4">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={context.readOnly}
              onClick={() => {
                const nextNode = addWorkflowEditorObjectConstructorInputToNode(node);
                context.updateSelectedNode({
                  inputs: nextNode.inputs,
                  outputs: nextNode.outputs,
                  data: nextNode.data,
                } as Partial<WorkflowEditorNode<TNodeData>>);
              }}
            >
              Add property input
            </Button>
          </div>
        ) : null}
        {isWorkflowEditorObjectDecompositionNode(node) ? (
          <div className="flex flex-wrap gap-2 px-4">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={context.readOnly}
              onClick={() => {
                const nextNode = addWorkflowEditorObjectDecompositionOutputToNode(node);
                context.updateSelectedNode({
                  inputs: nextNode.inputs,
                  outputs: nextNode.outputs,
                  data: nextNode.data,
                } as Partial<WorkflowEditorNode<TNodeData>>);
              }}
            >
              Add property output
            </Button>
          </div>
        ) : null}
        {context.documentReferences ? (
          <div className="flex flex-wrap gap-2 px-4 pb-4">
            {referencedDocumentId ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={referenceMissing || !context.openSelectedNodeWorkflow}
                onClick={context.openSelectedNodeWorkflow}
              >
                Open workflow
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={context.readOnly || !context.createSelectedNodeWorkflow}
                onClick={context.createSelectedNodeWorkflow}
              >
                Create nested workflow
              </Button>
            )}
          </div>
        ) : null}
      </div>
    );
  }

  if (context.selectedEdge) {
    const edge = context.selectedEdge;

    return (
      <InspectorPanel
        key={edge.id}
        title="Workflow edge"
        description={`${edge.sourceNodeId} -> ${edge.targetNodeId}`}
        readOnly={context.readOnly}
        defaultValues={{
          id: edge.id,
          status: edge.status ?? "idle",
          source: edge.sourcePortId,
          target: edge.targetPortId,
        }}
        fields={[
          { id: "id", label: "ID", type: "text", readOnly: true },
          { id: "source", label: "Source port", type: "text", readOnly: true },
          { id: "target", label: "Target port", type: "text", readOnly: true },
          { id: "status", label: "Status", type: "text" },
        ]}
        onApply={(values) => {
          context.updateSelectedEdge({
            status: String(values.status ?? "") || undefined,
          });
        }}
      />
    );
  }

  return (
    <div className="p-4 text-sm text-muted-foreground">
      Select a workflow node or edge to inspect its configuration.
    </div>
  );
}

function createWorkflowEditorRemovableInspectorField({
  id,
  label,
  onRemove,
  placeholder,
  readOnly = false,
  removeDisabled = false,
  removeLabel,
}: {
  id: string;
  label: string;
  onRemove: () => void;
  placeholder?: string;
  readOnly?: boolean;
  removeDisabled?: boolean;
  removeLabel: string;
}): InspectorFieldDefinition {
  return {
    id,
    label,
    type: "custom",
    placeholder,
    render: (value, onChange) => (
      <div className="flex items-center gap-2">
        <Input
          aria-label={label}
          className={cn(
            "h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm",
            readOnly && "text-muted-foreground",
          )}
          disabled={readOnly}
          placeholder={placeholder}
          value={String(value ?? "")}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-label={removeLabel}
          disabled={removeDisabled}
          onClick={onRemove}
        >
          Remove
        </Button>
      </div>
    ),
  };
}

function toNumber(value: InspectorFieldValue, fallback: number) {
  const nextValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}

function isWorkflowEditorJsonPrimitiveNode<TData>(
  node: WorkflowEditorNode<TData>,
): node is WorkflowEditorNode<TData> & {
  kind: "json.string" | "json.number" | "json.boolean" | "json.null";
} {
  return (
    node.kind === "json.string" ||
    node.kind === "json.number" ||
    node.kind === "json.boolean" ||
    node.kind === "json.null"
  );
}

function readWorkflowEditorJsonPrimitiveNodeValue<TData>(
  node: WorkflowEditorNode<TData>,
): string | number | boolean | null {
  const value = isRecord(node.data) ? node.data.value : undefined;

  switch (node.kind) {
    case "json.string":
      return typeof value === "string" ? value : "";
    case "json.number":
      return typeof value === "number" && Number.isFinite(value) ? value : 0;
    case "json.boolean":
      return value === true;
    case "json.null":
      return null;
    default:
      return null;
  }
}

function createWorkflowEditorJsonValueField<TData>(
  node: WorkflowEditorNode<TData>,
): InspectorFieldDefinition | null {
  switch (node.kind) {
    case "json.string":
      return {
        id: "jsonValue",
        label: "Value",
        type: "text",
        placeholder: "Text",
      };
    case "json.number":
      return {
        id: "jsonValue",
        label: "Value",
        type: "number",
      };
    case "json.boolean":
      return {
        id: "jsonValue",
        label: "Value",
        type: "select",
        options: [
          { label: "False", value: "false" },
          { label: "True", value: "true" },
        ],
      };
    case "json.null":
      return {
        id: "jsonValue",
        label: "Value",
        type: "code",
        readOnly: true,
      };
    default:
      return null;
  }
}

function readWorkflowEditorJsonValueFieldValue<TData>(
  node: WorkflowEditorNode<TData>,
): InspectorFieldValue {
  const value = isRecord(node.data) ? node.data.value : undefined;

  switch (node.kind) {
    case "json.string":
      return typeof value === "string" ? value : "";
    case "json.number":
      return typeof value === "number" && Number.isFinite(value) ? value : 0;
    case "json.boolean":
      return value === true ? "true" : "false";
    case "json.null":
      return "null";
    default:
      return undefined;
  }
}

function parseWorkflowEditorJsonValueFieldValue<TData>(
  node: WorkflowEditorNode<TData>,
  value: InspectorFieldValue,
) {
  switch (node.kind) {
    case "json.string":
      return String(value ?? "");
    case "json.number":
      return toNumber(value, 0);
    case "json.boolean":
      return value === true || value === "true";
    case "json.null":
      return null;
    default:
      return isRecord(node.data) ? node.data.value : undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createWorkflowReferenceOptions<TNodeData extends Record<string, unknown>>(
  references: WorkflowEditorDocumentReferenceOption[] | undefined,
  node: WorkflowEditorNode<TNodeData>,
) {
  const options = [
    { label: "None", value: "" },
    ...(references?.map((reference) => ({
      label: reference.missing ? `Missing: ${reference.id}` : reference.name,
      value: reference.id,
    })) ?? []),
  ];
  const referencedDocumentId = node.workflowRef?.documentId;

  if (referencedDocumentId && !options.some((option) => option.value === referencedDocumentId)) {
    options.push({ label: `Missing: ${referencedDocumentId}`, value: referencedDocumentId });
  }

  return options;
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
