import type { WorkflowEditorInputProfile } from "./core-workflow-inputs";
import {
  assertWorkflowEditorDocument,
  normalizeWorkflowEditorDocument,
  workflowEditorValidationPolicies,
  type WorkflowEditorDocument,
  type WorkflowEditorWorkflowReference,
} from "./core";

export const workflowEditorDocumentFormat = "@moritzbrantner/workflow-editor/document";
export const workflowEditorLibraryFormat = "@moritzbrantner/workflow-editor/library";
export const workflowEditorDocumentFileVersion = 1;
export const workflowEditorLibraryVersion = 1;
export const defaultWorkflowEditorMaxVersions = 20;
export const defaultWorkflowEditorStorageKey = "moritzbrantner.workflow-editor.library.v1";

/**
 * Library entries, saved versions and imported files are user documents: they validate with the
 * `import` policy, so allowed problems (dangling, self and unknown-port edges) are kept as warnings
 * instead of being dropped, while cycles and structural errors still fail closed.
 */
const libraryValidation = { policy: workflowEditorValidationPolicies.import };

export type WorkflowEditorDocumentFile<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
> = {
  format: typeof workflowEditorDocumentFormat;
  version: typeof workflowEditorDocumentFileVersion;
  exportedAt: string;
  documentId?: string;
  documentName?: string;
  documentVersion?: number;
  document: WorkflowEditorDocument<TNodeData, TEdgeData>;
};

export type WorkflowEditorSavedVersion<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
> = {
  id: string;
  version: number;
  name: string;
  createdAt: string;
  document: WorkflowEditorDocument<TNodeData, TEdgeData>;
};

export type WorkflowEditorLibraryEntry<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
> = {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
  version: number;
  document: WorkflowEditorDocument<TNodeData, TEdgeData>;
  versions: Array<WorkflowEditorSavedVersion<TNodeData, TEdgeData>>;
  /** Named reusable input values (#115); kept beside, never inside, the document. */
  inputProfiles?: WorkflowEditorInputProfile[];
};

export type WorkflowEditorLibrary<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
> = {
  format: typeof workflowEditorLibraryFormat;
  version: typeof workflowEditorLibraryVersion;
  activeDocumentId: string | null;
  documents: Array<WorkflowEditorLibraryEntry<TNodeData, TEdgeData>>;
};

export type WorkflowEditorDocumentReferenceOption = {
  id: string;
  name: string;
  missing?: boolean;
};

export type WorkflowEditorReferenceDiagnostic = {
  type: "missing-document" | "recursive-reference";
  sourceDocumentId: string;
  sourceNodeId: string;
  targetDocumentId: string;
  path: string[];
};

export type WorkflowEditorStorageDiagnosticCode =
  | "storage-unavailable"
  | "invalid-json"
  | "invalid-format"
  | "invalid-entry"
  | "unsupported-future-version"
  | "serialization-failed"
  | "quota-exceeded"
  | "write-failed";

export type WorkflowEditorStorageDiagnostic = {
  code: WorkflowEditorStorageDiagnosticCode;
  message: string;
  /** JSON path into the stored payload, when the problem has one. */
  path?: string;
};

/**
 * Outcome of reading a stored library. Unreadable payloads keep their raw text so it can be
 * exported; nothing is discarded silently. A `migrated` outcome joins when schema version 2 exists.
 */
export type WorkflowEditorLibraryLoadResult<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
> =
  | { status: "loaded"; library: WorkflowEditorLibrary<TNodeData, TEdgeData> }
  | { status: "empty" }
  | {
      status: "recoverable-error";
      raw: string;
      diagnostics: WorkflowEditorStorageDiagnostic[];
    }
  | {
      status: "unsupported-future-version";
      raw: string;
      version: number;
      diagnostics: WorkflowEditorStorageDiagnostic[];
    };

/** A failed library write with a structured diagnostic. */
export class WorkflowEditorStorageError extends Error {
  override name = "WorkflowEditorStorageError" as const;
  diagnostic: WorkflowEditorStorageDiagnostic;

  constructor(diagnostic: WorkflowEditorStorageDiagnostic, options?: { cause?: unknown }) {
    super(diagnostic.message, options);
    this.diagnostic = diagnostic;
  }
}

