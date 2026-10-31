import { useEffect, useMemo, useRef, useState } from "react";
import {
  applyGraphEditorOperation,
  createGraphEditorRuntime,
  resetGraphEditorRuntime,
  setGraphEditorRuntimeSelection,
  type GraphEditorRuntimeState,
} from "@moritzbrantner/graph-editor/runtime";
import type { GraphEditorOperation } from "@moritzbrantner/graph-editor/operations";

import {
  createWorkflowEditorDocumentContext,
  normalizeWorkflowEditorSelection,
  repairWorkflowEditorDocument,
  resolveWorkflowEditorLinkedNodes,
  type WorkflowEditorDocument,
  type WorkflowEditorNodeTemplate,
  type WorkflowEditorPortType,
  type WorkflowEditorSelectionState,
} from "../core";
import { selectionStateToSingleSelection } from "../react-selection";
import {
  areWorkflowWorkbenchDocumentsEqual,
  areWorkflowWorkbenchSelectionsEqual,
  createWorkflowWorkbenchDocumentOperation,
  emptyWorkflowEditorSelection,
} from "./workbench-model";
import type { WorkflowWorkbenchProps } from "./workbench-types";

/**
 * The graph runtime only holds resolvable edges. Edges the document keeps under its validation
 * policy (dangling, self and unknown-port edges) are hidden from the canvas and re-attached to every
 * emitted document, so editing never silently drops them; removing them is an explicit repair.
 */
function useWorkflowWorkbenchEditableDocument<
  TNodeData extends Record<string, unknown>,
  TEdgeData extends Record<string, unknown>,
>(sourceDocument: WorkflowEditorDocument<TNodeData, TEdgeData>) {
  return useMemo(() => {
    const editable = repairWorkflowEditorDocument(sourceDocument).document;
    const editableEdgeIds = new Set(editable.edges.map((edge) => edge.id));
    const retainedEdges = sourceDocument.edges.filter((edge) => !editableEdgeIds.has(edge.id));
    if (retainedEdges.length === 0) {
      return {
        document: sourceDocument,
        // The canvas document is the source itself, so its repair is the one just computed.
        runtimeDocument: editable,
        emitDocument: (next: WorkflowEditorDocument<TNodeData, TEdgeData>) => next,
      };
    }
    return {
      document: editable,
      runtimeDocument: repairWorkflowEditorDocument(editable).document,
      emitDocument: (next: WorkflowEditorDocument<TNodeData, TEdgeData>) => {
        const nextEdgeIds = new Set(next.edges.map((edge) => edge.id));
        const missing = retainedEdges.filter((edge) => !nextEdgeIds.has(edge.id));
        return missing.length === 0 ? next : { ...next, edges: [...next.edges, ...missing] };
      },
    };
  }, [sourceDocument]);
}

/**
 * Document, selection and graph runtime shared by `WorkflowWorkbench` and
 * `useWorkflowWorkbenchController`: the host owns the document, the runtime holds operation history.
 */
export function useWorkflowWorkbenchRuntime<
  TNodeData extends Record<string, unknown>,
  TEdgeData extends Record<string, unknown>,
