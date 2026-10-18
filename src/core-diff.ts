import type { WorkflowEditorDocument } from "./core-types";

/**
 * Semantic, deterministic diff of two Workflow Documents (W-12). Entities are matched by id;
 * nested values report stable JSON paths. Neither input is mutated.
 */

export type WorkflowEditorDiffEntity = "node" | "edge" | "group" | "port" | "document" | "viewport";

export type WorkflowEditorDiffChange = "added" | "removed" | "changed" | "moved";

export type WorkflowEditorDiffField = {
  /** Path relative to the entity, for example `data.request.url` or `type.source`. */
  path: string;
  before?: unknown;
  after?: unknown;
  /** Values were withheld by the redaction policy. */
  redacted?: boolean;
};

export type WorkflowEditorDiffEntry = {
  entity: WorkflowEditorDiffEntity;
  change: WorkflowEditorDiffChange;
  /** Entity id: node, edge or group id; `<nodeId>.<inputs|outputs>.<portId>` for ports. */
  id: string;
  /** Owning node for node and port entries; edge endpoints for edges. */
  nodeId?: string;
  /** Absolute document path, for example `nodes[id=a].inputs[id=in]`. */
  path: string;
  label?: string;
  fields: WorkflowEditorDiffField[];
};

export type WorkflowEditorDiffSummary = {
  added: number;
  removed: number;
  changed: number;
  /** Nodes whose only change is their position (counted here when positions are summarized). */
  moved: number;
};

export type WorkflowEditorDocumentDiff = {
  entries: WorkflowEditorDiffEntry[];
  summary: WorkflowEditorDiffSummary;
  /** Ids of nodes/edges/groups with any entry, for highlighting on the canvas. */
  changedNodeIds: string[];
  changedEdgeIds: string[];
  changedGroupIds: string[];
};

export type WorkflowEditorDiffOptions = {
  /**
   * `include` lists pure position changes as `moved` entries (the default), `summarize` only
   * counts them in `summary.moved`, `ignore` drops them. Viewport changes follow the same option.
   */
  positions?: "include" | "summarize" | "ignore";
  /**
   * Decides whether a field's values are withheld. By default keys that look like secrets
   * (`secret`, `token`, `password`, `apiKey`, `credential`, `privateKey`) are redacted.
   */
  redact?: (path: string) => boolean;
};

export const workflowEditorDiffRedacted = "[redacted]";

const secretLikeKey = /(secret|token|password|passwd|api[-_]?key|credential|private[-_]?key)/iu;

export function isWorkflowEditorSecretLikePath(path: string) {
  return path.split(/[.[\]]/u).some((segment) => segment !== "" && secretLikeKey.test(segment));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasIds(value: unknown[]): value is Array<{ id: string }> {
  return (
    value.length > 0 &&
    value.every((item) => isRecord(item) && typeof item.id === "string") &&
    new Set(value.map((item) => (item as { id: string }).id)).size === value.length
  );
}

function equal(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a) && Array.isArray(b)) {
    return a.length === b.length && a.every((item, index) => equal(item, b[index]));
  }
  if (isRecord(a) && isRecord(b)) {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    for (const key of keys) {
      if (!equal(a[key], b[key])) return false;
    }
    return true;
  }
  return false;
}

/** Leaf-level differences between two JSON values; arrays of id'd items are matched by id. */
function diffValues(before: unknown, after: unknown, path: string, out: WorkflowEditorDiffField[]) {
  if (equal(before, after)) return;
  if (isRecord(before) && isRecord(after)) {
    const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
    for (const key of keys) {
      diffValues(before[key], after[key], path ? `${path}.${key}` : key, out);
    }
    return;
  }
  if (Array.isArray(before) && Array.isArray(after) && (hasIds(before) || hasIds(after))) {
    const beforeById = new Map((before as Array<{ id: string }>).map((item) => [item.id, item]));
    const afterById = new Map((after as Array<{ id: string }>).map((item) => [item.id, item]));
    const ids = [...new Set([...beforeById.keys(), ...afterById.keys()])].sort();
    for (const id of ids) {
      diffValues(beforeById.get(id), afterById.get(id), `${path}[id=${id}]`, out);
    }
    return;
  }
  out.push({
    path,
    ...(before === undefined ? {} : { before }),
    ...(after === undefined ? {} : { after }),
  });
}

function redactFields(
  fields: WorkflowEditorDiffField[],
  basePath: string,
  redact: (path: string) => boolean,
): WorkflowEditorDiffField[] {
  return fields.map((field) =>
    redact(`${basePath}.${field.path}`) || redact(field.path)
      ? {
          path: field.path,
          ...("before" in field ? { before: workflowEditorDiffRedacted } : {}),
          ...("after" in field ? { after: workflowEditorDiffRedacted } : {}),
          redacted: true,
        }
      : field,
  );
}

function byId<T extends { id: string }>(items: readonly T[] | undefined) {
  return new Map((items ?? []).map((item) => [item.id, item]));
}

function sortedIds(...maps: Array<Map<string, unknown>>) {
  return [...new Set(maps.flatMap((map) => [...map.keys()]))].sort();
}

