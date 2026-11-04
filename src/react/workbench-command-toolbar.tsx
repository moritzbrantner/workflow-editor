import type { ReactNode } from "react";
import {
  ClipboardPasteIcon,
  CombineIcon,
  CopyIcon,
  CopyPlusIcon,
  ExternalLinkIcon,
  GitBranchPlusIcon,
  GroupIcon,
  LayoutGridIcon,
  NetworkIcon,
  Trash2Icon,
  Undo2Icon,
  UngroupIcon,
} from "lucide-react";
import {
  Badge,
  EditorToolbar,
  EditorToolbarButton,
  EditorToolbarGroup,
  cn,
} from "@moritzbrantner/ui";

import { hasWorkflowWorkbenchSelection } from "./workbench-model";
import type { WorkflowWorkbenchController } from "./workbench-types";

/** How the toolbar treats commands that do not fit: wrap onto rows or scroll one row. */
export type WorkflowWorkbenchToolbarOverflow = "wrap" | "scroll";

/** The nested-workflow command the toolbar offers for the selected node, if any. */
export type WorkflowWorkbenchToolbarReferenceCommand = {
  mode: "open" | "create";
  disabled: boolean;
};

/**
 * Workflow command bar on the shared `EditorToolbar`: one Tab stop with arrow-key navigation,
 * labelled command groups and icon commands. The wrapper keeps the `workbench-toolbar` slot that
 * hosts style and query.
 */
export function WorkflowWorkbenchCommandToolbar<
  TNodeData extends Record<string, unknown>,
  TEdgeData extends Record<string, unknown>,
  TTemplateData,
>({
  controller,
  overflow,
  status,
  referenceCommand,
  showRestoreComposition,
  className,
}: {
  controller: WorkflowWorkbenchController<TNodeData, TEdgeData, TTemplateData>;
  overflow: WorkflowWorkbenchToolbarOverflow;
  /** Badges and hints shown before the commands. */
  status?: ReactNode;
  referenceCommand: WorkflowWorkbenchToolbarReferenceCommand | null;
  showRestoreComposition: boolean;
  className?: string;
}) {
  const {
    actions,
    configuration: { renderToolbarActions },
    document,
    inspector: { context: inspectorContext },
    readOnly,
    selectedGroup,
    selection,
  } = controller;
  const hasSelection = hasWorkflowWorkbenchSelection(selection);
  const hostActions = renderToolbarActions?.(inspectorContext);

  return (
    <div data-slot="workbench-toolbar" className={cn("min-w-0", className)}>
      <EditorToolbar
        aria-label="Workflow commands"
        density="compact"
        overflow={overflow}
        className="rounded-none border-0 border-b bg-card/75 shadow-none"
      >
        <div
          data-slot="workbench-toolbar-status"
          className="flex min-w-max items-center gap-1.5 whitespace-nowrap"
        >
          {status}
          <Badge variant="outline" data-testid="selection-count">
            {selection.nodeIds.length +
              selection.edgeIds.length +
              (selection.groupIds?.length ?? 0)}{" "}
            selected
          </Badge>
        </div>
        <EditorToolbarGroup aria-label="Clipboard">
          <EditorToolbarButton
            label="Duplicate"
            icon={<CopyPlusIcon aria-hidden="true" />}
            disabled={readOnly || !hasSelection}
            onClick={actions.duplicateSelection}
          />
          <EditorToolbarButton
            label="Copy"
            icon={<CopyIcon aria-hidden="true" />}
            disabled={!hasSelection}
            onClick={actions.copySelection}
          />
          <EditorToolbarButton
            label="Paste"
            icon={<ClipboardPasteIcon aria-hidden="true" />}
            disabled={readOnly}
            onClick={() => void actions.pasteSelection()}
          />
        </EditorToolbarGroup>
        <EditorToolbarGroup aria-label="Layout">
          <EditorToolbarButton
            label="Arrange selection"
            icon={<NetworkIcon aria-hidden="true" />}
            showLabel
            disabled={readOnly || (selection.nodeIds.length === 0 && !selectedGroup)}
            onClick={actions.arrangeSelection}
          />
          <EditorToolbarButton
            label="Arrange all"
            icon={<LayoutGridIcon aria-hidden="true" />}
            showLabel
            disabled={readOnly || document.nodes.length === 0}
            onClick={actions.arrangeAll}
          />
        </EditorToolbarGroup>
        <EditorToolbarGroup aria-label="Structure">
          <EditorToolbarButton
            label="Group"
            icon={<GroupIcon aria-hidden="true" />}
            disabled={readOnly || selection.nodeIds.length < 2}
            onClick={actions.groupSelection}
          />
          <EditorToolbarButton
            label="Ungroup"
            icon={<UngroupIcon aria-hidden="true" />}
            disabled={readOnly || !selectedGroup}
            onClick={actions.ungroupSelection}
          />
          <EditorToolbarButton
            label="Compose"
            icon={<CombineIcon aria-hidden="true" />}
            disabled={readOnly || selection.nodeIds.length === 0}
            onClick={actions.composeSelection}
          />
          {showRestoreComposition ? (
            <EditorToolbarButton
              label="Restore composition"
              icon={<Undo2Icon aria-hidden="true" />}
              showLabel
              disabled={readOnly}
              onClick={() => actions.restoreComposition()}
            />
          ) : null}
          {referenceCommand ? (
            referenceCommand.mode === "open" ? (
              <EditorToolbarButton
                label="Open workflow"
                icon={<ExternalLinkIcon aria-hidden="true" />}
                showLabel
                disabled={referenceCommand.disabled}
                onClick={actions.openSelectedNodeWorkflow}
              />
            ) : (
              <EditorToolbarButton
                label="Create nested workflow"
                icon={<GitBranchPlusIcon aria-hidden="true" />}
                showLabel
                disabled={referenceCommand.disabled}
                onClick={actions.createSelectedNodeWorkflow}
              />
            )
          ) : null}
        </EditorToolbarGroup>
        <EditorToolbarGroup aria-label="Delete">
          <EditorToolbarButton
            label="Delete"
            icon={<Trash2Icon aria-hidden="true" />}
            disabled={readOnly || !hasSelection}
            onClick={actions.deleteSelection}
          />
        </EditorToolbarGroup>
        {hostActions ? (
          <div
            data-slot="workbench-toolbar-host-actions"
            className="flex min-w-max items-center gap-1"
          >
            {hostActions}
          </div>
        ) : null}
      </EditorToolbar>
    </div>
  );
}
