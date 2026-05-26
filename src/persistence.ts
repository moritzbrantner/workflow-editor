import {
  assertWorkflowEditorDocument,
  normalizeWorkflowEditorDocument,
  type WorkflowEditorDocument,
  type WorkflowEditorWorkflowReference,
} from "./core";

export const workflowEditorDocumentFormat = "@moritzbrantner/workflow-editor/document";
export const workflowEditorLibraryFormat = "@moritzbrantner/workflow-editor/library";
export const workflowEditorDocumentFileVersion = 1;
export const workflowEditorLibraryVersion = 1;
export const defaultWorkflowEditorMaxVersions = 20;
export const defaultWorkflowEditorStorageKey = "moritzbrantner.workflow-editor.library.v1";

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

export type WorkflowEditorStorageAdapter<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
> = {
  loadLibrary(): Promise<WorkflowEditorLibrary<TNodeData, TEdgeData> | null>;
  saveLibrary(library: WorkflowEditorLibrary<TNodeData, TEdgeData>): Promise<void>;
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
  );
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
    document: normalizeWorkflowEditorDocument(entry.document),
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
    document: normalizeWorkflowEditorDocument(version.document),
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
    document: normalizeWorkflowEditorDocument(document),
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

  assertWorkflowEditorDocument<TNodeData, TEdgeData>(parsed.document);

  return {
    format: workflowEditorDocumentFormat,
    version: workflowEditorDocumentFileVersion,
    exportedAt:
      typeof parsed.exportedAt === "string" ? parsed.exportedAt : new Date().toISOString(),
    documentId: typeof parsed.documentId === "string" ? parsed.documentId : undefined,
    documentName: typeof parsed.documentName === "string" ? parsed.documentName : undefined,
    documentVersion:
      typeof parsed.documentVersion === "number" ? parsed.documentVersion : undefined,
    document: normalizeWorkflowEditorDocument(parsed.document),
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

  assertWorkflowEditorDocument<TNodeData, TEdgeData>(file.document);

  return {
    exportedAt: file.exportedAt,
    documentId: file.documentId,
    documentName: file.documentName,
    documentVersion: file.documentVersion,
    document: normalizeWorkflowEditorDocument(file.document),
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
  return {
    async loadLibrary() {
      if (typeof window === "undefined") {
        return null;
      }

      try {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) {
          return null;
        }
        return restoreWorkflowEditorLibrary(JSON.parse(raw));
      } catch {
        return null;
      }
    },
    async saveLibrary(library) {
      if (typeof window === "undefined") {
        return;
      }

      window.localStorage.setItem(storageKey, JSON.stringify(createWorkflowEditorLibrary(library)));
    },
  };
}

export async function loadWorkflowEditorLibrary<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  storage: WorkflowEditorStorageAdapter<TNodeData, TEdgeData>,
  fallback: WorkflowEditorLibrary<TNodeData, TEdgeData> = createWorkflowEditorLibrary(),
): Promise<WorkflowEditorLibrary<TNodeData, TEdgeData>> {
  try {
    const library = await storage.loadLibrary();
    return library ? createWorkflowEditorLibrary(library) : fallback;
  } catch {
    return fallback;
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
    document: normalizeWorkflowEditorDocument(entry.document),
    versions: compactSavedVersions(entry.versions ?? [], defaultWorkflowEditorMaxVersions),
  };
}

function restoreWorkflowEditorLibrary<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(value: unknown): WorkflowEditorLibrary<TNodeData, TEdgeData> | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    value.format !== workflowEditorLibraryFormat ||
    value.version !== workflowEditorLibraryVersion
  ) {
    return null;
  }

  if (!Array.isArray(value.documents)) {
    return null;
  }

  const documents = value.documents
    .map((entry) => restoreWorkflowEditorEntry<TNodeData, TEdgeData>(entry))
    .filter((entry): entry is WorkflowEditorLibraryEntry<TNodeData, TEdgeData> => entry !== null);

  return createWorkflowEditorLibrary({
    activeDocumentId: typeof value.activeDocumentId === "string" ? value.activeDocumentId : null,
    documents,
  });
}

function restoreWorkflowEditorEntry<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(value: unknown): WorkflowEditorLibraryEntry<TNodeData, TEdgeData> | null {
  if (!isRecord(value)) {
    return null;
  }

  try {
    assertWorkflowEditorDocument<TNodeData, TEdgeData>(value.document);
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
  });
}

function restoreWorkflowEditorSavedVersion<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(value: unknown): WorkflowEditorSavedVersion<TNodeData, TEdgeData> | null {
  if (!isRecord(value)) {
    return null;
  }

  try {
    assertWorkflowEditorDocument<TNodeData, TEdgeData>(value.document);
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
    ),
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
    document: normalizeWorkflowEditorDocument(version.document),
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