>({
  sourceDocument,
  linkedTemplates,
  selectedNodeId,
  selectedEdgeId,
  selectedNodeIds,
  selectedEdgeIds,
  selectedGroupIds,
  onDocumentChange,
  onSelectionChange,
  onSelectionStateChange,
}: Pick<
  WorkflowWorkbenchProps<TNodeData, TEdgeData, never>,
  | "selectedNodeId"
  | "selectedEdgeId"
  | "selectedNodeIds"
  | "selectedEdgeIds"
  | "selectedGroupIds"
  | "onDocumentChange"
  | "onSelectionChange"
  | "onSelectionStateChange"
> & {
  sourceDocument: WorkflowEditorDocument<TNodeData, TEdgeData>;
  linkedTemplates: readonly WorkflowEditorNodeTemplate<TNodeData>[];
}) {
  const {
    document,
    runtimeDocument: normalizedRuntimeDocument,
    emitDocument: withRetainedWorkflowEdges,
  } = useWorkflowWorkbenchEditableDocument(sourceDocument);
  const [internalSelection, setInternalSelection] = useState<WorkflowEditorSelectionState>(
    emptyWorkflowEditorSelection,
  );
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
  const [graphRuntime, setGraphRuntime] = useState<
    GraphEditorRuntimeState<TNodeData, TEdgeData, WorkflowEditorPortType>
  >(() =>
    createGraphEditorRuntime<TNodeData, TEdgeData, WorkflowEditorPortType>({
      initialDocument: normalizedRuntimeDocument,
      initialSelection: selection,
    }),
  );
  const lastEmittedDocumentRef = useRef<WorkflowEditorDocument<TNodeData, TEdgeData> | null>(null);
  const latestSelectionRef = useRef<WorkflowEditorSelectionState>(selection);
  const documentContext = useMemo(() => createWorkflowEditorDocumentContext(document), [document]);

  const emitGraphRuntimeSelection = (
    nextSelection: WorkflowEditorSelectionState,
    selectionDocument: WorkflowEditorDocument<TNodeData, TEdgeData> = document,
    options: { syncRuntime?: boolean } = {},
  ) => {
    const normalizedSelection = normalizeWorkflowEditorSelection(selectionDocument, nextSelection);
    latestSelectionRef.current = normalizedSelection;

    if (!externalSelectionProvided) {
      setInternalSelection(normalizedSelection);
    }

    if (options.syncRuntime !== false) {
      setGraphRuntime((current) =>
        areWorkflowWorkbenchSelectionsEqual(current.selection, normalizedSelection)
          ? current
          : setGraphEditorRuntimeSelection(current, normalizedSelection),
      );
    }

    onSelectionStateChange?.(normalizedSelection);
    onSelectionChange?.(selectionStateToSingleSelection(selectionDocument, normalizedSelection));
  };

  const emitGraphRuntimeDocument = (nextDocument: WorkflowEditorDocument<TNodeData, TEdgeData>) => {
    const emittedDocument = withRetainedWorkflowEdges(nextDocument);
    lastEmittedDocumentRef.current = emittedDocument;
    onDocumentChange?.(emittedDocument);
  };

  const dispatchGraphOperation = (
    operation: GraphEditorOperation<TNodeData, TEdgeData, WorkflowEditorPortType>,
    options?: { merge?: boolean; emitDocument?: boolean; emitSelection?: boolean },
  ) => {
    const nextRuntime = applyGraphEditorOperation(graphRuntime, operation, {
      merge: options?.merge,
    });
    setGraphRuntime(nextRuntime);

    const nextDocument = nextRuntime.document as WorkflowEditorDocument<TNodeData, TEdgeData>;
    if (
      options?.emitDocument !== false &&
      !areWorkflowWorkbenchDocumentsEqual(nextDocument, document)
    ) {
      emitGraphRuntimeDocument(nextDocument);
    }

    if (options?.emitSelection !== false) {
      emitGraphRuntimeSelection(nextRuntime.selection, nextDocument, { syncRuntime: false });
    }
  };

  const commitDocument = (
    nextDocument: WorkflowEditorDocument<TNodeData, TEdgeData>,
    options: { selectionAfter?: WorkflowEditorSelectionState | null; history?: boolean } = {},
  ) => {
    dispatchGraphOperation(
      createWorkflowWorkbenchDocumentOperation(
        nextDocument,
        options.selectionAfter,
        options.history ?? true,
      ),
      { emitSelection: options.selectionAfter !== undefined },
    );
  };

  useEffect(() => {
    if (lastEmittedDocumentRef.current === sourceDocument) {
      lastEmittedDocumentRef.current = null;
      return;
    }

    setGraphRuntime((current) =>
      resetGraphEditorRuntime(current, normalizedRuntimeDocument, { selection }),
    );
  }, [sourceDocument, normalizedRuntimeDocument]);

  useEffect(() => {
    latestSelectionRef.current = selection;
    setGraphRuntime((current) =>
      areWorkflowWorkbenchSelectionsEqual(current.selection, selection)
        ? current
        : setGraphEditorRuntimeSelection(current, selection),
    );
  }, [selection]);

  const emitSelectionState = (
    nextSelection: WorkflowEditorSelectionState,
    selectionDocument: WorkflowEditorDocument<TNodeData, TEdgeData> = document,
  ) => {
    emitGraphRuntimeSelection(nextSelection, selectionDocument);
  };

  // Linked shared templates follow the catalog (#65): compatible revisions apply when published.
  useEffect(() => {
    if (!document.nodes.some((node) => node.templateRef)) return;
    const resolved = resolveWorkflowEditorLinkedNodes(document, linkedTemplates);
    if (resolved.document !== document) {
      commitDocument(resolved.document, { history: false });
    }
    // Resolution is idempotent, so re-running on its own result settles.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document, linkedTemplates]);

  return {
    commitDocument,
    dispatchGraphOperation,
    document,
    documentContext,
    emitGraphRuntimeDocument,
    emitGraphRuntimeSelection,
    emitSelectionState,
    externalSelectionProvided,
    graphRuntime,
    latestSelectionRef,
    selection,
    setGraphRuntime,
    setInternalSelection,
  };
}
