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
    <>
      <Badge
        variant={controller.saveState === "error" ? "outline" : "secondary"}
        data-testid="save-state"
      >
        {formatSaveState(controller.saveState)}
      </Badge>
      <WorkflowEditorImportErrorAlert controller={controller} />
      <WorkflowEditorStorageRecoveryAlert controller={controller} />
      <WorkflowEditorDocumentProblems controller={controller} />
    </>
  );
}

/**
 * Lists problems the active document keeps under the library validation policy (dangling, self and
 * unknown-port edges). Nothing is removed until the user explicitly repairs the document.
 */
export function WorkflowEditorDocumentProblems({
  controller,
}: {
  controller: Pick<WorkflowEditorController, "documentProblems" | "readOnly"> & {
    actions: Pick<WorkflowEditorController["actions"], "repairDocument">;
  };
}) {
  if (controller.documentProblems.length === 0) {
    return null;
  }

  return (
    <section
      aria-label="Document problems"
      className="flex basis-full flex-col gap-1 rounded-md border border-amber-500/50 bg-amber-500/5 px-2 py-1.5 text-xs"
    >
      <div className="flex items-center justify-between gap-2">
        <strong className="font-semibold">Document problems</strong>
        {controller.readOnly ? null : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-6 flex-none px-2 text-xs"
            onClick={controller.actions.repairDocument}
          >
            Repair document
          </Button>
        )}
      </div>
      <ul className="list-disc pl-4 [overflow-wrap:anywhere]">
        {controller.documentProblems.map((diagnostic, index) => (
          <li key={`${diagnostic.code}:${diagnostic.edgeId ?? diagnostic.path}:${index}`}>
            {diagnostic.edgeId ? `Edge ${diagnostic.edgeId}: ` : null}
            {diagnostic.message}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Explains why the last import was rejected; the rejected file never reaches the library. */
export function WorkflowEditorImportErrorAlert({
  controller,
}: {
  controller: Pick<WorkflowEditorController, "importError"> & {
    actions: Pick<WorkflowEditorController["actions"], "dismissImportError">;
  };
}) {
  if (!controller.importError) {
    return null;
  }

  return (
    <div
      role="alert"
      className="flex basis-full items-start justify-between gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-2 py-1.5 text-xs text-destructive"
    >
      <p className="min-w-0 [overflow-wrap:anywhere]">
        <strong className="font-semibold">Import rejected:</strong> {controller.importError}
      </p>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className="h-6 flex-none px-2 text-xs"
        onClick={controller.actions.dismissImportError}
      >
        Dismiss
      </Button>
    </div>
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

/**
 * Shown when the saved library could not be loaded. The stored data stays untouched until the user
 * downloads it, restores the last-known-good backup, or explicitly discards it.
 */
export function WorkflowEditorStorageRecoveryAlert({
  controller,
}: {
  controller: Pick<WorkflowEditorController, "storageRecovery" | "readOnly"> & {
    actions: Pick<
      WorkflowEditorController["actions"],
      "downloadStoredLibrary" | "discardStoredLibrary" | "restoreBackupLibrary"
    >;
  };
}) {
  const recovery = controller.storageRecovery;
  if (!recovery) {
    return null;
  }

  return (
    <section
      role="alert"
      aria-label="Saved library could not be loaded"
      className="flex basis-full flex-col gap-1 rounded-md border border-destructive/40 bg-destructive/5 px-2 py-1.5 text-xs"
    >
      <strong className="font-semibold text-destructive">Saved library could not be loaded</strong>
      <ul className="list-disc pl-4 [overflow-wrap:anywhere]">
        {recovery.diagnostics.map((diagnostic) => (
          <li key={`${diagnostic.code}:${diagnostic.path ?? ""}:${diagnostic.message}`}>
            {diagnostic.message}
          </li>
        ))}
      </ul>
      <p className="text-muted-foreground">
        The editor opened its defaults. Your saved data is kept until you choose what to do.
      </p>
      <div className="flex flex-wrap gap-2">
        {recovery.raw ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-6 px-2 text-xs"
            onClick={controller.actions.downloadStoredLibrary}
          >
            Download saved data
          </Button>
        ) : null}
        {recovery.backupAvailable && !controller.readOnly ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-6 px-2 text-xs"
            onClick={() => void controller.actions.restoreBackupLibrary()}
          >
            Restore backup
          </Button>
        ) : null}
        {controller.readOnly ? null : (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-6 px-2 text-xs"
            onClick={controller.actions.discardStoredLibrary}
          >
            Discard and start fresh
          </Button>
        )}
      </div>
    </section>
  );
}
