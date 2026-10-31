import type { MutableRefObject } from "react";
import type { GraphWorkbenchCommandId } from "@moritzbrantner/graph-editor/react";
import {
  createGraphEditorAddNodeOperation,
  createGraphEditorUpdateViewportOperation,
} from "@moritzbrantner/graph-editor/operations";
import {
  redoGraphEditorRuntime,
  undoGraphEditorRuntime,
} from "@moritzbrantner/graph-editor/runtime";

import {
  connectWorkflowEditorNodes,
  copyWorkflowEditorSelection,
  createWorkflowEditorGroup,
  duplicateWorkflowEditorNode,
  duplicateWorkflowEditorSelection,
  pasteWorkflowEditorClipboardPayload,
  removeWorkflowEditorNode,
  removeWorkflowEditorSelection,
  ungroupWorkflowEditorGroup,
  updateWorkflowEditorGroup,
  updateWorkflowEditorNode,
  updateWorkflowEditorNodeWorkflowReference,
  updateWorkflowEditorObjectConstructorExpression,
  validateWorkflowEditorConnection,
  type WorkflowEditorDocument,
  type WorkflowEditorEdge,
  type WorkflowEditorGroup,
  type WorkflowEditorNode,
  type WorkflowEditorNodeTemplateRegistry,
  type WorkflowEditorPortType,
  type WorkflowEditorSelectionState,
  type WorkflowEditorViewport,
} from "../core";
import { layoutWorkflowEditorDocument } from "../core-layout";
import { isWorkflowEditorJsonPrimitiveNode } from "./node-inline-controls";
import type { WorkflowWorkbenchPaletteItem } from "./palette-model";
import { describeWorkflowWorkbenchConnectionRejection } from "./workbench-announcements";
import {
  areWorkflowWorkbenchDocumentsEqual,
  composeWorkflowWorkbenchSelection,
  createWorkflowWorkbenchInsertedSelection,
  createWorkflowWorkbenchTemplateNode,
  emptyWorkflowEditorSelection,
  getWorkflowWorkbenchConnectionKey,
  hasWorkflowWorkbenchSelection,
  isRecord,
  readWorkflowEditorMemoryClipboard,
  restoreWorkflowWorkbenchComposition,
  toWorkflowWorkbenchConnectionInput,
  writeWorkflowEditorMemoryClipboard,
  type WorkflowWorkbenchConnectionCoordinates,
} from "./workbench-model";
import type { useWorkflowWorkbenchRuntime } from "./workbench-runtime";
import type { WorkflowEditorPoint, WorkflowWorkbenchProps } from "./workbench-types";

/**
 * The commands `WorkflowWorkbench` runs on its document. Recreated each render, so every action
 * closes over the current document and selection.
 */
export function createWorkflowWorkbenchDocumentActions<
  TNodeData extends Record<string, unknown>,
  TEdgeData extends Record<string, unknown>,
  TTemplateData,
