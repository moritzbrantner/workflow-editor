import {
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type MutableRefObject,
  type RefObject,
  type SyntheticEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

import {
  createWorkflowEditorDocumentContext,
  resolveWorkflowEditorDocumentTypes,
  validateWorkflowEditorConnection,
  type WorkflowEditorDocument,
  type WorkflowEditorTypeDefinition,
} from "../core";
import type { WorkflowEditorDocumentContext } from "../core-context";
import { createWorkflowEditorTypeResolver } from "../core-type-resolver";
import {
  getWorkflowWorkbenchConnectionKey,
  type WorkflowWorkbenchConnectionCoordinates,
} from "./workbench-model";

type WorkflowWorkbenchPortDirection = "input" | "output";

type WorkflowWorkbenchPortConnectionMenuState = {
  direction: WorkflowWorkbenchPortDirection;
  nodeId: string;
  portId: string;
  x: number;
  y: number;
};

type WorkflowWorkbenchPortConnectionMenuOption = {
  connection: WorkflowWorkbenchConnectionCoordinates;
  id: string;
  nodeLabel: string;
  portLabel: string;
  portTypeLabel?: string;
  error?: string;
};

/** Owns the port context menu: closes it with its port, on outside press and on Escape. */
export function useWorkflowPortConnectionMenu<TNodeData, TEdgeData>({
  connectionInProgressRef,
  containerRef,
  documentContext,
  readOnly,
}: {
  connectionInProgressRef: MutableRefObject<boolean>;
  containerRef: RefObject<HTMLDivElement | null>;
  documentContext: WorkflowEditorDocumentContext<TNodeData, TEdgeData>;
  readOnly: boolean;
}) {
  const [portConnectionMenu, setPortConnectionMenu] =
    useState<WorkflowWorkbenchPortConnectionMenuState | null>(null);

  useEffect(() => {
    if (!portConnectionMenu) {
      return;
    }

    const portExists =
      portConnectionMenu.direction === "input"
        ? !!documentContext.getInputPort(portConnectionMenu.nodeId, portConnectionMenu.portId)
        : !!documentContext.getOutputPort(portConnectionMenu.nodeId, portConnectionMenu.portId);

    if (!portExists) {
      setPortConnectionMenu(null);
    }
  }, [documentContext, portConnectionMenu]);

  useEffect(() => {
    if (!portConnectionMenu) {
      return;
    }

    const ownerDocument = containerRef.current?.ownerDocument ?? globalThis.document;

    if (!ownerDocument) {
      return;
    }

    const closeOnPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest("[data-slot='workflow-port-connection-menu']")
      ) {
        return;
      }

      setPortConnectionMenu(null);
    };
    const closeOnKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPortConnectionMenu(null);
      }
    };

    ownerDocument.addEventListener("pointerdown", closeOnPointerDown, true);
    ownerDocument.addEventListener("keydown", closeOnKeyDown);
    return () => {
      ownerDocument.removeEventListener("pointerdown", closeOnPointerDown, true);
      ownerDocument.removeEventListener("keydown", closeOnKeyDown);
    };
  }, [portConnectionMenu]);

  const openPortConnectionMenu = (
    event: ReactMouseEvent<HTMLDivElement> | ReactKeyboardEvent<HTMLDivElement>,
  ) => {
    const container = containerRef.current;
    const portTarget = getWorkflowPortContextTarget(container, event);

    if (!container || !portTarget || readOnly) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    connectionInProgressRef.current = false;
    setPortConnectionMenu({
      ...portTarget,
      x: Math.round(
        ("clientX" in event
          ? event.clientX
          : (event.target as HTMLElement).getBoundingClientRect().right) + 4,
      ),
      y: Math.round(
        ("clientY" in event
          ? event.clientY
          : (event.target as HTMLElement).getBoundingClientRect().top) + 4,
      ),
    });
  };

  return { openPortConnectionMenu, portConnectionMenu, setPortConnectionMenu };
}

export function WorkflowPortConnectionMenu<
  TNodeData extends Record<string, unknown>,
  TEdgeData extends Record<string, unknown>,
