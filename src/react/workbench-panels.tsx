import { useState } from "react";

import { Badge, Button, Input, SearchField } from "@moritzbrantner/ui";

import {
  duplicateWorkflowEditorNode,
  removeWorkflowEditorNode,
  restoreWorkflowEditorComposedNode,
  updateWorkflowEditorNode,
  type WorkflowEditorNode,
} from "../core";
import { layoutWorkflowEditorDocument } from "../core-layout";
import type { WorkflowWorkbenchController } from "../react";

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
