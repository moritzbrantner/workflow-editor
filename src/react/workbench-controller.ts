import { useMemo, useRef, useState } from "react";
import type {
  GraphWorkbenchAction,
  GraphWorkbenchCommandId,
  GraphWorkbenchController,
} from "@moritzbrantner/graph-editor/react";
import {
  createGraphEditorAddNodeOperation,
  createGraphEditorUpdateViewportOperation,
} from "@moritzbrantner/graph-editor/operations";
import {
  redoGraphEditorRuntime,
  undoGraphEditorRuntime,
} from "@moritzbrantner/graph-editor/runtime";

import {
  copyWorkflowEditorSelection,
  createWorkflowEditorGroup,
  createWorkflowEditorNodeTemplateRegistry,
  defaultWorkflowEditorNodeTemplates,
  duplicateWorkflowEditorSelection,
  isWorkflowEditorIterationNode,
  pasteWorkflowEditorClipboardPayload,
  removeWorkflowEditorSelection,
  ungroupWorkflowEditorGroup,
  updateWorkflowEditorGroup,
  updateWorkflowEditorNode,
  updateWorkflowEditorNodeWorkflowReference,
  type WorkflowEditorDocument,
  type WorkflowEditorEdge,
  type WorkflowEditorGroup,
  type WorkflowEditorNode,
  type WorkflowEditorNodeTemplate,
  type WorkflowEditorPortType,
  type WorkflowEditorSelectionState,
} from "../core";
import { layoutWorkflowEditorDocument } from "../core-layout";
import type {
  WorkflowWorkbenchOverlayPosition,
  WorkflowWorkbenchPanelPlacement,
} from "./overlay-position";
import {
  createWorkflowWorkbenchPaletteCategoryGroups,
  filterWorkflowWorkbenchPaletteTemplates,
  type WorkflowWorkbenchPaletteCategoryGroup,
  type WorkflowWorkbenchPaletteItem,
} from "./palette-model";
import {
  areWorkflowWorkbenchDocumentsEqual,
  clampWorkflowEditorZoom,
  composeWorkflowWorkbenchSelection,
  createWorkflowWorkbenchDocumentOperation,
  createWorkflowWorkbenchInsertedSelection,
  createWorkflowWorkbenchTemplateNode,
  emptyWorkflowEditorSelection,
  hasWorkflowWorkbenchSelection,
  inspectorFieldsForNode,
  normalizeWorkflowEditorViewport,
  readWorkflowEditorMemoryClipboard,
  restoreWorkflowWorkbenchComposition,
  writeWorkflowEditorMemoryClipboard,
} from "./workbench-model";
import { useWorkflowWorkbenchRuntime } from "./workbench-runtime";
import type {
  WorkflowEditorPoint,
  WorkflowWorkbenchController,
  WorkflowWorkbenchControllerProps,
  WorkflowWorkbenchInspectorContext,
} from "./workbench-types";

export function useWorkflowWorkbenchController<
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
  sharedTemplates,
  typeDefinitions,
  documentReferences,
  portTypeColors,
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
  renderNodeTemplate,
  renderInspector,
  renderToolbarActions,
}: WorkflowWorkbenchControllerProps<
  TNodeData,
  TEdgeData,
  TTemplateData
