import { useRef, useState } from "react";

import { Button } from "@moritzbrantner/ui";

import {
  applyWorkflowEditorBundleImportPlan,
  buildWorkflowEditorBundle,
  parseWorkflowEditorBundle,
  planWorkflowEditorBundleImport,
  stringifyWorkflowEditorBundle,
  workflowEditorBundleCollisionStrategies,
  type WorkflowEditorBundle,
  type WorkflowEditorBundleCollisionStrategy,
  type WorkflowEditorBundleDiagnostic,
  type WorkflowEditorBundleImportPlan,
} from "../bundle";
import {
  downloadWorkflowEditorStoredData,
  type WorkflowEditorLibrary,
  type WorkflowEditorLibraryEntry,
} from "../persistence";

/** A parsed bundle waiting for the user to review its import plan and confirm. */
export type WorkflowEditorBundleImportState<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
> = {
  fileName: string;
  bundle: WorkflowEditorBundle<TNodeData, TEdgeData>;
  plan: WorkflowEditorBundleImportPlan;
  /** Non-blocking parse diagnostics, such as recorded version mismatches. */
  warnings: WorkflowEditorBundleDiagnostic[];
};

/** A rejected bundle export or import with its structured diagnostics. */
export type WorkflowEditorBundleError = {
  operation: "export" | "import";
  diagnostics: WorkflowEditorBundleDiagnostic[];
};

export type WorkflowEditorBundleActions = {
  /** Downloads the active document with its referenced-document closure. */
  exportBundle: () => void;
  /** Parses a bundle file and opens its import plan; the library is unchanged until applied. */
  importBundleFromFile: (file: File) => Promise<void>;
  setBundleImportStrategy: (strategy: WorkflowEditorBundleCollisionStrategy) => void;
  applyBundleImport: () => void;
  cancelBundleImport: () => void;
  dismissBundleError: () => void;
};

export function useWorkflowEditorBundleTransfer<TNodeData, TEdgeData>({
  library,
  activeEntry,
  readOnly,
  onApply,
  onError,
}: {
  library: WorkflowEditorLibrary<TNodeData, TEdgeData>;
  activeEntry: WorkflowEditorLibraryEntry<TNodeData, TEdgeData> | null;
  readOnly: boolean;
  onApply: (
    library: WorkflowEditorLibrary<TNodeData, TEdgeData>,
    plan: WorkflowEditorBundleImportPlan,
  ) => void;
  onError?: (error: Error) => void;
}) {
  const [bundleImport, setBundleImport] = useState<WorkflowEditorBundleImportState<
    TNodeData,
    TEdgeData
  > | null>(null);
  const [bundleError, setBundleError] = useState<WorkflowEditorBundleError | null>(null);

  const reject = (
    operation: WorkflowEditorBundleError["operation"],
    diagnostics: WorkflowEditorBundleDiagnostic[],
  ) => {
    setBundleError({ operation, diagnostics });
    onError?.(new Error(diagnostics[0]?.message ?? `Workflow bundle ${operation} failed`));
  };

  const actions: WorkflowEditorBundleActions = {
    exportBundle: () => {
      if (!activeEntry) {
        return;
      }
      setBundleError(null);
      const result = buildWorkflowEditorBundle(library, activeEntry.id);
      if (!result.ok) {
        reject("export", result.diagnostics);
        return;
      }
      downloadWorkflowEditorStoredData(
        stringifyWorkflowEditorBundle(result.value),
        `${bundleFilename(activeEntry.name)}.bundle.json`,
      );
    },
    importBundleFromFile: async (file) => {
      if (readOnly) {
        return;
      }
      setBundleError(null);
      setBundleImport(null);
      let text: string;
      try {
        text = await readFileText(file);
      } catch (error) {
        reject("import", [
          {
            code: "invalid-json",
            severity: "error",
            message: `Could not read ${file.name}: ${error instanceof Error ? error.message : String(error)}`,
          },
        ]);
        return;
      }
      const result = parseWorkflowEditorBundle<TNodeData, TEdgeData>(text);
      if (!result.ok) {
        reject("import", result.diagnostics);
        return;
      }
      setBundleImport({
        fileName: file.name,
        bundle: result.value,
        // Collisions block until the user explicitly picks a strategy.
        plan: planWorkflowEditorBundleImport(library, result.value, "abort"),
        warnings: result.diagnostics,
      });
    },
    setBundleImportStrategy: (strategy) => {
      setBundleImport((current) =>
        current
          ? { ...current, plan: planWorkflowEditorBundleImport(library, current.bundle, strategy) }
          : current,
      );
    },
    applyBundleImport: () => {
      if (!bundleImport || readOnly) {
        return;
      }
      // Re-plan against the current library in case it changed while the preview was open.
      const plan = planWorkflowEditorBundleImport(
        library,
        bundleImport.bundle,
        bundleImport.plan.strategy,
      );
      if (!plan.canApply) {
        setBundleImport({ ...bundleImport, plan });
        return;
      }
      onApply(applyWorkflowEditorBundleImportPlan(library, bundleImport.bundle, plan), plan);
      setBundleImport(null);
    },
    cancelBundleImport: () => setBundleImport(null),
    dismissBundleError: () => setBundleError(null),
  };

  return { bundleImport, bundleError, actions };
}

function readFileText(file: Blob): Promise<string> {
  if (typeof file.text === "function") {
    return file.text();
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error("File could not be read"));
    reader.readAsText(file);
  });
}

