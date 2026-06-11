type WorkflowEditorMinimizedNodeInput = {
  kind?: string;
  label: string;
};

export const workflowEditorMinimizedNodeHeight = 36;

const workflowEditorMinimizedNodeBaseWidth = 192;
const workflowEditorMinimizedPrimitiveNodeWidth = 224;
const workflowEditorMinimizedNodeChromeWidth = 112;
const workflowEditorMinimizedNodeAverageCharacterWidth = 7.5;

export function getWorkflowEditorMinimizedNodeWidth(node: WorkflowEditorMinimizedNodeInput) {
  const labelWidth =
    workflowEditorMinimizedNodeChromeWidth +
    Math.ceil([...node.label].length * workflowEditorMinimizedNodeAverageCharacterWidth);
  const controlWidth = isWorkflowEditorJsonPrimitiveKind(node.kind)
    ? workflowEditorMinimizedPrimitiveNodeWidth
    : 0;

  return Math.max(workflowEditorMinimizedNodeBaseWidth, labelWidth, controlWidth);
}

export function isWorkflowEditorJsonPrimitiveKind(kind: string | undefined) {
  return (
    kind === "json.string" ||
    kind === "json.number" ||
    kind === "json.boolean" ||
    kind === "json.null"
  );
}
