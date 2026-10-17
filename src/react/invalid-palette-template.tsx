import type { WorkflowEditorNodeTemplateRegistryEntry } from "../core-template-registry";

/** A palette entry for an invalid template: visible and explained, never addable. */
export function WorkflowWorkbenchInvalidPaletteTemplate<TTemplateData>({
  entry,
}: {
  entry: WorkflowEditorNodeTemplateRegistryEntry<TTemplateData>;
}) {
  return (
    <div
      role="group"
      aria-disabled="true"
      aria-label={`${entry.template.label || entry.template.id || "Template"} (unavailable)`}
      data-slot="workflow-palette-invalid-template"
      className="grid gap-1 rounded-md border border-dashed border-destructive/40 bg-destructive/5 px-3 py-2 text-xs"
    >
      <span className="font-medium text-foreground">
        {entry.template.label || entry.template.id || "Unnamed template"}
      </span>
      <ul className="list-disc pl-4 text-destructive [overflow-wrap:anywhere]">
        {entry.diagnostics.map((diagnostic) => (
          <li key={`${diagnostic.code}:${diagnostic.path}`}>{diagnostic.message}</li>
        ))}
      </ul>
    </div>
  );
}
