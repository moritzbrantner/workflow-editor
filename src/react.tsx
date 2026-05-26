"use client";

import { type ReactNode, useMemo } from "react";

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
  type WorkflowBuilderConnectionValidity,
  type InspectorFieldValue,
  type WorkflowNodeData,
} from "@moritzbrantner/ui/labs";

import {
  connectWorkflowEditorNodes,
  createWorkflowEditorGraphIndex,
  duplicateWorkflowEditorNode,
  findWorkflowEditorEdge,
  findWorkflowEditorNode,
  fromUiWorkflowBuilderEdges,
  fromUiWorkflowBuilderNodes,
  normalizeWorkflowEditorDocument,
  removeWorkflowEditorEdge,
  removeWorkflowEditorNode,
  toUiWorkflowBuilderEdges,
  toUiWorkflowBuilderNodes,
  updateWorkflowEditorNode,
  updateWorkflowEditorNodeWorkflowReference,
  validateWorkflowEditorConnection,
  type WorkflowEditorDocument,
  type WorkflowEditorEdge,
  type WorkflowEditorNode,
  type WorkflowEditorNodeTemplate,
  type WorkflowEditorSelection,
  type WorkflowEditorTypeDefinition,
  type WorkflowEditorViewport,
} from "./core";
import type { WorkflowEditorDocumentReferenceOption } from "./persistence";
import { formatShortcutLabel } from "./shortcut-label";

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
  readOnly?: boolean;
  nodeTemplates?: Array<WorkflowWorkbenchPaletteItem<TTemplateData>>;
  typeDefinitions?: readonly WorkflowEditorTypeDefinition[];
  documentReferences?: WorkflowEditorDocumentReferenceOption[];
  className?: string;
  onDocumentChange?: (document: WorkflowEditorDocument<TNodeData, TEdgeData>) => void;
  onSelectionChange?: (selection: WorkflowWorkbenchSelection<TNodeData, TEdgeData>) => void;
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
  deleteSelection: "Delete",
  duplicateNode: "Mod+D",
  fitView: "Mod+0",
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
  readOnly = false,
  nodeTemplates = [],
  typeDefinitions,
  documentReferences,
  className,
  onDocumentChange,
  onSelectionChange,
  onViewportChange,
  onOpenWorkflowReference,
  onCreateWorkflowReference,
  renderNodeTemplate,
  renderInspector,
  renderToolbarActions,
}: WorkflowWorkbenchProps<TNodeData, TEdgeData, TTemplateData>) {
  const selectedNode = selectedNodeId
    ? findWorkflowEditorNode(document, selectedNodeId)
    : undefined;
  const selectedEdge = selectedEdgeId
    ? findWorkflowEditorEdge(document, selectedEdgeId)
    : undefined;
  const graphIndex = useMemo(() => createWorkflowEditorGraphIndex(document), [document]);

  const commitDocument = (nextDocument: WorkflowEditorDocument<TNodeData, TEdgeData>) => {
    onDocumentChange?.(nextDocument);
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

  const addTemplateNode = (template: WorkflowWorkbenchPaletteItem<TTemplateData>) => {
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
      eyebrow: template.eyebrow,
      packageLabel: template.packageLabel,
      status: template.status,
      tone: template.tone,
      variant: template.variant,
      minimized: template.minimized,
      tags: template.tags,
      x: 120 + document.nodes.length * 36,
      y: 120 + document.nodes.length * 28,
      inputs: template.inputs,
      outputs: template.outputs,
      data: template.data as TNodeData | undefined,
      workflowRef: template.workflowRef,
      composition: template.composition as WorkflowEditorNode<TNodeData>["composition"],
    };

    const nextDocument = {
      ...document,
      nodes: [...document.nodes, node],
    };
    commitDocument(nextDocument);
    onSelectionChange?.({ type: "node", id, node });
  };

  const deleteSelection = () => {
    if (readOnly) {
      return;
    }

    if (selectedNode) {
      commitDocument(removeWorkflowEditorNode(document, selectedNode.id));
      onSelectionChange?.(null);
      return;
    }

    if (selectedEdge) {
      commitDocument(removeWorkflowEditorEdge(document, selectedEdge.id));
      onSelectionChange?.(null);
    }
  };

  const duplicateSelection = () => {
    if (!selectedNode || readOnly) {
      return;
    }

    commitDocument(duplicateWorkflowEditorNode(document, selectedNode.id));
  };

  return (
    <WorkbenchLayout
      className={cn("min-h-[38rem] overflow-hidden border border-border bg-background", className)}
      leftPanel={
        <WorkbenchPanel side="left" className="min-w-64">
          <div className="grid gap-3 p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium">Node palette</div>
              <Badge variant="secondary">{nodeTemplates.length}</Badge>
            </div>
            {renderNodeTemplate ? (
              <div className="grid gap-2">
                {nodeTemplates.map((template) => (
                  <Button
                    key={template.id}
                    type="button"
                    variant="ghost"
                    className="h-auto justify-start border border-border bg-background px-3 py-2 text-left"
                    disabled={readOnly}
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
        <WorkbenchToolbar className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-3 py-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{document.nodes.length} nodes</Badge>
            <Badge variant="outline">{document.edges.length} edges</Badge>
            <Badge variant="secondary">
              {
                graphIndex.getSubgraph({ offset: 0, limit: document.nodes.length }).summary
                  .edgeCount
              }{" "}
              indexed
            </Badge>
            <span className="text-xs text-muted-foreground">
              Duplicate {formatShortcutLabel(defaultWorkflowWorkbenchHotkeys.duplicateNode)}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={readOnly || !selectedNode}
              onClick={duplicateSelection}
            >
              Duplicate
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
              disabled={readOnly || (!selectedNode && !selectedEdge)}
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
        <WorkflowBuilder
          nodes={toUiWorkflowBuilderNodes(document.nodes)}
          edges={toUiWorkflowBuilderEdges(document.edges)}
          selectedNodeId={selectedNodeId}
          selectedEdgeId={selectedEdgeId}
          readOnly={readOnly}
          showMiniMap
          surfaceHeight="34rem"
          viewport={document.viewport}
          toolbarLabel="Workflow"
          onNodesChange={(nodes) => {
            if (!readOnly) {
              commitDocument(
                normalizeWorkflowEditorDocument({
                  ...document,
                  nodes: fromUiWorkflowBuilderNodes(nodes, document.nodes),
                }),
              );
            }
          }}
          onEdgesChange={(edges) => {
            if (!readOnly) {
              commitDocument(
                normalizeWorkflowEditorDocument({
                  ...document,
                  edges: fromUiWorkflowBuilderEdges(edges, document.edges),
                }),
              );
            }
          }}
          onViewportChange={(viewport) => {
            onViewportChange?.(viewport);
            commitDocument({ ...document, viewport });
          }}
          onSelectionChange={(selection) => {
            if (!selection) {
              onSelectionChange?.(null);
              return;
            }

            if (selection.type === "node") {
              const node = findWorkflowEditorNode(document, selection.id);
              onSelectionChange?.(node ? { type: "node", id: selection.id, node } : null);
              return;
            }

            const edge = findWorkflowEditorEdge(document, selection.id);
            onSelectionChange?.(edge ? { type: "edge", id: selection.id, edge } : null);
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
            if (!readOnly) {
              commitDocument(connectWorkflowEditorNodes(document, connection, { typeDefinitions }));
            }
          }}
          onDoubleClick={() => {
            openSelectedNodeWorkflow();
          }}
        />
      </WorkbenchCanvas>
    </WorkbenchLayout>
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

            context.updateSelectedNode(patch);
          }}
        />
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
