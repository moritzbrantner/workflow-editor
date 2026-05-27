"use client";

import {
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type WheelEvent as ReactWheelEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Badge,
  Button,
  WorkbenchCanvas,
  WorkbenchLayout,
  WorkbenchPanel,
  WorkbenchToolbar,
  cn,
} from "@moritzbrantner/ui";
import {
  InspectorPanel,
  WorkflowBuilder,
  WorkflowNode,
  getWorkflowNodePortCenterOffset,
  getWorkflowNodeSize,
  type WorkflowBuilderConnectionValidity,
  type WorkflowBuilderSelection,
  type InspectorFieldDefinition,
  type InspectorFieldValue,
  type WorkflowNodeData,
} from "@moritzbrantner/ui/labs";

import {
  addWorkflowEditorObjectDecompositionOutputToNode,
  addWorkflowEditorObjectConstructorInputToNode,
  connectWorkflowEditorNodes,
  copyWorkflowEditorSelection,
  createWorkflowEditorDocumentContext,
  createWorkflowEditorGraphIndex,
  defaultWorkflowEditorNodeTemplates,
  duplicateWorkflowEditorNode,
  duplicateWorkflowEditorSelection,
  formatWorkflowEditorObjectDecompositionExpression,
  formatWorkflowEditorObjectConstructorExpression,
  fromUiWorkflowBuilderEdges,
  fromUiWorkflowBuilderNodes,
  getWorkflowEditorObjectDecompositionOutputs,
  getWorkflowEditorObjectConstructorInputs,
  isWorkflowEditorObjectDecompositionNode,
  isWorkflowEditorObjectConstructorNode,
  normalizeWorkflowEditorDocument,
  normalizeWorkflowEditorSelection,
  pasteWorkflowEditorClipboardPayload,
  removeWorkflowEditorSelection,
  toUiWorkflowBuilderEdges,
  toUiWorkflowBuilderNodes,
  updateWorkflowEditorNode,
  updateWorkflowEditorObjectDecompositionPropertiesInNode,
  updateWorkflowEditorObjectConstructorPropertiesInNode,
  updateWorkflowEditorNodeWorkflowReference,
  validateWorkflowEditorConnection,
  type WorkflowEditorDocument,
  type WorkflowEditorEdge,
  type WorkflowEditorNode,
  type WorkflowEditorNodeTemplate,
  type WorkflowEditorSelection,
  type WorkflowEditorSelectionState,
  type WorkflowEditorTypeDefinition,
  type WorkflowEditorViewport,
} from "./core";
import { layoutWorkflowEditorDocument } from "./core-layout";
import type { WorkflowEditorDocumentReferenceOption } from "./persistence";
import { formatShortcutLabel } from "./shortcut-label";

const emptyWorkflowEditorSelection: WorkflowEditorSelectionState = {
  nodeIds: [],
  edgeIds: [],
};

const workflowEditorPaletteDragType = "application/x-workflow-editor-node-template";
const workflowEditorSnapDistance = 28;
const workflowEditorMinZoom = 0.5;
const workflowEditorMaxZoom = 1.75;

let workflowEditorMemoryClipboard: string | null = null;