>({
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
}: Pick<
  WorkflowWorkbenchProps<TNodeData, TEdgeData, TTemplateData>,
  | "documentReferences"
  | "onCreateWorkflowReference"
  | "onOpenWorkflowReference"
  | "onViewportChange"
  | "typeDefinitions"
> & {
  hostHistory: WorkflowWorkbenchProps<TNodeData, TEdgeData, TTemplateData>["history"];
  readOnly: boolean;
  runtime: ReturnType<typeof useWorkflowWorkbenchRuntime<TNodeData, TEdgeData>>;
  selectedEdge: WorkflowEditorEdge<TEdgeData> | undefined;
  selectedGroup: WorkflowEditorGroup | undefined;
  selectedNode: WorkflowEditorNode<TNodeData> | undefined;
  setAnnouncement: (message: string) => void;
  templateRegistry: WorkflowEditorNodeTemplateRegistry<TTemplateData>;
  uiCreatedConnectionCommitKeyRef: MutableRefObject<string | null>;
}) {
  const {
    commitDocument,
    dispatchGraphOperation,
    document,
    documentContext,
    emitGraphRuntimeDocument,
    emitGraphRuntimeSelection,
    emitSelectionState,
    graphRuntime,
    latestSelectionRef,
    selection,
    setGraphRuntime,
  } = runtime;

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
      const validity = validateWorkflowEditorConnection(document, connection, { typeDefinitions });
      if (!validity.valid) {
        setAnnouncement(describeWorkflowWorkbenchConnectionRejection(validity));
      }
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
    dispatchGraphOperation(
      createGraphEditorUpdateViewportOperation<TNodeData, TEdgeData, WorkflowEditorPortType>(
        viewport,
        {
          history: false,
          selectionBefore: selection,
          selectionAfter: selection,
        },
      ),
      { emitDocument: false, emitSelection: false },
    );
    emitGraphRuntimeDocument({ ...document, viewport });
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

  const addTemplateNode = (
    template: WorkflowWorkbenchPaletteItem<TTemplateData>,
    position?: WorkflowEditorPoint,
  ) => {
    // Invalid templates are listed disabled with their diagnostics and never create nodes.
    if (readOnly || templateRegistry.getEntry(template)?.valid === false) {
      return;
    }

    const { id, node } = createWorkflowWorkbenchTemplateNode(document.nodes, template, position, {
      centerOnPosition: true,
    });
    const nextDocument = {
      ...document,
      nodes: [...document.nodes, node],
    };
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
    if (readOnly) {
      return;
    }

    if (hasWorkflowWorkbenchSelection(selection)) {
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
    if (readOnly || !hasWorkflowWorkbenchSelection(selection)) {
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
    emitSelectionState(createWorkflowWorkbenchInsertedSelection(result), result.document);
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
      commitDocument(result.document);
      emitSelectionState(createWorkflowWorkbenchInsertedSelection(result), result.document);
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
    const currentSelection = latestSelectionRef.current;
    if (readOnly || currentSelection.nodeIds.length < 2) {
      return;
    }

    const nextDocument = createWorkflowEditorGroup(document, currentSelection.nodeIds);
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

  const composeSelection = () => {
    const result = readOnly
      ? undefined
      : composeWorkflowWorkbenchSelection(document, latestSelectionRef.current.nodeIds);
    if (!result) return;
    commitDocument(result.document);
    emitSelectionState(result.selection, result.document);
  };

  const restoreComposition = (nodeId = latestSelectionRef.current.primary?.id) => {
    const result = readOnly ? undefined : restoreWorkflowWorkbenchComposition(document, nodeId);
    if (!result) return;
    commitDocument(result.document);
    emitSelectionState(result.selection, result.document);
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

  const selectAll = () => {
    emitSelectionState({
      nodeIds: document.nodes.map((node) => node.id),
      edgeIds: [],
      ...(document.nodes.at(-1)
        ? { primary: { type: "node", id: document.nodes.at(-1)!.id } }
        : {}),
    });
  };

  const undoGraphRuntime = () => {
    const nextRuntime = undoGraphEditorRuntime(graphRuntime);
    setGraphRuntime(nextRuntime);
    const nextDocument = nextRuntime.document as WorkflowEditorDocument<TNodeData, TEdgeData>;
    if (!areWorkflowWorkbenchDocumentsEqual(nextDocument, document)) {
      emitGraphRuntimeDocument(nextDocument);
    }
    emitGraphRuntimeSelection(nextRuntime.selection, nextDocument, { syncRuntime: false });
  };

  const redoGraphRuntime = () => {
    const nextRuntime = redoGraphEditorRuntime(graphRuntime);
    setGraphRuntime(nextRuntime);
    const nextDocument = nextRuntime.document as WorkflowEditorDocument<TNodeData, TEdgeData>;
    if (!areWorkflowWorkbenchDocumentsEqual(nextDocument, document)) {
      emitGraphRuntimeDocument(nextDocument);
    }
    emitGraphRuntimeSelection(nextRuntime.selection, nextDocument, { syncRuntime: false });
  };

  const undoWorkbench = () => {
    if (hostHistory) {
      if (!readOnly && hostHistory.canUndo) {
        hostHistory.undo();
      }
      return;
    }
    undoGraphRuntime();
  };

  const redoWorkbench = () => {
    if (hostHistory) {
      if (!readOnly && hostHistory.canRedo) {
        hostHistory.redo();
      }
      return;
    }
    redoGraphRuntime();
  };

  const fitWorkflowWorkbenchView = () => {
    if (document.nodes.length === 0) {
      commitViewportChange({ x: 0, y: 0, zoom: 1 });
      return;
    }

    const bounds = document.nodes.reduce(
      (current, node) => ({
        minX: Math.min(current.minX, node.x),
        minY: Math.min(current.minY, node.y),
        maxX: Math.max(current.maxX, node.x + 220),
        maxY: Math.max(current.maxY, node.y + 140),
      }),
      {
        minX: Number.POSITIVE_INFINITY,
        minY: Number.POSITIVE_INFINITY,
        maxX: Number.NEGATIVE_INFINITY,
        maxY: Number.NEGATIVE_INFINITY,
      },
    );
    const viewport = {
      x: Math.round(96 - bounds.minX),
      y: Math.round(96 - bounds.minY),
      zoom: 1,
    };

    commitViewportChange(viewport);
  };

  const runGraphCommand = (commandId: GraphWorkbenchCommandId | string) => {
    switch (commandId) {
      case "undo":
        undoWorkbench();
        return;
      case "redo":
        redoWorkbench();
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
        fitWorkflowWorkbenchView();
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

  return {
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
  };
}
