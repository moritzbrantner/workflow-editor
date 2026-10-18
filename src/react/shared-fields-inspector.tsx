import { useState } from "react";

import {
  getWorkflowEditorSharedInspectorFields,
  updateWorkflowEditorNode,
  workflowEditorMixedFieldValue,
  type WorkflowEditorNode,
} from "../core";
import type { WorkflowWorkbenchInspectorContext } from "../react";
import { InspectorPanel, type InspectorFieldValue } from "./inspector-panel";
import {
  applyInspectorFieldDrafts,
  createInspectorFieldSections,
  validateInspectorFieldDrafts,
} from "./inspector-field-sections";

/**
 * Edits the data fields every selected node shares (same path, kind and label). Fields whose
 * values differ show "Mixed" and stay untouched unless edited; one Apply is one undoable edit.
 */
export function WorkflowSharedFieldsInspector<
  TNodeData extends Record<string, unknown>,
  TEdgeData extends Record<string, unknown>,
>({ context }: { context: WorkflowWorkbenchInspectorContext<TNodeData, TEdgeData> }) {
  const nodes = context.selectedNodes;
  const shared = getWorkflowEditorSharedInspectorFields(
    nodes.map((node) => ({ data: node.data, fields: context.inspectorFields?.(node) ?? [] })),
  );
  const fields = shared.map((entry) => entry.field);
  const valueByPath = new Map(shared.map((entry) => [entry.field.path, entry.value]));
  const { sections, defaultValues } = createInspectorFieldSections({
    fields,
    values: (field) => valueByPath.get(field.path),
    renderers: context.inspectorFieldRenderers,
    readOnly: context.readOnly,
  });
  const [drafts, setDrafts] = useState<Record<string, InspectorFieldValue>>({});
  const mixedCount = shared.filter((entry) => entry.value === workflowEditorMixedFieldValue).length;

  if (fields.length === 0 || !context.updateDocument) {
    return null;
  }

  return (
    <InspectorPanel
      key={nodes.map((node) => node.id).join("|")}
      title={`Shared settings (${nodes.length} nodes)`}
      description={
        mixedCount > 0
          ? `${mixedCount} field${mixedCount === 1 ? " has" : "s have"} mixed values and stay${mixedCount === 1 ? "s" : ""} unchanged unless edited.`
          : "Edits apply to every selected node."
      }
      readOnly={context.readOnly}
      sections={sections}
      defaultValues={defaultValues}
      validationMessages={validateInspectorFieldDrafts(
        fields,
        { ...defaultValues, ...drafts },
        defaultValues,
      )}
      onValuesChange={(values) => setDrafts(values)}
      onApply={(values) => {
        let document = context.document;
        for (const node of nodes) {
          document = updateWorkflowEditorNode(document, node.id, {
            data: applyInspectorFieldDrafts(node.data, fields, values, defaultValues),
          } as Partial<WorkflowEditorNode<TNodeData>>);
        }
        context.updateDocument?.(document);
      }}
    />
  );
}
