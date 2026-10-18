import { useState } from "react";

import { Button, Input } from "@moritzbrantner/ui";

import {
  areWorkflowEditorTemplateRevisionsCompatible,
  createWorkflowEditorSharedTemplateRevision,
  detachWorkflowEditorLinkedNode,
  latestWorkflowEditorSharedTemplates,
  planWorkflowEditorLinkedTemplateUpgrade,
  resolveWorkflowEditorLinkedTemplate,
  upgradeWorkflowEditorLinkedNode,
  type WorkflowEditorDocument,
  type WorkflowEditorNode,
  type WorkflowEditorNodeTemplate,
} from "../core";

/** A linked instance of a shared template somewhere in the host's documents. */
export type WorkflowWorkbenchLinkedInstance = {
  documentId: string;
  documentName: string;
  nodeId: string;
  label: string;
  revision: number;
};

/** Host wiring for linked shared templates (#65). */
export type WorkflowWorkbenchSharedTemplates = {
  /**
   * Stores a newly published immutable revision in the host catalog. The host must then include
   * it in `nodeTemplates`; the editor links the published node to it.
   */
  onPublish: (template: WorkflowEditorNodeTemplate<Record<string, unknown>>) => void;
  /** Linked instances across the host's documents (`WorkflowEditor` provides it from its library). */
  listInstances?: (templateId: string) => WorkflowWorkbenchLinkedInstance[];
};

function slug(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "shared-template"
  );
}

function linkedTo<TNodeData>(
  node: WorkflowEditorNode<TNodeData>,
  template: WorkflowEditorNodeTemplate<TNodeData>,
): WorkflowEditorNode<TNodeData> {
  return {
    ...node,
    inputs: template.inputs,
    outputs: template.outputs,
    composition: template.composition as WorkflowEditorNode<TNodeData>["composition"],
    templateRef: { templateId: template.shared!.templateId, revision: template.shared!.revision },
  };
}

/**
 * Shared template section of a composed node's inspector: publish a local composed node (as a new
 * template or a new revision), or, for a linked instance, show its source and revision, upgrade
 * explicitly to an incompatible newer revision, and detach to a local copy.
 */
