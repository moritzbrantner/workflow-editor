import {
  isWorkflowEditorReferenceDepth,
  normalizeWorkflowEditorDocument,
  workflowEditorValidationPolicies,
  type WorkflowEditorDocument,
  type WorkflowEditorNode,
} from "./core";
import {
  createWorkflowEditorEntry,
  createWorkflowEditorLibrary,
  createWorkflowEditorVersion,
  type WorkflowEditorLibrary,
  type WorkflowEditorLibraryEntry,
} from "./persistence";

/**
 * Portable workflow bundles: a root Workflow Document exported together with the closure of every
 * Workflow Document it references, so nested workflows move between libraries intact. Planning and
 * reference rewriting are headless and deterministic; nothing here touches storage.
 */
export const workflowEditorBundleFormat = "@moritzbrantner/workflow-editor/bundle";
export const workflowEditorBundleVersion = 1;

const bundleValidation = { policy: workflowEditorValidationPolicies.import };

export type WorkflowEditorBundleDocument<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
> = {
  id: string;
  name: string;
  description?: string;
  tags?: string[];
  version: number;
  updatedAt: string;
  document: WorkflowEditorDocument<TNodeData, TEdgeData>;
};

/** Provenance of one Workflow Reference inside the bundle. */
export type WorkflowEditorBundleReference = {
  sourceDocumentId: string;
  /** Node ids from the document root to the referencing node (composed nodes nest). */
  nodePath: string[];
  targetDocumentId: string;
  /** Version of the target document when the bundle was exported. */
  targetVersion: number;
  maxDepth?: number;
};

export type WorkflowEditorBundle<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
> = {
  format: typeof workflowEditorBundleFormat;
  version: typeof workflowEditorBundleVersion;
  exportedAt: string;
  rootDocumentId: string;
  /** The root first, then referenced documents in depth-first reference order. */
  documents: Array<WorkflowEditorBundleDocument<TNodeData, TEdgeData>>;
  references: WorkflowEditorBundleReference[];
};

export type WorkflowEditorBundleDiagnosticCode =
  | "invalid-json"
  | "invalid-format"
  | "unsupported-future-version"
  | "unsupported-version"
  | "invalid-document"
  | "duplicate-document"
  | "missing-root"
  | "missing-reference"
  | "unbounded-recursive-reference"
  | "invalid-reference-bound"
  | "reference-mismatch"
  | "version-mismatch"
  | "document-collision";

export type WorkflowEditorBundleDiagnostic = {
  code: WorkflowEditorBundleDiagnosticCode;
  severity: "error" | "warning";
  message: string;
  /** JSON path into the bundle, when the problem has one. */
  path?: string;
  documentId?: string;
  nodePath?: string[];
  /** Document ids along a reference cycle, first id repeated at the end. */
  cycle?: string[];
};

export type WorkflowEditorBundleResult<T> =
  | { ok: true; value: T; diagnostics: WorkflowEditorBundleDiagnostic[] }
  | { ok: false; diagnostics: WorkflowEditorBundleDiagnostic[] };

export type WorkflowEditorBundleCollisionStrategy = "reuse" | "replace" | "duplicate" | "abort";

export const workflowEditorBundleCollisionStrategies: readonly WorkflowEditorBundleCollisionStrategy[] =
  ["reuse", "replace", "duplicate", "abort"];

export type WorkflowEditorBundleImportAction = "create" | "reuse" | "replace" | "duplicate";

export type WorkflowEditorBundleImportItem = {
  /** Id inside the bundle. */
  sourceDocumentId: string;
  /** Id the document has in the target library after import. */
  targetDocumentId: string;
  name: string;
  action: WorkflowEditorBundleImportAction;
  collision: boolean;
  bundleVersion: number;
  existingVersion?: number;
};

export type WorkflowEditorBundleReferenceRewrite = {
  documentId: string;
  nodePath: string[];
  from: string;
  to: string;
};