export type WorkflowWorkbenchPaletteItem<TData = Record<string, unknown>> =
  WorkflowEditorNodeTemplate<TData>;

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
  updateSelectedNode: (patch: Partial<WorkflowEditorNode<TNodeData>>) => void;
  updateSelectedEdge: (patch: Partial<WorkflowEditorEdge<TEdgeData>>) => void;
  updateSelectedNodeWorkflowReference: (documentId: string | null) => void;
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
  readOnly?: boolean;
  nodeTemplates?: ReadonlyArray<WorkflowWorkbenchPaletteItem<TTemplateData>>;
  typeDefinitions?: readonly WorkflowEditorTypeDefinition[];
  documentReferences?: WorkflowEditorDocumentReferenceOption[];
  className?: string;
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
  pasteSelection: "Mod+V",
  selectAll: "Mod+A",
  nudgeDown: "ArrowDown",
  nudgeLeft: "ArrowLeft",
  nudgeRight: "ArrowRight",
  nudgeUp: "ArrowUp",
};

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
  readOnly = false,
  nodeTemplates = defaultWorkflowEditorNodeTemplates as ReadonlyArray<
    WorkflowWorkbenchPaletteItem<TTemplateData>
  >,
  typeDefinitions,
  documentReferences,
  className,
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
  const connectionInProgressRef = useRef(false);
  const marqueeRef = useRef<WorkflowSelectionMarquee | null>(null);
  const pendingNodeSnapRef = useRef<{
    document: WorkflowEditorDocument<TNodeData, TEdgeData>;
    nodeIds: Set<string>;
  } | null>(null);
  const pointerModifierRef = useRef({ additive: false });
  const [internalSelection, setInternalSelection] = useState<WorkflowEditorSelectionState>(
    emptyWorkflowEditorSelection,
  );
  const [marquee, setMarquee] = useState<WorkflowSelectionMarquee | null>(null);
  const [paletteMinimized, setPaletteMinimized] = useState(false);
  const documentContext = useMemo(() => createWorkflowEditorDocumentContext(document), [document]);
  const externalSelectionProvided =
    selectedNodeIds !== undefined ||
    selectedEdgeIds !== undefined ||
    selectedNodeId !== undefined ||
    selectedEdgeId !== undefined;
  const rawSelection = useMemo<WorkflowEditorSelectionState>(() => {
    if (selectedNodeIds !== undefined || selectedEdgeIds !== undefined) {
      const nodeIds = [...(selectedNodeIds ?? [])];
      const edgeIds = [...(selectedEdgeIds ?? [])];
      const primary =
        nodeIds.length > 0
          ? ({ type: "node", id: nodeIds.at(-1)! } as const)
          : edgeIds.length > 0
            ? ({ type: "edge", id: edgeIds.at(-1)! } as const)
            : undefined;

      return {
        nodeIds,
        edgeIds,
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
  const selectedNodes = selection.nodeIds.flatMap((id) => {
    const node = documentContext.nodeById.get(id);
    return node ? [node] : [];
  });
  const selectedEdges = selection.edgeIds.flatMap((id) => {
    const edge = documentContext.edgeById.get(id);
    return edge ? [edge] : [];
  });
  const graphIndex = useMemo(() => createWorkflowEditorGraphIndex(document), [document]);
  const uiNodes = useMemo(() => toUiWorkflowBuilderNodes(document.nodes), [document.nodes]);
  const uiEdges = useMemo(() => toUiWorkflowBuilderEdges(document.edges), [document.edges]);

  const commitDocument = (nextDocument: WorkflowEditorDocument<TNodeData, TEdgeData>) => {
    onDocumentChange?.(nextDocument);
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
      const size = getWorkflowNodeSize(node);
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

  const deleteSelection = () => {
    if (readOnly) {
      return;
    }

    if (selection.nodeIds.length > 0 || selection.edgeIds.length > 0) {
      commitDocument(removeWorkflowEditorSelection(document, selection));
      emitSelectionState(emptyWorkflowEditorSelection);
    }
  };

  const duplicateSelection = () => {
    if (readOnly || (selection.nodeIds.length === 0 && selection.edgeIds.length === 0)) {
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
        ...(result.nodeIds[0] ? { primary: { type: "node", id: result.nodeIds[0] } } : {}),
      },
      result.document,
    );
  };

  const copySelection = () => {
    if (selection.nodeIds.length === 0 && selection.edgeIds.length === 0) {
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
          ...(result.nodeIds[0] ? { primary: { type: "node", id: result.nodeIds[0] } } : {}),
        },
        result.document,
      );
    } catch {
      return;
    }
  };

  const arrangeSelection = () => {
    if (readOnly || selection.nodeIds.length === 0) {
      return;
    }

    commitDocument(layoutWorkflowEditorDocument(document, { nodeIds: selection.nodeIds }).document);
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
      if (!pointerModifierRef.current.additive && !marquee) {
        emitSelectionState(emptyWorkflowEditorSelection);
      }
      return;
    }

    const item =
      builderSelection.type === "node"
        ? ({ type: "node", id: builderSelection.id } as const)
        : ({ type: "edge", id: builderSelection.id } as const);

    if (!pointerModifierRef.current.additive) {
      emitSelectionState({
        nodeIds: item.type === "node" ? [item.id] : [],
        edgeIds: item.type === "edge" ? [item.id] : [],
        primary: item,
      });
      return;
    }

    emitSelectionState(toggleWorkflowEditorSelectionItem(selection, item));
  };

  const startMarquee = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointerModifierRef.current = { additive: event.shiftKey || event.metaKey || event.ctrlKey };
    const target = event.target;
    if (
      event.button !== 0 ||
      !(target instanceof Element) ||
      target.closest(
        "[data-slot='workflow-builder-node'], [data-slot='workflow-node-port'], [data-slot='workflow-builder-edge'], button, input, textarea, select",
      )
    ) {
      return;
    }

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

  const handleCanvasWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (!event.ctrlKey) {
      return;
    }

    const surface = containerRef.current?.querySelector<HTMLElement>(
      "[data-slot='workflow-builder-surface']",
    );
    const rect = surface?.getBoundingClientRect();

    if (!rect) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    const currentViewport = document.viewport ?? { x: 0, y: 0, zoom: 1 };
    const currentZoom = clampWorkflowEditorZoom(currentViewport.zoom);
    const nextZoom = clampWorkflowEditorZoom(currentZoom * Math.exp(-event.deltaY * 0.002));

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

  return (
    <WorkbenchLayout
      className={cn("min-h-[38rem] overflow-hidden border border-border bg-background", className)}
      leftPanel={
        <WorkbenchPanel side="left" className={cn(paletteMinimized ? "min-w-16" : "min-w-64")}>
          <div className="grid gap-3 p-3">
            <div className="flex items-center justify-between gap-3">
              {paletteMinimized ? null : <div className="text-sm font-medium">Node palette</div>}
              <div className="flex items-center gap-2">
                {paletteMinimized ? null : (
                  <Badge variant="secondary">{nodeTemplates.length}</Badge>
                )}
                <Button
                  type="button"
                  size="icon-sm"
                  variant="ghost"
                  aria-label={paletteMinimized ? "Expand node palette" : "Minimize node palette"}
                  aria-pressed={paletteMinimized}
                  onClick={() => setPaletteMinimized((current) => !current)}
                >
                  {paletteMinimized ? "+" : "-"}
                </Button>
              </div>
            </div>
            {paletteMinimized ? (
              <Badge variant="secondary" className="justify-center">
                {nodeTemplates.length}
              </Badge>
            ) : renderNodeTemplate ? (
              <div className="grid gap-2">
                {nodeTemplates.map((template) => (
                  <Button
                    key={template.id}
                    type="button"
                    variant="ghost"
                    className="h-auto justify-start border border-border bg-background px-3 py-2 text-left"
                    disabled={readOnly}
                    draggable={!readOnly}
                    onDragStart={(event) => startTemplateDrag(event, template)}
                    onClick={() => addTemplateNode(template)}
                  >
                    {renderNodeTemplate(template)}
                  </Button>
                ))}
              </div>
            ) : (
              <div className="grid gap-2">
                {nodeTemplates.length > 0 ? (
                  nodeTemplates.map((template) => (
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
                  ))
                ) : (
                  <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                    No node templates
                  </div>
                )}
              </div>
            )}
          </div>
        </WorkbenchPanel>
      }
      rightPanel={
        <WorkbenchPanel side="right" className="min-w-72">
          {renderInspector ? (
            renderInspector(inspectorContext)
          ) : (
            <DefaultWorkflowInspector context={inspectorContext} />
          )}
        </WorkbenchPanel>
      }
      toolbar={
        <WorkbenchToolbar className="flex min-h-10 flex-nowrap items-center justify-between gap-2 overflow-x-auto border-b border-border px-2 py-1">
          <div className="flex min-w-max items-center gap-1.5 whitespace-nowrap">
            {showGraphStats ? (
              <>
                <Badge variant="outline">{document.nodes.length} nodes</Badge>
                <Badge variant="outline">{document.edges.length} edges</Badge>
              </>
            ) : null}
            <Badge variant="outline" data-testid="selection-count">
              {selection.nodeIds.length + selection.edgeIds.length} selected
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
              disabled={
                readOnly || (selection.nodeIds.length === 0 && selection.edgeIds.length === 0)
              }
              onClick={duplicateSelection}
            >
              Duplicate
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={selection.nodeIds.length === 0 && selection.edgeIds.length === 0}
              onClick={copySelection}
            >
              Copy
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={readOnly}
              onClick={() => void pasteSelection()}
            >
              Paste
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={readOnly || selection.nodeIds.length === 0}
              onClick={arrangeSelection}
            >
              Arrange selection
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
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
              disabled={
                readOnly || (selection.nodeIds.length === 0 && selection.edgeIds.length === 0)
              }
              onClick={deleteSelection}
            >
              Delete
            </Button>
            {renderToolbarActions?.(inspectorContext)}
          </div>
        </WorkbenchToolbar>
      }
    >
      <WorkbenchCanvas className="overflow-hidden p-3">
        <div
          ref={containerRef}
          className="relative"
          onPointerDownCapture={startMarquee}
          onPointerUpCapture={clearPendingConnectionAfterTargetClick}
          onPointerMove={updateMarquee}
          onPointerUp={() => {
            completeMarquee();
            completePendingNodeSnap();
          }}
          onPointerCancel={() => {
            marqueeRef.current = null;
            pendingNodeSnapRef.current = null;
            setMarquee(null);
          }}
          onDragOver={handleTemplateDragOver}
          onDrop={handleTemplateDrop}
          onWheelCapture={handleCanvasWheel}
        >
          <WorkflowBuilder
            nodes={uiNodes}
            edges={uiEdges}
            selectedNodeId={primarySelectedNodeId}
            selectedEdgeId={primarySelectedEdgeId}
            readOnly={readOnly}
            showMiniMap
            surfaceHeight="34rem"
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
            onEdgesChange={(edges) => {
              if (!readOnly) {
                const hasUiCreatedEdge = edges.some(
                  (edge) => !document.edges.some((currentEdge) => currentEdge.id === edge.id),
                );

                if (hasUiCreatedEdge) {
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
              const validity = validateWorkflowEditorConnection(document, connection, {
                typeDefinitions,
              });

              return {
                valid: validity.valid,
                reason: toUiConnectionInvalidReason(validity.reason),
              };
            }}
            onConnectionComplete={(connection) => {
              connectionInProgressRef.current = false;
              if (!readOnly) {
                commitDocument(
                  connectWorkflowEditorNodes(document, connection, { typeDefinitions }),
                );
              }
            }}
            onDoubleClick={() => {
              openSelectedNodeWorkflow();
            }}
          />
          <WorkflowSelectionOverlay
            document={document}
            marquee={marquee}
            primaryNodeId={primarySelectedNodeId}
            selection={selection}
          />
        </div>
      </WorkbenchCanvas>
    </WorkbenchLayout>
  );
}

type WorkflowSelectionMarquee = {
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
};

type WorkflowEditorPoint = {
  x: number;
  y: number;
};

function snapWorkflowEditorNodeToCompatiblePort<
  TNodeData extends Record<string, unknown>,
  TEdgeData extends Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  nodeId: string,
  options: { typeDefinitions?: readonly WorkflowEditorTypeDefinition[] } = {},
) {
  const snapCandidate = findWorkflowEditorNodeSnapCandidate(document, nodeId, options);

  if (!snapCandidate) {
    return document;
  }

  const snappedDocument = applyWorkflowEditorNodeSnap(document, nodeId, snapCandidate);
  const validity = validateWorkflowEditorConnection(
    snappedDocument,
    snapCandidate.connection,
    options,
  );

  return validity.valid
    ? connectWorkflowEditorNodes(snappedDocument, snapCandidate.connection, options)
    : snappedDocument;
}

function snapWorkflowEditorNodePositionToCompatiblePort<
  TNodeData extends Record<string, unknown>,
  TEdgeData extends Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  nodeId: string,
  options: { typeDefinitions?: readonly WorkflowEditorTypeDefinition[] } = {},
) {
  const snapCandidate = findWorkflowEditorNodeSnapCandidate(document, nodeId, options);

  return snapCandidate ? applyWorkflowEditorNodeSnap(document, nodeId, snapCandidate) : document;
}

