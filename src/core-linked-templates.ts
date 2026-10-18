import { workflowEditorPortTypeSource } from "./core-type-source";
import type {
  WorkflowEditorDocument,
  WorkflowEditorEdge,
  WorkflowEditorNode,
  WorkflowEditorNodeTemplate,
  WorkflowEditorPort,
} from "./core-types";

/**
 * Linked, versioned shared Node Templates (#65; Decision Atlas 2.9/2.11; TECH-001).
 *
 * The host's Node Template catalog is the only authority: every published revision is one
 * immutable catalog template carrying `shared: { templateId, revision }`, with the composed
 * subgraph as its `composition`. A linked node stores `templateRef` (the template identity and the
 * revision it currently resolves to). Its ports and composition are always re-resolved from the
 * catalog; they are never an independent copy.
 *
 * - A newer revision whose port contract matches the node's resolved revision is **compatible**
 *   and becomes effective automatically.
 * - An incompatible revision never applies on its own: the node stays on its last compatible
 *   revision until the user upgrades explicitly.
 * - Detach turns the node into an ordinary local composed node.
 */
export type WorkflowEditorSharedTemplateIdentity = {
  /** Stable identity of the shared definition across revisions. */
  templateId: string;
  /** Immutable published revision, starting at 1. */
  revision: number;
};

export type WorkflowEditorLinkedTemplateRef = WorkflowEditorSharedTemplateIdentity;

export type WorkflowEditorLinkedTemplateDiagnostic = {
  code: "missing-linked-template" | "missing-linked-template-revision";
  nodeId: string;
  templateId: string;
  revision: number;
  message: string;
  path: string;
};

export type WorkflowEditorLinkedTemplateResolution<TData = Record<string, unknown>> = {
  /** The revision the node resolves to: its own, or the newest compatible one. */
  template: WorkflowEditorNodeTemplate<TData>;
  revision: number;
  /** The newest published revision, when it is incompatible and needs an explicit upgrade. */
  upgrade?: { revision: number; template: WorkflowEditorNodeTemplate<TData> };
};

export function workflowEditorSharedTemplateId(templateId: string, revision: number) {
  return `${templateId}@${revision}`;
}

/** Published revisions of one shared template, oldest first. */
export function listWorkflowEditorSharedTemplateRevisions<TData>(
  templates: readonly WorkflowEditorNodeTemplate<TData>[],
  templateId: string,
) {
  return templates
    .filter((template) => template.shared?.templateId === templateId)
    .sort((a, b) => a.shared!.revision - b.shared!.revision);
}

/** The newest revision of every shared template, for the palette. */
export function latestWorkflowEditorSharedTemplates<TData>(
  templates: readonly WorkflowEditorNodeTemplate<TData>[],
) {
  const latest = new Map<string, WorkflowEditorNodeTemplate<TData>>();
  for (const template of templates) {
    if (!template.shared) continue;
    const current = latest.get(template.shared.templateId);
    if (!current || current.shared!.revision < template.shared.revision) {
      latest.set(template.shared.templateId, template);
    }
  }
  return latest;
}

/** Whether a template is visible in the palette: unshared, or the latest shared revision. */
export function isWorkflowEditorPaletteTemplate<TData>(
  template: WorkflowEditorNodeTemplate<TData>,
  templates: readonly WorkflowEditorNodeTemplate<TData>[],
) {
  return (
    !template.shared ||
    latestWorkflowEditorSharedTemplates(templates).get(template.shared.templateId) === template
  );
}

function portContract(port: WorkflowEditorPort) {
  return `${port.id}${port.optional ? "?" : ""}:${workflowEditorPortTypeSource(port.type)}`;
}

function contract(ports: readonly WorkflowEditorPort[] | undefined) {
  return (ports ?? []).map(portContract).sort().join("|");
}

/**
 * Compatible revisions keep the port contract: the same port ids, TypeScript types and optional
 * flags on both sides. Internal subgraph, label and data changes are compatible.
 */
export function areWorkflowEditorTemplateRevisionsCompatible(
  a: Pick<WorkflowEditorNodeTemplate<unknown>, "inputs" | "outputs">,
  b: Pick<WorkflowEditorNodeTemplate<unknown>, "inputs" | "outputs">,
) {
  return contract(a.inputs) === contract(b.inputs) && contract(a.outputs) === contract(b.outputs);
}