export type WorkflowEditorBundleImportPlan = {
  strategy: WorkflowEditorBundleCollisionStrategy;
  rootDocumentId: string;
  items: WorkflowEditorBundleImportItem[];
  rewrites: WorkflowEditorBundleReferenceRewrite[];
  diagnostics: WorkflowEditorBundleDiagnostic[];
  /** `false` when an error diagnostic (for example an `abort` collision) blocks the import. */
  canApply: boolean;
};

type ReferenceSite = {
  nodePath: string[];
  targetDocumentId: string;
  maxDepth?: number;
};

type ClosureDocument = {
  id: string;
  version: number;
  document: WorkflowEditorDocument<unknown, unknown>;
};

/** Collects every Workflow Reference in a document, including those inside composed nodes. */
export function collectWorkflowEditorReferenceSites<TNodeData, TEdgeData>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
): ReferenceSite[] {
  const sites: ReferenceSite[] = [];
  const visit = (nodes: Array<WorkflowEditorNode<TNodeData>>, prefix: string[]) => {
    for (const node of nodes) {
      const nodePath = [...prefix, node.id];
      if (node.workflowRef?.documentId) {
        const site: ReferenceSite = { nodePath, targetDocumentId: node.workflowRef.documentId };
        if (node.workflowRef.maxDepth !== undefined) {
          site.maxDepth = node.workflowRef.maxDepth;
        }
        sites.push(site);
      }
      if (node.composition) {
        visit(node.composition.nodes, nodePath);
      }
    }
  };
  visit(document.nodes, []);
  return sites;
}

/**
 * Walks the reference closure from `rootDocumentId` in deterministic depth-first order. Missing
 * targets, invalid bounds and recursive cycles without any finite `maxDepth` are diagnosed.
 */
function analyzeClosure(
  documents: ReadonlyMap<string, ClosureDocument>,
  rootDocumentId: string,
  pathPrefix: (documentId: string) => string,
) {
  const order: string[] = [];
  const references: WorkflowEditorBundleReference[] = [];
  const diagnostics: WorkflowEditorBundleDiagnostic[] = [];
  const visited = new Set<string>();

  // `path` holds the documents from the root to `documentId`, each with whether the reference
  // entering it declares a finite bound.
  const visit = (documentId: string, path: Array<{ documentId: string; bounded: boolean }>) => {
    visited.add(documentId);
    order.push(documentId);
    const current = documents.get(documentId)!;

    for (const site of collectWorkflowEditorReferenceSites(current.document)) {
      const target = documents.get(site.targetDocumentId);
      const location = `${pathPrefix(documentId)} node ${site.nodePath.join("/")}`;
      if (site.maxDepth !== undefined && !isWorkflowEditorReferenceDepth(site.maxDepth)) {
        diagnostics.push({
          code: "invalid-reference-bound",
          severity: "error",
          message: `${location} declares an invalid maxDepth ${String(site.maxDepth)}; use a positive integer.`,
          documentId,
          nodePath: site.nodePath,
        });
      }

      if (!target) {
        diagnostics.push({
          code: "missing-reference",
          severity: "error",
          message: `${location} references missing workflow "${site.targetDocumentId}".`,
          documentId,
          nodePath: site.nodePath,
        });
        continue;
      }

      const reference: WorkflowEditorBundleReference = {
        sourceDocumentId: documentId,
        nodePath: site.nodePath,
        targetDocumentId: site.targetDocumentId,
        targetVersion: target.version,
      };
      if (site.maxDepth !== undefined) {
        reference.maxDepth = site.maxDepth;
      }
      references.push(reference);

      const bounded = isWorkflowEditorReferenceDepth(site.maxDepth);
      const ancestorIndex = path.findIndex((entry) => entry.documentId === site.targetDocumentId);
      if (ancestorIndex !== -1) {
        // A reference back to an ancestor closes a cycle; any bounded reference on it bounds it.
        const cycleEntries = path.slice(ancestorIndex);
        const cycleBounded = bounded || cycleEntries.slice(1).some((entry) => entry.bounded);
        if (!cycleBounded) {
          const cycle = [...cycleEntries.map((entry) => entry.documentId), site.targetDocumentId];
          diagnostics.push({
            code: "unbounded-recursive-reference",
            severity: "error",
            message: `Recursive reference ${cycle.join(" → ")} has no finite maxDepth bound.`,
            documentId,
            nodePath: site.nodePath,
            cycle,
          });
        }
        continue;
      }

      if (!visited.has(site.targetDocumentId)) {
        visit(site.targetDocumentId, [...path, { documentId: site.targetDocumentId, bounded }]);
      }
    }
  };

  if (documents.has(rootDocumentId)) {
    visit(rootDocumentId, [{ documentId: rootDocumentId, bounded: false }]);
  }

  return { order, references, diagnostics };
}

