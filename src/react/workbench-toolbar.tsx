import { Badge } from "@moritzbrantner/ui";

import {
  WorkflowWorkbenchCommandToolbar,
  type WorkflowWorkbenchToolbarOverflow,
} from "./workbench-command-toolbar";
import type { WorkflowWorkbenchController } from "./workbench-types";

export type { WorkflowWorkbenchToolbarOverflow } from "./workbench-command-toolbar";

/**
 * Workflow command toolbar for hosts composing their own workbench from a controller. It is the
 * shared `EditorToolbar` (a single Tab stop with arrow-key navigation); pass `overflow="scroll"`
 * to keep one scrolling row on narrow surfaces.
 */
export function WorkflowWorkbenchToolbar<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
>({
  controller,
  overflow = "wrap",
}: {
  controller: WorkflowWorkbenchController<TNodeData, TEdgeData, TTemplateData>;
  /** `wrap` (default) flows command groups onto new rows; `scroll` keeps one scrolling row. */
  overflow?: WorkflowWorkbenchToolbarOverflow;
}) {
  const { selectedNode } = controller;
  return (
    <WorkflowWorkbenchCommandToolbar
      controller={controller}
      overflow={overflow}
      showRestoreComposition={Boolean(
        selectedNode?.composition && selectedNode.kind !== "control.iterate",
      )}
      referenceCommand={
        controller.workflow.documentReferences
          ? selectedNode?.workflowRef?.documentId
            ? { mode: "open", disabled: !controller.workflow.openSelectedNodeWorkflow }
            : {
                mode: "create",
                disabled:
                  controller.readOnly ||
                  !selectedNode ||
                  !controller.workflow.createSelectedNodeWorkflow,
              }
          : null
      }
      status={
        controller.toolbar.showGraphStats ? (
          <>
            <Badge variant="outline">{controller.document.nodes.length} nodes</Badge>
            <Badge variant="outline">{controller.document.edges.length} edges</Badge>
          </>
        ) : null
      }
    />
  );
}
