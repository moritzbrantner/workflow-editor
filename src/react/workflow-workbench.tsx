"use client";

import {
  type DragEvent as ReactDragEvent,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cn } from "@moritzbrantner/ui";
import {
  getGraphWorkbenchCommandFromKeyboardEvent,
  isGraphWorkbenchEditableTarget,
  type GraphWorkbenchAction,
  type GraphWorkbenchController,
} from "@moritzbrantner/graph-editor/react";

import {
  createWorkflowEditorGraphIndex,
  createWorkflowEditorNodeTemplateRegistry,
  defaultWorkflowEditorNodeTemplates,
  formatWorkflowEditorObjectConstructorExpression,
  getWorkflowEditorNodeGroupId,
  isWorkflowEditorIterationNode,
  isWorkflowEditorObjectConstructorNode,
  moveWorkflowEditorGroup,
  normalizeWorkflowEditorDocument,
  normalizeWorkflowEditorSelection,
  removeWorkflowEditorSelection,
  ungroupWorkflowEditorGroup,
  updateWorkflowEditorGroup,
  validateWorkflowEditorConnection,
  type WorkflowEditorDocument,
  type WorkflowEditorNode,
  type WorkflowEditorNodeTemplate,
  type WorkflowEditorPortType,
} from "../core";
import {
  getWorkflowExecutionEdgeStatus,
  getWorkflowExecutionNodePresentation,
} from "../core-execution";
import { getWorkflowEditorNodeBodyHeight, getWorkflowEditorNodeWidth } from "../core-node-layout";
import {
  snapWorkflowEditorNodePositionToCompatiblePort,
  snapWorkflowEditorNodeToCompatiblePort,
} from "../react-snap";
import {
  isWorkflowEditorDynamicPortNode,
  WorkflowDynamicPortAddAction,
  WorkflowDynamicPortControl,
} from "./dynamic-port-controls";
import { WorkflowGroupOverlays } from "./group-overlays";
import {
  isWorkflowEditorJsonPrimitiveNode,
  WorkflowJsonPrimitiveNodeValueControl,
  WorkflowNodeRenameControl,
  WorkflowObjectConstructorExpressionControl,
} from "./node-inline-controls";
import {
  createWorkflowWorkbenchPaletteCategoryGroups,
  filterWorkflowWorkbenchPaletteTemplates,
  type WorkflowWorkbenchPaletteCategoryGroup,
  type WorkflowWorkbenchPaletteItem,
} from "./palette-model";
import { useWorkflowPortConnectionMenu, WorkflowPortConnectionMenu } from "./port-connection-menu";
import { WorkflowSelectionOverlay } from "./selection-overlay";
import { describeWorkflowWorkbenchDocumentChange } from "./workbench-announcements";
import { useWorkflowWorkbenchCanvasInteractions } from "./workbench-canvas-interactions";
import {
  WorkflowWorkbenchInspectorOverlay,
  WorkflowWorkbenchPaletteOverlay,
} from "./workbench-default-overlays";
import { WorkflowWorkbenchDefaultToolbar } from "./workbench-default-toolbar";
import { getWorkflowEditorPointFromClient, isEditableEventTarget } from "./workbench-dom";
import { createWorkflowWorkbenchDocumentActions } from "./workbench-document-actions";
import {
  clampWorkflowEditorZoom,
  emptyWorkflowEditorSelection,
  hasWorkflowWorkbenchSelection,
  inspectorFieldsForNode,
  isWorkflowEditorComposedNode,
  keepDesignPresentation,
  normalizeWorkflowEditorViewport,
  toUiConnectionInvalidReason,
  toWorkflowWorkbenchConnectionInput,
  workflowEditorMaxZoom,
  workflowEditorMinZoom,
} from "./workbench-model";
import { useWorkflowWorkbenchOverlayState } from "./workbench-overlay-state";
import { useWorkflowWorkbenchRuntime } from "./workbench-runtime";
import type {
  WorkflowWorkbenchController,
  WorkflowWorkbenchInspectorContext,
  WorkflowWorkbenchProps,
} from "./workbench-types";
import { WorkflowBuilder } from "./workflow-builder";
import {
  fromUiWorkflowBuilderEdges,
  fromUiWorkflowBuilderNodes,
  toUiWorkflowBuilderEdges,
  toUiWorkflowBuilderNodes,
} from "./workflow-builder-adapters";