export type WorkflowEditorStorageAdapter<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
> = {
  loadLibrary(): Promise<WorkflowEditorLibraryLoadResult<TNodeData, TEdgeData>>;
  /** Replaces the stored library; throws `WorkflowEditorStorageError` on failure. */
  saveLibrary(library: WorkflowEditorLibrary<TNodeData, TEdgeData>): Promise<void>;
  /** The last-known-good library kept before the most recent replacement, if supported. */
  loadBackup?(): Promise<WorkflowEditorLibraryLoadResult<TNodeData, TEdgeData>>;
};

export type WorkflowEditorEntryInput<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
> = {
  id?: string;
  name?: string;
  description?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  version?: number;
  document?: WorkflowEditorDocument<TNodeData, TEdgeData>;
  versions?: Array<WorkflowEditorSavedVersion<TNodeData, TEdgeData>>;
  inputProfiles?: WorkflowEditorInputProfile[];
};

export type WorkflowEditorLibraryInput<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
> = {
  activeDocumentId?: string | null;
  documents?: Array<WorkflowEditorLibraryEntry<TNodeData, TEdgeData>>;
};

export type WorkflowEditorRestoredDocumentFile<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
> = {
  exportedAt: string;
  documentId?: string;
  documentName?: string;
  documentVersion?: number;
  document: WorkflowEditorDocument<TNodeData, TEdgeData>;
};

export function createBlankWorkflowEditorDocument<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(): WorkflowEditorDocument<TNodeData, TEdgeData> {
  return {
    nodes: [],
    edges: [],
  };
}

export function createWorkflowEditorEntry<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  input: WorkflowEditorEntryInput<TNodeData, TEdgeData> = {},
): WorkflowEditorLibraryEntry<TNodeData, TEdgeData> {
  const now = new Date().toISOString();
  const document = normalizeWorkflowEditorDocument(
    input.document ?? createBlankWorkflowEditorDocument<TNodeData, TEdgeData>(),
    libraryValidation,
  ).document;
  const entry: WorkflowEditorLibraryEntry<TNodeData, TEdgeData> = {
    id: input.id ?? createWorkflowEditorId("workflow"),
    name: input.name?.trim() || "Untitled Workflow",
    createdAt: input.createdAt ?? now,
    updatedAt: input.updatedAt ?? input.createdAt ?? now,
    version: Math.max(1, Math.trunc(input.version ?? 1)),
    document,
    versions: [],
  };

  if (input.description) {
    entry.description = input.description;
  }

  if (input.tags) {
    entry.tags = [...input.tags];
  }

  entry.versions = compactSavedVersions(input.versions ?? [], defaultWorkflowEditorMaxVersions);
  const inputProfiles = normalizeWorkflowEditorInputProfiles(input.inputProfiles);
  if (inputProfiles.length > 0) {
    entry.inputProfiles = inputProfiles;
  }
  return entry;
}

export function createWorkflowEditorLibrary<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  input: WorkflowEditorLibraryInput<TNodeData, TEdgeData> = {},
): WorkflowEditorLibrary<TNodeData, TEdgeData> {
  const documents = input.documents?.length
    ? input.documents.map((entry) => normalizeWorkflowEditorEntry(entry))
    : [createWorkflowEditorEntry<TNodeData, TEdgeData>()];
  const activeDocumentId =
    input.activeDocumentId && documents.some((entry) => entry.id === input.activeDocumentId)
      ? input.activeDocumentId
      : (documents[0]?.id ?? null);

  return {
    format: workflowEditorLibraryFormat,
    version: workflowEditorLibraryVersion,
    activeDocumentId,
    documents,
  };
}

export function activeWorkflowEditorEntry<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  library: WorkflowEditorLibrary<TNodeData, TEdgeData>,
): WorkflowEditorLibraryEntry<TNodeData, TEdgeData> | null {
  return (
    library.documents.find((entry) => entry.id === library.activeDocumentId) ??
    library.documents[0] ??
    null
  );
}

export function resolveWorkflowEditorDocumentReference<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  library: WorkflowEditorLibrary<TNodeData, TEdgeData>,
  reference: WorkflowEditorWorkflowReference | null | undefined,
): WorkflowEditorLibraryEntry<TNodeData, TEdgeData> | null {
  if (!reference?.documentId) {
    return null;
  }

  return library.documents.find((entry) => entry.id === reference.documentId) ?? null;
}

