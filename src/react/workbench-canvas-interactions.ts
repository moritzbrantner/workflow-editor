import {
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  useEffect,
  useRef,
} from "react";

import type { WorkflowEditorSelectionState, WorkflowEditorViewport } from "../core";
import {
  getWorkflowEditorWheelDelta,
  isWorkflowWorkbenchOverlayInteractionTarget,
} from "./workbench-dom";
import {
  clampWorkflowEditorZoom,
  emptyWorkflowEditorSelection,
  normalizeWorkflowEditorViewport,
} from "./workbench-model";

const workflowEditorPanActivationDistance = 3;

type WorkflowCanvasPanState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  viewport: WorkflowEditorViewport;
  panning: boolean;
};

/** Background pan, wheel pan/zoom and the click-to-clear-selection of the workflow canvas. */
export function useWorkflowWorkbenchCanvasInteractions({
  commitViewportChange,
  containerRef,
  emitSelectionState,
  viewport,
}: {
  commitViewportChange: (viewport: WorkflowEditorViewport) => void;
  containerRef: RefObject<HTMLDivElement | null>;
  emitSelectionState: (selection: WorkflowEditorSelectionState) => void;
  viewport: WorkflowEditorViewport | undefined;
}) {
  const canvasPanRef = useRef<WorkflowCanvasPanState | null>(null);
  const pointerModifierRef = useRef({ additive: false });

  const startCanvasPointerInteraction = (event: ReactPointerEvent<HTMLDivElement>) => {
    pointerModifierRef.current = { additive: event.shiftKey || event.metaKey || event.ctrlKey };
    const target = event.target;
    if (target instanceof Element && isWorkflowWorkbenchOverlayInteractionTarget(target)) {
      return;
    }

    if (
      event.button !== 0 ||
      !(target instanceof Element) ||
      target.closest(
        "[data-slot='workflow-builder-node'], [data-slot='workflow-node-port'], [data-slot='workflow-builder-edge'], [data-slot='workflow-builder-edge-hit'], [data-slot='workflow-builder-edge-handle'], [data-slot='workflow-group'], button, input, textarea, select",
      )
    ) {
      return;
    }

    if (event.shiftKey || event.metaKey || event.ctrlKey) {
      const surface = target.closest<HTMLElement>("[data-slot='workflow-builder-surface']");
      surface?.setPointerCapture?.(event.pointerId);
      return;
    }

    const currentViewport = normalizeWorkflowEditorViewport(viewport);
    canvasPanRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      viewport: currentViewport,
      panning: false,
    };
    event.stopPropagation();
  };

  const preserveGraphCanvasModifierSelection = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!event.shiftKey && !event.metaKey && !event.ctrlKey) {
      return;
    }

    const target = event.target;
    if (target instanceof Element && target.closest("[data-slot='workflow-node-select']")) {
      event.stopPropagation();
    }
  };

  const updateCanvasPointerInteraction = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pan = canvasPanRef.current;
    if (pan && pan.pointerId === event.pointerId) {
      const dx = event.clientX - pan.startClientX;
      const dy = event.clientY - pan.startClientY;

      if (!pan.panning && Math.hypot(dx, dy) < workflowEditorPanActivationDistance) {
        return;
      }

      if (!pan.panning) {
        event.currentTarget.setPointerCapture?.(event.pointerId);
        pan.panning = true;
      }
      event.preventDefault();
      event.stopPropagation();
      commitViewportChange({
        x: Math.round(pan.viewport.x + dx),
        y: Math.round(pan.viewport.y + dy),
        zoom: pan.viewport.zoom,
      });
      return;
    }
  };

  const completeCanvasPointerInteraction = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pan = canvasPanRef.current;

    if (!pan || pan.pointerId !== event.pointerId) {
      return false;
    }

    canvasPanRef.current = null;
    if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    }

    if (!pan.panning) {
      if (!pointerModifierRef.current.additive) {
        emitSelectionState(emptyWorkflowEditorSelection);
      }
      return false;
    }

    event.preventDefault();
    event.stopPropagation();
    return true;
  };

  const cancelCanvasPointerInteraction = (event: ReactPointerEvent<HTMLDivElement>) => {
    const pan = canvasPanRef.current;
    if (pan?.pointerId === event.pointerId) {
      canvasPanRef.current = null;
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture?.(event.pointerId);
      }
    }
  };

  const handleCanvasWheel = (event: WheelEvent) => {
    const target = event.target;
    if (target instanceof Element && isWorkflowWorkbenchOverlayInteractionTarget(target)) {
      event.stopPropagation();
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (!event.ctrlKey) {
      const currentViewport = normalizeWorkflowEditorViewport(viewport);
      const delta = getWorkflowEditorWheelDelta(event);
      const nextViewport = event.shiftKey
        ? {
            ...currentViewport,
            y: Math.round(currentViewport.y - (delta.y || delta.x)),
          }
        : {
            ...currentViewport,
            x: Math.round(currentViewport.x - (delta.x || delta.y)),
          };

      if (nextViewport.x === currentViewport.x && nextViewport.y === currentViewport.y) {
        return;
      }

      commitViewportChange(nextViewport);
      return;
    }

    const surface = containerRef.current?.querySelector<HTMLElement>(
      "[data-slot='workflow-builder-surface']",
    );
    const rect = surface?.getBoundingClientRect();

    if (!rect) {
      return;
    }

    const currentViewport = normalizeWorkflowEditorViewport(viewport);
    const currentZoom = currentViewport.zoom;
    const nextZoom = clampWorkflowEditorZoom(
      currentZoom * Math.exp(-getWorkflowEditorWheelDelta(event).y * 0.002),
    );

    if (nextZoom === currentZoom) {
      return;
    }

    const localX = event.clientX - rect.left;
    const localY = event.clientY - rect.top;
    const canvasX = (localX - currentViewport.x) / currentZoom;
    const canvasY = (localY - currentViewport.y) / currentZoom;
    const nextViewport = {
      x: Math.round(localX - canvasX * nextZoom),
      y: Math.round(localY - canvasY * nextZoom),
      zoom: nextZoom,
    };

    commitViewportChange(nextViewport);
  };

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    container.addEventListener("wheel", handleCanvasWheel, { capture: true, passive: false });
    return () => container.removeEventListener("wheel", handleCanvasWheel, { capture: true });
  });

  return {
    cancelCanvasPointerInteraction,
    completeCanvasPointerInteraction,
    preserveGraphCanvasModifierSelection,
    startCanvasPointerInteraction,
    updateCanvasPointerInteraction,
  };
}
