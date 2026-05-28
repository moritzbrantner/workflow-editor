"use client";

import {
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type CSSProperties,
  type RefObject,
  type ReactNode,
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
  InspectorPanel,
  WorkflowBuilder,
  WorkflowNode,
  type WorkflowBuilderConnectionValidity,
  type WorkflowBuilderSelection,
  type InspectorFieldDefinition,
  type InspectorFieldValue,
} from "@moritzbrantner/ui/labs";

import {
  addWorkflowEditorArrayConstructorInputToNode,
  addWorkflowEditorObjectDecompositionOutputToNode,
  addWorkflowEditorObjectConstructorInputToNode,
  connectWorkflowEditorNodes,
  copyWorkflowEditorSelection,
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
  getWorkflowEditorObjectDecompositionOutputs,
  getWorkflowEditorObjectConstructorInputs,
  isWorkflowEditorArrayConstructorNode,
  isWorkflowEditorObjectDecompositionNode,
  isWorkflowEditorObjectConstructorNode,
  normalizeWorkflowEditorDocument,
  normalizeWorkflowEditorSelection,
  pasteWorkflowEditorClipboardPayload,
  removeWorkflowEditorArrayConstructorInput,
  removeWorkflowEditorNode,
  removeWorkflowEditorObjectDecompositionOutput,
  removeWorkflowEditorObjectConstructorInput,
  removeWorkflowEditorSelection,
  toUiWorkflowBuilderEdges,
  toUiWorkflowBuilderNodes,
  updateWorkflowEditorNode,
  updateWorkflowEditorObjectDecompositionPropertiesInNode,
  updateWorkflowEditorObjectConstructorExpression,
  updateWorkflowEditorObjectConstructorPropertiesInNode,
  updateWorkflowEditorNodeWorkflowReference,
  validateWorkflowEditorConnection,
  type WorkflowEditorConnectionInput,
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
import { formatShortcutLabel } from "./shortcut-label";

const emptyWorkflowEditorSelection: WorkflowEditorSelectionState = {
  nodeIds: [],
  edgeIds: [],
};
const workflowWorkbenchOverlayInteractionSelector =
  "[data-slot='workflow-palette-overlay'], [data-slot='workflow-inspector-overlay'], [data-slot='workflow-node-rename-control'], [data-slot='workflow-json-primitive-node-control'], [data-slot='workflow-object-constructor-node-control'], [data-slot='select-content'], [data-slot='dropdown-menu-content']";
const workflowWorkbenchOverlaySelectionPreservationMs = 1500;

const workflowEditorPaletteDragType = "application/x-workflow-editor-node-template";
const workflowEditorPaletteMargin = 12;
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

export type WorkflowWorkbenchPaletteItem<TData = Record<string, unknown>> =
  WorkflowEditorNodeTemplate<TData>;

type WorkflowWorkbenchPaletteCategoryGroup<TData = Record<string, unknown>> = {
  id: string;
  label: string;
  templates: Array<WorkflowWorkbenchPaletteItem<TData>>;
  children: Array<WorkflowWorkbenchPaletteCategoryGroup<TData>>;
};

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

function createWorkflowWorkbenchPaletteCategoryGroups<TData>(
  templates: ReadonlyArray<WorkflowWorkbenchPaletteItem<TData>>,
) {
  const groups: Array<WorkflowWorkbenchPaletteCategoryGroup<TData>> = [];

  for (const template of templates) {
    const categoryPath = getWorkflowWorkbenchPaletteCategoryPath(template);
    let level = groups;

    categoryPath.forEach((label, index) => {
      const id = categoryPath.slice(0, index + 1).join("\u001f");
      let group = level.find((candidate) => candidate.id === id);

      if (!group) {
        group = { id, label, templates: [], children: [] };
        level.push(group);
      }

      if (index === categoryPath.length - 1) {
        group.templates.push(template);
      } else {
        level = group.children;
      }
    });
  }

  return groups;
}

function getWorkflowWorkbenchPaletteCategoryPath<TData>(
  template: WorkflowWorkbenchPaletteItem<TData>,
) {
  const categoryPath = Array.isArray(template.categoryPath)
    ? template.categoryPath.flatMap((part) => {
        if (typeof part !== "string") {
          return [];
        }

        const segment = part.trim();
        return segment ? [segment] : [];
      })
    : undefined;

  if (categoryPath && categoryPath.length > 0) {
    return categoryPath;
  }

  const category = template.category?.trim();
  if (!category) {
    return ["Uncategorized"];
  }

  const categorySegments = category
    .split(/[/>]/)
    .map((part) => part.trim())
    .filter(Boolean);

  return categorySegments.length > 0 ? categorySegments : [category];
}

function getWorkflowWorkbenchPaletteTemplateSearchText<TData>(
  template: WorkflowWorkbenchPaletteItem<TData>,
) {
  const searchableValues = [
    template.id,
    template.label,
    template.description,
    template.kind,
    template.category,
    ...getWorkflowWorkbenchPaletteCategoryPath(template),
  ];

  return searchableValues
    .flatMap((value) => (typeof value === "string" ? [value] : []))
    .join("\n")
    .toLowerCase();
}

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
  const paletteRef = useRef<HTMLDivElement | null>(null);
  const connectionInProgressRef = useRef(false);
  const uiCreatedConnectionCommitKeyRef = useRef<string | null>(null);
  const ignoreSelectionClearUntilRef = useRef(0);
  const marqueeRef = useRef<WorkflowSelectionMarquee | null>(null);
  const canvasPanRef = useRef<WorkflowCanvasPanState | null>(null);
  const paletteDragRef = useRef<WorkflowPaletteDragState | null>(null);
  const pendingNodeSnapRef = useRef<{
    document: WorkflowEditorDocument<TNodeData, TEdgeData>;
    nodeIds: Set<string>;
  } | null>(null);
  const pointerModifierRef = useRef({ additive: false });
  const [internalSelection, setInternalSelection] = useState<WorkflowEditorSelectionState>(
    emptyWorkflowEditorSelection,
  );
  const [inspectorMinimized, setInspectorMinimized] = useState(false);
  const [narrowOverlayLayout, setNarrowOverlayLayout] = useState(false);
  const [marquee, setMarquee] = useState<WorkflowSelectionMarquee | null>(null);
  const [paletteMinimized, setPaletteMinimized] = useState(false);
  const [paletteCorner, setPaletteCorner] = useState<WorkflowPaletteCorner>("top-left");
  const [paletteDragging, setPaletteDragging] = useState(false);
  const [palettePosition, setPalettePosition] = useState<WorkflowPalettePosition>(null);
  const [paletteSearchValue, setPaletteSearchValue] = useState("");
  const [renamingNodeId, setRenamingNodeId] = useState<string | null>(null);
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
  const inspectorCollapsed = inspectorMinimized || (!selectedNode && !selectedEdge);
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
  const filteredNodeTemplates = useMemo(() => {
    const query = paletteSearchValue.trim().toLowerCase();

    if (!query) {
      return nodeTemplates;
    }

    return nodeTemplates.filter((template) =>
      getWorkflowWorkbenchPaletteTemplateSearchText(template).includes(query),
    );
  }, [nodeTemplates, paletteSearchValue]);
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

        const next = clampWorkflowPalettePosition(
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

    if (selection.nodeIds.length > 0 || selection.edgeIds.length > 0) {
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
  };

  const startPaletteDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
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
    const paletteRect = paletteRef.current?.getBoundingClientRect();
    if (!containerRect || !paletteRect) {
      return;
    }

    const startPosition = clampWorkflowPalettePosition(
      {
        x: paletteRect.left - containerRect.left,
        y: paletteRect.top - containerRect.top,
      },
      containerRef.current,
      paletteRef.current,
      { width: paletteRect.width, height: paletteRect.height },
    );

    paletteDragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: startPosition.x,
      startY: startPosition.y,
      width: paletteRect.width,
      height: paletteRect.height,
    };
    setPaletteDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  };

  const updatePaletteDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = paletteDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const nextPosition = clampWorkflowPalettePosition(
      {
        x: drag.startX + event.clientX - drag.startClientX,
        y: drag.startY + event.clientY - drag.startClientY,
      },
      containerRef.current,
      paletteRef.current,
      { width: drag.width, height: drag.height },
    );

    setPalettePosition((current) =>
      current && current.x === nextPosition.x && current.y === nextPosition.y
        ? current
        : nextPosition,
    );
    event.preventDefault();
    event.stopPropagation();
  };

  const completePaletteDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = paletteDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    paletteDragRef.current = null;
    setPaletteDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    event.preventDefault();
    event.stopPropagation();
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

  const paletteOverlayPosition: CSSProperties = palettePosition
    ? { left: palettePosition.x, top: palettePosition.y }
    : getWorkflowPalettePinnedStyle(paletteCorner);

  return (
    <div
      data-slot="workbench-layout"
      className={cn(
        "grid min-h-[38rem] min-w-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden rounded-md border border-border bg-background text-foreground",
        className,
      )}
    >
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
              className="!h-6 !min-h-6 !px-2 !text-xs"
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
              className="!h-6 !min-h-6 !px-2 !text-xs"
              disabled={selection.nodeIds.length === 0 && selection.edgeIds.length === 0}
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
              disabled={readOnly || selection.nodeIds.length === 0}
              onClick={arrangeSelection}
            >
              Arrange selection
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
                readOnly || (selection.nodeIds.length === 0 && selection.edgeIds.length === 0)
              }
              onClick={deleteSelection}
            >
              Delete
            </Button>
            {renderToolbarActions?.(inspectorContext)}
          </div>
        </div>
      </div>
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
              primaryNodeId={primarySelectedNodeId}
            />
            <WorkflowBuilder
              className="flex h-full min-h-0 min-w-0 flex-col [&>[data-slot='workflow-builder-surface']]:flex-1 [&>[data-slot='workflow-builder-surface']]:basis-0 [&_[data-slot='workflow-node'][data-minimized='true']]:!h-9 [&_[data-slot='workflow-node'][data-minimized='true']]:!min-h-9 [&_[data-slot='workflow-node'][data-minimized='true']]:!w-44 [&_[data-slot='workflow-node'][data-minimized='true']]:!flex-row [&_[data-slot='workflow-node'][data-minimized='true']]:items-stretch [&_[data-slot='workflow-node'][data-minimized='true']>[data-slot='workflow-node-header']]:relative [&_[data-slot='workflow-node'][data-minimized='true']>[data-slot='workflow-node-header']]:z-10 [&_[data-slot='workflow-node'][data-minimized='true']>[data-slot='workflow-node-header']]:!h-9 [&_[data-slot='workflow-node'][data-minimized='true']>[data-slot='workflow-node-header']]:!min-h-9 [&_[data-slot='workflow-node'][data-minimized='true']>[data-slot='workflow-node-header']]:!flex-1 [&_[data-slot='workflow-node'][data-minimized='true']>[data-slot='workflow-node-header']]:!rounded-lg [&_[data-slot='workflow-node'][data-minimized='true']>[data-slot='workflow-node-header']]:!border-b-0 [&_[data-slot='workflow-node'][data-minimized='true']>[data-slot='workflow-node-header']]:!px-2 [&_[data-slot='workflow-node'][data-minimized='true']>[data-slot='workflow-node-header']]:!py-1.5 [&_[data-slot='workflow-node'][data-minimized='true']_[data-slot='workflow-node-header']>div]:items-center [&_[data-slot='workflow-node'][data-minimized='true']_[data-slot='workflow-node-header']>div>div:last-child]:!mt-0 [&_[data-slot='workflow-node'][data-minimized='true']_[data-slot='workflow-node-select']>div+div]:hidden [&_[data-slot='workflow-node'][data-minimized='true']_[data-slot='workflow-node-minimize']]:relative [&_[data-slot='workflow-node'][data-minimized='true']_[data-slot='workflow-node-minimize']]:z-20 [&_[data-slot='workflow-node'][data-minimized='true']>[data-slot='workflow-node-minimized-ports']]:!absolute [&_[data-slot='workflow-node'][data-minimized='true']>[data-slot='workflow-node-minimized-ports']]:inset-0 [&_[data-slot='workflow-node'][data-minimized='true']>[data-slot='workflow-node-minimized-ports']]:z-0 [&_[data-slot='workflow-node'][data-minimized='true']>[data-slot='workflow-node-minimized-ports']]:!h-auto [&_[data-slot='workflow-node'][data-minimized='true']>[data-slot='workflow-node-minimized-ports']]:!border-t-0 [&_[data-slot='workflow-node'][data-minimized='true']>[data-slot='workflow-node-minimized-ports']]:!bg-transparent [&_[data-slot='workflow-node'][data-minimized='true']>[data-slot='workflow-node-minimized-ports']]:pointer-events-none [&_[data-slot='workflow-node'][data-minimized='true']>[data-slot='workflow-node-minimized-ports']>div]:hidden [&_[data-slot='workflow-node'][data-minimized='true']>[data-slot='workflow-node-minimized-ports']>[data-slot='workflow-node-port']]:!z-0 [&_[data-slot='workflow-node'][data-minimized='true']>[data-slot='workflow-node-minimized-ports']>[data-slot='workflow-node-port']]:pointer-events-auto [&_[data-slot='workflow-node'][data-minimized='true']>[data-slot='workflow-node-minimized-ports']>[data-slot='workflow-node-port']]:-translate-y-1/2 [&_[data-slot='workflow-node'][data-compact='true']_[data-slot='workflow-node-port']]:!z-0"
              nodes={uiNodes}
              edges={uiEdges}
              selectedNodeId={primarySelectedNodeId}
              selectedEdgeId={primarySelectedEdgeId}
              readOnly={readOnly}
              showMiniMap
              showPortColumnHeaders={false}
              surfaceHeight="auto"
              minZoom={workflowEditorMinZoom}
              maxZoom={workflowEditorMaxZoom}
              measurePorts="dom"
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
            <WorkflowNodeActionMenus
              document={document}
              readOnly={readOnly}
              onDeleteNode={deleteNode}
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
              readOnly={readOnly}
              onFocusNode={selectWorkflowJsonPrimitiveNode}
              onValueChange={updateWorkflowObjectConstructorExpressionValue}
            />
            <div
              data-slot="workflow-palette-overlay"
              ref={paletteRef}
              onClickCapture={preserveOverlaySelection}
              onFocusCapture={preserveOverlaySelection}
              onMouseDownCapture={preserveOverlaySelection}
              onPointerDownCapture={preserveOverlaySelection}
              className={cn(
                "absolute z-[20000] flex max-h-[calc(100%-5rem)] max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-md border border-border/70 bg-card/95 text-sm shadow-md supports-backdrop-filter:backdrop-blur-xl",
                paletteMinimized ? "w-44 p-2" : "w-96 p-3",
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
                        paletteMinimized ? "Expand node palette" : "Minimize node palette"
                      }
                      aria-pressed={paletteMinimized}
                      onClick={() => setPaletteMinimized((current) => !current)}
                    >
                      {paletteMinimized ? (
                        <Maximize2Icon className="size-3.5" aria-hidden="true" />
                      ) : (
                        <Minimize2Icon className="size-3.5" aria-hidden="true" />
                      )}
                    </Button>
                  </div>
                </div>
                {paletteMinimized ? null : (
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
            <div
              data-slot="workflow-inspector-overlay"
              onClickCapture={preserveOverlaySelection}
              onFocusCapture={preserveOverlaySelection}
              onMouseDownCapture={preserveOverlaySelection}
              onPointerDownCapture={preserveOverlaySelection}
              className={cn(
                "absolute right-3 z-[20000] max-h-[calc(100%-5rem)] overflow-auto rounded-md border border-border/70 bg-card/95 text-sm shadow-md supports-backdrop-filter:backdrop-blur-xl",
                inspectorCollapsed ? "w-16 p-2" : "w-[min(20rem,calc(100%-1.5rem))] p-3",
              )}
              style={{ top: "4rem" }}
            >
              <div className="grid gap-3">
                <div className="flex items-center justify-between gap-3">
                  {inspectorCollapsed ? null : <div className="text-sm font-medium">Info</div>}
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={inspectorCollapsed ? "Expand info panel" : "Minimize info panel"}
                    aria-pressed={inspectorMinimized}
                    disabled={!selectedNode && !selectedEdge}
                    onClick={() => setInspectorMinimized((current) => !current)}
                  >
                    {inspectorCollapsed ? "+" : "-"}
                  </Button>
                </div>
                {inspectorCollapsed ? null : renderInspector ? (
                  renderInspector(inspectorContext)
                ) : (
                  <DefaultWorkflowInspector context={inspectorContext} />
                )}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

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

type WorkflowPaletteCorner = "top-left" | "top-right" | "bottom-left" | "bottom-right";

type WorkflowPalettePosition = { x: number; y: number } | null;

type WorkflowPaletteDragState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  width: number;
  height: number;
};

type WorkflowEditorPoint = {
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

function clampWorkflowPalettePosition(
  position: NonNullable<WorkflowPalettePosition>,
  container: HTMLElement | null,
  palette: HTMLElement | null,
  size?: { width: number; height: number },
) {
  const containerRect = container?.getBoundingClientRect();
  const paletteRect = palette?.getBoundingClientRect();
  const width = size?.width ?? paletteRect?.width ?? 0;
  const height = size?.height ?? paletteRect?.height ?? 0;

  if (!containerRect || width <= 0 || height <= 0) {
    return position;
  }

  const minX = workflowEditorPaletteMargin;
  const minY = workflowEditorPaletteMargin;
  const maxX = Math.max(minX, containerRect.width - width - workflowEditorPaletteMargin);
  const maxY = Math.max(minY, containerRect.height - height - workflowEditorPaletteMargin);

  return {
    x: Math.min(Math.max(position.x, minX), maxX),
    y: Math.min(Math.max(position.y, minY), maxY),
  };
}

function getWorkflowPalettePinnedStyle(corner: WorkflowPaletteCorner): CSSProperties {
  const offset = "0.75rem";

  switch (corner) {
    case "top-right":
      return { right: offset, top: offset };
    case "bottom-left":
      return { bottom: offset, left: offset };
    case "bottom-right":
      return { bottom: offset, right: offset };
    case "top-left":
    default:
      return { left: offset, top: offset };
  }
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
  primaryNodeId,
}: {
  nodes: Array<WorkflowEditorNode<TNodeData>>;
  primaryNodeId?: string;
}) {
  const styles = nodes
    .map((node, index) => {
      const selector = `[data-slot="workflow-builder-node"][data-node-id="${cssAttributeValue(node.id)}"]`;
      const layer = getWorkflowEditorNodeLayerIndex(index, node.id, primaryNodeId);
      const rules = [`${selector} { z-index: ${layer}; }`];

      if (isWorkflowEditorJsonPrimitiveNode(node)) {
        rules.push(
          `${selector} [data-slot="workflow-node"][data-minimized="true"] [data-slot="workflow-node-select"] > div { visibility: hidden; }`,
        );
      }

      if (isWorkflowEditorObjectConstructorNode(node) && node.minimized !== true) {
        const uiNode = toUiWorkflowBuilderNodes([node])[0]!;
        const width = getWorkflowEditorObjectConstructorRenderedWidth(uiNode);
        const height = getWorkflowEditorRenderedNodeSize(uiNode).height;
        const outputPanelHeight = getWorkflowEditorObjectConstructorOutputPanelHeight(uiNode);
        rules.push(
          `${selector}, ${selector} > [data-slot="workflow-node"] { width: ${width}px !important; }`,
          `${selector} { height: ${height}px !important; }`,
          `${selector} > [data-slot="workflow-node"] { height: ${height}px !important; }`,
          `${selector} [data-slot="workflow-node-port"][data-port-direction="output"][data-port-id="value"] { height: ${outputPanelHeight}px !important; min-height: ${outputPanelHeight}px !important; }`,
        );
      }

      return rules.join("\n");
    })
    .join("\n");

  return styles ? <style data-slot="workflow-workbench-layer-styles">{styles}</style> : null;
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
  const primitiveNodes = document.nodes.filter(
    (node) =>
      isWorkflowEditorJsonPrimitiveNode(node) && isWorkflowEditorDetachedNodeControlVisible(node),
  );
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
  if (node.variant === "compact") {
    return { x: 58, y: 13, width: 112 };
  }

  const uiNode = toUiWorkflowBuilderNodes([node])[0]!;

  const outputIndex = Math.max(
    0,
    (node.outputs ?? []).findIndex((output) => output.id === "value"),
  );
  const size = getWorkflowEditorRenderedNodeSize(uiNode);
  const portCenterY = getWorkflowEditorPortCenterOffset(uiNode, "output", outputIndex);
  const width = Math.min(170, Math.max(112, size.width - 48));

  return {
    x: Math.max(12, size.width - width - 24),
    y: Math.max(12, portCenterY - 12),
    width,
  };
}

function WorkflowObjectConstructorNodeControls<
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

        const offset = getWorkflowObjectConstructorNodeControlOffset(node);

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
  onFocusNode,
  onValueChange,
  readOnly,
}: {
  node: WorkflowEditorNode<TNodeData>;
  onFocusNode: (nodeId: string) => void;
  onValueChange: (nodeId: string, value: string) => void;
  readOnly: boolean;
}) {
  const expression = formatWorkflowEditorObjectConstructorExpression(node);
  const [draft, setDraft] = useState(expression);

  useEffect(() => {
    setDraft(expression);
  }, [node.id, expression]);

  const handleInteractionStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.stopPropagation();
    onFocusNode(node.id);
  };
  const stopInteractionPropagation = (event: SyntheticEvent) => {
    event.stopPropagation();
  };
  const commitDraft = () => {
    if (draft !== expression) {
      onValueChange(node.id, draft);
    }
  };

  return (
    <div
      data-slot="workflow-object-constructor-node-control"
      className="h-full"
      onPointerDownCapture={handleInteractionStart}
      onMouseDownCapture={stopInteractionPropagation}
      onClick={stopInteractionPropagation}
    >
      <Textarea
        aria-label={`${node.label} object expression`}
        className={cn(workflowNodeTextareaControlClassName, "h-full min-h-full w-full")}
        disabled={readOnly}
        spellCheck={false}
        value={draft}
        onBlur={commitDraft}
        onChange={(event) => setDraft(event.currentTarget.value)}
        onKeyDown={(event) => {
          if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
            event.preventDefault();
            commitDraft();
          }
        }}
      />
    </div>
  );
}