export function listWorkflowEditorDocumentReferenceOptions<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(library: WorkflowEditorLibrary<TNodeData, TEdgeData>): WorkflowEditorDocumentReferenceOption[] {
  return library.documents.map((entry) => ({ id: entry.id, name: entry.name }));
}

export function getWorkflowEditorReferenceDiagnostics<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  library: WorkflowEditorLibrary<TNodeData, TEdgeData>,
  options: { includeRecursive?: boolean; maxDepth?: number } = {},
): WorkflowEditorReferenceDiagnostic[] {
  const documents = new Map(library.documents.map((entry) => [entry.id, entry]));
  const diagnostics: WorkflowEditorReferenceDiagnostic[] = [];
  const maxDepth = Math.max(1, Math.trunc(options.maxDepth ?? 64));

  for (const entry of library.documents) {
    for (const node of entry.document.nodes) {
      const targetDocumentId = node.workflowRef?.documentId;
      if (!targetDocumentId) {
        continue;
      }

      if (!documents.has(targetDocumentId)) {
        diagnostics.push({
          type: "missing-document",
          sourceDocumentId: entry.id,
          sourceNodeId: node.id,
          targetDocumentId,
          path: [entry.id, targetDocumentId],
        });
        continue;
      }

      if (options.includeRecursive) {
        collectRecursiveReferenceDiagnostics({
          documents,
          diagnostics,
          sourceDocumentId: entry.id,
          sourceNodeId: node.id,
          targetDocumentId,
          path: [entry.id, targetDocumentId],
          maxDepth,
        });
      }
    }
  }

  return diagnostics;
}

export function upsertWorkflowEditorEntry<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  library: WorkflowEditorLibrary<TNodeData, TEdgeData>,
  entry: WorkflowEditorLibraryEntry<TNodeData, TEdgeData>,
  options: { activate?: boolean } = {},
): WorkflowEditorLibrary<TNodeData, TEdgeData> {
  const normalizedEntry = normalizeWorkflowEditorEntry(entry);
  const existing = library.documents.some((candidate) => candidate.id === normalizedEntry.id);
  const documents = existing
    ? library.documents.map((candidate) =>
        candidate.id === normalizedEntry.id ? normalizedEntry : candidate,
      )
    : [normalizedEntry, ...library.documents];

  return createWorkflowEditorLibrary({
    activeDocumentId:
      options.activate || !library.activeDocumentId ? normalizedEntry.id : library.activeDocumentId,
    documents,
  });
}

export function removeWorkflowEditorEntry<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  library: WorkflowEditorLibrary<TNodeData, TEdgeData>,
  documentId: string,
): WorkflowEditorLibrary<TNodeData, TEdgeData> {
  const documents = library.documents.filter((entry) => entry.id !== documentId);
  const activeDocumentId =
    library.activeDocumentId === documentId ? (documents[0]?.id ?? null) : library.activeDocumentId;

  return createWorkflowEditorLibrary({
    activeDocumentId,
    documents,
  });
}

export function renameWorkflowEditorEntry<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  library: WorkflowEditorLibrary<TNodeData, TEdgeData>,
  documentId: string,
  name: string,
): WorkflowEditorLibrary<TNodeData, TEdgeData> {
  const nextName = name.trim() || "Untitled Workflow";
  const updatedAt = new Date().toISOString();
  return createWorkflowEditorLibrary({
    activeDocumentId: library.activeDocumentId,
    documents: library.documents.map((entry) =>
      entry.id === documentId ? { ...entry, name: nextName, updatedAt } : entry,
    ),
  });
}

export function duplicateWorkflowEditorEntry<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  library: WorkflowEditorLibrary<TNodeData, TEdgeData>,
  documentId: string,
  options: { name?: string; activate?: boolean } = {},
): WorkflowEditorLibrary<TNodeData, TEdgeData> {
  const source = library.documents.find((entry) => entry.id === documentId);
  if (!source) {
    return library;
  }

  const duplicate = createWorkflowEditorEntry<TNodeData, TEdgeData>({
    name: options.name ?? `${source.name} Copy`,
    description: source.description,
    tags: source.tags,
    document: source.document,
    versions: source.versions,
  });

  return upsertWorkflowEditorEntry(library, duplicate, { activate: options.activate ?? true });
}