const workflowEditorPaletteDragType = "application/x-workflow-editor-node-template";

export function WorkflowWorkbench<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
>({
  document: sourceDocument,
  selectedNodeId,
  selectedEdgeId,
  selectedNodeIds,
  selectedEdgeIds,
  selectedGroupIds,
  readOnly = false,
  nodeTemplates = defaultWorkflowEditorNodeTemplates as ReadonlyArray<
    WorkflowWorkbenchPaletteItem<TTemplateData>
  >,
  inspectorFieldRenderers,
  triggerActivation,
  inputProfiles,
  humanTasks,
  sharedTemplates,
  typeDefinitions,
  documentReferences,
  portTypeColors,
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
  onOpenIterationBody,
  iterationBody,
  execution,
  formatExecutionLabel,
  renderExecutionDetails,
  history: hostHistory,
  renderNodeTemplate,
  renderInspector,
  renderToolbarActions,
}: WorkflowWorkbenchProps<TNodeData, TEdgeData, TTemplateData>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const connectionInProgressRef = useRef(false);
  const uiCreatedConnectionCommitKeyRef = useRef<string | null>(null);
  const pendingNodeSnapRef = useRef<{
    document: WorkflowEditorDocument<TNodeData, TEdgeData>;
    nodeIds: Set<string>;
  } | null>(null);
  const runtime = useWorkflowWorkbenchRuntime({
    sourceDocument,
    linkedTemplates: nodeTemplates as unknown as readonly WorkflowEditorNodeTemplate<TNodeData>[],
    selectedNodeId,
    selectedEdgeId,
    selectedNodeIds,
    selectedEdgeIds,
    selectedGroupIds,
    onDocumentChange,
    onSelectionChange,
    onSelectionStateChange,
  });
  const {
    commitDocument,
    dispatchGraphOperation,
    document,
    documentContext,
    emitSelectionState,
    externalSelectionProvided,
    graphRuntime,
    selection,
    setInternalSelection,
  } = runtime;
  const [paletteSearchValue, setPaletteSearchValue] = useState("");
  const [renamingNodeId, setRenamingNodeId] = useState<string | null>(null);
  const [objectConstructorExpressionDrafts, setObjectConstructorExpressionDrafts] = useState<
    Record<string, string>
  >({});
  const [announcement, setAnnouncement] = useState("");
  const announcedDocumentRef = useRef(document);
  const focusWithinWorkbenchRef = useRef(false);

  useEffect(() => {
    const previous = announcedDocumentRef.current;
    announcedDocumentRef.current = document;
    const message = describeWorkflowWorkbenchDocumentChange(previous, document);
    if (message) {
      setAnnouncement(message);
    }

    // Keep keyboard users on the canvas when the focused element was removed by an edit
    // (deletion, undo, redo, composition) instead of dropping focus to the page body.
    const ownerDocument = containerRef.current?.ownerDocument;
    if (!ownerDocument || !focusWithinWorkbenchRef.current) {
      return;
    }
    const frame = ownerDocument.defaultView?.requestAnimationFrame(() => {
      const active = ownerDocument.activeElement;
      if (active && active !== ownerDocument.body && active.isConnected) {
        return;
      }
      containerRef.current
        ?.querySelector<HTMLElement>("[data-slot='workflow-builder-surface']")
        ?.focus({ preventScroll: true });
    });
    return () => {
      if (frame !== undefined) {
        ownerDocument.defaultView?.cancelAnimationFrame(frame);
      }
    };
  }, [document]);

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
  const nothingSelected = !selectedNode && !selectedEdge;
  const selectedNodes = selection.nodeIds.flatMap((id) => {
    const node = documentContext.nodeById.get(id);
    return node ? [node] : [];
  });
  const selectedEdges = selection.edgeIds.flatMap((id) => {
    const edge = documentContext.edgeById.get(id);
    return edge ? [edge] : [];
  });
  const graphIndex = useMemo(() => createWorkflowEditorGraphIndex(document), [document]);
  const designUiNodes = useMemo(
    () => toUiWorkflowBuilderNodes(document.nodes, document.edges, { portTypeColors }),
    [document.edges, document.nodes, portTypeColors],
  );
  const designUiEdges = useMemo(
    () => toUiWorkflowBuilderEdges(document.edges, document.nodes, { portTypeColors }),
    [document.edges, document.nodes, portTypeColors],
  );
  // Runtime state is layered over the derived UI nodes only, so an update never re-normalizes the
  // document and never reaches document history or serialization.
  const uiNodes = useMemo(
    () =>
      execution
        ? designUiNodes.map((uiNode) => {
            const snapshot = execution.nodes[uiNode.id];
            if (!snapshot) {
              return uiNode;
            }
            const presentation = getWorkflowExecutionNodePresentation(snapshot);
            const node = documentContext.nodeById.get(uiNode.id);
            return {
              ...uiNode,
              status: presentation.status,
              tone: presentation.tone,
              eyebrow:
                formatExecutionLabel && node
                  ? formatExecutionLabel(snapshot, node)
                  : presentation.label,
            };
          })
        : designUiNodes,
    [designUiNodes, documentContext, execution, formatExecutionLabel],
  );
  const uiEdges = useMemo(
    () =>
      execution?.edges
        ? designUiEdges.map((uiEdge) => {
            const snapshot = execution.edges?.[uiEdge.id];
            return snapshot
              ? { ...uiEdge, status: getWorkflowExecutionEdgeStatus(snapshot) }
              : uiEdge;
          })
        : designUiEdges,
    [designUiEdges, execution],
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
  const templateRegistry = useMemo(
    () => createWorkflowEditorNodeTemplateRegistry(nodeTemplates, { typeDefinitions }),
    [nodeTemplates, typeDefinitions],
  );
  const filteredNodeTemplates = useMemo(
    () => filterWorkflowWorkbenchPaletteTemplates(nodeTemplates, paletteSearchValue),
    [nodeTemplates, paletteSearchValue],
  );
  const paletteGroups = useMemo(
    () => createWorkflowWorkbenchPaletteCategoryGroups(filteredNodeTemplates),
    [filteredNodeTemplates],
  );

  useEffect(() => {
    if (!externalSelectionProvided) {
      setInternalSelection((current) => normalizeWorkflowEditorSelection(document, current));
    }
  }, [document, externalSelectionProvided]);

  const {
    addTemplateNode,
    arrangeAll,
    arrangeSelection,
    commitViewportChange,
    commitWorkflowEditorConnection,
    composeSelection,
    copySelection,
    createSelectedNodeWorkflow,
    deleteNode,
    deleteSelection,
    duplicateSelection,
    fitWorkflowWorkbenchView,
    groupSelection,
    openSelectedNodeWorkflow,
    pasteSelection,
    redoWorkbench,
    renameSelectedGroup,
    restoreComposition,
    runGraphCommand,
    selectAll,
    selectWorkflowJsonPrimitiveNode,
    selectedNodeHasWorkflowReference,
    selectedNodeWorkflowReferenceValid,
    toggleSelectedGroupMinimized,
    undoWorkbench,
    ungroupSelection,
    updateDocument,
    updateSelectedEdge,
    updateSelectedGroup,
    updateSelectedNode,
    updateSelectedNodeWorkflowReference,
    updateWorkflowJsonPrimitiveNodeValue,
    updateWorkflowNodeLabel,
    updateWorkflowObjectConstructorExpressionValue,
  } = createWorkflowWorkbenchDocumentActions({
    documentReferences,
    hostHistory,
    onCreateWorkflowReference,
    onOpenWorkflowReference,
    onViewportChange,
    readOnly,
    runtime,
    selectedEdge,
    selectedGroup,
    selectedNode,
    setAnnouncement,
    templateRegistry,
    typeDefinitions,
    uiCreatedConnectionCommitKeyRef,
  });
  const overlays = useWorkflowWorkbenchOverlayState({
    containerRef,
    nothingSelected,
    overlayBehavior,
  });
  const { openPortConnectionMenu, portConnectionMenu, setPortConnectionMenu } =
    useWorkflowPortConnectionMenu({
      connectionInProgressRef,
      containerRef,
      documentContext,
      readOnly,
    });
  const {
    cancelCanvasPointerInteraction,
    completeCanvasPointerInteraction,
    preserveGraphCanvasModifierSelection,
    startCanvasPointerInteraction,
    updateCanvasPointerInteraction,
  } = useWorkflowWorkbenchCanvasInteractions({
    commitViewportChange,
    containerRef,
    emitSelectionState,
    viewport: document.viewport,
  });

  const updateWorkflowObjectConstructorExpressionDraft = (nodeId: string, expression: string) => {
    setObjectConstructorExpressionDrafts((current) =>
      current[nodeId] === expression ? current : { ...current, [nodeId]: expression },
    );
  };

  const inspectorContext = {
    document,
    ...(execution ? { execution } : {}),
    documentReferences,
    readOnly,
    selection,
    selectedEdges,
    selectedNodes,
    createSelectedNodeWorkflow:
      documentReferences && onCreateWorkflowReference ? createSelectedNodeWorkflow : undefined,
    openSelectedNodeWorkflow:
      documentReferences && onOpenWorkflowReference ? openSelectedNodeWorkflow : undefined,
    ...(selectedNode && onOpenIterationBody && isWorkflowEditorIterationNode(selectedNode)
      ? { openSelectedIterationBody: () => onOpenIterationBody(selectedNode) }
      : {}),
    ...(iterationBody ? { iterationBody } : {}),
    selectedEdge,
    selectedNode,
    updateDocument,
    updateSelectedEdge,
    updateSelectedNode,
    updateSelectedNodeWorkflowReference,
    inspectorFields: (node: WorkflowEditorNode<TNodeData>) =>
      inspectorFieldsForNode(nodeTemplates, node),
    ...(inspectorFieldRenderers ? { inspectorFieldRenderers } : {}),
    ...(triggerActivation ? { triggerActivation } : {}),
    ...(inputProfiles ? { inputProfiles } : {}),
    ...(sharedTemplates
      ? {
          sharedTemplates: {
            ...sharedTemplates,
            templates: nodeTemplates as unknown as readonly WorkflowEditorNodeTemplate<TNodeData>[],
          },
        }
      : {}),
    ...(typeDefinitions ? { typeDefinitions } : {}),
  } satisfies WorkflowWorkbenchInspectorContext<TNodeData, TEdgeData>;

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

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isGraphWorkbenchEditableTarget(event.target) || isEditableEventTarget(event.target)) {
        return;
      }

      const mod = event.metaKey || event.ctrlKey;
      const commandId =
        getGraphWorkbenchCommandFromKeyboardEvent(event) ??
        (mod && event.key.toLowerCase() === "g"
          ? event.shiftKey
            ? "ungroup-selection"
            : "group-selection"
          : event.key === "Escape"
            ? "clear-selection"
            : event.key === "Delete" || event.key === "Backspace"
              ? "delete"
              : null);

      if (!commandId) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (commandId === "clear-selection") {
        emitSelectionState(emptyWorkflowEditorSelection);
        return;
      }

      runGraphCommand(commandId);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

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
    emitSelectionState({
      nodeIds: [nodeId],
      edgeIds: [],
      primary: { type: "node", id: nodeId },
    });
    setRenamingNodeId(nodeId);
  };

  const graphCommands = [
    {
      id: "undo",
      label: "Undo",
      disabled: readOnly || !(hostHistory?.canUndo ?? graphRuntime.canUndo),
      run: undoWorkbench,
    },
    {
      id: "redo",
      label: "Redo",
      disabled: readOnly || !(hostHistory?.canRedo ?? graphRuntime.canRedo),
      run: redoWorkbench,
    },
    {
      id: "copy",
      label: "Copy",
      disabled: !hasWorkflowWorkbenchSelection(selection),
      run: copySelection,
    },
    {
      id: "paste",
      label: "Paste",
      disabled: readOnly,
      run: pasteSelection,
    },
    {
      id: "duplicate",
      label: "Duplicate",
      disabled: readOnly || !hasWorkflowWorkbenchSelection(selection),
      run: duplicateSelection,
    },
    {
      id: "delete",
      label: "Delete",
      destructive: true,
      disabled: readOnly || !hasWorkflowWorkbenchSelection(selection),
      run: deleteSelection,
    },
    { id: "select-all", label: "Select all", run: selectAll },
    { id: "fit-view", label: "Fit view", run: fitWorkflowWorkbenchView },
    {
      id: "auto-layout",
      label: "Arrange all",
      disabled: readOnly || document.nodes.length === 0,
      run: arrangeAll,
    },
    {
      id: "group-selection",
      label: "Group",
      disabled: readOnly || selection.nodeIds.length < 2,
      run: groupSelection,
    },
    {
      id: "ungroup-selection",
      label: "Ungroup",
      disabled: readOnly || !selectedGroup,
      run: ungroupSelection,
    },
    { id: "export-json", label: "Export JSON", run: () => {} },
    { id: "import-json", label: "Import JSON", disabled: readOnly, run: () => {} },
  ] satisfies GraphWorkbenchAction[];

  const graphController = {
    runtime: graphRuntime,
    dispatch: dispatchGraphOperation,
    document: graphRuntime.document,
    readOnly,
    selection,
    selectedNode,
    selectedEdge,
    selectedGroup,
    diagnostics: graphRuntime.diagnostics,
    selectedDiagnostics: graphRuntime.selectedDiagnostics,
    history: {
      ...graphRuntime.operationHistory,
      canUndo: hostHistory?.canUndo ?? graphRuntime.canUndo,
      canRedo: hostHistory?.canRedo ?? graphRuntime.canRedo,
    },
    palette: {
      groups: paletteGroups as unknown as Array<WorkflowWorkbenchPaletteCategoryGroup<TNodeData>>,
      items: nodeTemplates as unknown as ReadonlyArray<WorkflowWorkbenchPaletteItem<TNodeData>>,
      filteredItems: filteredNodeTemplates as unknown as ReadonlyArray<
        WorkflowWorkbenchPaletteItem<TNodeData>
      >,
      searchValue: paletteSearchValue,
      setSearchValue: setPaletteSearchValue,
    },
    view: {
      showPalette: chrome?.palette !== "hidden",
      showInspector: chrome?.inspector !== "hidden",
      showMiniMap: true,
      setShowPalette: () => {},
      setShowInspector: () => {},
      setShowMiniMap: () => {},
      setZoom: (zoom: number) => {
        commitViewportChange({
          ...normalizeWorkflowEditorViewport(document.viewport),
          zoom: clampWorkflowEditorZoom(zoom),
        });
      },
    },
    actions: {
      addTemplateNode: (template, position) =>
        addTemplateNode(
          template as unknown as WorkflowWorkbenchPaletteItem<TTemplateData>,
          position,
        ),
      appendTemplateNode: (template) => {
        if (template) {
          addTemplateNode(template as unknown as WorkflowWorkbenchPaletteItem<TTemplateData>);
        }
      },
      deleteSelection,
      setSelection: emitSelectionState,
      updateDocument: (nextDocument, options) =>
        commitDocument(nextDocument as WorkflowEditorDocument<TNodeData, TEdgeData>, {
          history: options?.history,
          selectionAfter: options?.selectionAfter,
        }),
      undo: undoWorkbench,
      redo: redoWorkbench,
      copySelection: async () => copySelection(),
      pasteSelection,
      duplicateSelection,
      selectAll,
      fitView: fitWorkflowWorkbenchView,
      autoLayout: arrangeAll,
      groupSelection,
      ungroupSelection,
      importJson: async (file?: File) => {
        if (readOnly || !file) {
          return;
        }

        const text = await file.text();
        commitDocument(JSON.parse(text) as WorkflowEditorDocument<TNodeData, TEdgeData>);
      },
      exportJson: () => {},
      runCommand: runGraphCommand,
    },
    commands: graphCommands,
    // Workflow actions report their own errors; the generic graph action error slot stays empty.
    status: { actionError: null, clearActionError: () => {} },
  } satisfies GraphWorkbenchController<TNodeData, TEdgeData, WorkflowEditorPortType>;

  const workbenchController = {
    graph: graphController,
    document,
    readOnly,
    selection,
    selectedEdge,
    selectedEdges,
    selectedGroup,
    selectedGroups,
    selectedNode,
    selectedNodes,
    workflow: {
      typeDefinitions,
      documentReferences,
      openSelectedNodeWorkflow:
        documentReferences && onOpenWorkflowReference ? openSelectedNodeWorkflow : undefined,
      createSelectedNodeWorkflow:
        documentReferences && onCreateWorkflowReference ? createSelectedNodeWorkflow : undefined,
    },
    palette: {
      groups: paletteGroups,
      items: nodeTemplates,
      registry: templateRegistry,
      filteredItems: filteredNodeTemplates,
      minimized: overlays.palette.minimized,
      placement: overlays.palette.placement,
      position: overlays.palette.position,
      searchValue: paletteSearchValue,
      setMinimized: overlays.palette.setMinimized,
      setPlacement: overlays.palette.setPlacement,
      setPosition: overlays.palette.setPosition,
      setSearchValue: setPaletteSearchValue,
    },
    inspector: {
      context: inspectorContext,
      collapsed: overlays.inspector.collapsed,
      minimized: overlays.inspector.minimized,
      position: overlays.inspector.position,
      setMinimized: overlays.inspector.setMinimized,
      setPosition: overlays.inspector.setPosition,
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
        minimized: overlays.palette.minimized,
        placement: overlays.palette.placement,
        position: overlays.palette.position,
      },
      inspector: {
        minimized: overlays.inspector.minimized,
        position: overlays.inspector.position,
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
      portTypeColors,
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
      composeSelection,
      restoreComposition,
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

  return (
    <div
      data-slot="workbench-layout"
      onFocusCapture={() => {
        focusWithinWorkbenchRef.current = true;
      }}
      onBlurCapture={(event) => {
        const nextFocus = event.relatedTarget;
        if (nextFocus instanceof Node) {
          if (!event.currentTarget.contains(nextFocus)) {
            focusWithinWorkbenchRef.current = false;
          }
          return;
        }
        // Focus left to nowhere: either the user clicked away (target stays connected) or an
        // edit removed the focused element, in which case focus is restored to the canvas.
        const blurred = event.target;
        const ownerDocument = event.currentTarget.ownerDocument;
        queueMicrotask(() => {
          // A blurred element that is still rendered and enabled means the user moved focus away; a
          // removed, hidden or disabled one (for example "Create nested workflow" once it opens the
          // nested workflow) does not.
          if (
            blurred.isConnected &&
            blurred.getClientRects().length > 0 &&
            !blurred.matches(":disabled")
          ) {
            focusWithinWorkbenchRef.current = false;
            return;
          }
          ownerDocument.defaultView?.requestAnimationFrame(() => {
            const active = ownerDocument.activeElement;
            if (focusWithinWorkbenchRef.current && (!active || active === ownerDocument.body)) {
              containerRef.current
                ?.querySelector<HTMLElement>("[data-slot='workflow-builder-surface']")
                ?.focus({ preventScroll: true });
            }
          });
        });
      }}
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
        <WorkflowWorkbenchDefaultToolbar
          controller={workbenchController}
          graphIndex={graphIndex}
          selectedNodeHasWorkflowReference={selectedNodeHasWorkflowReference}
          selectedNodeWorkflowReferenceValid={selectedNodeWorkflowReferenceValid}
        />
      )}
      <main
        data-slot="workbench-canvas"
        className="relative grid min-h-0 overflow-hidden bg-background"
      >
        <div className="grid min-h-0 min-w-0 p-3">
          <div
            ref={containerRef}
            className="relative min-h-0 min-w-0"
            onClickCapture={preserveGraphCanvasModifierSelection}
            onPointerDownCapture={startCanvasPointerInteraction}
            onPointerMoveCapture={updateCanvasPointerInteraction}
            onPointerUpCapture={(event) => {
              if (!completeCanvasPointerInteraction(event)) {
                clearPendingConnectionAfterTargetClick(event);
              }
            }}
            onPointerUp={() => {
              completePendingNodeSnap();
            }}
            onPointerCancel={(event) => {
              cancelCanvasPointerInteraction(event);
              pendingNodeSnapRef.current = null;
            }}
            onContextMenuCapture={openPortConnectionMenu}
            onKeyDownCapture={(event) => {
              if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
                openPortConnectionMenu(event);
              }
            }}
            onDoubleClickCapture={startNodeRenameFromDoubleClick}
            onDragOver={handleTemplateDragOver}
            onDrop={handleTemplateDrop}
          >
            <WorkflowBuilder
              className="flex h-full min-h-0 min-w-0 flex-col [&>[data-slot='workflow-builder-surface']]:flex-1 [&>[data-slot='workflow-builder-surface']]:basis-0"
              nodes={uiNodes}
              edges={uiEdges}
              groups={document.groups}
              selectedNodeId={primarySelectedNodeId}
              selectedEdgeId={primarySelectedEdgeId}
              selectedGroupId={primarySelectedGroupId}
              selectedNodeIds={selection.nodeIds}
              selectedEdgeIds={selection.edgeIds}
              selectedGroupIds={selection.groupIds}
              hiddenNodeIds={hiddenNodeIds}
              hiddenEdgeIds={hiddenEdgeIds}
              readOnly={readOnly}
              showMiniMap
              showPortColumnHeaders={false}
              showNodeCategory={false}
              enableWheelZoom={false}
              measurePorts="dom"
              surfaceHeight="auto"
              // JSON value editors render natively inside the node (graph-editor composition seams).
              renderMinimizedNodeContent={({ node }) => {
                const workflowNode = documentContext.nodeById.get(node.id);
                return workflowNode && isWorkflowEditorJsonPrimitiveNode(workflowNode) ? (
                  <WorkflowJsonPrimitiveNodeValueControl
                    node={workflowNode}
                    readOnly={readOnly}
                    onFocusNode={selectWorkflowJsonPrimitiveNode}
                    onValueChange={updateWorkflowJsonPrimitiveNodeValue}
                  />
                ) : null;
              }}
              // One geometry model (#48): graph-editor sizes nodes from these options.
              minimizedNodeLayout="inline"
              getNodeBodyHeight={(node) =>
                getWorkflowEditorNodeBodyHeight(node, {
                  objectConstructorExpressions: objectConstructorExpressionDrafts,
                })
              }
              getNodeWidth={(node) =>
                getWorkflowEditorNodeWidth(node, {
                  objectConstructorExpressions: objectConstructorExpressionDrafts,
                  objectConstructorExpression: () => {
                    const workflowNode = documentContext.nodeById.get(node.id);
                    return workflowNode
                      ? formatWorkflowEditorObjectConstructorExpression(workflowNode)
                      : undefined;
                  },
                })
              }
              renderNodeBody={({ node }) => {
                const workflowNode = documentContext.nodeById.get(node.id);
                if (!workflowNode) return null;
                if (isWorkflowEditorJsonPrimitiveNode(workflowNode)) {
                  return (
                    <WorkflowJsonPrimitiveNodeValueControl
                      node={workflowNode}
                      readOnly={readOnly}
                      onFocusNode={selectWorkflowJsonPrimitiveNode}
                      onValueChange={updateWorkflowJsonPrimitiveNodeValue}
                    />
                  );
                }
                if (!isWorkflowEditorDynamicPortNode(workflowNode)) return null;
                const addAction = (
                  <WorkflowDynamicPortAddAction
                    document={document}
                    node={workflowNode}
                    readOnly={readOnly}
                    commit={(nextDocument) => commitDocument(nextDocument)}
                  />
                );
                return isWorkflowEditorObjectConstructorNode(workflowNode) ? (
                  <div className="grid gap-1">
                    <WorkflowObjectConstructorExpressionControl
                      node={workflowNode}
                      readOnly={readOnly}
                      onDraftChange={updateWorkflowObjectConstructorExpressionDraft}
                      onFocusNode={selectWorkflowJsonPrimitiveNode}
                      onValueChange={updateWorkflowObjectConstructorExpressionValue}
                    />
                    {addAction}
                  </div>
                ) : (
                  addAction
                );
              }}
              // One action surface per node: graph-editor's built-in node menu (#46).
              {...(chrome?.nodeControls === "hidden"
                ? {}
                : {
                    getNodeMenuItems: (node: { id: string }) => [
                      // Nested workflow navigation is contextual, in the node menu (#47).
                      ...(() => {
                        const workflowNode = documentContext.nodeById.get(node.id);
                        const target = workflowNode?.workflowRef?.documentId;
                        return workflowNode &&
                          target &&
                          onOpenWorkflowReference &&
                          documentReferences?.some((reference) => reference.id === target)
                          ? [
                              {
                                id: "open-workflow",
                                label: "Open workflow",
                                onSelect: () => onOpenWorkflowReference(workflowNode),
                              },
                            ]
                          : [];
                      })(),
                      // An iteration body opens in its own view (#94).
                      ...(() => {
                        const workflowNode = documentContext.nodeById.get(node.id);
                        return workflowNode &&
                          onOpenIterationBody &&
                          isWorkflowEditorIterationNode(workflowNode)
                          ? [
                              {
                                id: "open-iteration-body",
                                label: "Open body",
                                onSelect: () => onOpenIterationBody(workflowNode),
                              },
                            ]
                          : [];
                      })(),
                      ...(readOnly
                        ? []
                        : [
                            {
                              id: "rename",
                              label: "Rename",
                              onSelect: () => {
                                emitSelectionState({
                                  nodeIds: [node.id],
                                  edgeIds: [],
                                  primary: { type: "node", id: node.id },
                                });
                                // Start after the menu closes and returns focus to its trigger,
                                // so the field keeps focus instead of committing on blur.
                                window.setTimeout(() => setRenamingNodeId(node.id), 0);
                              },
                            },
                            ...(documentContext.nodeById.get(node.id) &&
                            isWorkflowEditorComposedNode(documentContext.nodeById.get(node.id)!)
                              ? [
                                  {
                                    id: "restore-composition",
                                    label: "Restore composition",
                                    onSelect: () => restoreComposition(node.id),
                                  },
                                ]
                              : []),
                            {
                              id: "delete",
                              label: "Delete",
                              destructive: true,
                              onSelect: () => deleteNode(node.id),
                            },
                          ]),
                    ],
                  })}
              // Inline rename replaces the header title in place (no portal, #46).
              renderNodeTitle={({ node }) => {
                const workflowNode =
                  node.id === renamingNodeId && !readOnly
                    ? documentContext.nodeById.get(node.id)
                    : undefined;
                return workflowNode ? (
                  <WorkflowNodeRenameControl
                    node={workflowNode}
                    onCancel={() => setRenamingNodeId(null)}
                    onCommit={(nodeId, label) => {
                      setRenamingNodeId(null);
                      updateWorkflowNodeLabel(nodeId, label);
                    }}
                  />
                ) : undefined;
              }}
              renderPortContent={({ node, port, direction }) => {
                const workflowNode = documentContext.nodeById.get(node.id);
                return workflowNode && isWorkflowEditorDynamicPortNode(workflowNode) ? (
                  <WorkflowDynamicPortControl
                    document={document}
                    node={workflowNode}
                    portId={port.id}
                    direction={direction}
                    readOnly={readOnly}
                    commit={(nextDocument) => commitDocument(nextDocument)}
                  />
                ) : null;
              }}
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
                    nodes: keepDesignPresentation(
                      fromUiWorkflowBuilderNodes(nodes, document.nodes),
                      documentContext.nodeById,
                    ),
                    edges: document.edges.filter(
                      (edge) => nodeIds.has(edge.sourceNodeId) && nodeIds.has(edge.targetNodeId),
                    ),
                  }).document;
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
                    (edge) => !documentContext.edgeById.has(edge.id),
                  );

                  if (uiCreatedEdge) {
                    commitWorkflowEditorConnection(uiCreatedEdge, { fromUiCreatedEdge: true });
                    return;
                  }

                  commitDocument(
                    normalizeWorkflowEditorDocument({
                      ...document,
                      edges: keepDesignPresentation(
                        fromUiWorkflowBuilderEdges(edges, document.edges),
                        documentContext.edgeById,
                      ),
                    }).document,
                  );
                }
              }}
              onViewportChange={(viewport) => {
                commitViewportChange(viewport);
              }}
              onSelectionStateChange={(nextSelection) => {
                emitSelectionState(nextSelection);
              }}
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
                  return true;
                }
              }}
              onDoubleClick={() => {
                openSelectedNodeWorkflow();
              }}
            />
            {portConnectionMenu ? (
              <WorkflowPortConnectionMenu
                document={document}
                menu={portConnectionMenu}
                typeDefinitions={typeDefinitions}
                onClose={() => setPortConnectionMenu(null)}
                onConnect={(connection) => {
                  setPortConnectionMenu(null);
                  commitWorkflowEditorConnection(connection);
                }}
              />
            ) : null}
            {chrome?.nodeControls === "hidden" ? null : (
              <>
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
                  marquee={null}
                  primaryNodeId={primarySelectedNodeId}
                  selection={selection}
                />
              </>
            )}
            {typeof chrome?.palette === "function" ? (
              chrome.palette(workbenchController)
            ) : chrome?.palette === "hidden" ? null : (
              <WorkflowWorkbenchPaletteOverlay
                controller={workbenchController}
                panel={overlays.palette}
                startTemplateDrag={startTemplateDrag}
              />
            )}
            {typeof chrome?.inspector === "function" ? (
              chrome.inspector(workbenchController)
            ) : chrome?.inspector === "hidden" ? null : (
              <WorkflowWorkbenchInspectorOverlay
                controller={workbenchController}
                execution={execution}
                humanTasks={humanTasks}
                panel={overlays.inspector}
                renderExecutionDetails={renderExecutionDetails}
              />
            )}
          </div>
        </div>
      </main>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="true"
        data-slot="workflow-workbench-announcer"
        className="sr-only"
      >
        {announcement}
      </div>
    </div>
  );
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
      portTypeColors={controller.configuration.portTypeColors}
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

export function WorkflowWorkbenchNodeControls() {
  return null;
}