>({
  document,
  menu,
  typeDefinitions,
  onClose,
  onConnect,
}: {
  document: WorkflowEditorDocument<TNodeData, TEdgeData>;
  menu: WorkflowWorkbenchPortConnectionMenuState;
  typeDefinitions?: readonly WorkflowEditorTypeDefinition[];
  onClose: () => void;
  onConnect: (connection: WorkflowWorkbenchConnectionCoordinates) => void;
}) {
  const context = useMemo(() => createWorkflowEditorDocumentContext(document), [document]);
  const node = context.nodeById.get(menu.nodeId);
  const port =
    menu.direction === "input"
      ? context.getInputPort(menu.nodeId, menu.portId)
      : context.getOutputPort(menu.nodeId, menu.portId);
  const options = useMemo(
    () => getWorkflowPortConnectionMenuOptions(document, menu, typeDefinitions),
    [document, menu, typeDefinitions],
  );
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previousFocus = globalThis.document?.activeElement;
    const element = menuRef.current;
    if (element && globalThis.window) {
      const bounds = element.getBoundingClientRect();
      element.style.left = `${Math.max(8, Math.min(menu.x, window.innerWidth - bounds.width - 8))}px`;
      element.style.top = `${Math.max(8, Math.min(menu.y, window.innerHeight - bounds.height - 8))}px`;
      element.querySelector<HTMLButtonElement>("button")?.focus();
    }
    return () => {
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) {
        previousFocus.focus();
      }
    };
  }, [menu]);
  const title = `${node?.label ?? menu.nodeId} ${port?.label ?? menu.portId}`;
  const targetLabel = menu.direction === "output" ? "Possible inputs" : "Possible outputs";
  const ownerDocument = globalThis.document;

  const stopInteractionPropagation = (event: SyntheticEvent) => {
    event.stopPropagation();
  };

  if (!ownerDocument?.body) {
    return null;
  }

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      data-slot="workflow-port-connection-menu"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onClose();
          return;
        }
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
          return;
        }
        const choices = [...event.currentTarget.querySelectorAll<HTMLButtonElement>("button")];
        if (!choices.length) {
          return;
        }
        event.preventDefault();
        event.stopPropagation();
        const current = choices.indexOf(globalThis.document.activeElement as HTMLButtonElement);
        let next =
          event.key === "ArrowUp"
            ? (current - 1 + choices.length) % choices.length
            : (current + 1) % choices.length;
        if (event.key === "Home") {
          next = 0;
        }
        if (event.key === "End") {
          next = choices.length - 1;
        }
        choices[next]?.focus();
      }}
      aria-label={`${title} ${targetLabel}`}
      className="fixed z-[30000] grid max-h-72 w-56 gap-1 overflow-auto rounded-md bg-popover p-1 text-popover-foreground shadow-md ring-1 ring-foreground/10"
      style={{
        left: Math.max(8, menu.x),
        top: Math.max(8, menu.y),
      }}
      onClick={stopInteractionPropagation}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onMouseDown={stopInteractionPropagation}
      onPointerDown={stopInteractionPropagation}
    >
      <div className="px-1.5 py-1">
        <div className="truncate text-xs font-medium text-muted-foreground">{targetLabel}</div>
        <div className="truncate text-[11px] text-muted-foreground/80">{title}</div>
      </div>
      {options.length === 0 ? (
        <div
          role="menuitem"
          aria-disabled="true"
          className="rounded-sm px-1.5 py-1.5 text-sm text-muted-foreground"
        >
          No compatible {menu.direction === "output" ? "inputs" : "outputs"}
        </div>
      ) : (
        options.map((option) => (
          <button
            key={option.id}
            type="button"
            role="menuitem"
            aria-label={`${option.nodeLabel} ${option.portLabel}`}
            aria-disabled={Boolean(option.error)}
            title={option.error}
            className="grid min-w-0 gap-0.5 rounded-sm px-1.5 py-1.5 text-left text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground"
            onClick={() => {
              if (option.error) {
                return;
              }
              onConnect(option.connection);
              onClose();
            }}
          >
            <span className="truncate font-medium">
              {option.nodeLabel} {option.portLabel}
            </span>
            {option.error ? <span className="text-xs text-destructive">{option.error}</span> : null}
            {option.portTypeLabel ? (
              <span className="truncate text-[11px] text-muted-foreground">
                {option.portTypeLabel}
              </span>
            ) : null}
          </button>
        ))
      )}
    </div>,
    ownerDocument.body,
  );
}

function getWorkflowPortConnectionMenuOptions<
  TNodeData extends Record<string, unknown>,
  TEdgeData extends Record<string, unknown>,