export function createWorkflowEditorVersion<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  entry: WorkflowEditorLibraryEntry<TNodeData, TEdgeData>,
  options: {
    name?: string;
    createdAt?: string;
    maxVersions?: number;
  } = {},
): WorkflowEditorLibraryEntry<TNodeData, TEdgeData> {
  const createdAt = options.createdAt ?? new Date().toISOString();
  const versionNumber = nextWorkflowEditorVersionNumber(entry);
  const version: WorkflowEditorSavedVersion<TNodeData, TEdgeData> = {
    id: createWorkflowEditorId("version"),
    version: versionNumber,
    name: options.name?.trim() || entry.name,
    createdAt,
    document: normalizeWorkflowEditorDocument(entry.document, libraryValidation).document,
  };

  return compactWorkflowEditorVersions(
    {
      ...entry,
      version: versionNumber,
      updatedAt: createdAt,
      versions: [version, ...entry.versions],
    },
    options.maxVersions,
  );
}

export function restoreWorkflowEditorVersion<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  entry: WorkflowEditorLibraryEntry<TNodeData, TEdgeData>,
  versionIdOrNumber: string | number,
): WorkflowEditorLibraryEntry<TNodeData, TEdgeData> {
  const version = entry.versions.find((candidate) =>
    typeof versionIdOrNumber === "number"
      ? candidate.version === versionIdOrNumber
      : candidate.id === versionIdOrNumber,
  );

  if (!version) {
    return entry;
  }

  return {
    ...entry,
    version: version.version,
    updatedAt: new Date().toISOString(),
    document: normalizeWorkflowEditorDocument(version.document, libraryValidation).document,
  };
}

export function compactWorkflowEditorVersions<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  entry: WorkflowEditorLibraryEntry<TNodeData, TEdgeData>,
  maxVersions = defaultWorkflowEditorMaxVersions,
): WorkflowEditorLibraryEntry<TNodeData, TEdgeData> {
  return {
    ...entry,
    versions: compactSavedVersions(entry.versions, maxVersions),
  };
}

export function buildWorkflowEditorDocumentFile<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  options: {
    documentId?: string;
    documentName?: string;
    documentVersion?: number;
    exportedAt?: string;
  } = {},
): WorkflowEditorDocumentFile<TNodeData, TEdgeData> {
  const file: WorkflowEditorDocumentFile<TNodeData, TEdgeData> = {
    format: workflowEditorDocumentFormat,
    version: workflowEditorDocumentFileVersion,
    exportedAt: options.exportedAt ?? new Date().toISOString(),
    document: normalizeWorkflowEditorDocument(document, libraryValidation).document,
  };

  if (options.documentId) {
    file.documentId = options.documentId;
  }

  if (options.documentName) {
    file.documentName = options.documentName;
  }

  if (typeof options.documentVersion === "number") {
    file.documentVersion = options.documentVersion;
  }

  return file;
}

export function buildWorkflowEditorDocumentFileFromEntry<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  entry: WorkflowEditorLibraryEntry<TNodeData, TEdgeData>,
  options: { exportedAt?: string } = {},
): WorkflowEditorDocumentFile<TNodeData, TEdgeData> {
  return buildWorkflowEditorDocumentFile(entry.document, {
    documentId: entry.id,
    documentName: entry.name,
    documentVersion: entry.version,
    exportedAt: options.exportedAt,
  });
}

export function parseWorkflowEditorDocumentFile<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(text: string): WorkflowEditorDocumentFile<TNodeData, TEdgeData> {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Invalid workflow document JSON");
  }

  if (!isRecord(parsed)) {
    throw new Error("JSON does not match the workflow document format");
  }

  if (parsed.format !== workflowEditorDocumentFormat) {
    throw new Error("JSON is not a workflow document file");
  }

  if (parsed.version !== workflowEditorDocumentFileVersion) {
    throw new Error(`Unsupported workflow document version ${String(parsed.version)}`);
  }

  assertWorkflowEditorDocument<TNodeData, TEdgeData>(parsed.document, libraryValidation);

  return {
    format: workflowEditorDocumentFormat,
    version: workflowEditorDocumentFileVersion,
    exportedAt:
      typeof parsed.exportedAt === "string" ? parsed.exportedAt : new Date().toISOString(),
    documentId: typeof parsed.documentId === "string" ? parsed.documentId : undefined,
    documentName: typeof parsed.documentName === "string" ? parsed.documentName : undefined,
    documentVersion:
      typeof parsed.documentVersion === "number" ? parsed.documentVersion : undefined,
    document: normalizeWorkflowEditorDocument(parsed.document, libraryValidation).document,
  };
}

