import {
  type Dispatch,
  type CSSProperties,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
  type SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";

import {
  clampWorkflowOverlayPosition,
  getWorkflowOverlayMaxHeight,
  getWorkflowPalettePinnedStyle,
  workflowWorkbenchOverlayMargin,
  type WorkflowWorkbenchOverlayPosition,
  type WorkflowWorkbenchPanelPlacement,
} from "./overlay-position";
import type { WorkflowWorkbenchProps } from "./workbench-types";

type WorkflowOverlayDragState = {
  pointerId: number;
  startClientX: number;
  startClientY: number;
  startX: number;
  startY: number;
  width: number;
  height: number;
};

/** Keeps a dragged overlay inside the canvas as the window, canvas or overlay resizes. */
function useWorkflowWorkbenchOverlayPositionClamp(
  position: WorkflowWorkbenchOverlayPosition,
  setPosition: Dispatch<SetStateAction<WorkflowWorkbenchOverlayPosition>>,
  containerRef: RefObject<HTMLDivElement | null>,
  overlayRef: RefObject<HTMLDivElement | null>,
  overlayCollapsed: boolean,
  narrowOverlayLayout: boolean,
) {
  useEffect(() => {
    if (!position) {
      return;
    }

    const syncPosition = () => {
      setPosition((current) => {
        if (!current) {
          return current;
        }

        const next = clampWorkflowOverlayPosition(
          current,
          containerRef.current,
          overlayRef.current,
        );
        return next.x === current.x && next.y === current.y ? current : next;
      });
    };

    syncPosition();
    window.addEventListener("resize", syncPosition);

    const resizeObserver =
      typeof ResizeObserver === "function" ? new ResizeObserver(syncPosition) : null;
    if (containerRef.current) {
      resizeObserver?.observe(containerRef.current);
    }
    if (overlayRef.current) {
      resizeObserver?.observe(overlayRef.current);
    }

    return () => {
      window.removeEventListener("resize", syncPosition);
      resizeObserver?.disconnect();
    };
  }, [narrowOverlayLayout, overlayCollapsed, position !== null]);
}

/** Position, collapse and drag state of the workbench's default palette and inspector overlays. */
export function useWorkflowWorkbenchOverlayState({
  containerRef,
  nothingSelected,
  overlayBehavior,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  nothingSelected: boolean;
  overlayBehavior: WorkflowWorkbenchProps["overlayBehavior"];
}) {
  const paletteRef = useRef<HTMLDivElement | null>(null);
  const inspectorRef = useRef<HTMLDivElement | null>(null);
  const paletteDragRef = useRef<WorkflowOverlayDragState | null>(null);
  const inspectorDragRef = useRef<WorkflowOverlayDragState | null>(null);
  const [inspectorDragging, setInspectorDragging] = useState(false);
  const [inspectorMinimized, setInspectorMinimized] = useState(false);
  const [inspectorPosition, setInspectorPosition] =
    useState<WorkflowWorkbenchOverlayPosition>(null);
  const [narrowOverlayLayout, setNarrowOverlayLayout] = useState(false);
  const [paletteMinimized, setPaletteMinimized] = useState(false);
  const [paletteCorner, setPaletteCorner] = useState<WorkflowWorkbenchPanelPlacement>(
    overlayBehavior?.palette?.defaultPlacement ?? "top-left",
  );
  const [paletteDragging, setPaletteDragging] = useState(false);
  const [palettePosition, setPalettePosition] = useState<WorkflowWorkbenchOverlayPosition>(null);
  const palettePanelBehavior = overlayBehavior?.palette;
  const inspectorPanelBehavior = overlayBehavior?.inspector;
  const effectivePaletteMinimized =
    palettePanelBehavior?.controlledState?.minimized ?? paletteMinimized;
  const effectivePaletteCorner =
    palettePanelBehavior?.controlledState?.placement ??
    paletteCorner ??
    palettePanelBehavior?.defaultPlacement ??
    "top-left";
  const effectivePalettePosition =
    palettePanelBehavior?.controlledState?.position === undefined
      ? palettePosition
      : palettePanelBehavior.controlledState.position;
  const effectiveInspectorMinimized =
    inspectorPanelBehavior?.controlledState?.minimized ?? inspectorMinimized;
  const effectiveInspectorPosition =
    inspectorPanelBehavior?.controlledState?.position === undefined
      ? inspectorPosition
      : inspectorPanelBehavior.controlledState.position;
  // With nothing selected the panel stays collapsed until the user opens document settings (#91).
  const [documentSettingsOpen, setDocumentSettingsOpen] = useState(false);
  const inspectorCollapsed = nothingSelected ? !documentSettingsOpen : effectiveInspectorMinimized;

  useEffect(() => {
    if (typeof window.matchMedia !== "function") {
      return;
    }

    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const syncOverlayLayout = () => setNarrowOverlayLayout(mediaQuery.matches);

    syncOverlayLayout();
    mediaQuery.addEventListener("change", syncOverlayLayout);
    return () => mediaQuery.removeEventListener("change", syncOverlayLayout);
  }, []);

  useWorkflowWorkbenchOverlayPositionClamp(
    palettePosition,
    setPalettePosition,
    containerRef,
    paletteRef,
    paletteMinimized,
    narrowOverlayLayout,
  );
  useWorkflowWorkbenchOverlayPositionClamp(
    inspectorPosition,
    setInspectorPosition,
    containerRef,
    inspectorRef,
    inspectorCollapsed,
    narrowOverlayLayout,
  );

  const pinPaletteToCorner = (corner: WorkflowWorkbenchPanelPlacement) => {
    setPaletteCorner(corner);
    setPalettePosition(null);
    palettePanelBehavior?.onStateChange?.({
      minimized: effectivePaletteMinimized,
      placement: corner,
      position: null,
    });
  };

  const startOverlayDrag = (
    event: ReactPointerEvent<HTMLDivElement>,
    overlay: HTMLDivElement | null,
    dragRef: MutableRefObject<WorkflowOverlayDragState | null>,
    setDragging: (dragging: boolean) => void,
  ) => {
    if (
      event.button !== 0 ||
      !(event.target instanceof Element) ||
      event.target.closest(
        "button, input, textarea, select, [contenteditable='true'], [role='textbox'], [data-slot='dropdown-menu-content']",
      )
    ) {
      return;
    }

    const containerRect = containerRef.current?.getBoundingClientRect();
    const overlayRect = overlay?.getBoundingClientRect();
    if (!containerRect || !overlayRect) {
      return;
    }

    const startPosition = clampWorkflowOverlayPosition(
      {
        x: overlayRect.left - containerRect.left,
        y: overlayRect.top - containerRect.top,
      },
      containerRef.current,
      overlay,
      { width: overlayRect.width, height: overlayRect.height },
    );

    dragRef.current = {
      pointerId: event.pointerId,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startX: startPosition.x,
      startY: startPosition.y,
      width: overlayRect.width,
      height: overlayRect.height,
    };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
    event.preventDefault();
    event.stopPropagation();
  };

  const updateOverlayDrag = (
    event: ReactPointerEvent<HTMLDivElement>,
    overlay: HTMLDivElement | null,
    dragRef: MutableRefObject<WorkflowOverlayDragState | null>,
    setPosition: Dispatch<SetStateAction<WorkflowWorkbenchOverlayPosition>>,
  ) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const nextPosition = clampWorkflowOverlayPosition(
      {
        x: drag.startX + event.clientX - drag.startClientX,
        y: drag.startY + event.clientY - drag.startClientY,
      },
      containerRef.current,
      overlay,
      { width: drag.width, height: drag.height },
    );

    setPosition((current) =>
      current && current.x === nextPosition.x && current.y === nextPosition.y
        ? current
        : nextPosition,
    );
    event.preventDefault();
    event.stopPropagation();
  };

  const completeOverlayDrag = (
    event: ReactPointerEvent<HTMLDivElement>,
    dragRef: MutableRefObject<WorkflowOverlayDragState | null>,
    setDragging: (dragging: boolean) => void,
  ) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    dragRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    event.preventDefault();
    event.stopPropagation();
  };

  const startPaletteDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    startOverlayDrag(event, paletteRef.current, paletteDragRef, setPaletteDragging);
  };

  const updatePaletteDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    updateOverlayDrag(event, paletteRef.current, paletteDragRef, setPalettePosition);
  };

  const completePaletteDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    completeOverlayDrag(event, paletteDragRef, setPaletteDragging);
  };

  const startInspectorDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    startOverlayDrag(event, inspectorRef.current, inspectorDragRef, setInspectorDragging);
  };

  const updateInspectorDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    updateOverlayDrag(event, inspectorRef.current, inspectorDragRef, setInspectorPosition);
  };

  const completeInspectorDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    completeOverlayDrag(event, inspectorDragRef, setInspectorDragging);
  };

  const setPaletteMinimizedState = (minimized: boolean) => {
    setPaletteMinimized(minimized);
    palettePanelBehavior?.onStateChange?.({
      minimized,
      placement: effectivePaletteCorner,
      position: effectivePalettePosition,
    });
  };

  const setPalettePositionState = (position: WorkflowWorkbenchOverlayPosition) => {
    setPalettePosition(position);
    palettePanelBehavior?.onStateChange?.({
      minimized: effectivePaletteMinimized,
      placement: effectivePaletteCorner,
      position,
    });
  };

  const setPalettePlacementState = (placement: WorkflowWorkbenchPanelPlacement) => {
    setPaletteCorner(placement);
    setPalettePosition(null);
    palettePanelBehavior?.onStateChange?.({
      minimized: effectivePaletteMinimized,
      placement,
      position: null,
    });
  };

  const setInspectorMinimizedState = (minimized: boolean) => {
    setInspectorMinimized(minimized);
    inspectorPanelBehavior?.onStateChange?.({
      minimized,
      position: effectiveInspectorPosition,
    });
  };

  const setInspectorPositionState = (position: WorkflowWorkbenchOverlayPosition) => {
    setInspectorPosition(position);
    inspectorPanelBehavior?.onStateChange?.({
      minimized: effectiveInspectorMinimized,
      position,
    });
  };

  const paletteOverlayPosition: CSSProperties = effectivePalettePosition
    ? {
        left: effectivePalettePosition.x,
        maxHeight: getWorkflowOverlayMaxHeight(effectivePalettePosition.y),
        top: effectivePalettePosition.y,
      }
    : {
        ...getWorkflowPalettePinnedStyle(effectivePaletteCorner),
        maxHeight: `calc(100% - ${workflowWorkbenchOverlayMargin * 2}px)`,
      };
  const inspectorOverlayPosition: CSSProperties = effectiveInspectorPosition
    ? {
        left: effectiveInspectorPosition.x,
        maxHeight: getWorkflowOverlayMaxHeight(effectiveInspectorPosition.y),
        top: effectiveInspectorPosition.y,
      }
    : { maxHeight: "calc(100% - 4.75rem)", right: "0.75rem", top: "4rem" };

  return {
    palette: {
      ref: paletteRef,
      dragging: paletteDragging,
      minimized: effectivePaletteMinimized,
      placement: effectivePaletteCorner,
      position: effectivePalettePosition,
      style: paletteOverlayPosition,
      pinToCorner: pinPaletteToCorner,
      setMinimized: setPaletteMinimizedState,
      setPlacement: setPalettePlacementState,
      setPosition: setPalettePositionState,
      startDrag: startPaletteDrag,
      updateDrag: updatePaletteDrag,
      completeDrag: completePaletteDrag,
    },
    inspector: {
      ref: inspectorRef,
      collapsed: inspectorCollapsed,
      dragging: inspectorDragging,
      minimized: effectiveInspectorMinimized,
      position: effectiveInspectorPosition,
      style: inspectorOverlayPosition,
      setMinimized: setInspectorMinimizedState,
      setPosition: setInspectorPositionState,
      toggleCollapsed: () =>
        nothingSelected
          ? setDocumentSettingsOpen(!documentSettingsOpen)
          : setInspectorMinimizedState(!effectiveInspectorMinimized),
      startDrag: startInspectorDrag,
      updateDrag: updateInspectorDrag,
      completeDrag: completeInspectorDrag,
    },
  };
}

export type WorkflowWorkbenchOverlayState = ReturnType<typeof useWorkflowWorkbenchOverlayState>;
