import { useEffect, useState } from "react";

import { Button, Input } from "@moritzbrantner/ui";

import {
  addWorkflowEditorArrayConstructorInputToNode,
  addWorkflowEditorObjectConstructorInputToNode,
  addWorkflowEditorObjectDecompositionOutputToNode,
  getWorkflowEditorArrayConstructorInputs,
  getWorkflowEditorObjectConstructorInputs,
  getWorkflowEditorObjectDecompositionOutputs,
  isWorkflowEditorArrayConstructorNode,
  isWorkflowEditorObjectConstructorNode,
  isWorkflowEditorObjectDecompositionNode,
  removeWorkflowEditorArrayConstructorInput,
  removeWorkflowEditorObjectConstructorInput,
  removeWorkflowEditorObjectDecompositionOutput,
  updateWorkflowEditorNode,
  updateWorkflowEditorObjectConstructorPropertiesInNode,
  updateWorkflowEditorObjectDecompositionPropertiesInNode,
  type WorkflowEditorDocument,
  type WorkflowEditorNode,
} from "../core";

/**
 * Frequent dynamic-port edits on the node itself (#45, Decision Atlas 5.6): object-constructor
 * property names beside their inputs, array-constructor item rows, object-decomposition output
 * names, and one compact add action in the node body. Every edit goes through the workflow-core
 * mutation helpers, so port ids, connections and undo stay authoritative.
 */
export function isWorkflowEditorDynamicPortNode<TData>(node: WorkflowEditorNode<TData>) {
  return (
    isWorkflowEditorObjectConstructorNode(node) ||
    isWorkflowEditorArrayConstructorNode(node) ||
    isWorkflowEditorObjectDecompositionNode(node)
  );
}

export const workflowDynamicPortBodyHeight = 40;

function PortNameEditor({
  label,
  name,
  readOnly,
  onRename,
  onRemove,
}: {
  label: string;
  name: string;
  readOnly: boolean;
  onRename?: (name: string) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState(name);
  useEffect(() => setDraft(name), [name]);
  const commit = () => {
    const next = draft.trim();
    if (next && next !== name) onRename?.(next);
    else setDraft(name);
  };
  return (
    <div className="flex items-center gap-1">
      {onRename ? (
        <Input
          aria-label={`${label} name`}
          className="h-6 min-w-0 flex-1 px-1 text-[11px]"
          value={draft}
          disabled={readOnly}
          onChange={(event) => setDraft(event.currentTarget.value)}
          onBlur={commit}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commit();
            } else if (event.key === "Escape") {
              setDraft(name);
            }
          }}
        />
      ) : (
        <span className="min-w-0 flex-1" />
      )}
      <button
        type="button"
        aria-label={`Remove ${label}`}
        disabled={readOnly}
        className="h-6 rounded px-1 text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
        onClick={(event) => {
          event.stopPropagation();
          onRemove();
        }}
      >
        ×
      </button>
    </div>
  );
}

/** Port-card content for a dynamic port, or null for other ports. */
export function WorkflowDynamicPortControl<TNodeData, TEdgeData>({
  document,
  node,
  portId,
  direction,
  readOnly,
  commit,
}: {
  document: WorkflowEditorDocument<TNodeData, TEdgeData>;
  node: WorkflowEditorNode<TNodeData>;
  portId: string;
  direction: "input" | "output";
  readOnly: boolean;
  commit: (document: WorkflowEditorDocument<TNodeData, TEdgeData>) => void;
}) {
  if (direction === "input" && isWorkflowEditorObjectConstructorNode(node)) {
    const input = getWorkflowEditorObjectConstructorInputs(node).find(
      (candidate) => candidate.id === portId,
    );
    if (!input) return null;
    return (
      <PortNameEditor
        label={`${node.label} property ${input.label}`}
        name={input.label}
        readOnly={readOnly}
        onRename={(name) =>
          commit(
            updateWorkflowEditorNode(
              document,
              node.id,
              pickPorts(
                updateWorkflowEditorObjectConstructorPropertiesInNode(node, { [portId]: name }),
              ),
            ),
          )
        }
        onRemove={() =>
          commit(removeWorkflowEditorObjectConstructorInput(document, node.id, portId))
        }
      />
    );
  }
  if (direction === "input" && isWorkflowEditorArrayConstructorNode(node)) {
    const items = getWorkflowEditorArrayConstructorInputs(node);
    const index = items.findIndex((candidate) => candidate.id === portId);
    if (index === -1) return null;
    return (
      <PortNameEditor
        label={`${node.label} item ${index + 1}`}
        name={String(index + 1)}
        readOnly={readOnly}
        onRemove={() =>
          commit(removeWorkflowEditorArrayConstructorInput(document, node.id, portId))
        }
      />
    );
  }
  if (direction === "output" && isWorkflowEditorObjectDecompositionNode(node)) {
    const output = getWorkflowEditorObjectDecompositionOutputs(node).find(
      (candidate) => candidate.id === portId,
    );
    if (!output) return null;
    return (
      <PortNameEditor
        label={`${node.label} output ${output.label}`}
        name={output.label}
        readOnly={readOnly}
        onRename={(name) =>
          commit(
            updateWorkflowEditorNode(
              document,
              node.id,
              pickPorts(
                updateWorkflowEditorObjectDecompositionPropertiesInNode(node, { [portId]: name }),
              ),
            ),
          )
        }
        onRemove={() =>
          commit(removeWorkflowEditorObjectDecompositionOutput(document, node.id, portId))
        }
      />
    );
  }
  return null;
}

/** Body action that adds a dynamic port. */
export function WorkflowDynamicPortAddAction<TNodeData, TEdgeData>({
  document,
  node,
  readOnly,
  commit,
}: {
  document: WorkflowEditorDocument<TNodeData, TEdgeData>;
  node: WorkflowEditorNode<TNodeData>;
  readOnly: boolean;
  commit: (document: WorkflowEditorDocument<TNodeData, TEdgeData>) => void;
}) {
  const [label, next] = isWorkflowEditorObjectConstructorNode(node)
    ? ["Add property", addWorkflowEditorObjectConstructorInputToNode(node)]
    : isWorkflowEditorArrayConstructorNode(node)
      ? ["Add item", addWorkflowEditorArrayConstructorInputToNode(node)]
      : ["Add output", addWorkflowEditorObjectDecompositionOutputToNode(node)];
  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      className="h-7 px-2 text-xs"
      disabled={readOnly}
      aria-label={`${label} to ${node.label}`}
      onClick={(event) => {
        event.stopPropagation();
        commit(updateWorkflowEditorNode(document, node.id, pickPorts(next)));
      }}
    >
      + {label}
    </Button>
  );
}

function pickPorts<TNodeData>(
  node: WorkflowEditorNode<TNodeData>,
): Partial<WorkflowEditorNode<TNodeData>> {
  return { inputs: node.inputs, outputs: node.outputs, data: node.data };
}
