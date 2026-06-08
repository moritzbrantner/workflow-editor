import { useRef } from "react";

import { Badge, Button, Input, WorkbenchToolbar } from "@moritzbrantner/ui";

import { canRedoWorkflowEditorHistory, canUndoWorkflowEditorHistory } from "../history";
import type { WorkflowEditorController, WorkflowEditorSaveState } from "../editor";

type ChromeController<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
> = WorkflowEditorController<TNodeData, TEdgeData, TTemplateData>;

export function WorkflowEditorSaveStateBadge<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
>({ controller }: { controller: ChromeController<TNodeData, TEdgeData, TTemplateData> }) {
  return (
    <Badge
      variant={controller.saveState === "error" ? "outline" : "secondary"}
      data-testid="save-state"
    >
      {formatSaveState(controller.saveState)}
    </Badge>
  );
}

export function WorkflowEditorHistoryControls<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
>({ controller }: { controller: ChromeController<TNodeData, TEdgeData, TTemplateData> }) {
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={controller.readOnly || !canUndoWorkflowEditorHistory(controller.history)}
        onClick={controller.actions.undo}
        aria-label="Undo"
      >
        Undo
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={controller.readOnly || !canRedoWorkflowEditorHistory(controller.history)}
        onClick={controller.actions.redo}
        aria-label="Redo"
      >
        Redo
      </Button>
    </div>
  );
}

export function WorkflowEditorDocumentMenu<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
>({ controller }: { controller: ChromeController<TNodeData, TEdgeData, TTemplateData> }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label="Workflow document"
        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        value={controller.activeEntry?.id ?? ""}
        disabled={controller.readOnly || controller.library.documents.length === 0}
        onChange={(event) => controller.actions.selectDocument(event.target.value)}
      >
        {controller.library.documents.map((entry) => (
          <option key={entry.id} value={entry.id}>
            {entry.name}
          </option>
        ))}
      </select>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={controller.readOnly}
        onClick={controller.actions.createDocument}
      >
        New
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={controller.readOnly || !controller.activeEntry}
        onClick={controller.actions.duplicateDocument}
      >
        Duplicate document
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={
          controller.readOnly || !controller.activeEntry || controller.library.documents.length <= 1
        }
        onClick={controller.actions.deleteDocument}
      >
        Delete document
      </Button>
    </div>
  );
}

export function WorkflowEditorVersionControls<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
>({ controller }: { controller: ChromeController<TNodeData, TEdgeData, TTemplateData> }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={controller.readOnly || !controller.activeEntry}
        onClick={controller.actions.saveVersion}
      >
        Save version
      </Button>
      <select
        aria-label="Saved versions"
        className="h-9 rounded-md border border-input bg-background px-2 text-sm"
        value={controller.selectedVersionId}
        disabled={
          controller.readOnly ||
          !controller.activeEntry ||
          controller.activeEntry.versions.length === 0
        }
        onChange={(event) => controller.actions.setSelectedVersionId(event.target.value)}
      >
        <option value="">No saved versions</option>
        {controller.activeEntry?.versions.map((version) => (
          <option key={version.id} value={version.id}>
            v{version.version} {version.name}
          </option>
        ))}
      </select>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={controller.readOnly || !controller.selectedVersionId}
        onClick={controller.actions.restoreVersion}
      >
        Restore version
      </Button>
    </div>
  );
}

export function WorkflowEditorImportExportControls<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
>({ controller }: { controller: ChromeController<TNodeData, TEdgeData, TTemplateData> }) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        ref={inputRef}
        aria-label="Import workflow JSON"
        className="hidden"
        type="file"
        accept="application/json,.json"
        disabled={controller.readOnly}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) {
            void controller.actions.importDocumentFromFile(file);
          }
        }}
      />
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={controller.readOnly}
        onClick={() => inputRef.current?.click()}
      >
        Import JSON
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!controller.activeEntry}
        onClick={controller.actions.exportDocument}
      >
        Export JSON
      </Button>
    </div>
  );
}

export function WorkflowEditorDocumentControls<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
>({ controller }: { controller: ChromeController<TNodeData, TEdgeData, TTemplateData> }) {
  return (
    <div className="grid gap-3">
      <WorkbenchToolbar className="flex flex-wrap items-center justify-between gap-3 border border-border bg-background px-3 py-2">
        <WorkflowEditorDocumentMenu controller={controller} />
        <WorkflowEditorSaveStateBadge controller={controller} />
      </WorkbenchToolbar>
      <WorkbenchToolbar className="flex flex-wrap items-center justify-between gap-3 border border-border bg-background px-3 py-2">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            aria-label="Document name"
            className="h-9 min-w-48 rounded-md border border-input bg-background px-2 text-sm"
            value={controller.nameDraft}
            disabled={controller.readOnly || !controller.activeEntry}
            onChange={(event) => controller.actions.setNameDraft(event.target.value)}
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={controller.readOnly || !controller.activeEntry}
            onClick={controller.actions.renameDocument}
          >
            Rename
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <WorkflowEditorHistoryControls controller={controller} />
          <WorkflowEditorVersionControls controller={controller} />
          <WorkflowEditorImportExportControls controller={controller} />
        </div>
      </WorkbenchToolbar>
    </div>
  );
}

export function WorkflowEditorCompactMenu<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
>({ controller }: { controller: ChromeController<TNodeData, TEdgeData, TTemplateData> }) {
  return (
    <WorkbenchToolbar className="flex items-center justify-between gap-2 border border-border bg-background px-2 py-1">
      <WorkflowEditorDocumentMenu controller={controller} />
      <div className="flex items-center gap-2">
        <WorkflowEditorHistoryControls controller={controller} />
        <WorkflowEditorSaveStateBadge controller={controller} />
      </div>
    </WorkbenchToolbar>
  );
}

export function WorkflowEditorDocumentPath<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
>({ controller }: { controller: ChromeController<TNodeData, TEdgeData, TTemplateData> }) {
  if (controller.documentPathEntries.length === 0) {
    return null;
  }

  return (
    <WorkbenchToolbar
      className="flex flex-wrap items-center gap-2 border border-border bg-background px-3 py-2"
      aria-label="Workflow path"
    >
      <span className="text-xs text-muted-foreground">Path</span>
      {controller.documentPathEntries.map((item, index) => (
        <Button
          key={`${item.documentId}-${index}`}
          type="button"
          size="sm"
          variant={index === controller.documentPathEntries.length - 1 ? "secondary" : "ghost"}
          disabled={!item.entry || index === controller.documentPathEntries.length - 1}
          onClick={() => controller.actions.selectDocumentPathItem(index)}
        >
          {item.entry?.name ?? `Missing: ${item.documentId}`}
        </Button>
      ))}
    </WorkbenchToolbar>
  );
}

function formatSaveState(state: WorkflowEditorSaveState) {
  switch (state) {
    case "loading":
      return "Loading";
    case "dirty":
      return "Unsaved";
    case "saving":
      return "Saving";
    case "saved":
      return "Saved";
    case "error":
      return "Save error";
    default:
      return state;
  }
}