function getWorkflowObjectConstructorNodeControlOffset<TNodeData>(
  node: WorkflowEditorNode<TNodeData>,
) {
  const uiNode = toUiWorkflowBuilderNodes([node])[0]!;
  const size = getWorkflowEditorRenderedNodeSize(uiNode);
  const outputIndex = Math.max(
    0,
    (node.outputs ?? []).findIndex((output) => output.id === "value"),
  );
  const portCenterY = getWorkflowEditorPortCenterOffset(uiNode, "output", outputIndex);
  const outputPanelHeight = getWorkflowEditorObjectConstructorOutputPanelHeight(uiNode);
  const outputPanelTop = portCenterY - outputPanelHeight / 2;
  const outputColumnX = size.width / 2 + 6;
  const x = Math.round(outputColumnX + 10);
  const width = Math.max(156, Math.round(size.width - x - 26));

  return {
    height: getWorkflowEditorObjectConstructorTextAreaHeight(uiNode),
    x,
    y: Math.max(12, Math.round(outputPanelTop + 42)),
    width,
  };
}

function WorkflowNodeActionMenus<
  TNodeData extends Record<string, unknown>,
  TEdgeData extends Record<string, unknown>,
>({
  document,
  readOnly,
  onDeleteNode,
}: {
  document: WorkflowEditorDocument<TNodeData, TEdgeData>;
  readOnly: boolean;
  onDeleteNode: (nodeId: string) => void;
}) {
  const [openNodeId, setOpenNodeId] = useState<string | null>(null);

  if (document.nodes.length === 0) {
    return null;
  }

  const stopInteractionPropagation = (event: SyntheticEvent) => {
    event.stopPropagation();
  };

  return (
    <div
      data-slot="workflow-node-action-menu-layer"
      className="pointer-events-none absolute inset-0 z-30"
    >
      {document.nodes.map((node) => {
        const size = getWorkflowEditorRenderedNodeSize(toUiWorkflowBuilderNodes([node])[0]!);
        const open = openNodeId === node.id;

        return (
          <div
            key={node.id}
            data-slot="workflow-node-action-menu"
            className="pointer-events-auto absolute"
            style={{
              left: Math.round(node.x + size.width - 34),
              top: Math.round(node.y + 8),
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
          </div>
        );
      })}
    </div>
  );
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
