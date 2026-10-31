import type { DragEvent as ReactDragEvent, ReactNode } from "react";
import { Maximize2Icon, Minimize2Icon, PinIcon } from "lucide-react";
import {
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
  cn,
} from "@moritzbrantner/ui";
import { SearchField } from "@moritzbrantner/ui/data";

import type { WorkflowExecutionSnapshot } from "../core-execution";
import { DefaultWorkflowInspector } from "./default-workflow-inspector";
import { WorkflowExecutionDetails } from "./execution-details";
import {
  WorkflowPendingHumanTaskPanel,
  type WorkflowWorkbenchHumanTasks,
} from "./human-task-panel";
import { WorkflowWorkbenchInvalidPaletteTemplate } from "./invalid-palette-template";
import type {
  WorkflowWorkbenchPaletteCategoryGroup,
  WorkflowWorkbenchPaletteItem,
} from "./palette-model";
import { toUiWorkflowNodeTemplate } from "./workbench-model";
import type { WorkflowWorkbenchOverlayState } from "./workbench-overlay-state";
import type { WorkflowWorkbenchController, WorkflowWorkbenchProps } from "./workbench-types";
import { WorkflowNode } from "./workflow-node";

/** The draggable node palette `WorkflowWorkbench` renders unless the host hides or replaces it. */
export function WorkflowWorkbenchPaletteOverlay<
  TNodeData extends Record<string, unknown>,
  TEdgeData extends Record<string, unknown>,
  TTemplateData,
