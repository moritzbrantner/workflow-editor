import type { CSSProperties } from "react";

export const workflowWorkbenchOverlayMargin = 12;

export type WorkflowWorkbenchPanelPlacement =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export type WorkflowWorkbenchOverlayPosition = { x: number; y: number } | null;

export type WorkflowWorkbenchPanelState = {
  minimized?: boolean;
  placement?: WorkflowWorkbenchPanelPlacement;
  position?: WorkflowWorkbenchOverlayPosition;
};

export type WorkflowWorkbenchPanelBehavior = {
  mode?: "overlay" | "inline" | "external";
  defaultPlacement?: WorkflowWorkbenchPanelPlacement;
  draggable?: boolean;
  minimizable?: boolean;
  controlledState?: WorkflowWorkbenchPanelState;
  onStateChange?: (state: WorkflowWorkbenchPanelState) => void;
};

export function clampWorkflowOverlayPosition(
  position: NonNullable<WorkflowWorkbenchOverlayPosition>,
  container: HTMLElement | null,
  overlay: HTMLElement | null,
  size?: { width: number; height: number },
) {
  const containerRect = container?.getBoundingClientRect();
  const overlayRect = overlay?.getBoundingClientRect();
  const width = size?.width ?? overlayRect?.width ?? 0;
  const height = size?.height ?? overlayRect?.height ?? 0;

  if (!containerRect || width <= 0 || height <= 0) {
    return position;
  }

  const minX = workflowWorkbenchOverlayMargin;
  const minY = workflowWorkbenchOverlayMargin;
  const maxX = Math.max(minX, containerRect.width - width - workflowWorkbenchOverlayMargin);
  const maxY = Math.max(minY, containerRect.height - height - workflowWorkbenchOverlayMargin);

  return {
    x: Math.min(Math.max(position.x, minX), maxX),
    y: Math.min(Math.max(position.y, minY), maxY),
  };
}

export function getWorkflowOverlayMaxHeight(top: number) {
  return `calc(100% - ${Math.max(top, 0) + workflowWorkbenchOverlayMargin}px)`;
}

export function getWorkflowPalettePinnedStyle(
  placement: WorkflowWorkbenchPanelPlacement,
): CSSProperties {
  const offset = "0.75rem";

  switch (placement) {
    case "top-right":
      return { right: offset, top: offset };
    case "bottom-left":
      return { bottom: offset, left: offset };
    case "bottom-right":
      return { bottom: offset, right: offset };
    case "top-left":
    default:
      return { left: offset, top: offset };
  }
}
