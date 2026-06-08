import { Badge, Button, SearchField } from "@moritzbrantner/ui";

import type { WorkflowWorkbenchController } from "../react";
import type { WorkflowWorkbenchPaletteCategoryGroup } from "./palette-model";

export function WorkflowWorkbenchPalette<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
>({
  controller,
  mode = "inline",
}: {
  controller: WorkflowWorkbenchController<TNodeData, TEdgeData, TTemplateData>;
  mode?: "inline" | "overlay";
}) {
  return (
    <div
      data-slot={mode === "overlay" ? "workflow-palette-overlay" : "workflow-palette"}
      className="grid min-h-0 gap-3 rounded-md border border-border bg-card p-3 text-sm"
    >
      <SearchField
        value={controller.palette.searchValue}
        onValueChange={controller.palette.setSearchValue}
        placeholder="Search nodes"
        clearLabel="Clear node search"
        inputProps={{ "aria-label": "Search node palette" }}
      />
      <div className="grid min-h-0 gap-3 overflow-y-auto">
        {controller.palette.filteredItems.length > 0 ? (
          controller.palette.groups.map((group) => (
            <WorkflowWorkbenchPaletteGroup key={group.id} controller={controller} group={group} />
          ))
        ) : (
          <div className="rounded-md border border-dashed p-3 text-muted-foreground">
            {controller.palette.items.length > 0
              ? "No matching node templates"
              : "No node templates"}
          </div>
        )}
      </div>
    </div>
  );
}

function WorkflowWorkbenchPaletteGroup<
  TNodeData extends Record<string, unknown>,
  TEdgeData extends Record<string, unknown>,
  TTemplateData,
>({
  controller,
  group,
}: {
  controller: WorkflowWorkbenchController<TNodeData, TEdgeData, TTemplateData>;
  group: WorkflowWorkbenchPaletteCategoryGroup<TTemplateData>;
}) {
  return (
    <section className="grid gap-2" aria-label={group.label}>
      <div className="flex items-center justify-between gap-3 text-[0.68rem] font-semibold uppercase text-muted-foreground">
        <span>{group.label}</span>
        {group.templates.length > 0 ? (
          <Badge variant="secondary">{group.templates.length}</Badge>
        ) : null}
      </div>
      <div className="grid gap-2">
        {group.templates.map((template) => (
          <Button
            key={template.id}
            type="button"
            variant="ghost"
            className="h-auto justify-start border border-border bg-background px-3 py-2 text-left"
            disabled={controller.readOnly}
            onClick={() => controller.actions.addTemplateNode(template)}
          >
            {template.label}
          </Button>
        ))}
      </div>
      {group.children.map((child) => (
        <div key={child.id} className="border-l border-border/60 pl-3">
          <WorkflowWorkbenchPaletteGroup controller={controller} group={child} />
        </div>
      ))}
    </section>
  );
}