export function WorkflowSharedTemplatePanel<TNodeData extends Record<string, unknown>, TEdgeData>({
  document,
  node,
  templates,
  sharedTemplates,
  readOnly,
  updateDocument,
}: {
  document: WorkflowEditorDocument<TNodeData, TEdgeData>;
  node: WorkflowEditorNode<TNodeData>;
  templates: readonly WorkflowEditorNodeTemplate<TNodeData>[];
  sharedTemplates: WorkflowWorkbenchSharedTemplates;
  readOnly: boolean;
  updateDocument?: (document: WorkflowEditorDocument<TNodeData, TEdgeData>) => void;
}) {
  const [name, setName] = useState(node.label);
  const latest = [...latestWorkflowEditorSharedTemplates(templates).values()];
  const [revisionOf, setRevisionOf] = useState(latest[0]?.shared?.templateId ?? "");
  const disabled = readOnly || !updateDocument;
  const replaceNode = (next: WorkflowEditorNode<TNodeData>) =>
    updateDocument?.({
      ...document,
      nodes: document.nodes.map((candidate) => (candidate.id === node.id ? next : candidate)),
    });
  const publish = (templateId: string, label?: string) => {
    const template = createWorkflowEditorSharedTemplateRevision(node, templates, {
      templateId,
      ...(label ? { label } : {}),
    });
    sharedTemplates.onPublish(template as WorkflowEditorNodeTemplate<Record<string, unknown>>);
    // A newly named template also names the published node.
    replaceNode({ ...linkedTo(node, template), ...(label ? { label: template.label } : {}) });
  };

  if (node.templateRef) {
    const ref = node.templateRef;
    const resolution = resolveWorkflowEditorLinkedTemplate(ref, templates);
    const instances = sharedTemplates.listInstances?.(ref.templateId) ?? [];
    const plan = resolution?.upgrade
      ? planWorkflowEditorLinkedTemplateUpgrade(
          document,
          node.id,
          resolution.upgrade.revision,
          templates,
        )
      : undefined;
    return (
      <section aria-label="Shared template" className="grid gap-2 border-t p-4 text-sm">
        <h3 className="text-sm font-semibold">Shared template</h3>
        {resolution ? (
          <p className="text-xs">
            Linked to <span className="font-medium">{resolution.template.label}</span> · revision{" "}
            {resolution.revision}
          </p>
        ) : (
          <p role="alert" className="text-xs text-destructive">
            Shared template &quot;{ref.templateId}&quot; revision {ref.revision} is not in the
            catalog.
          </p>
        )}
        {resolution?.upgrade && plan ? (
          <div className="grid gap-1 text-xs">
            <p role="status">
              Revision {resolution.upgrade.revision} changes the ports, so this node stays on
              revision {resolution.revision} until you upgrade.
              {plan.removedEdgeIds.length
                ? ` Upgrading removes ${plan.removedEdgeIds.length} connection${plan.removedEdgeIds.length === 1 ? "" : "s"} (${plan.removedEdgeIds.join(", ")}).`
                : ""}
              {plan.changedPortIds.length
                ? ` Ports that change type: ${plan.changedPortIds.join(", ")}.`
                : ""}
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={() =>
                updateDocument?.(
                  upgradeWorkflowEditorLinkedNode(
                    document,
                    node.id,
                    resolution.upgrade!.revision,
                    templates,
                  ),
                )
              }
            >
              Upgrade to revision {resolution.upgrade.revision}
            </Button>
          </div>
        ) : null}
        {instances.length ? (
          <ul aria-label="Linked instances" className="grid gap-0.5 text-xs text-muted-foreground">
            {instances.map((instance) => (
              <li key={`${instance.documentId}:${instance.nodeId}`}>
                {instance.documentName} · {instance.label} · revision {instance.revision}
              </li>
            ))}
          </ul>
        ) : null}
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          onClick={() => updateDocument?.(detachWorkflowEditorLinkedNode(document, node.id))}
        >
          Detach to local copy
        </Button>
      </section>
    );
  }

  const target = latest.find((template) => template.shared?.templateId === revisionOf);
  const revisionCompatible = target
    ? areWorkflowEditorTemplateRevisionsCompatible(target, node)
    : true;
  return (
    <section aria-label="Shared template" className="grid gap-2 border-t p-4 text-sm">
      <h3 className="text-sm font-semibold">Shared template</h3>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          aria-label="Shared template name"
          className="h-8 w-48"
          value={name}
          disabled={disabled}
          onChange={(event) => setName(event.currentTarget.value)}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled || !name.trim()}
          onClick={() => {
            const used = new Set(latest.map((template) => template.shared!.templateId));
            let templateId = slug(name);
            for (let suffix = 2; used.has(templateId); suffix += 1) {
              templateId = `${slug(name)}-${suffix}`;
            }
            publish(templateId, name.trim());
          }}
        >
          Publish as shared template
        </Button>
      </div>
      {latest.length ? (
        <div className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Publish as a revision of"
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
              value={revisionOf}
              disabled={disabled}
              onChange={(event) => setRevisionOf(event.target.value)}
            >
              {latest.map((template) => (
                <option key={template.shared!.templateId} value={template.shared!.templateId}>
                  {template.label} (revision {template.shared!.revision})
                </option>
              ))}
            </select>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled || !target}
              onClick={() => target && publish(target.shared!.templateId)}
            >
              Publish as new revision
            </Button>
          </div>
          {target && !revisionCompatible ? (
            <p role="status" className="text-xs text-muted-foreground">
              These ports differ from revision {target.shared!.revision}: linked instances keep
              their current revision until they are upgraded.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