export function restoreWorkflowEditorDocumentFile<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  file: WorkflowEditorDocumentFile<TNodeData, TEdgeData>,
): WorkflowEditorRestoredDocumentFile<TNodeData, TEdgeData> {
  if (file.format !== workflowEditorDocumentFormat) {
    throw new Error("JSON is not a workflow document file");
  }

  if (file.version !== workflowEditorDocumentFileVersion) {
    throw new Error(`Unsupported workflow document version ${String(file.version)}`);
  }

  assertWorkflowEditorDocument<TNodeData, TEdgeData>(file.document, libraryValidation);

  return {
    exportedAt: file.exportedAt,
    documentId: file.documentId,
    documentName: file.documentName,
    documentVersion: file.documentVersion,
    document: normalizeWorkflowEditorDocument(file.document, libraryValidation).document,
  };
}

export function downloadWorkflowEditorDocumentJson<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  filename = "workflow-document.json",
  options: Parameters<typeof buildWorkflowEditorDocumentFile<TNodeData, TEdgeData>>[1] = {},
) {
  if (typeof window === "undefined" || typeof globalThis.document === "undefined") {
    return;
  }

  const file = buildWorkflowEditorDocumentFile(document, options);
  const blob = new Blob([`${JSON.stringify(file, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = globalThis.document.createElement("a");
  anchor.href = url;
  anchor.download = ensureJsonFilename(filename);
  globalThis.document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

/** Downloads raw stored library data (for example an unreadable payload) for manual recovery. */
export function downloadWorkflowEditorStoredData(
  raw: string,
  filename = "workflow-library-recovery.json",
) {
  if (typeof window === "undefined" || typeof globalThis.document === "undefined") {
    return;
  }
  const url = URL.createObjectURL(new Blob([raw], { type: "application/json" }));
  const anchor = globalThis.document.createElement("a");
  anchor.href = url;
  anchor.download = ensureJsonFilename(filename);
  globalThis.document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export async function readWorkflowEditorDocumentFile<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(file: Blob): Promise<WorkflowEditorRestoredDocumentFile<TNodeData, TEdgeData>> {
  return restoreWorkflowEditorDocumentFile(parseWorkflowEditorDocumentFile(await file.text()));
}

export function createLocalStorageWorkflowEditorStorage<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  storageKey = defaultWorkflowEditorStorageKey,
): WorkflowEditorStorageAdapter<TNodeData, TEdgeData> {
  const backupKey = `${storageKey}.backup`;
  const read = (key: string): WorkflowEditorLibraryLoadResult<TNodeData, TEdgeData> => {
    if (typeof window === "undefined") {
      return { status: "empty" };
    }
    let raw: string | null;
    try {
      raw = window.localStorage.getItem(key);
    } catch (error) {
      return {
        status: "recoverable-error",
        raw: "",
        diagnostics: [
          {
            code: "storage-unavailable",
            message: `Browser storage is unavailable: ${errorMessage(error)}`,
          },
        ],
      };
    }
    return raw === null ? { status: "empty" } : parseWorkflowEditorLibrary(raw);
  };

  return {
    async loadLibrary() {
      return read(storageKey);
    },
    async loadBackup() {
      return read(backupKey);
    },
    async saveLibrary(library) {
      if (typeof window === "undefined") {
        return;
      }
      let json: string;
      try {
        json = JSON.stringify(createWorkflowEditorLibrary(library));
      } catch (error) {
        throw new WorkflowEditorStorageError(
          {
            code: "serialization-failed",
            message: `Workflow library could not be serialized: ${errorMessage(error)}`,
          },
          { cause: error },
        );
      }
      try {
        // Keep the replaced library as the last-known-good backup; never back up unreadable data.
        const current = window.localStorage.getItem(storageKey);
        if (
          current !== null &&
          current !== json &&
          parseWorkflowEditorLibrary(current).status === "loaded"
        ) {
          window.localStorage.setItem(backupKey, current);
        }
        window.localStorage.setItem(storageKey, json);
      } catch (error) {
        // DOMException is not an Error subclass in every environment; match by name.
        const name =
          typeof error === "object" && error !== null && "name" in error ? String(error.name) : "";
        throw new WorkflowEditorStorageError(
          name === "QuotaExceededError"
            ? {
                code: "quota-exceeded",
                message: "Browser storage is full; the library was not saved.",
              }
            : name === "SecurityError"
              ? {
                  code: "storage-unavailable",
                  message: "Browser storage is not permitted; the library was not saved.",
                }
              : {
                  code: "write-failed",
                  message: `Workflow library could not be saved: ${errorMessage(error)}`,
                },
          { cause: error },
        );
      }
    },
  };
}

/** Parses a stored library payload into a load outcome without discarding unreadable data. */
export function parseWorkflowEditorLibrary<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(raw: string): WorkflowEditorLibraryLoadResult<TNodeData, TEdgeData> {
  const recoverable = (
    diagnostics: WorkflowEditorStorageDiagnostic[],
  ): WorkflowEditorLibraryLoadResult<TNodeData, TEdgeData> => ({
    status: "recoverable-error",
    raw,
    diagnostics,
  });
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch (error) {
    return recoverable([
      { code: "invalid-json", message: `Saved library is not valid JSON: ${errorMessage(error)}` },
    ]);
  }
  if (!isRecord(value) || value.format !== workflowEditorLibraryFormat) {
    return recoverable([
      {
        code: "invalid-format",
        message: "Saved data is not a workflow library.",
        path: "$.format",
      },
    ]);
  }
  if (typeof value.version === "number" && value.version > workflowEditorLibraryVersion) {
    return {
      status: "unsupported-future-version",
      raw,
      version: value.version,
      diagnostics: [
        {
          code: "unsupported-future-version",
          message: `Saved library uses version ${value.version}; this editor supports version ${workflowEditorLibraryVersion}.`,
          path: "$.version",
        },
      ],
    };
  }
  // Migration hook: older versions are migrated here once a real version 2 exists.
  if (value.version !== workflowEditorLibraryVersion) {
    return recoverable([
      {
        code: "invalid-format",
        message: `Saved library has an unknown version ${String(value.version)}.`,
        path: "$.version",
      },
    ]);
  }
  if (!Array.isArray(value.documents)) {
    return recoverable([
      {
        code: "invalid-format",
        message: "Saved library has no document list.",
        path: "$.documents",
      },
    ]);
  }
  const diagnostics: WorkflowEditorStorageDiagnostic[] = [];
  const documents = value.documents.flatMap((entry, index) => {
    const restored = restoreWorkflowEditorEntry<TNodeData, TEdgeData>(entry);
    if (!restored) {
      diagnostics.push({
        code: "invalid-entry",
        message: `Saved document ${
          isRecord(entry) && typeof entry.name === "string" ? `"${entry.name}"` : index + 1
        } could not be read.`,
        path: `$.documents[${index}]`,
      });
      return [];
    }
    return [restored];
  });
  if (diagnostics.length > 0) {
    return recoverable(diagnostics);
  }
  return {
    status: "loaded",
    library: createWorkflowEditorLibrary({
      activeDocumentId: typeof value.activeDocumentId === "string" ? value.activeDocumentId : null,
      documents,
    }),
  };
}

export async function loadWorkflowEditorLibrary<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  storage: WorkflowEditorStorageAdapter<TNodeData, TEdgeData>,
): Promise<WorkflowEditorLibraryLoadResult<TNodeData, TEdgeData>> {
  try {
    const result = await storage.loadLibrary();
    return result.status === "loaded"
      ? { status: "loaded", library: createWorkflowEditorLibrary(result.library) }
      : result;
  } catch (error) {
    return {
      status: "recoverable-error",
      raw: "",
      diagnostics: [
        {
          code: "storage-unavailable",
          message: `Workflow library could not be read: ${errorMessage(error)}`,
        },
      ],
    };
  }
}

export async function saveWorkflowEditorLibrary<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  storage: WorkflowEditorStorageAdapter<TNodeData, TEdgeData>,
  library: WorkflowEditorLibrary<TNodeData, TEdgeData>,
): Promise<void> {
  await storage.saveLibrary(createWorkflowEditorLibrary(library));
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function normalizeWorkflowEditorEntry<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  entry: WorkflowEditorLibraryEntry<TNodeData, TEdgeData>,
): WorkflowEditorLibraryEntry<TNodeData, TEdgeData> {
  return {
    ...entry,
    name: entry.name.trim() || "Untitled Workflow",
    version: Math.max(1, Math.trunc(entry.version)),
    document: normalizeWorkflowEditorDocument(entry.document, libraryValidation).document,
    versions: compactSavedVersions(entry.versions ?? [], defaultWorkflowEditorMaxVersions),
  };
}

function restoreWorkflowEditorEntry<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(value: unknown): WorkflowEditorLibraryEntry<TNodeData, TEdgeData> | null {
  if (!isRecord(value)) {
    return null;
  }

  try {
    assertWorkflowEditorDocument<TNodeData, TEdgeData>(value.document, libraryValidation);
  } catch {
    return null;
  }

  const now = new Date().toISOString();
  const id =
    typeof value.id === "string" && value.id.trim() ? value.id : createWorkflowEditorId("workflow");
  const name =
    typeof value.name === "string" && value.name.trim() ? value.name : "Untitled Workflow";
  const createdAt = typeof value.createdAt === "string" ? value.createdAt : now;
  const updatedAt = typeof value.updatedAt === "string" ? value.updatedAt : createdAt;
  const version = typeof value.version === "number" ? value.version : 1;
  const versions = Array.isArray(value.versions)
    ? value.versions
        .map((candidate) => restoreWorkflowEditorSavedVersion<TNodeData, TEdgeData>(candidate))
        .filter(
          (candidate): candidate is WorkflowEditorSavedVersion<TNodeData, TEdgeData> =>
            candidate !== null,
        )
    : [];

  return createWorkflowEditorEntry({
    id,
    name,
    createdAt,
    updatedAt,
    version,
    description: typeof value.description === "string" ? value.description : undefined,
    tags: Array.isArray(value.tags)
      ? value.tags.filter((tag): tag is string => typeof tag === "string")
      : undefined,
    document: value.document as WorkflowEditorDocument<TNodeData, TEdgeData>,
    versions,
    inputProfiles: normalizeWorkflowEditorInputProfiles(value.inputProfiles),
  });
}

/** Keeps well-formed, uniquely identified profiles with JSON-object values. */
function normalizeWorkflowEditorInputProfiles(value: unknown): WorkflowEditorInputProfile[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.flatMap((profile) => {
    if (
      !isRecord(profile) ||
      typeof profile.id !== "string" ||
      !profile.id ||
      seen.has(profile.id) ||
      typeof profile.name !== "string" ||
      !isRecord(profile.values)
    ) {
      return [];
    }
    seen.add(profile.id);
    return [{ id: profile.id, name: profile.name.trim() || "Untitled profile", values: { ...profile.values } }];
  });
}

/** Adds or replaces a named input profile on a library entry. */
export function upsertWorkflowEditorInputProfile<TNodeData, TEdgeData>(
  entry: WorkflowEditorLibraryEntry<TNodeData, TEdgeData>,
  profile: WorkflowEditorInputProfile,
): WorkflowEditorLibraryEntry<TNodeData, TEdgeData> {
  const profiles = entry.inputProfiles ?? [];
  const next = profiles.some((candidate) => candidate.id === profile.id)
    ? profiles.map((candidate) => (candidate.id === profile.id ? profile : candidate))
    : [...profiles, profile];
  return { ...entry, inputProfiles: normalizeWorkflowEditorInputProfiles(next) };
}

export function removeWorkflowEditorInputProfile<TNodeData, TEdgeData>(
  entry: WorkflowEditorLibraryEntry<TNodeData, TEdgeData>,
  profileId: string,
): WorkflowEditorLibraryEntry<TNodeData, TEdgeData> {
  const next = (entry.inputProfiles ?? []).filter((profile) => profile.id !== profileId);
  const { inputProfiles: _inputProfiles, ...rest } = entry;
  return next.length ? { ...rest, inputProfiles: next } : rest;
}

function restoreWorkflowEditorSavedVersion<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(value: unknown): WorkflowEditorSavedVersion<TNodeData, TEdgeData> | null {
  if (!isRecord(value)) {
    return null;
  }

  try {
    assertWorkflowEditorDocument<TNodeData, TEdgeData>(value.document, libraryValidation);
  } catch {
    return null;
  }

  return {
    id:
      typeof value.id === "string" && value.id.trim()
        ? value.id
        : createWorkflowEditorId("version"),
    version: typeof value.version === "number" ? Math.max(1, Math.trunc(value.version)) : 1,
    name: typeof value.name === "string" && value.name.trim() ? value.name : "Saved Version",
    createdAt: typeof value.createdAt === "string" ? value.createdAt : new Date().toISOString(),
    document: normalizeWorkflowEditorDocument(
      value.document as WorkflowEditorDocument<TNodeData, TEdgeData>,
      libraryValidation,
    ).document,
  };
}

function nextWorkflowEditorVersionNumber<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(entry: WorkflowEditorLibraryEntry<TNodeData, TEdgeData>) {
  return Math.max(entry.version, 0, ...entry.versions.map((version) => version.version)) + 1;
}

function compactSavedVersions<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(versions: Array<WorkflowEditorSavedVersion<TNodeData, TEdgeData>>, maxVersions: number) {
  const limit = Math.max(0, Math.trunc(maxVersions));
  return [...versions]
    .sort((a, b) => b.version - a.version)
    .slice(0, limit)
    .map((version) => normalizeWorkflowEditorSavedVersion(version));
}

function normalizeWorkflowEditorSavedVersion<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  version: WorkflowEditorSavedVersion<TNodeData, TEdgeData>,
): WorkflowEditorSavedVersion<TNodeData, TEdgeData> {
  return {
    id: version.id,
    version: version.version,
    name: version.name,
    createdAt: version.createdAt,
    document: normalizeWorkflowEditorDocument(version.document, libraryValidation).document,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function collectRecursiveReferenceDiagnostics<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>({
  documents,
  diagnostics,
  sourceDocumentId,
  sourceNodeId,
  targetDocumentId,
  path,
  maxDepth,
}: {
  documents: ReadonlyMap<string, WorkflowEditorLibraryEntry<TNodeData, TEdgeData>>;
  diagnostics: WorkflowEditorReferenceDiagnostic[];
  sourceDocumentId: string;
  sourceNodeId: string;
  targetDocumentId: string;
  path: string[];
  maxDepth: number;
}) {
  const currentEntry = documents.get(targetDocumentId);
  if (!currentEntry || path.length > maxDepth) {
    return;
  }

  const ancestors = path.slice(0, -1);
  if (ancestors.includes(targetDocumentId)) {
    diagnostics.push({
      type: "recursive-reference",
      sourceDocumentId,
      sourceNodeId,
      targetDocumentId,
      path,
    });
    return;
  }

  for (const node of currentEntry.document.nodes) {
    const nextDocumentId = node.workflowRef?.documentId;
    if (!nextDocumentId || !documents.has(nextDocumentId)) {
      continue;
    }

    collectRecursiveReferenceDiagnostics({
      documents,
      diagnostics,
      sourceDocumentId,
      sourceNodeId,
      targetDocumentId: nextDocumentId,
      path: [...path, nextDocumentId],
      maxDepth,
    });
  }
}

function createWorkflowEditorId(prefix: string) {
  const random =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

  return `${prefix}-${random}`;
}

function ensureJsonFilename(filename: string) {
  return filename.toLowerCase().endsWith(".json") ? filename : `${filename}.json`;
}

export {
  applyWorkflowEditorBundleImportPlan,
  buildWorkflowEditorBundle,
  collectWorkflowEditorReferenceSites,
  isWorkflowEditorBundleText,
  parseWorkflowEditorBundle,
  planWorkflowEditorBundleImport,
  stringifyWorkflowEditorBundle,
  workflowEditorBundleCollisionStrategies,
  workflowEditorBundleFormat,
  workflowEditorBundleVersion,
  type WorkflowEditorBundle,
  type WorkflowEditorBundleCollisionStrategy,
  type WorkflowEditorBundleDiagnostic,
  type WorkflowEditorBundleDiagnosticCode,
  type WorkflowEditorBundleDocument,
  type WorkflowEditorBundleImportAction,
  type WorkflowEditorBundleImportItem,
  type WorkflowEditorBundleImportPlan,
  type WorkflowEditorBundleReference,
  type WorkflowEditorBundleReferenceRewrite,
  type WorkflowEditorBundleResult,
} from "./bundle";