>): WorkflowWorkbenchController<TNodeData, TEdgeData, TTemplateData> {
  const {
    dispatchGraphOperation,
    document,
    documentContext,
    emitGraphRuntimeDocument,
    emitSelectionState: setSelection,
    graphRuntime,
    latestSelectionRef,
    selection,
    setGraphRuntime,
  } = useWorkflowWorkbenchRuntime({
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
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [paletteSearchValue, setPaletteSearchValue] = useState("");
  const [paletteMinimized, setPaletteMinimized] = useState(false);
  const [palettePlacement, setPalettePlacement] =
    useState<WorkflowWorkbenchPanelPlacement>("top-left");
  const [palettePosition, setPalettePosition] = useState<WorkflowWorkbenchOverlayPosition>(null);
  const [inspectorMinimized, setInspectorMinimized] = useState(false);
  const [inspectorPosition, setInspectorPosition] =
    useState<WorkflowWorkbenchOverlayPosition>(null);
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
  const templateRegistry = useMemo(
    () => createWorkflowEditorNodeTemplateRegistry(nodeTemplates, { typeDefinitions }),
    [nodeTemplates, typeDefinitions],
  );
  const filteredItems = useMemo(
    () => filterWorkflowWorkbenchPaletteTemplates(nodeTemplates, paletteSearchValue),
    [nodeTemplates, paletteSearchValue],
  );
  const groups = useMemo(
    () => createWorkflowWorkbenchPaletteCategoryGroups(filteredItems),
    [filteredItems],
  );

  const updateDocument = (nextDocument: WorkflowEditorDocument<TNodeData, TEdgeData>) => {
    if (!readOnly) {
      dispatchGraphOperation(createWorkflowWorkbenchDocumentOperation(nextDocument));
    }
  };
  const updateSelectedNode = (patch: Partial<WorkflowEditorNode<TNodeData>>) => {
    if (!readOnly && selectedNode) {
      updateDocument(updateWorkflowEditorNode(document, selectedNode.id, patch));
    }
  };
  const updateSelectedEdge = (patch: Partial<WorkflowEditorEdge<TEdgeData>>) => {
    if (!readOnly && selectedEdge) {
      updateDocument({
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
    // Invalid templates are listed disabled with their diagnostics and never create nodes.
    if (readOnly || templateRegistry.getEntry(template)?.valid === false) {
      return;
    }
    const { id, node } = createWorkflowWorkbenchTemplateNode(document.nodes, template, position);
    const nextDocument = { ...document, nodes: [...document.nodes, node] };
    const selectionAfter = {
      nodeIds: [id],
      edgeIds: [],
      primary: { type: "node", id },
    } satisfies WorkflowEditorSelectionState;
    dispatchGraphOperation(
      createGraphEditorAddNodeOperation<TNodeData, TEdgeData, WorkflowEditorPortType>({
        node,
        selectionBefore: selection,
        selectionAfter,
      }),
      { emitDocument: false },
    );
    emitGraphRuntimeDocument(nextDocument);
  };
  const deleteSelection = () => {
    if (!readOnly && hasWorkflowWorkbenchSelection(selection)) {
      const nextDocument = removeWorkflowEditorSelection(document, selection);
      dispatchGraphOperation(
        createWorkflowWorkbenchDocumentOperation(nextDocument, emptyWorkflowEditorSelection),
      );
      setSelection(emptyWorkflowEditorSelection);
    }
  };
  const duplicateSelection = () => {
    if (readOnly || !hasWorkflowWorkbenchSelection(selection)) {
      return;
    }
    const result = duplicateWorkflowEditorSelection(document, selection);
    dispatchGraphOperation(
      createWorkflowWorkbenchDocumentOperation(
        result.document,
        createWorkflowWorkbenchInsertedSelection(result),
      ),
      { emitSelection: false },
    );
    setSelection(createWorkflowWorkbenchInsertedSelection(result), result.document);
  };
  const copySelection = () => {
    if (!hasWorkflowWorkbenchSelection(selection)) {
      return;
    }
    const text = JSON.stringify(copyWorkflowEditorSelection(document, selection));
    writeWorkflowEditorMemoryClipboard(text);
    void navigator.clipboard?.writeText(text).catch(() => {});
  };
  const pasteSelection = async () => {
    if (readOnly) {
      return;
    }
    let text = readWorkflowEditorMemoryClipboard();
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
      dispatchGraphOperation(
        createWorkflowWorkbenchDocumentOperation(
          result.document,
          createWorkflowWorkbenchInsertedSelection(result),
        ),
        { emitSelection: false },
      );
      setSelection(createWorkflowWorkbenchInsertedSelection(result), result.document);
    } catch {
      return;
    }
  };
  const arrangeSelection = () => {
    const nodeIds = selectedGroup?.nodeIds ?? selection.nodeIds;
    if (!readOnly && nodeIds.length > 0) {
      dispatchGraphOperation(
        createWorkflowWorkbenchDocumentOperation(
          layoutWorkflowEditorDocument(document, { nodeIds }).document,
          selection,
        ),
      );
    }
  };
  const arrangeAll = () => {
    if (!readOnly && document.nodes.length > 0) {
      dispatchGraphOperation(
        createWorkflowWorkbenchDocumentOperation(
          layoutWorkflowEditorDocument(document).document,
          selection,
        ),
      );
    }
  };
  const updateSelectedNodeWorkflowReference = (documentId: string | null) => {
    if (!readOnly && selectedNode) {
      updateDocument(
        updateWorkflowEditorNodeWorkflowReference(
          document,
          selectedNode.id,
          documentId ? { documentId } : null,
        ),
      );
    }
  };
  const groupSelection = () => {
    const currentSelection = latestSelectionRef.current;
    if (readOnly || currentSelection.nodeIds.length < 2) {
      return;
    }

    const nextDocument = createWorkflowEditorGroup(document, currentSelection.nodeIds);
    const previousGroupIds = new Set((document.groups ?? []).map((group) => group.id));
    const group = (nextDocument.groups ?? []).find(
      (candidate) => !previousGroupIds.has(candidate.id),
    );
    dispatchGraphOperation(
      createWorkflowWorkbenchDocumentOperation(
        nextDocument,
        group
          ? {
              nodeIds: [],
              edgeIds: [],
              groupIds: [group.id],
              primary: { type: "group", id: group.id },
            }
          : currentSelection,
      ),
      { emitSelection: false },
    );
    if (group) {
      setSelection(
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
  const composeSelection = () => {
    const result = readOnly
      ? undefined
      : composeWorkflowWorkbenchSelection(document, latestSelectionRef.current.nodeIds);
    if (!result) return;
    dispatchGraphOperation(
      createWorkflowWorkbenchDocumentOperation(result.document, result.selection),
      {
        emitSelection: false,
      },
    );
    setSelection(result.selection, result.document);
  };
  const restoreComposition = (nodeId = latestSelectionRef.current.primary?.id) => {
    const result = readOnly ? undefined : restoreWorkflowWorkbenchComposition(document, nodeId);
    if (!result) return;
    dispatchGraphOperation(
      createWorkflowWorkbenchDocumentOperation(result.document, result.selection),
      {
        emitSelection: false,
      },
    );
    setSelection(result.selection, result.document);
  };
  const ungroupSelection = () => {
    if (readOnly || !selectedGroup) {
      return;
    }
    const nextDocument = ungroupWorkflowEditorGroup(document, selectedGroup.id);
    dispatchGraphOperation(
      createWorkflowWorkbenchDocumentOperation(nextDocument, {
        nodeIds: selectedGroup.nodeIds,
        edgeIds: [],
        ...(selectedGroup.nodeIds[0]
          ? { primary: { type: "node", id: selectedGroup.nodeIds[0] } }
          : {}),
      }),
      { emitSelection: false },
    );
    setSelection(
      {
        nodeIds: selectedGroup.nodeIds,
        edgeIds: [],
        ...(selectedGroup.nodeIds[0]
          ? { primary: { type: "node", id: selectedGroup.nodeIds[0] } }
          : {}),
      },
      nextDocument,
    );
  };
  const updateSelectedGroup = (patch: Partial<WorkflowEditorGroup>) => {
    if (!readOnly && selectedGroup) {
      dispatchGraphOperation(
        createWorkflowWorkbenchDocumentOperation(
          updateWorkflowEditorGroup(document, selectedGroup.id, patch),
          selection,
        ),
      );
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
  const selectAll = () => {
    setSelection({
      nodeIds: document.nodes.map((node) => node.id),
      edgeIds: [],
      ...(document.nodes.at(-1)
        ? { primary: { type: "node", id: document.nodes.at(-1)!.id } }
        : {}),
    });
  };
  const fitView = () => {
    const viewport =
      document.nodes.length === 0
        ? { x: 0, y: 0, zoom: 1 }
        : {
            x: Math.round(96 - Math.min(...document.nodes.map((node) => node.x))),
            y: Math.round(96 - Math.min(...document.nodes.map((node) => node.y))),
            zoom: 1,
          };
    onViewportChange?.(viewport);
    dispatchGraphOperation(
      createGraphEditorUpdateViewportOperation<TNodeData, TEdgeData, WorkflowEditorPortType>(
        viewport,
        { history: false, selectionBefore: selection, selectionAfter: selection },
      ),
      { emitDocument: false, emitSelection: false },
    );
    emitGraphRuntimeDocument({ ...document, viewport });
  };
  const undo = () => {
    const nextRuntime = undoGraphEditorRuntime(graphRuntime);
    setGraphRuntime(nextRuntime);
    const nextDocument = nextRuntime.document as WorkflowEditorDocument<TNodeData, TEdgeData>;
    if (!areWorkflowWorkbenchDocumentsEqual(nextDocument, document)) {
      emitGraphRuntimeDocument(nextDocument);
    }
    setSelection(nextRuntime.selection, nextDocument);
  };
  const redo = () => {
    const nextRuntime = redoGraphEditorRuntime(graphRuntime);
    setGraphRuntime(nextRuntime);
    const nextDocument = nextRuntime.document as WorkflowEditorDocument<TNodeData, TEdgeData>;
    if (!areWorkflowWorkbenchDocumentsEqual(nextDocument, document)) {
      emitGraphRuntimeDocument(nextDocument);
    }
    setSelection(nextRuntime.selection, nextDocument);
  };
  const runCommand = (commandId: GraphWorkbenchCommandId | string) => {
    switch (commandId) {
      case "undo":
        undo();
        return;
      case "redo":
        redo();
        return;
      case "copy":
        copySelection();
        return;
      case "paste":
        void pasteSelection();
        return;
      case "duplicate":
        duplicateSelection();
        return;
      case "delete":
        deleteSelection();
        return;
      case "select-all":
        selectAll();
        return;
      case "fit-view":
        fitView();
        return;
      case "auto-layout":
        arrangeAll();
        return;
      case "group-selection":
        groupSelection();
        return;
      case "ungroup-selection":
        ungroupSelection();
        return;
      default:
        return;
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
    ...(selectedNode && onOpenIterationBody && isWorkflowEditorIterationNode(selectedNode)
      ? { openSelectedIterationBody: () => onOpenIterationBody(selectedNode) }
      : {}),
    ...(iterationBody ? { iterationBody } : {}),
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

  const graphCommands = [
    { id: "undo", label: "Undo", disabled: readOnly || !graphRuntime.canUndo, run: undo },
    { id: "redo", label: "Redo", disabled: readOnly || !graphRuntime.canRedo, run: redo },
    { id: "copy", label: "Copy", run: copySelection },
    { id: "paste", label: "Paste", disabled: readOnly, run: pasteSelection },
    { id: "duplicate", label: "Duplicate", disabled: readOnly, run: duplicateSelection },
    { id: "delete", label: "Delete", destructive: true, disabled: readOnly, run: deleteSelection },
    { id: "select-all", label: "Select all", run: selectAll },
    { id: "fit-view", label: "Fit view", run: fitView },
    { id: "auto-layout", label: "Arrange all", disabled: readOnly, run: arrangeAll },
    { id: "group-selection", label: "Group", disabled: readOnly, run: groupSelection },
    { id: "ungroup-selection", label: "Ungroup", disabled: readOnly, run: ungroupSelection },
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
      canUndo: graphRuntime.canUndo,
      canRedo: graphRuntime.canRedo,
    },
    palette: {
      groups: groups as unknown as Array<WorkflowWorkbenchPaletteCategoryGroup<TNodeData>>,
      items: nodeTemplates as unknown as ReadonlyArray<WorkflowWorkbenchPaletteItem<TNodeData>>,
      filteredItems: filteredItems as unknown as ReadonlyArray<
        WorkflowWorkbenchPaletteItem<TNodeData>
      >,
      searchValue: paletteSearchValue,
      setSearchValue: setPaletteSearchValue,
    },
    view: {
      showPalette: true,
      showInspector: true,
      showMiniMap: true,
      setShowPalette: () => {},
      setShowInspector: () => {},
      setShowMiniMap: () => {},
      setZoom: (zoom: number) =>
        onViewportChange?.({
          ...normalizeWorkflowEditorViewport(document.viewport),
          zoom: clampWorkflowEditorZoom(zoom),
        }),
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
      setSelection,
      updateDocument: (nextDocument, options) =>
        dispatchGraphOperation(
          createWorkflowWorkbenchDocumentOperation(
            nextDocument as WorkflowEditorDocument<TNodeData, TEdgeData>,
            options?.selectionAfter,
            options?.history ?? true,
          ),
        ),
      undo,
      redo,
      copySelection: async () => copySelection(),
      pasteSelection,
      duplicateSelection,
      selectAll,
      fitView,
      autoLayout: arrangeAll,
      groupSelection,
      ungroupSelection,
      importJson: async (file?: File) => {
        if (!file || readOnly) {
          return;
        }
        updateDocument(
          JSON.parse(await file.text()) as WorkflowEditorDocument<TNodeData, TEdgeData>,
        );
      },
      exportJson: () => {},
      runCommand,
    },
    commands: graphCommands,
    // Workflow actions report their own errors; the generic graph action error slot stays empty.
    status: { actionError: null, clearActionError: () => {} },
  } satisfies GraphWorkbenchController<TNodeData, TEdgeData, WorkflowEditorPortType>;

  return {
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
        documentReferences && onOpenWorkflowReference && selectedNode
          ? () => selectedNode && onOpenWorkflowReference?.(selectedNode)
          : undefined,
      createSelectedNodeWorkflow:
        documentReferences && onCreateWorkflowReference && selectedNode
          ? () => selectedNode && onCreateWorkflowReference?.(selectedNode)
          : undefined,
    },
    palette: {
      groups,
      items: nodeTemplates,
      registry: templateRegistry,
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
      portTypeColors,
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
      composeSelection,
      restoreComposition,
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