/**
 * Builds a portable bundle with the root document and its complete referenced-document closure.
 * Missing references and unbounded recursion fail before export; bounded recursion keeps its bound.
 */
export function buildWorkflowEditorBundle<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(
  library: WorkflowEditorLibrary<TNodeData, TEdgeData>,
  rootDocumentId: string,
  options: { exportedAt?: string } = {},
): WorkflowEditorBundleResult<WorkflowEditorBundle<TNodeData, TEdgeData>> {
  const entries = new Map(library.documents.map((entry) => [entry.id, entry]));
  if (!entries.has(rootDocumentId)) {
    return {
      ok: false,
      diagnostics: [
        {
          code: "missing-root",
          severity: "error",
          message: `Workflow "${rootDocumentId}" is not in the library.`,
          documentId: rootDocumentId,
        },
      ],
    };
  }

  const closure = analyzeClosure(
    entries as unknown as ReadonlyMap<string, ClosureDocument>,
    rootDocumentId,
    (id) => `Workflow "${entries.get(id)?.name ?? id}"`,
  );
  if (closure.diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return { ok: false, diagnostics: closure.diagnostics };
  }

  return {
    ok: true,
    diagnostics: closure.diagnostics,
    value: {
      format: workflowEditorBundleFormat,
      version: workflowEditorBundleVersion,
      exportedAt: options.exportedAt ?? new Date().toISOString(),
      rootDocumentId,
      documents: closure.order.map((id) => toBundleDocument(entries.get(id)!)),
      references: closure.references,
    },
  };
}

function toBundleDocument<TNodeData, TEdgeData>(
  entry: WorkflowEditorLibraryEntry<TNodeData, TEdgeData>,
): WorkflowEditorBundleDocument<TNodeData, TEdgeData> {
  const document: WorkflowEditorBundleDocument<TNodeData, TEdgeData> = {
    id: entry.id,
    name: entry.name,
    version: entry.version,
    updatedAt: entry.updatedAt,
    document: normalizeWorkflowEditorDocument(entry.document, bundleValidation).document,
  };
  if (entry.description) {
    document.description = entry.description;
  }
  if (entry.tags) {
    document.tags = [...entry.tags];
  }
  return document;
}

/** Serializes a bundle as stable, indented JSON. */
export function stringifyWorkflowEditorBundle(bundle: WorkflowEditorBundle<unknown, unknown>) {
  return `${JSON.stringify(bundle, null, 2)}\n`;
}

/** Whether JSON text looks like a workflow bundle (by its `format`), without validating it. */
export function isWorkflowEditorBundleText(text: string) {
  try {
    const value: unknown = JSON.parse(text);
    return isRecord(value) && value.format === workflowEditorBundleFormat;
  } catch {
    return false;
  }
}

/**
 * Parses, migrates and validates bundle JSON. Every problem is a structured diagnostic; errors
 * (unreadable documents, missing references, unbounded recursion) reject the bundle.
 */