export function resolveWorkflowEditorLinkedTemplate<TData>(
  ref: WorkflowEditorLinkedTemplateRef,
  templates: readonly WorkflowEditorNodeTemplate<TData>[],
): WorkflowEditorLinkedTemplateResolution<TData> | undefined {
  const revisions = listWorkflowEditorSharedTemplateRevisions(templates, ref.templateId);
  const pinned = revisions.find((template) => template.shared!.revision === ref.revision);
  if (!pinned) return undefined;
  // Follow newer revisions while each stays compatible with the pinned contract.
  let effective = pinned;
  for (const candidate of revisions) {
    if (candidate.shared!.revision <= effective.shared!.revision) continue;
    if (!areWorkflowEditorTemplateRevisionsCompatible(pinned, candidate)) break;
    effective = candidate;
  }
  const newest = revisions.at(-1)!;
  return {
    template: effective,
    revision: effective.shared!.revision,
    ...(newest.shared!.revision > effective.shared!.revision
      ? { upgrade: { revision: newest.shared!.revision, template: newest } }
      : {}),
  };
}

function linkedNodeFromTemplate<TData>(
  node: WorkflowEditorNode<TData>,
  template: WorkflowEditorNodeTemplate<TData>,
): WorkflowEditorNode<TData> {
  return {
    ...node,
    kind: template.kind,
    inputs: template.inputs?.map((port) => ({ ...port })),
    outputs: template.outputs?.map((port) => ({ ...port })),
    composition: template.composition as WorkflowEditorNode<TData>["composition"],
    templateRef: { templateId: template.shared!.templateId, revision: template.shared!.revision },
  };
}

/**
 * Re-resolves every linked node from the catalog: compatible newer revisions take effect, and the
 * node's ports and composition come from its effective revision. Missing templates or revisions
 * are reported and the node is left unchanged; nothing is rebound by name.
 */
export function resolveWorkflowEditorLinkedNodes<TNodeData, TEdgeData>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  templates: readonly WorkflowEditorNodeTemplate<TNodeData>[],
): {
  document: WorkflowEditorDocument<TNodeData, TEdgeData>;
  diagnostics: WorkflowEditorLinkedTemplateDiagnostic[];
} {
  const diagnostics: WorkflowEditorLinkedTemplateDiagnostic[] = [];
  let changed = false;
  const nodes = document.nodes.map((node) => {
    const ref = node.templateRef;
    if (!ref) return node;
    const resolution = resolveWorkflowEditorLinkedTemplate(ref, templates);
    if (!resolution) {
      const known = templates.some((template) => template.shared?.templateId === ref.templateId);
      diagnostics.push({
        code: known ? "missing-linked-template-revision" : "missing-linked-template",
        nodeId: node.id,
        templateId: ref.templateId,
        revision: ref.revision,
        message: known
          ? `Node ${node.id} uses revision ${ref.revision} of shared template "${ref.templateId}", which is not in the catalog.`
          : `Node ${node.id} uses shared template "${ref.templateId}", which is not in the catalog.`,
        path: `nodes.${node.id}.templateRef`,
      });
      return node;
    }
    const next = linkedNodeFromTemplate(node, resolution.template);
    if (JSON.stringify(next) === JSON.stringify(node)) return node;
    changed = true;
    return next;
  });
  return { document: changed ? { ...document, nodes } : document, diagnostics };
}

export type WorkflowEditorLinkedTemplateUpgradePlan = {
  revision: number;
  /** Connections whose port no longer exists on the target revision; upgrading removes them. */
  removedEdgeIds: string[];
  /** Ports kept by id whose type or optional flag changes. */
  changedPortIds: string[];
};

/** What an explicit upgrade of `nodeId` to `revision` would change, before applying it. */
export function planWorkflowEditorLinkedTemplateUpgrade<TNodeData, TEdgeData>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  nodeId: string,
  revision: number,
  templates: readonly WorkflowEditorNodeTemplate<TNodeData>[],
): WorkflowEditorLinkedTemplateUpgradePlan | undefined {
  const node = document.nodes.find((candidate) => candidate.id === nodeId);
  const target = node?.templateRef
    ? listWorkflowEditorSharedTemplateRevisions(templates, node.templateRef.templateId).find(
        (template) => template.shared!.revision === revision,
      )
    : undefined;
  if (!node || !target) return undefined;
  const inputIds = new Set((target.inputs ?? []).map((port) => port.id));
  const outputIds = new Set((target.outputs ?? []).map((port) => port.id));
  const removedEdgeIds = document.edges
    .filter(
      (edge) =>
        (edge.targetNodeId === nodeId && !inputIds.has(edge.targetPortId ?? "")) ||
        (edge.sourceNodeId === nodeId && !outputIds.has(edge.sourcePortId ?? "")),
    )
    .map((edge) => edge.id);
  const changedPortIds = [
    ...(node.inputs ?? []).flatMap((port) => {
      const next = target.inputs?.find((candidate) => candidate.id === port.id);
      return next && portContract(next) !== portContract(port) ? [port.id] : [];
    }),
    ...(node.outputs ?? []).flatMap((port) => {
      const next = target.outputs?.find((candidate) => candidate.id === port.id);
      return next && portContract(next) !== portContract(port) ? [port.id] : [];
    }),
  ];
  return { revision, removedEdgeIds, changedPortIds };
}