type WorkflowEditorNodeSnapCandidate = {
  connection: {
    sourceNodeId: string;
    sourcePortId: string;
    targetNodeId: string;
    targetPortId: string;
  };
  distance: number;
  dx: number;
  dy: number;
};

function findWorkflowEditorNodeSnapCandidate<
  TNodeData extends Record<string, unknown>,
  TEdgeData extends Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  nodeId: string,
  options: { typeDefinitions?: readonly WorkflowEditorTypeDefinition[] } = {},
) {
  const movedNode = document.nodes.find((node) => node.id === nodeId);

  if (!movedNode) {
    return undefined;
  }

  let bestCandidate: WorkflowEditorNodeSnapCandidate | undefined;

  const addCandidate = (
    connection: {
      sourceNodeId: string;
      sourcePortId: string;
      targetNodeId: string;
      targetPortId: string;
    },
    movedPortCenter: WorkflowEditorPoint | null,
    otherPortCenter: WorkflowEditorPoint | null,
  ) => {
    if (!movedPortCenter || !otherPortCenter) {
      return;
    }

    const dx = otherPortCenter.x - movedPortCenter.x;
    const dy = otherPortCenter.y - movedPortCenter.y;
    const distance = Math.hypot(dx, dy);

    if (distance > workflowEditorSnapDistance) {
      return;
    }

    if (
      !canSnapWorkflowEditorConnection(document, connection, options) ||
      (bestCandidate && bestCandidate.distance <= distance)
    ) {
      return;
    }

    bestCandidate = { connection, distance, dx, dy };
  };

  for (const node of document.nodes) {
    if (node.id === movedNode.id) {
      continue;
    }

    for (const output of movedNode.outputs ?? []) {
      for (const input of node.inputs ?? []) {
        addCandidate(
          {
            sourceNodeId: movedNode.id,
            sourcePortId: output.id,
            targetNodeId: node.id,
            targetPortId: input.id,
          },
          getWorkflowEditorPortCenter(movedNode, "output", output.id),
          getWorkflowEditorPortCenter(node, "input", input.id),
        );
      }
    }

    for (const input of movedNode.inputs ?? []) {
      for (const output of node.outputs ?? []) {
        addCandidate(
          {
            sourceNodeId: node.id,
            sourcePortId: output.id,
            targetNodeId: movedNode.id,
            targetPortId: input.id,
          },
          getWorkflowEditorPortCenter(movedNode, "input", input.id),
          getWorkflowEditorPortCenter(node, "output", output.id),
        );
      }
    }
  }

  return bestCandidate;
}