export function parseWorkflowEditorBundle<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
>(text: string): WorkflowEditorBundleResult<WorkflowEditorBundle<TNodeData, TEdgeData>> {
  const fail = (diagnostic: Omit<WorkflowEditorBundleDiagnostic, "severity">) => ({
    ok: false as const,
    diagnostics: [{ ...diagnostic, severity: "error" as const }],
  });
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch (error) {
    return fail({
      code: "invalid-json",
      message: `Bundle is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    });
  }
  if (!isRecord(value) || value.format !== workflowEditorBundleFormat) {
    return fail({
      code: "invalid-format",
      message: "JSON is not a workflow bundle.",
      path: "$.format",
    });
  }
  if (typeof value.version === "number" && value.version > workflowEditorBundleVersion) {
    return fail({
      code: "unsupported-future-version",
      message: `Bundle uses version ${value.version}; this editor supports version ${workflowEditorBundleVersion}.`,
      path: "$.version",
    });
  }
  // Migration hook: older bundle versions are migrated here once a version 2 exists.
  if (value.version !== workflowEditorBundleVersion) {
    return fail({
      code: "unsupported-version",
      message: `Bundle has an unknown version ${String(value.version)}.`,
      path: "$.version",
    });
  }
  if (typeof value.rootDocumentId !== "string" || !value.rootDocumentId) {
    return fail({
      code: "invalid-format",
      message: "Bundle has no root document id.",
      path: "$.rootDocumentId",
    });
  }
  if (!Array.isArray(value.documents)) {
    return fail({
      code: "invalid-format",
      message: "Bundle has no document list.",
      path: "$.documents",
    });
  }

  const diagnostics: WorkflowEditorBundleDiagnostic[] = [];
  const documents: Array<WorkflowEditorBundleDocument<TNodeData, TEdgeData>> = [];
  const seen = new Set<string>();
  value.documents.forEach((raw, index) => {
    const path = `$.documents[${index}]`;
    const restored = restoreBundleDocument<TNodeData, TEdgeData>(raw, path, diagnostics);
    if (!restored) {
      return;
    }
    if (seen.has(restored.id)) {
      diagnostics.push({
        code: "duplicate-document",
        severity: "error",
        message: `Bundle contains workflow "${restored.id}" more than once.`,
        path,
        documentId: restored.id,
      });
      return;
    }
    seen.add(restored.id);
    documents.push(restored);
  });

  if (!seen.has(value.rootDocumentId)) {
    diagnostics.push({
      code: "missing-root",
      severity: "error",
      message: `Bundle root "${value.rootDocumentId}" is not among its documents.`,
      path: "$.rootDocumentId",
    });
  }
  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return { ok: false, diagnostics };
  }

  const byId = new Map(documents.map((document) => [document.id, document]));
  const indexOf = new Map(documents.map((document, index) => [document.id, index]));
  const closure = analyzeClosure(
    byId as unknown as ReadonlyMap<string, ClosureDocument>,
    value.rootDocumentId,
    (id) => `$.documents[${indexOf.get(id)}]`,
  );
  diagnostics.push(...closure.diagnostics);
  if (!diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    diagnostics.push(...compareRecordedReferences(value.references, closure.references));
  }

  if (diagnostics.some((diagnostic) => diagnostic.severity === "error")) {
    return { ok: false, diagnostics };
  }

  return {
    ok: true,
    diagnostics,
    value: {
      format: workflowEditorBundleFormat,
      version: workflowEditorBundleVersion,
      exportedAt:
        typeof value.exportedAt === "string" ? value.exportedAt : new Date().toISOString(),
      rootDocumentId: value.rootDocumentId,
      documents,
      references: closure.references,
    },
  };
}

function restoreBundleDocument<TNodeData, TEdgeData>(
  raw: unknown,
  path: string,
  diagnostics: WorkflowEditorBundleDiagnostic[],
): WorkflowEditorBundleDocument<TNodeData, TEdgeData> | null {
  if (!isRecord(raw) || typeof raw.id !== "string" || !raw.id) {
    diagnostics.push({
      code: "invalid-document",
      severity: "error",
      message: "Bundle document has no id.",
      path,
    });
    return null;
  }
  const id = raw.id;
  for (const bound of collectRawReferenceBounds(raw.document)) {
    if (!isWorkflowEditorReferenceDepth(bound.maxDepth)) {
      // Normalization would drop the bound; never weaken it silently.
      diagnostics.push({
        code: "invalid-reference-bound",
        severity: "error",
        message: `${path} node ${bound.nodePath.join("/")} declares an invalid maxDepth ${String(bound.maxDepth)}; use a positive integer.`,
        path: `${path}.document`,
        documentId: id,
        nodePath: bound.nodePath,
      });
    }
  }
  let document: WorkflowEditorDocument<TNodeData, TEdgeData>;
  try {
    document = normalizeWorkflowEditorDocument(
      raw.document as WorkflowEditorDocument<TNodeData, TEdgeData>,
      bundleValidation,
    ).document;
  } catch (error) {
    diagnostics.push({
      code: "invalid-document",
      severity: "error",
      message: `Bundle document "${id}" is invalid: ${error instanceof Error ? error.message : String(error)}`,
      path: `${path}.document`,
      documentId: id,
    });
    return null;
  }

  const restored: WorkflowEditorBundleDocument<TNodeData, TEdgeData> = {
    id,
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name : "Untitled Workflow",
    version:
      typeof raw.version === "number" && Number.isFinite(raw.version)
        ? Math.max(1, Math.trunc(raw.version))
        : 1,
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : new Date().toISOString(),
    document,
  };
  if (typeof raw.description === "string" && raw.description) {
    restored.description = raw.description;
  }
  if (Array.isArray(raw.tags)) {
    restored.tags = raw.tags.filter((tag): tag is string => typeof tag === "string");
  }
  return restored;
}

function collectRawReferenceBounds(document: unknown) {
  const bounds: Array<{ nodePath: string[]; maxDepth: unknown }> = [];
  const visit = (nodes: unknown, prefix: string[]) => {
    if (!Array.isArray(nodes)) {
      return;
    }
    for (const node of nodes) {
      if (!isRecord(node)) {
        continue;
      }
      const nodePath = [...prefix, String(node.id)];
      if (isRecord(node.workflowRef) && node.workflowRef.maxDepth !== undefined) {
        bounds.push({ nodePath, maxDepth: node.workflowRef.maxDepth });
      }
      if (isRecord(node.composition)) {
        visit(node.composition.nodes, nodePath);
      }
    }
  };
  if (isRecord(document)) {
    visit(document.nodes, []);
  }
  return bounds;
}

/** Recorded reference provenance is informative; disagreements with the documents are warnings. */
function compareRecordedReferences(
  recorded: unknown,
  actual: WorkflowEditorBundleReference[],
): WorkflowEditorBundleDiagnostic[] {
  if (recorded === undefined) {
    return [];
  }
  if (!Array.isArray(recorded)) {
    return [
      {
        code: "reference-mismatch",
        severity: "warning",
        message:
          "Bundle reference list is not an array; references were recomputed from documents.",
        path: "$.references",
      },
    ];
  }
  const key = (reference: {
    sourceDocumentId: unknown;
    nodePath: unknown;
    targetDocumentId: unknown;
  }) =>
    `${String(reference.sourceDocumentId)}|${Array.isArray(reference.nodePath) ? reference.nodePath.join("/") : ""}|${String(reference.targetDocumentId)}`;
  const actualByKey = new Map(actual.map((reference) => [key(reference), reference]));
  const diagnostics: WorkflowEditorBundleDiagnostic[] = [];
  const recordedKeys = new Set<string>();

  recorded.forEach((raw, index) => {
    if (!isRecord(raw)) {
      return;
    }
    const recordedKey = key(raw as WorkflowEditorBundleReference);
    recordedKeys.add(recordedKey);
    const match = actualByKey.get(recordedKey);
    if (!match) {
      diagnostics.push({
        code: "reference-mismatch",
        severity: "warning",
        message: `Recorded reference ${index + 1} does not match any reference in the bundled documents.`,
        path: `$.references[${index}]`,
      });
      return;
    }
    if (typeof raw.targetVersion === "number" && raw.targetVersion !== match.targetVersion) {
      diagnostics.push({
        code: "version-mismatch",
        severity: "warning",
        message: `Reference to "${match.targetDocumentId}" was recorded at version ${raw.targetVersion}, but the bundle contains version ${match.targetVersion}.`,
        path: `$.references[${index}].targetVersion`,
        documentId: match.targetDocumentId,
      });
    }
  });

  for (const reference of actual) {
    if (!recordedKeys.has(key(reference))) {
      diagnostics.push({
        code: "reference-mismatch",
        severity: "warning",
        message: `Reference from "${reference.sourceDocumentId}" to "${reference.targetDocumentId}" was not recorded in the bundle.`,
        documentId: reference.sourceDocumentId,
        nodePath: reference.nodePath,
      });
    }
  }

  return diagnostics;
}

/**
 * Plans importing a bundle into a library without changing it. Documents whose ids already exist
 * collide; the strategy decides whether to reuse the existing document, replace it, import a
 * duplicate under a new deterministic id (rewriting every affected reference), or abort.
 */
export function planWorkflowEditorBundleImport<TNodeData, TEdgeData>(
  library: WorkflowEditorLibrary<TNodeData, TEdgeData>,
  bundle: WorkflowEditorBundle<TNodeData, TEdgeData>,
  strategy: WorkflowEditorBundleCollisionStrategy,
): WorkflowEditorBundleImportPlan {
  const existing = new Map(library.documents.map((entry) => [entry.id, entry]));
  const taken = new Set([...existing.keys(), ...bundle.documents.map((document) => document.id)]);
  const diagnostics: WorkflowEditorBundleDiagnostic[] = [];
  const items: WorkflowEditorBundleImportItem[] = bundle.documents.map((document) => {
    const current = existing.get(document.id);
    const item: WorkflowEditorBundleImportItem = {
      sourceDocumentId: document.id,
      targetDocumentId: document.id,
      name: document.name,
      action: "create",
      collision: !!current,
      bundleVersion: document.version,
    };
    if (!current) {
      return item;
    }
    item.existingVersion = current.version;

    if (strategy === "abort") {
      diagnostics.push({
        code: "document-collision",
        severity: "error",
        message: `Workflow "${current.name}" (${document.id}) already exists; choose reuse, replace or duplicate.`,
        documentId: document.id,
      });
      item.action = "reuse";
    } else if (strategy === "reuse") {
      item.action = "reuse";
      if (current.version !== document.version) {
        diagnostics.push({
          code: "version-mismatch",
          severity: "warning",
          message: `Reusing library version ${current.version} of "${current.name}" instead of bundled version ${document.version}.`,
          documentId: document.id,
        });
      }
    } else if (strategy === "replace") {
      item.action = "replace";
    } else {
      item.action = "duplicate";
      item.targetDocumentId = uniqueDocumentId(document.id, taken);
      taken.add(item.targetDocumentId);
    }
    return item;
  });

  const idMap = new Map(items.map((item) => [item.sourceDocumentId, item.targetDocumentId]));
  const writtenIds = new Set(
    items.filter((item) => item.action !== "reuse").map((item) => item.sourceDocumentId),
  );
  const rewrites: WorkflowEditorBundleReferenceRewrite[] = [];
  for (const reference of bundle.references) {
    const to = idMap.get(reference.targetDocumentId) ?? reference.targetDocumentId;
    if (writtenIds.has(reference.sourceDocumentId) && to !== reference.targetDocumentId) {
      rewrites.push({
        documentId: idMap.get(reference.sourceDocumentId) ?? reference.sourceDocumentId,
        nodePath: reference.nodePath,
        from: reference.targetDocumentId,
        to,
      });
    }
  }

  return {
    strategy,
    rootDocumentId: idMap.get(bundle.rootDocumentId) ?? bundle.rootDocumentId,
    items,
    rewrites,
    diagnostics,
    canApply: !diagnostics.some((diagnostic) => diagnostic.severity === "error"),
  };
}

/**
 * Applies a plan from `planWorkflowEditorBundleImport` and activates the imported root. Replaced
 * documents keep their previous content as a saved version so the replacement is recoverable.
 */
export function applyWorkflowEditorBundleImportPlan<TNodeData, TEdgeData>(
  library: WorkflowEditorLibrary<TNodeData, TEdgeData>,
  bundle: WorkflowEditorBundle<TNodeData, TEdgeData>,
  plan: WorkflowEditorBundleImportPlan,
  options: { now?: string } = {},
): WorkflowEditorLibrary<TNodeData, TEdgeData> {
  if (!plan.canApply) {
    throw new Error(
      plan.diagnostics.find((diagnostic) => diagnostic.severity === "error")?.message,
    );
  }
  const now = options.now ?? new Date().toISOString();
  const idMap = new Map(plan.items.map((item) => [item.sourceDocumentId, item.targetDocumentId]));
  const bundleDocuments = new Map(bundle.documents.map((document) => [document.id, document]));
  const documents = [...library.documents];

  for (const item of plan.items) {
    if (item.action === "reuse") {
      continue;
    }
    const source = bundleDocuments.get(item.sourceDocumentId)!;
    const document = rewriteReferences(source.document, idMap);
    const index = documents.findIndex((entry) => entry.id === item.targetDocumentId);

    if (item.action === "replace" && index !== -1) {
      const previous = createWorkflowEditorVersion(documents[index]!, {
        name: `Before bundle import`,
        createdAt: now,
      });
      documents[index] = {
        ...previous,
        name: source.name,
        description: source.description,
        tags: source.tags ? [...source.tags] : undefined,
        version: Math.max(source.version, previous.version + 1),
        updatedAt: now,
        document,
      };
      continue;
    }

    const entry = createWorkflowEditorEntry<TNodeData, TEdgeData>({
      id: item.targetDocumentId,
      name: source.name,
      description: source.description,
      tags: source.tags,
      version: source.version,
      createdAt: now,
      updatedAt: source.updatedAt,
      document,
    });
    if (index === -1) {
      documents.push(entry);
    } else {
      documents[index] = entry;
    }
  }

  return createWorkflowEditorLibrary({ activeDocumentId: plan.rootDocumentId, documents });
}

function rewriteReferences<TNodeData, TEdgeData>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  idMap: ReadonlyMap<string, string>,
): WorkflowEditorDocument<TNodeData, TEdgeData> {
  const rewriteNodes = (
    nodes: Array<WorkflowEditorNode<TNodeData>>,
  ): Array<WorkflowEditorNode<TNodeData>> =>
    nodes.map((node) => {
      const target = node.workflowRef ? idMap.get(node.workflowRef.documentId) : undefined;
      if (!node.composition && (!target || target === node.workflowRef?.documentId)) {
        return node;
      }
      const next: WorkflowEditorNode<TNodeData> = { ...node };
      if (node.workflowRef && target) {
        next.workflowRef = { ...node.workflowRef, documentId: target };
      }
      if (node.composition) {
        next.composition = { ...node.composition, nodes: rewriteNodes(node.composition.nodes) };
      }
      return next;
    });

  return { ...document, nodes: rewriteNodes(document.nodes) };
}

function uniqueDocumentId(base: string, taken: ReadonlySet<string>) {
  let candidate = `${base}-copy`;
  for (let suffix = 2; taken.has(candidate); suffix += 1) {
    candidate = `${base}-copy-${suffix}`;
  }
  return candidate;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
