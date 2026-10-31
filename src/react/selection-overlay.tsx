import type { WorkflowEditorDocument, WorkflowEditorSelectionState } from "../core";
import { getWorkflowEditorRenderedNodeSize } from "../react-snap";

type WorkflowSelectionMarquee = {
  pointerId: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
};

export function WorkflowSelectionOverlay<
  TNodeData extends Record<string, unknown>,
  TEdgeData extends Record<string, unknown>,
>({
  document,
  marquee,
  primaryNodeId,
  selection,
}: {
  document: WorkflowEditorDocument<TNodeData, TEdgeData>;
  marquee: WorkflowSelectionMarquee | null;
  primaryNodeId?: string;
  selection: WorkflowEditorSelectionState;
}) {
  const selectedNodeIds = new Set(selection.nodeIds.filter((id) => id !== primaryNodeId));
  const marqueeRect = marquee ? normalizeRect(marquee) : null;

  return (
    <div className="pointer-events-none absolute inset-0 z-20" aria-hidden="true">
      {document.nodes
        .filter((node) => selectedNodeIds.has(node.id))
        .map((node) => {
          const size = getWorkflowEditorRenderedNodeSize(node);
          return (
            <div
              key={node.id}
              data-testid={`multi-selection-outline-${node.id}`}
              className="absolute rounded-xl border-2 border-primary/70 bg-primary/5"
              style={{
                height: size.height,
                left: node.x,
                top: node.y,
                width: size.width,
              }}
            />
          );
        })}
      {marqueeRect ? (
        <div
          data-testid="selection-marquee"
          className="absolute border border-primary bg-primary/10"
          style={{
            height: marqueeRect.bottom - marqueeRect.top,
            left: marqueeRect.left,
            top: marqueeRect.top,
            width: marqueeRect.right - marqueeRect.left,
          }}
        />
      ) : null}
    </div>
  );
}

export const WorkflowWorkbenchSelectionOverlay = WorkflowSelectionOverlay;

function normalizeRect(rect: WorkflowSelectionMarquee) {
  return {
    left: Math.min(rect.startX, rect.currentX),
    top: Math.min(rect.startY, rect.currentY),
    right: Math.max(rect.startX, rect.currentX),
    bottom: Math.max(rect.startY, rect.currentY),
  };
}