>({
  controller,
  panel,
  startTemplateDrag,
}: {
  controller: WorkflowWorkbenchController<TNodeData, TEdgeData, TTemplateData>;
  panel: WorkflowWorkbenchOverlayState["palette"];
  startTemplateDrag: (
    event: ReactDragEvent<HTMLElement>,
    template: WorkflowWorkbenchPaletteItem<TTemplateData>,
  ) => void;
}) {
  const {
    actions: { addTemplateNode },
    configuration: { renderNodeTemplate },
    palette,
    readOnly,
  } = controller;

  const renderPaletteTemplate = (template: WorkflowWorkbenchPaletteItem<TTemplateData>) => {
    const entry = palette.registry.getEntry(template);
    return entry && !entry.valid ? (
      <WorkflowWorkbenchInvalidPaletteTemplate key={`invalid-${entry.index}`} entry={entry} />
    ) : renderNodeTemplate ? (
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
  };

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

  return (
    <div
      data-slot="workflow-palette-overlay"
      ref={panel.ref}
      className={cn(
        "absolute z-[20000] flex max-h-[calc(100%-1.5rem)] max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-md border border-border/70 bg-card/95 text-sm shadow-md supports-backdrop-filter:backdrop-blur-xl",
        panel.minimized ? "w-44 p-2" : "w-96 p-3",
      )}
      style={panel.style}
    >
      <div className="flex min-h-0 flex-col gap-3">
        <div
          data-slot="workflow-palette-header"
          className={cn(
            "flex flex-none touch-none select-none items-center justify-between gap-3 rounded-sm",
            panel.dragging ? "cursor-grabbing" : "cursor-grab",
          )}
          onPointerCancel={panel.completeDrag}
          onPointerDown={panel.startDrag}
          onPointerMove={panel.updateDrag}
          onPointerUp={panel.completeDrag}
        >
          <div className="min-w-0 truncate text-sm font-medium">Node palette</div>
          <div className="flex items-center gap-2">
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button type="button" size="icon-sm" variant="ghost" aria-label="Pin node palette">
                  <PinIcon className="size-3.5" aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="z-[20010] w-40">
                <DropdownMenuLabel>Pin to corner</DropdownMenuLabel>
                <DropdownMenuItem onSelect={() => panel.pinToCorner("top-left")}>
                  Top left
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => panel.pinToCorner("top-right")}>
                  Top right
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => panel.pinToCorner("bottom-left")}>
                  Bottom left
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => panel.pinToCorner("bottom-right")}>
                  Bottom right
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              aria-label={panel.minimized ? "Expand node palette" : "Minimize node palette"}
              aria-pressed={panel.minimized}
              onClick={() => panel.setMinimized(!panel.minimized)}
            >
              {panel.minimized ? (
                <Maximize2Icon className="size-3.5" aria-hidden="true" />
              ) : (
                <Minimize2Icon className="size-3.5" aria-hidden="true" />
              )}
            </Button>
          </div>
        </div>
        {panel.minimized ? null : (
          <>
            <SearchField
              value={palette.searchValue}
              onValueChange={palette.setSearchValue}
              placeholder="Search nodes"
              clearLabel="Clear node search"
              inputProps={{ "aria-label": "Search node palette" }}
            />
            {/* Focusable so keyboard users can scroll the list even when its items are disabled. */}
            <div
              role="region"
              aria-label="Node templates"
              tabIndex={0}
              className="min-h-0 overflow-y-auto pr-1 outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
            >
              {palette.filteredItems.length > 0 ? (
                <div className="grid gap-3">
                  {palette.groups.map((group) => renderPaletteCategoryGroup(group))}
                </div>
              ) : palette.items.length > 0 ? (
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
  );
}

/** The draggable info panel `WorkflowWorkbench` renders unless the host hides or replaces it. */
export function WorkflowWorkbenchInspectorOverlay<
  TNodeData extends Record<string, unknown>,
  TEdgeData extends Record<string, unknown>,
  TTemplateData,
>({
  controller,
  execution,
  humanTasks,
  panel,
  renderExecutionDetails,
}: {
  controller: WorkflowWorkbenchController<TNodeData, TEdgeData, TTemplateData>;
  execution: WorkflowExecutionSnapshot | null | undefined;
  humanTasks: WorkflowWorkbenchHumanTasks | undefined;
  panel: WorkflowWorkbenchOverlayState["inspector"];
  renderExecutionDetails: WorkflowWorkbenchProps<
    TNodeData,
    TEdgeData,
    TTemplateData
  >["renderExecutionDetails"];
}) {
  const {
    configuration: { renderInspector, typeDefinitions },
    inspector: { context: inspectorContext },
    selectedNode,
  } = controller;

  return (
    <div
      data-slot="workflow-inspector-overlay"
      ref={panel.ref}
      className={cn(
        "absolute z-[20000] flex max-h-[calc(100%-1.5rem)] max-w-[calc(100%-1.5rem)] flex-col overflow-hidden rounded-md border border-border/70 bg-card/95 text-sm shadow-md supports-backdrop-filter:backdrop-blur-xl",
        panel.collapsed ? "w-44 p-2" : "w-[min(20rem,calc(100%-1.5rem))] p-3",
      )}
      style={panel.style}
    >
      <div className="flex min-h-0 flex-col gap-3">
        <div
          data-slot="workflow-inspector-header"
          className={cn(
            "flex flex-none touch-none select-none items-center justify-between gap-3 rounded-sm",
            panel.dragging ? "cursor-grabbing" : "cursor-grab",
          )}
          onPointerCancel={panel.completeDrag}
          onPointerDown={panel.startDrag}
          onPointerMove={panel.updateDrag}
          onPointerUp={panel.completeDrag}
        >
          <div className="min-w-0 truncate text-sm font-medium">Info</div>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label={panel.collapsed ? "Expand info panel" : "Minimize info panel"}
            aria-pressed={panel.collapsed}
            onClick={panel.toggleCollapsed}
          >
            {panel.collapsed ? (
              <Maximize2Icon className="size-3.5" aria-hidden="true" />
            ) : (
              <Minimize2Icon className="size-3.5" aria-hidden="true" />
            )}
          </Button>
        </div>
        {panel.collapsed ? null : (
          <div className="min-h-0 overflow-y-auto">
            {selectedNode
              ? humanTasks?.pending
                  .filter((task) => task.nodeId === selectedNode.id)
                  .map((task) => (
                    <WorkflowPendingHumanTaskPanel
                      key={`${task.runId}:${task.taskId}`}
                      task={task}
                      respond={humanTasks.respond}
                      readOnly={false}
                      typeDeclarations={controller.document.typeDeclarations}
                      typeDefinitions={typeDefinitions}
                    />
                  ))
              : null}
            {execution && selectedNode ? (
              <WorkflowExecutionDetails
                execution={execution}
                node={selectedNode}
                renderExecutionDetails={renderExecutionDetails}
              />
            ) : null}
            {renderInspector ? (
              renderInspector(inspectorContext)
            ) : (
              <DefaultWorkflowInspector context={inspectorContext} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
