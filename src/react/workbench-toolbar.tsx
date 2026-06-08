import { Badge, Button } from "@moritzbrantner/ui";

import type { WorkflowWorkbenchController } from "../react";

export function WorkflowWorkbenchToolbar<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
>({
  controller,
}: {
  controller: WorkflowWorkbenchController<TNodeData, TEdgeData, TTemplateData>;
}) {
  return (
    <div data-slot="workbench-toolbar" className="flex flex-wrap items-center gap-2">
      {controller.toolbar.showGraphStats ? (
        <>
          <Badge variant="outline">{controller.document.nodes.length} nodes</Badge>
          <Badge variant="outline">{controller.document.edges.length} edges</Badge>
        </>
      ) : null}
      <Badge variant="outline" data-testid="selection-count">
        {controller.selection.nodeIds.length +
          controller.selection.edgeIds.length +
          (controller.selection.groupIds?.length ?? 0)}{" "}
        selected
      </Badge>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={
          controller.readOnly ||
          (controller.selection.nodeIds.length === 0 &&
            controller.selection.edgeIds.length === 0 &&
            (controller.selection.groupIds?.length ?? 0) === 0)
        }
        onClick={controller.actions.duplicateSelection}
      >
        Duplicate
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={
          controller.selection.nodeIds.length === 0 &&
          controller.selection.edgeIds.length === 0 &&
          (controller.selection.groupIds?.length ?? 0) === 0
        }
        onClick={controller.actions.copySelection}
      >
        Copy
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={controller.readOnly}
        onClick={() => void controller.actions.pasteSelection()}
      >
        Paste
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={
          controller.readOnly ||
          (controller.selection.nodeIds.length === 0 && !controller.selectedGroup)
        }
        onClick={controller.actions.arrangeSelection}
      >
        Arrange selection
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={controller.readOnly || controller.document.nodes.length === 0}
        onClick={controller.actions.arrangeAll}
      >
        Arrange all
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={controller.readOnly || controller.selection.nodeIds.length < 2}
        onClick={controller.actions.groupSelection}
      >
        Group
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={controller.readOnly || !controller.selectedGroup}
        onClick={controller.actions.ungroupSelection}
      >
        Ungroup
      </Button>
      {controller.workflow.documentReferences ? (
        controller.selectedNode?.workflowRef?.documentId ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={!controller.workflow.openSelectedNodeWorkflow}
            onClick={controller.actions.openSelectedNodeWorkflow}
          >
            Open workflow
          </Button>
        ) : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={
              controller.readOnly ||
              !controller.selectedNode ||
              !controller.workflow.createSelectedNodeWorkflow
            }
            onClick={controller.actions.createSelectedNodeWorkflow}
          >
            Create nested workflow
          </Button>
        )
      ) : null}
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={
          controller.readOnly ||
          (controller.selection.nodeIds.length === 0 &&
            controller.selection.edgeIds.length === 0 &&
            (controller.selection.groupIds?.length ?? 0) === 0)
        }
        onClick={controller.actions.deleteSelection}
      >
        Delete
      </Button>
      {controller.configuration.renderToolbarActions?.(controller.inspector.context)}
    </div>
  );
}
