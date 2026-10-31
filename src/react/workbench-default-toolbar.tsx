import { Badge, Button } from "@moritzbrantner/ui";

import type { WorkflowEditorGraphIndex } from "../core";
import { formatShortcutLabel } from "../shortcut-label";
import {
  defaultWorkflowWorkbenchHotkeys,
  hasWorkflowWorkbenchSelection,
  isWorkflowEditorComposedNode,
} from "./workbench-model";
import type { WorkflowWorkbenchController } from "./workbench-types";

/** The toolbar `WorkflowWorkbench` renders unless the host hides or replaces it. */
export function WorkflowWorkbenchDefaultToolbar<
  TNodeData extends Record<string, unknown>,
  TEdgeData extends Record<string, unknown>,
  TTemplateData,
>({
  controller,
  graphIndex,
  selectedNodeHasWorkflowReference,
  selectedNodeWorkflowReferenceValid,
}: {
  controller: WorkflowWorkbenchController<TNodeData, TEdgeData, TTemplateData>;
  graphIndex: WorkflowEditorGraphIndex<TNodeData, TEdgeData>;
  selectedNodeHasWorkflowReference: boolean;
  selectedNodeWorkflowReferenceValid: boolean;
}) {
  const {
    actions: {
      arrangeAll,
      arrangeSelection,
      composeSelection,
      copySelection,
      createSelectedNodeWorkflow,
      deleteSelection,
      duplicateSelection,
      groupSelection,
      openSelectedNodeWorkflow,
      pasteSelection,
      restoreComposition,
      ungroupSelection,
    },
    configuration: {
      documentReferences,
      onCreateWorkflowReference,
      onOpenWorkflowReference,
      renderToolbarActions,
    },
    document,
    inspector: { context: inspectorContext },
    readOnly,
    selectedGroup,
    selectedNode,
    selection,
    toolbar: { showGraphStats, showShortcutHint },
  } = controller;

  return (
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
            {selection.nodeIds.length +
              selection.edgeIds.length +
              (selection.groupIds?.length ?? 0)}{" "}
            selected
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
            disabled={readOnly || !hasWorkflowWorkbenchSelection(selection)}
            onClick={duplicateSelection}
          >
            Duplicate
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="!h-6 !min-h-6 !px-2 !text-xs"
            disabled={!hasWorkflowWorkbenchSelection(selection)}
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
            disabled={readOnly || (selection.nodeIds.length === 0 && !selectedGroup)}
            onClick={arrangeSelection}
          >
            Arrange selection
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="!h-6 !min-h-6 !px-2 !text-xs"
            disabled={readOnly || selection.nodeIds.length < 2}
            onClick={groupSelection}
          >
            Group
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="!h-6 !min-h-6 !px-2 !text-xs"
            disabled={readOnly || !selectedGroup}
            onClick={ungroupSelection}
          >
            Ungroup
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="!h-6 !min-h-6 !px-2 !text-xs"
            disabled={readOnly || selection.nodeIds.length === 0}
            onClick={composeSelection}
          >
            Compose
          </Button>
          {selectedNode && isWorkflowEditorComposedNode(selectedNode) ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="!h-6 !min-h-6 !px-2 !text-xs"
              disabled={readOnly}
              onClick={() => restoreComposition()}
            >
              Restore composition
            </Button>
          ) : null}
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
            disabled={readOnly || !hasWorkflowWorkbenchSelection(selection)}
            onClick={deleteSelection}
          >
            Delete
          </Button>
          {renderToolbarActions?.(inspectorContext)}
        </div>
      </div>
    </div>
  );
}