>(
  document: WorkflowEditorDocument<TNodeData, TEdgeData>,
  menu: WorkflowWorkbenchPortConnectionMenuState,
  typeDefinitions?: readonly WorkflowEditorTypeDefinition[],
): WorkflowWorkbenchPortConnectionMenuOption[] {
  document = resolveWorkflowEditorDocumentTypes(document, { typeDefinitions });
  const options: WorkflowWorkbenchPortConnectionMenuOption[] = [];
  const context = createWorkflowEditorDocumentContext(document);
  const selectedPort =
    menu.direction === "output"
      ? context.getOutputPort(menu.nodeId, menu.portId)
      : context.getInputPort(menu.nodeId, menu.portId);
  if (selectedPort) {
    createWorkflowEditorTypeResolver(typeDefinitions, document.typeDeclarations).prepareChecks(
      document.nodes.flatMap((node) =>
        (menu.direction === "output" ? (node.inputs ?? []) : (node.outputs ?? [])).flatMap(
          (port) => {
            const source = menu.direction === "output" ? selectedPort.type : port.type;
            const target = menu.direction === "output" ? port.type : selectedPort.type;
            return [
              { source, target },
              { source, target: { kind: "any" } as const },
            ];
          },
        ),
      ),
    );
  }

  for (const node of document.nodes) {
    const ports = menu.direction === "output" ? (node.inputs ?? []) : (node.outputs ?? []);

    for (const port of ports) {
      const connection =
        menu.direction === "output"
          ? {
              sourceNodeId: menu.nodeId,
              sourcePortId: menu.portId,
              targetNodeId: node.id,
              targetPortId: port.id,
            }
          : {
              sourceNodeId: node.id,
              sourcePortId: port.id,
              targetNodeId: menu.nodeId,
              targetPortId: menu.portId,
            };
      const validity = validateWorkflowEditorConnection(document, connection, { typeDefinitions });

      if (!validity.valid && !isExplainedWorkflowConnectionRejection(validity.reason)) {
        continue;
      }

      options.push({
        ...(validity.valid ? {} : { error: validity.message ?? "Incompatible port types" }),
        connection,
        id: getWorkflowWorkbenchConnectionKey(connection),
        nodeLabel: node.label,
        portLabel: port.label,
        portTypeLabel: formatWorkflowPortConnectionMenuType(port.type),
      });
    }
  }

  return options;
}

/** Contract rejections stay listed (disabled, with their reason); structural ones are hidden. */
function isExplainedWorkflowConnectionRejection(
  reason: ReturnType<typeof validateWorkflowEditorConnection>["reason"],
) {
  return (
    reason === "type-mismatch" ||
    reason === "payload-mode-mismatch" ||
    reason === "media-type-mismatch" ||
    reason === "target-cardinality" ||
    reason === "source-cardinality"
  );
}

function formatWorkflowPortConnectionMenuType(type: unknown) {
  if (!type || typeof type !== "object" || !("kind" in type)) {
    return undefined;
  }

  if ((type as { kind?: unknown }).kind === "typescript") {
    return "source" in type && typeof type.source === "string" ? type.source : undefined;
  }
  const kind = (type as { kind?: unknown }).kind;
  return typeof kind === "string" ? kind : undefined;
}

function getWorkflowPortContextTarget(
  container: HTMLElement | null,
  event: ReactMouseEvent | ReactKeyboardEvent,
): Pick<WorkflowWorkbenchPortConnectionMenuState, "direction" | "nodeId" | "portId"> | null {
  if (!container) {
    return null;
  }

  const eventTarget = event.target;
  const directPort =
    eventTarget instanceof Element
      ? eventTarget.closest<HTMLElement>(
          "[data-slot='workflow-node-port'][data-port-direction][data-port-id]",
        )
      : null;
  const portElement =
    directPort && container.contains(directPort)
      ? directPort
      : getWorkflowPortElementFromPoint(
          container,
          "clientX" in event ? event.clientX : -1,
          "clientY" in event ? event.clientY : -1,
        );
  const nodeElement = portElement?.closest<HTMLElement>(
    "[data-slot='workflow-builder-node'][data-node-id]",
  );
  const direction = portElement?.dataset.portDirection;
  const nodeId = nodeElement?.dataset.nodeId;
  const portId = portElement?.dataset.portId;

  if (
    !nodeId ||
    !portId ||
    (direction !== "input" && direction !== "output") ||
    !container.contains(nodeElement)
  ) {
    return null;
  }

  return { direction, nodeId, portId };
}

function getWorkflowPortElementFromPoint(container: HTMLElement, clientX: number, clientY: number) {
  let bestPort: HTMLElement | null = null;
  let bestArea = Number.POSITIVE_INFINITY;

  for (const portElement of container.querySelectorAll<HTMLElement>(
    "[data-slot='workflow-node-port'][data-port-direction][data-port-id]",
  )) {
    const rect = portElement.getBoundingClientRect();

    if (
      clientX < rect.left ||
      clientX > rect.right ||
      clientY < rect.top ||
      clientY > rect.bottom
    ) {
      continue;
    }

    const area = rect.width * rect.height;
    if (area < bestArea) {
      bestArea = area;
      bestPort = portElement;
    }
  }

  return bestPort;
}