function bundleFilename(value: string) {
  return (
    value
      .trim()
      .replace(/[^a-z0-9._-]+/giu, "-")
      .replace(/^-+|-+$/gu, "") || "workflow"
  );
}

const actionLabels = {
  create: "New",
  reuse: "Keep existing",
  replace: "Replace existing",
  duplicate: "Import as copy",
} as const;

const strategyLabels: Record<WorkflowEditorBundleCollisionStrategy, string> = {
  abort: "Choose a strategy…",
  reuse: "Keep existing workflows",
  replace: "Replace existing workflows",
  duplicate: "Import colliding workflows as copies",
};

type BundleController = {
  readOnly: boolean;
  bundleImport: WorkflowEditorBundleImportState<unknown, unknown> | null;
  bundleError: WorkflowEditorBundleError | null;
  actions: Pick<
    WorkflowEditorBundleActions,
    "setBundleImportStrategy" | "applyBundleImport" | "cancelBundleImport" | "dismissBundleError"
  >;
};

/** Shows a rejected bundle transfer or the pending bundle import plan for confirmation. */
export function WorkflowEditorBundleTransferStatus({
  controller,
}: {
  controller: BundleController;
}) {
  const { bundleImport, bundleError } = controller;

  return (
    <>
      {bundleError ? (
        <div
          role="alert"
          className="flex basis-full items-start justify-between gap-2 rounded-md border border-destructive/40 bg-destructive/5 px-2 py-1.5 text-xs text-destructive"
        >
          <div className="min-w-0 [overflow-wrap:anywhere]">
            <strong className="font-semibold">
              Bundle {bundleError.operation === "export" ? "export" : "import"} rejected:
            </strong>
            <ul className="list-disc pl-4">
              {bundleError.diagnostics.map((diagnostic, index) => (
                <li key={index}>{diagnostic.message}</li>
              ))}
            </ul>
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-6 flex-none px-2 text-xs"
            onClick={controller.actions.dismissBundleError}
          >
            Dismiss
          </Button>
        </div>
      ) : null}
      {bundleImport ? <BundleImportPlan controller={controller} state={bundleImport} /> : null}
    </>
  );
}

function BundleImportPlan({
  controller,
  state,
}: {
  controller: BundleController;
  state: WorkflowEditorBundleImportState<unknown, unknown>;
}) {
  const { plan } = state;
  const hasCollisions = plan.items.some((item) => item.collision);
  const diagnostics = [...state.warnings, ...plan.diagnostics];

  return (
    <section
      aria-label="Bundle import"
      className="flex basis-full flex-col gap-2 rounded-md border border-border bg-muted/30 px-2 py-1.5 text-xs"
    >
      <strong className="font-semibold [overflow-wrap:anywhere]">
        Import bundle {state.fileName} ({plan.items.length} workflows)
      </strong>
      <ul className="grid gap-0.5">
        {plan.items.map((item) => (
          <li key={item.sourceDocumentId} className="flex flex-wrap justify-between gap-2">
            <span className="min-w-0 [overflow-wrap:anywhere]">
              {item.name}
              {item.sourceDocumentId === state.bundle.rootDocumentId ? " (root)" : ""}
            </span>
            <span className="text-muted-foreground">
              {item.collision && plan.strategy === "abort"
                ? "Already in library"
                : actionLabels[item.action]}
              {item.action === "duplicate" ? ` → ${item.targetDocumentId}` : ""}
            </span>
          </li>
        ))}
      </ul>
      {hasCollisions ? (
        <label className="grid gap-1">
          <span>Workflows already in the library</span>
          <select
            aria-label="Collision strategy"
            className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            value={plan.strategy}
            onChange={(event) =>
              controller.actions.setBundleImportStrategy(
                event.target.value as WorkflowEditorBundleCollisionStrategy,
              )
            }
          >
            {workflowEditorBundleCollisionStrategies.map((strategy) => (
              <option key={strategy} value={strategy} disabled={strategy === "abort"}>
                {strategyLabels[strategy]}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {diagnostics.length > 0 ? (
        <ul className="list-disc pl-4">
          {diagnostics.map((diagnostic, index) => (
            <li
              key={index}
              className={diagnostic.severity === "error" ? "text-destructive" : "text-amber-700"}
            >
              {diagnostic.message}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          className="h-7 px-2 text-xs"
          disabled={controller.readOnly || !plan.canApply}
          onClick={controller.actions.applyBundleImport}
        >
          Confirm import
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs"
          onClick={controller.actions.cancelBundleImport}
        >
          Cancel
        </Button>
      </div>
    </section>
  );
}

/** "Import bundle" and "Export bundle" buttons with their hidden file input. */
export function WorkflowEditorBundleTransferButtons({
  controller,
}: {
  controller: {
    readOnly: boolean;
    activeEntry: unknown;
    actions: Pick<WorkflowEditorBundleActions, "exportBundle" | "importBundleFromFile">;
  };
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <>
      <input
        ref={inputRef}
        aria-label="Import workflow bundle"
        className="hidden"
        type="file"
        accept="application/json,.json"
        disabled={controller.readOnly}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) {
            void controller.actions.importBundleFromFile(file);
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
        Import bundle
      </Button>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={!controller.activeEntry}
        onClick={controller.actions.exportBundle}
      >
        Export bundle
      </Button>
    </>
  );
}