/** Explicitly moves a linked node to `revision`, removing connections to ports it no longer has. */
export function upgradeWorkflowEditorLinkedNode<TNodeData, TEdgeData>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  nodeId: string,
  revision: number,
  templates: readonly WorkflowEditorNodeTemplate<TNodeData>[],
): WorkflowEditorDocument<TNodeData, TEdgeData> {
  const plan = planWorkflowEditorLinkedTemplateUpgrade(document, nodeId, revision, templates);
  const node = document.nodes.find((candidate) => candidate.id === nodeId);
  if (!plan || !node?.templateRef) return document;
  const target = listWorkflowEditorSharedTemplateRevisions(
    templates,
    node.templateRef.templateId,
  ).find((template) => template.shared!.revision === revision)!;
  const removed = new Set(plan.removedEdgeIds);
  return {
    ...document,
    nodes: document.nodes.map((candidate) =>
      candidate.id === nodeId ? linkedNodeFromTemplate(candidate, target) : candidate,
    ),
    edges: document.edges.filter((edge: WorkflowEditorEdge<TEdgeData>) => !removed.has(edge.id)),
  };
}

/** Detach / Unlink: keeps the currently resolved subgraph as an independent local composed node. */
export function detachWorkflowEditorLinkedNode<TNodeData, TEdgeData>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  nodeId: string,
): WorkflowEditorDocument<TNodeData, TEdgeData> {
  const node = document.nodes.find((candidate) => candidate.id === nodeId);
  if (!node?.templateRef) return document;
  return {
    ...document,
    nodes: document.nodes.map((candidate) => {
      if (candidate.id !== nodeId) return candidate;
      const { templateRef: _templateRef, ...local } = candidate;
      return local as WorkflowEditorNode<TNodeData>;
    }),
  };
}

/**
 * Publishes a composed node as a shared template revision: revision 1 of a new template, or the
 * next revision of `templateId`. Returns the immutable catalog entry for the host to store; the
 * existing revisions are never changed.
 */
export function createWorkflowEditorSharedTemplateRevision<TData>(
  node: WorkflowEditorNode<TData>,
  templates: readonly WorkflowEditorNodeTemplate<TData>[],
  options: { templateId: string; label?: string; category?: string },
): WorkflowEditorNodeTemplate<TData> {
  if (!node.composition) {
    throw new Error(`Node ${node.id} has no composition to publish.`);
  }
  const revisions = listWorkflowEditorSharedTemplateRevisions(templates, options.templateId);
  const revision = (revisions.at(-1)?.shared?.revision ?? 0) + 1;
  const label = options.label?.trim() || revisions.at(-1)?.label || node.label;
  return {
    id: workflowEditorSharedTemplateId(options.templateId, revision),
    label,
    kind: node.kind ?? "composed",
    category: options.category ?? revisions.at(-1)?.category ?? "Shared templates",
    packageLabel: `Shared · r${revision}`,
    inputs: node.inputs?.map((port) => ({ ...port })),
    outputs: node.outputs?.map((port) => ({ ...port })),
    composition: structuredClone(node.composition),
    shared: { templateId: options.templateId, revision },
  };
}

/** Linked instances of a shared template across documents, with the revision each resolves to. */
export function listWorkflowEditorLinkedInstances<TData>(
  documents: ReadonlyArray<{ id: string; name: string; document: WorkflowEditorDocument<TData> }>,
  templateId: string,
  templates: readonly WorkflowEditorNodeTemplate<TData>[],
) {
  return documents.flatMap((entry) =>
    entry.document.nodes
      .filter((node) => node.templateRef?.templateId === templateId)
      .map((node) => ({
        documentId: entry.id,
        documentName: entry.name,
        nodeId: node.id,
        label: node.label,
        revision:
          resolveWorkflowEditorLinkedTemplate(node.templateRef!, templates)?.revision ??
          node.templateRef!.revision,
      })),
  );
}
