import { type SyntheticEvent, useEffect, useRef, useState } from "react";
import { Maximize2Icon, Minimize2Icon, MoreHorizontalIcon } from "lucide-react";
import { Button, Input, cn } from "@moritzbrantner/ui";

import type { WorkflowEditorDocument, WorkflowEditorGroup } from "../core";
import { getWorkflowEditorRenderedNodeSize } from "../react-snap";
import type { WorkflowEditorPoint } from "./workbench-types";

type WorkflowGroupOverlayDragState = {
  groupId: string;
  pointerId: number;
  startClientX: number;
  startClientY: number;
  committedX: number;
  committedY: number;
};

export function WorkflowGroupOverlays<
  TNodeData extends Record<string, unknown>,
  TEdgeData extends Record<string, unknown>,
>({
  document,
  readOnly,
  selectedGroupId,
  zoom,
  onDeleteGroup,
  onMoveGroup,
  onRenameGroup,
  onSelectGroup,
  onToggleGroupMinimized,
  onUngroupGroup,
}: {
  document: WorkflowEditorDocument<TNodeData, TEdgeData>;
  readOnly: boolean;
  selectedGroupId?: string;
  zoom: number;
  onDeleteGroup: (groupId: string) => void;
  onMoveGroup: (groupId: string, delta: WorkflowEditorPoint) => void;
  onRenameGroup: (groupId: string, label: string) => void;
  onSelectGroup: (groupId: string) => void;
  onToggleGroupMinimized: (groupId: string) => void;
  onUngroupGroup: (groupId: string) => void;
}) {
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const dragRef = useRef<WorkflowGroupOverlayDragState | null>(null);

  useEffect(() => {
    const ownerDocument = globalThis.document;
    if (!ownerDocument) {
      return;
    }

    const move = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }

      const nextX = Math.round((event.clientX - drag.startClientX) / zoom);
      const nextY = Math.round((event.clientY - drag.startClientY) / zoom);
      const delta = { x: nextX - drag.committedX, y: nextY - drag.committedY };
      if (delta.x === 0 && delta.y === 0) {
        return;
      }

      drag.committedX = nextX;
      drag.committedY = nextY;
      onMoveGroup(drag.groupId, delta);
    };
    const end = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (drag?.pointerId === event.pointerId) {
        dragRef.current = null;
      }
    };

    ownerDocument.addEventListener("pointermove", move);
    ownerDocument.addEventListener("pointerup", end);
    ownerDocument.addEventListener("pointercancel", end);
    return () => {
      ownerDocument.removeEventListener("pointermove", move);
      ownerDocument.removeEventListener("pointerup", end);
      ownerDocument.removeEventListener("pointercancel", end);
    };
  }, [onMoveGroup, zoom]);

  const groups = document.groups ?? [];
  if (groups.length === 0) {
    return null;
  }

  const stopInteractionPropagation = (event: SyntheticEvent) => {
    event.stopPropagation();
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-[15]" aria-hidden={false}>
      {groups.map((group) => {
        const bounds = getWorkflowEditorRenderedGroupBounds(document, group);
        if (!bounds) {
          return null;
        }

        const selected = group.id === selectedGroupId;
        const minimized = group.minimized === true;
        const open = openGroupId === group.id;
        const frameStyle = minimized
          ? {
              height: 48,
              left: bounds.left,
              top: bounds.top,
              width: Math.max(220, Math.min(360, bounds.width)),
            }
          : {
              height: bounds.height,
              left: bounds.left,
              top: bounds.top,
              width: bounds.width,
            };

        return (
          <div
            key={group.id}
            data-slot="workflow-group"
            data-group-id={group.id}
            data-selected={selected ? "true" : undefined}
            data-minimized={minimized ? "true" : undefined}
            className={cn(
              "absolute rounded-lg border bg-background/35 shadow-sm",
              selected ? "border-primary ring-2 ring-primary/20" : "border-border/80",
              minimized ? "bg-card/95" : "bg-primary/5",
            )}
            style={frameStyle}
            onClick={(event) => {
              event.stopPropagation();
              onSelectGroup(group.id);
            }}
          >
            <div
              data-slot="workflow-group-header"
              className={cn(
                "pointer-events-auto absolute left-2 top-2 flex h-8 min-w-0 items-center gap-1 rounded-md border bg-background/95 px-1.5 shadow-sm",
                minimized &&
                  "left-0 top-0 h-12 w-full rounded-lg border-0 bg-transparent shadow-none",
              )}
              onClick={stopInteractionPropagation}
              onMouseDown={stopInteractionPropagation}
              onPointerDown={(event) => {
                stopInteractionPropagation(event);
                onSelectGroup(group.id);
                if (readOnly || event.button !== 0) {
                  return;
                }

                dragRef.current = {
                  groupId: group.id,
                  pointerId: event.pointerId,
                  startClientX: event.clientX,
                  startClientY: event.clientY,
                  committedX: 0,
                  committedY: 0,
                };
              }}
            >
              <span
                data-slot="workflow-group-drag-handle"
                className="h-4 w-2 cursor-grab rounded-sm bg-muted-foreground/35"
                aria-hidden="true"
              />
              <Input
                aria-label={`${group.label} group label`}
                className="h-6 min-w-0 w-32 border-0 bg-transparent px-1 text-xs font-medium shadow-none focus-visible:ring-1"
                defaultValue={group.label}
                disabled={readOnly}
                onClick={stopInteractionPropagation}
                onPointerDown={stopInteractionPropagation}
                onBlur={(event) => onRenameGroup(group.id, event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.currentTarget.blur();
                  }
                }}
              />
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                className="size-6"
                disabled={readOnly}
                aria-label={
                  minimized ? `Expand ${group.label} group` : `Minimize ${group.label} group`
                }
                onPointerDown={stopInteractionPropagation}
                onClick={(event) => {
                  stopInteractionPropagation(event);
                  onToggleGroupMinimized(group.id);
                }}
              >
                {minimized ? (
                  <Maximize2Icon className="size-3.5" aria-hidden="true" />
                ) : (
                  <Minimize2Icon className="size-3.5" aria-hidden="true" />
                )}
              </Button>
              <Button
                type="button"
                size="icon-sm"
                variant="ghost"
                className="size-6"
                aria-expanded={open}
                aria-haspopup="menu"
                aria-label={`${group.label} group actions`}
                onPointerDown={stopInteractionPropagation}
                onClick={(event) => {
                  stopInteractionPropagation(event);
                  setOpenGroupId((current) => (current === group.id ? null : group.id));
                }}
              >
                <MoreHorizontalIcon className="size-3.5" aria-hidden="true" />
              </Button>
              {open ? (
                <div
                  role="menu"
                  data-slot="workflow-group-action-menu-content"
                  className="absolute right-0 top-9 z-[20020] grid w-40 gap-1 rounded-md bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
                  onPointerDown={stopInteractionPropagation}
                >
                  <div className="truncate px-1.5 py-1 text-xs font-medium text-muted-foreground">
                    {group.label}
                  </div>
                  <button
                    type="button"
                    role="menuitem"
                    className="rounded-sm px-1.5 py-1.5 text-left text-sm outline-none transition-colors hover:bg-accent focus:bg-accent disabled:pointer-events-none disabled:opacity-50"
                    disabled={readOnly}
                    onClick={() => {
                      setOpenGroupId(null);
                      onToggleGroupMinimized(group.id);
                    }}
                  >
                    {minimized ? "Expand" : "Minimize"}
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="rounded-sm px-1.5 py-1.5 text-left text-sm outline-none transition-colors hover:bg-accent focus:bg-accent disabled:pointer-events-none disabled:opacity-50"
                    disabled={readOnly}
                    onClick={() => {
                      setOpenGroupId(null);
                      onUngroupGroup(group.id);
                    }}
                  >
                    Ungroup
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    className="rounded-sm px-1.5 py-1.5 text-left text-sm text-destructive outline-none transition-colors hover:bg-destructive/10 focus:bg-destructive/10 disabled:pointer-events-none disabled:opacity-50"
                    disabled={readOnly}
                    onClick={() => {
                      setOpenGroupId(null);
                      onDeleteGroup(group.id);
                    }}
                  >
                    Delete contents
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function getWorkflowEditorRenderedGroupBounds<
  TNodeData extends Record<string, unknown>,
  TEdgeData extends Record<string, unknown>,
>(document: WorkflowEditorDocument<TNodeData, TEdgeData>, group: WorkflowEditorGroup) {
  const nodeIds = new Set(group.nodeIds);
  const nodes = document.nodes.filter((node) => nodeIds.has(node.id));
  if (nodes.length === 0) {
    return null;
  }

  const boxes = nodes.map((node) => {
    const size = getWorkflowEditorRenderedNodeSize(node);
    return {
      left: node.x,
      top: node.y,
      right: node.x + size.width,
      bottom: node.y + size.height,
    };
  });
  const left = Math.min(...boxes.map((box) => box.left)) - 16;
  const top = Math.min(...boxes.map((box) => box.top)) - 42;
  const right = Math.max(...boxes.map((box) => box.right)) + 16;
  const bottom = Math.max(...boxes.map((box) => box.bottom)) + 16;

  return {
    left,
    top,
    width: Math.max(220, right - left),
    height: Math.max(80, bottom - top),
  };
}