function canSnapWorkflowEditorConnection<
  TNodeData extends Record<string, unknown>,
  TEdgeData extends Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  connection: WorkflowEditorNodeSnapCandidate["connection"],
  options: { typeDefinitions?: readonly WorkflowEditorTypeDefinition[] },
) {
  const validity = validateWorkflowEditorConnection(document, connection, options);

  return validity.valid || validity.reason === "duplicate" || validity.reason === "cycle";
}

function applyWorkflowEditorNodeSnap<
  TNodeData extends Record<string, unknown>,
  TEdgeData extends Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  nodeId: string,
  snapCandidate: WorkflowEditorNodeSnapCandidate,
): WorkflowEditorDocument<TNodeData, TEdgeData> {
  const movedNode = document.nodes.find((node) => node.id === nodeId);

  if (!movedNode) {
    return document;
  }

  const nextX = Math.round(movedNode.x + snapCandidate.dx);
  const nextY = Math.round(movedNode.y + snapCandidate.dy);

  if (movedNode.x === nextX && movedNode.y === nextY) {
    return document;
  }

  return {
    ...document,
    nodes: document.nodes.map((node) =>
      node.id === nodeId
        ? {
            ...node,
            x: nextX,
            y: nextY,
          }
        : node,
    ),
  };
}

function getWorkflowEditorPortCenter<TNodeData extends Record<string, unknown>>(
  node: WorkflowEditorNode<TNodeData>,
  direction: "input" | "output",
  portId: string,
): WorkflowEditorPoint | null {
  const ports = direction === "input" ? (node.inputs ?? []) : (node.outputs ?? []);
  const portIndex = ports.findIndex((port) => port.id === portId);

  if (portIndex === -1) {
    return null;
  }

  const size = getWorkflowNodeSize(node);

  return {
    x: node.x + (direction === "input" ? 0 : size.width),
    y: node.y + getWorkflowNodePortCenterOffset(node, portIndex),
  };
}

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