export function diffWorkflowEditorDocuments(
  before: WorkflowEditorDocument<unknown, unknown>,
  after: WorkflowEditorDocument<unknown, unknown>,
  options: WorkflowEditorDiffOptions = {},
): WorkflowEditorDocumentDiff {
  const positions = options.positions ?? "include";
  const redact = options.redact ?? isWorkflowEditorSecretLikePath;
  const entries: WorkflowEditorDiffEntry[] = [];
  let moved = 0;

  const entityFields = (
    beforeValue: unknown,
    afterValue: unknown,
    path: string,
    skip: Set<string>,
  ) => {
    const fields: WorkflowEditorDiffField[] = [];
    const strip = (value: unknown) =>
      isRecord(value)
        ? Object.fromEntries(Object.entries(value).filter(([key]) => !skip.has(key)))
        : value;
    diffValues(strip(beforeValue), strip(afterValue), "", fields);
    return redactFields(fields, path, redact);
  };

  // Nodes, with their ports as separate entries.
  const beforeNodes = byId(before.nodes);
  const afterNodes = byId(after.nodes);
  for (const id of sortedIds(beforeNodes, afterNodes)) {
    const a = beforeNodes.get(id);
    const b = afterNodes.get(id);
    const path = `nodes[id=${id}]`;
    const label = (b ?? a)?.label;
    if (!a || !b) {
      entries.push({
        entity: "node",
        change: a ? "removed" : "added",
        id,
        nodeId: id,
        path,
        ...(label ? { label } : {}),
        fields: [],
      });
      continue;
    }
    const fields = entityFields(a, b, path, new Set(["x", "y", "inputs", "outputs"]));
    const positionChanged = a.x !== b.x || a.y !== b.y;
    for (const side of ["inputs", "outputs"] as const) {
      const beforePorts = byId(a[side]);
      const afterPorts = byId(b[side]);
      for (const portId of sortedIds(beforePorts, afterPorts)) {
        const pa = beforePorts.get(portId);
        const pb = afterPorts.get(portId);
        const portPath = `${path}.${side}[id=${portId}]`;
        const portFields = pa && pb ? entityFields(pa, pb, portPath, new Set()) : [];
        if (pa && pb && portFields.length === 0) continue;
        entries.push({
          entity: "port",
          change: !pa ? "added" : !pb ? "removed" : "changed",
          id: `${id}.${side}.${portId}`,
          nodeId: id,
          path: portPath,
          label: `${label ?? id} · ${(pb ?? pa)?.label ?? portId}`,
          fields: portFields,
        });
      }
    }
    if (fields.length > 0) {
      entries.push({
        entity: "node",
        change: "changed",
        id,
        nodeId: id,
        path,
        ...(label ? { label } : {}),
        fields:
          positionChanged && positions === "include"
            ? [
                ...fields,
                { path: "position", before: { x: a.x, y: a.y }, after: { x: b.x, y: b.y } },
              ]
            : fields,
      });
    } else if (positionChanged) {
      const portChanged = entries.some((entry) => entry.entity === "port" && entry.nodeId === id);
      if (positions === "include") {
        entries.push({
          entity: "node",
          change: "moved",
          id,
          nodeId: id,
          path,
          ...(label ? { label } : {}),
          fields: [{ path: "position", before: { x: a.x, y: a.y }, after: { x: b.x, y: b.y } }],
        });
      } else if (positions === "summarize" && !portChanged) {
        moved += 1;
      }
    }
  }

  // Edges: endpoint changes are rewiring.
  const beforeEdges = byId(before.edges);
  const afterEdges = byId(after.edges);
  for (const id of sortedIds(beforeEdges, afterEdges)) {
    const a = beforeEdges.get(id);
    const b = afterEdges.get(id);
    const path = `edges[id=${id}]`;
    const fields = a && b ? entityFields(a, b, path, new Set()) : [];
    if (a && b && fields.length === 0) continue;
    const edge = (b ?? a)!;
    entries.push({
      entity: "edge",
      change: !a ? "added" : !b ? "removed" : "changed",
      id,
      path,
      label: `${edge.sourceNodeId}.${edge.sourcePortId} → ${edge.targetNodeId}.${edge.targetPortId}`,
      fields,
    });
  }

  // Groups.
  const beforeGroups = byId(before.groups);
  const afterGroups = byId(after.groups);
  for (const id of sortedIds(beforeGroups, afterGroups)) {
    const a = beforeGroups.get(id);
    const b = afterGroups.get(id);
    const path = `groups[id=${id}]`;
    const fields = a && b ? entityFields(a, b, path, new Set()) : [];
    if (a && b && fields.length === 0) continue;
    entries.push({
      entity: "group",
      change: !a ? "added" : !b ? "removed" : "changed",
      id,
      path,
      ...((b ?? a)?.label ? { label: (b ?? a)!.label } : {}),
      fields,
    });
  }

  // Document-level metadata (type declarations and any host fields) and the viewport.
  const documentFields = entityFields(
    before,
    after,
    "document",
    new Set(["nodes", "edges", "groups", "viewport"]),
  );
  if (documentFields.length > 0) {
    entries.push({
      entity: "document",
      change: "changed",
      id: "document",
      path: "document",
      fields: documentFields,
    });
  }
  if (!equal(before.viewport, after.viewport) && positions === "include") {
    entries.push({
      entity: "viewport",
      change: "moved",
      id: "viewport",
      path: "viewport",
      fields: [{ path: "viewport", before: before.viewport, after: after.viewport }],
    });
  }

  const count = (change: WorkflowEditorDiffChange) =>
    entries.filter((entry) => entry.change === change && entry.entity !== "viewport").length;
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  const groupIds = new Set<string>();
  for (const entry of entries) {
    if (entry.nodeId) nodeIds.add(entry.nodeId);
    if (entry.entity === "edge") edgeIds.add(entry.id);
    if (entry.entity === "group") groupIds.add(entry.id);
  }

  return {
    entries,
    summary: {
      added: count("added"),
      removed: count("removed"),
      changed: count("changed"),
      moved: positions === "include" ? count("moved") : moved,
    },
    changedNodeIds: [...nodeIds],
    changedEdgeIds: [...edgeIds],
    changedGroupIds: [...groupIds],
  };
}
