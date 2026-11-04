import { Badge } from "@moritzbrantner/ui";

import type { WorkflowEditorGraphIndex } from "../core";
import { formatShortcutLabel } from "../shortcut-label";
import {
  WorkflowWorkbenchCommandToolbar,
  type WorkflowWorkbenchToolbarOverflow,
} from "./workbench-command-toolbar";
import { defaultWorkflowWorkbenchHotkeys, isWorkflowEditorComposedNode } from "./workbench-model";
import type { WorkflowWorkbenchController } from "./workbench-types";

/** The toolbar `WorkflowWorkbench` renders unless the host hides or replaces it. */
export function WorkflowWorkbenchDefaultToolbar<
  TNodeData extends Record<string, unknown>,
  TEdgeData extends Record<string, unknown>,
  TTemplateData,
>({
  controller,
  graphIndex,
  overflow,
  selectedNodeHasWorkflowReference,
  selectedNodeWorkflowReferenceValid,
}: {
  controller: WorkflowWorkbenchController<TNodeData, TEdgeData, TTemplateData>;
  graphIndex: WorkflowEditorGraphIndex<TNodeData, TEdgeData>;
  /** `scroll` keeps one row on narrow workbenches; `wrap` flows groups onto new rows. */
  overflow: WorkflowWorkbenchToolbarOverflow;
  selectedNodeHasWorkflowReference: boolean;
  selectedNodeWorkflowReferenceValid: boolean;
}) {
  const {
    configuration: { documentReferences, onCreateWorkflowReference, onOpenWorkflowReference },
    document,
    readOnly,
    selectedNode,
    toolbar: { showGraphStats, showShortcutHint },
  } = controller;

  return (
    <WorkflowWorkbenchCommandToolbar
      controller={controller}
      overflow={overflow}
      showRestoreComposition={Boolean(selectedNode && isWorkflowEditorComposedNode(selectedNode))}
      referenceCommand={
        documentReferences
          ? selectedNodeHasWorkflowReference
            ? {
                mode: "open",
                disabled: !selectedNodeWorkflowReferenceValid || !onOpenWorkflowReference,
              }
            : { mode: "create", disabled: readOnly || !selectedNode || !onCreateWorkflowReference }
          : null
      }
      status={
        <>
          {showGraphStats ? (
            <>
              <Badge variant="outline">{document.nodes.length} nodes</Badge>
              <Badge variant="outline">{document.edges.length} edges</Badge>
              <Badge variant="secondary">
                {
                  graphIndex.getSubgraph({ offset: 0, limit: document.nodes.length }).summary
                    .edgeCount
                }{" "}
                indexed
              </Badge>
            </>
          ) : null}
          {showShortcutHint ? (
            <span className="hidden text-xs text-muted-foreground sm:inline">
              Duplicate {formatShortcutLabel(defaultWorkflowWorkbenchHotkeys.duplicateNode)}
            </span>
          ) : null}
        </>
      }
    />
  );
}