function WorkflowSelectionOverlay<
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
          const size = getWorkflowNodeSize(node);
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

function selectionStateToSingleSelection<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  selection: WorkflowEditorSelectionState,
): WorkflowEditorSelection<TNodeData, TEdgeData> {
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

function toggleWorkflowEditorSelectionItem(
  selection: WorkflowEditorSelectionState,
  item: NonNullable<WorkflowEditorSelectionState["primary"]>,
): WorkflowEditorSelectionState {
  if (item.type === "node") {
    const hasNode = selection.nodeIds.includes(item.id);
    return {
      nodeIds: hasNode
        ? selection.nodeIds.filter((nodeId) => nodeId !== item.id)
        : [...selection.nodeIds, item.id],
      edgeIds: selection.edgeIds,
      primary: item,
    };
  }

  const hasEdge = selection.edgeIds.includes(item.id);
  return {
    nodeIds: selection.nodeIds,
    edgeIds: hasEdge
      ? selection.edgeIds.filter((edgeId) => edgeId !== item.id)
      : [...selection.edgeIds, item.id],
    primary: item,
  };
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
    !!target.closest("input, textarea, select, [contenteditable='true'], [role='textbox']")
  );
}

function toUiWorkflowNodeTemplate<TData>(template: WorkflowWorkbenchPaletteItem<TData>) {
  return {
    id: template.id,
    label: template.label,
    description: template.description,
    kind: template.kind,
    category: template.category,
    eyebrow: template.eyebrow,
    packageLabel: template.packageLabel,
    status: template.status,
    tone: template.tone,
    variant: template.variant ?? "compact",
    minimized: template.minimized,
    tags: template.tags,
    inputs: template.inputs,
    outputs: template.outputs,
  } satisfies WorkflowNodeData;
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

function DefaultWorkflowInspector<
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
            objectExpression: objectConstructorExpression,
            objectDecompositionExpression,
            ...(jsonValueField ? { jsonValue: jsonValueDefault } : {}),
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
                { id: "kind", label: "Kind", type: "text" },
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
            ...(isWorkflowEditorObjectConstructorNode(node)
              ? [
                  {
                    id: "object-constructor",
                    title: "Object",
                    description: "Map input values to object properties.",
                    fields: [
                      ...objectConstructorInputs.map((input) => ({
                        id: `objectProperty:${input.id}`,
                        label: input.badge ? `${input.badge}` : input.label,
                        type: "text" as const,
                        placeholder: "propertyName",
                      })),
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
                      ...objectDecompositionOutputs.map((output) => ({
                        id: `objectOutput:${output.id}`,
                        label: output.badge ? `${output.badge}` : output.label,
                        type: "text" as const,
                        placeholder: "propertyName",
                      })),
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
              kind: String(values.kind ?? "") || undefined,
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

function toNumber(value: InspectorFieldValue, fallback: number) {
  const nextValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
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
