import type { WorkflowWorkbenchController } from "../react";
import { DefaultWorkflowInspector } from "./default-workflow-inspector";

export function WorkflowWorkbenchInspector<
  TNodeData extends Record<string, unknown> = Record<string, unknown>,
  TEdgeData extends Record<string, unknown> = Record<string, unknown>,
  TTemplateData = TNodeData,
>({
  controller,
}: {
  controller: WorkflowWorkbenchController<TNodeData, TEdgeData, TTemplateData>;
}) {
  return (
    <div data-slot="workflow-inspector" className="min-h-0 overflow-y-auto">
      {controller.configuration.renderInspector ? (
        controller.configuration.renderInspector(controller.inspector.context)
      ) : (
        <DefaultWorkflowInspector context={controller.inspector.context} />
      )}
    </div>
  );
}
