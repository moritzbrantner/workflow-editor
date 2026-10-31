import type { WorkflowEditorPoint } from "./workbench-types";

const workflowWorkbenchOverlayInteractionSelector =
  "[data-slot='workflow-palette-overlay'], [data-slot='workflow-inspector-overlay'], [data-slot='workflow-node-rename-control'], [data-slot='workflow-json-primitive-node-control'], [data-slot='workflow-object-constructor-node-control'], [data-slot='workflow-port-connection-menu'], [data-slot='select-content'], [data-slot='dropdown-menu-content']";

export function isWorkflowWorkbenchOverlayInteractionTarget(target: EventTarget | null) {
  return target instanceof Element && !!target.closest(workflowWorkbenchOverlayInteractionSelector);
}

export function isEditableEventTarget(target: EventTarget | null) {
  return (
    target instanceof HTMLElement &&
    !!target.closest(
      "input, textarea, select, [contenteditable='true'], [role='textbox'], [data-slot='workflow-json-primitive-node-control']",
    )
  );
}

export function getWorkflowEditorPointFromClient(
  container: HTMLDivElement | null,
  clientX: number,
  clientY: number,
  zoom: number,
): WorkflowEditorPoint | null {
  const viewport = container?.querySelector<HTMLElement>("[data-slot='workflow-builder-viewport']");
  const rect = viewport?.getBoundingClientRect();

  if (!rect || zoom <= 0) {
    return null;
  }

  return {
    x: (clientX - rect.left) / zoom,
    y: (clientY - rect.top) / zoom,
  };
}

export function getWorkflowEditorWheelDelta(event: WheelEvent) {
  const multiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? 600 : 1;

  return {
    x: event.deltaX * multiplier,
    y: event.deltaY * multiplier,
  };
}
