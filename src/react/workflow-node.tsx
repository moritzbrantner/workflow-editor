"use client";

import * as React from "react";
import { Maximize2Icon, Minimize2Icon, MoreHorizontalIcon } from "lucide-react";

import {
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@moritzbrantner/ui";

type WorkflowNodeTypeScriptType<TypeScriptType = unknown> =
  | string
  | {
      label?: string;
      source?: string;
      kind?: string;
      description?: string;
      metadata?: Record<string, unknown>;
      readonly __type?: TypeScriptType;
    };

type WorkflowNodePort<TypeScriptType = unknown> = {
  id: string;
  label: string;
  kind?: string;
  type?: WorkflowNodeTypeScriptType<TypeScriptType>;
  required?: boolean;
  description?: string;
  badge?: string;
  color?: string;
  metadata?: Record<string, unknown>;
};

type WorkflowNodeData<
  Inputs extends readonly WorkflowNodePort[] = readonly WorkflowNodePort[],
  Outputs extends readonly WorkflowNodePort[] = readonly WorkflowNodePort[],
> = {
  id: string;
  label: string;
  description?: string;
  kind?: string;
  category?: string;
  eyebrow?: string;
  packageLabel?: string;
  status?: "idle" | "running" | "success" | "error" | "warning" | string;
  tone?: "neutral" | "info" | "success" | "warning" | "error" | string;
  variant?: "default" | "compact";
  minimized?: boolean;
  tags?: string[];
  inputs?: Inputs;
  outputs?: Outputs;
  metadata?: Record<string, unknown>;
};

type WorkflowInputOnlyNodeData<
  Inputs extends readonly WorkflowNodePort[] = readonly WorkflowNodePort[],
> = Omit<WorkflowNodeData<Inputs, []>, "outputs"> & {
  inputs: Inputs;
  outputs?: never;
};

type WorkflowOutputOnlyNodeData<
  Outputs extends readonly WorkflowNodePort[] = readonly WorkflowNodePort[],
> = Omit<WorkflowNodeData<[], Outputs>, "inputs"> & {
  inputs?: never;
  outputs: Outputs;
};

type WorkflowNodeSize = {
  width: number;
  height: number;
};

type WorkflowNodeLayoutOptions = {
  showPortColumnHeaders?: boolean;
};

type WorkflowNodeMenuItem = {
  id: string;
  label: React.ReactNode;
  disabled?: boolean;
  destructive?: boolean;
  onSelect?: (node: WorkflowNodeData) => void;
};

type WorkflowNodeProps<
  Inputs extends readonly WorkflowNodePort[] = readonly WorkflowNodePort[],
  Outputs extends readonly WorkflowNodePort[] = readonly WorkflowNodePort[],
> = React.ComponentProps<"div"> & {
  node: WorkflowNodeData<Inputs, Outputs>;
  selected?: boolean;
  readOnly?: boolean;
  inputDisabled?: boolean;
  outputDisabled?: boolean;
  showPortColumnHeaders?: boolean;
  menuItems?: WorkflowNodeMenuItem[];
  menuLabel?: React.ReactNode;
  onNodeSelect?: (node: WorkflowNodeData) => void;
  onMinimizedChange?: (node: WorkflowNodeData, minimized: boolean) => void;
  onMenuItemSelect?: (item: WorkflowNodeMenuItem, node: WorkflowNodeData) => void;
  onInputClick?: (port: WorkflowNodePort, node: WorkflowNodeData) => void;
  onOutputClick?: (port: WorkflowNodePort, node: WorkflowNodeData) => void;
  onInputPointerUp?: (
    port: WorkflowNodePort,
    node: WorkflowNodeData,
    event: React.PointerEvent<HTMLButtonElement>,
  ) => void;
  onOutputPointerDown?: (
    port: WorkflowNodePort,
    node: WorkflowNodeData,
    event: React.PointerEvent<HTMLButtonElement>,
  ) => void;
  onOutputPointerUp?: (
    port: WorkflowNodePort,
    node: WorkflowNodeData,
    event: React.PointerEvent<HTMLButtonElement>,
  ) => void;
  getInputAriaLabel?: (port: WorkflowNodePort, node: WorkflowNodeData) => string;
  getOutputAriaLabel?: (port: WorkflowNodePort, node: WorkflowNodeData) => string;
};

type WorkflowInputOnlyNodeProps<
  Inputs extends readonly WorkflowNodePort[] = readonly WorkflowNodePort[],
> = Omit<
  WorkflowNodeProps<Inputs, []>,
  "node" | "outputDisabled" | "onOutputClick" | "getOutputAriaLabel"
> & {
  node: WorkflowInputOnlyNodeData<Inputs>;
};

type WorkflowOutputOnlyNodeProps<
  Outputs extends readonly WorkflowNodePort[] = readonly WorkflowNodePort[],
> = Omit<
  WorkflowNodeProps<[], Outputs>,
  "node" | "inputDisabled" | "onInputClick" | "getInputAriaLabel"
> & {
  node: WorkflowOutputOnlyNodeData<Outputs>;
};

const workflowNodeInlineWidth = 240;
const workflowNodeDefaultWidth = 310;
const workflowNodeMinimizedWidth = 230;
const workflowNodeCompactHeight = 48;
const workflowNodeMinimizedHeaderHeight = 54;
const workflowNodePortRowHeight = 64;
const workflowNodePortGap = 8;
const workflowNodePortColumnsPaddingY = 24;
const workflowNodePortColumnLabelHeight = 21;
const workflowNodeHeaderBaseHeight = 72;
const workflowNodeDescriptionLineHeight = 20;
const workflowNodeDescriptionMaxRows = 4;
const workflowNodeControlButtonClassName =
  "inline-flex h-6 w-6 items-center justify-center rounded-md border border-zinc-300 bg-white/80 text-zinc-700 outline-none transition-colors hover:bg-white focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1";

function WorkflowNode({
  node,
  selected,
  readOnly = false,
  inputDisabled = false,
  outputDisabled = false,
  showPortColumnHeaders = true,
  menuItems = [],
  menuLabel = "Actions",
  onNodeSelect,
  onMinimizedChange,
  onMenuItemSelect,
  onInputClick,
  onOutputClick,
  onInputPointerUp,
  onOutputPointerDown,
  onOutputPointerUp,
  getInputAriaLabel,
  getOutputAriaLabel,
  className,
  style,
  ...props
}: WorkflowNodeProps) {
  const [uncontrolledMinimized, setUncontrolledMinimized] = React.useState(node.minimized ?? false);

  React.useEffect(() => {
    setUncontrolledMinimized(node.minimized ?? false);
  }, [node.id, node.minimized]);

  const minimized = node.minimized ?? uncontrolledMinimized;
  const resolvedNode = React.useMemo(
    () => (node.minimized === minimized ? node : { ...node, minimized }),
    [minimized, node],
  );
  const layoutOptions = React.useMemo(() => ({ showPortColumnHeaders }), [showPortColumnHeaders]);
  const compact = workflowNodeUsesCompactVariant(resolvedNode);
  const size = getWorkflowNodeSize(resolvedNode, layoutOptions);
  const portLayout = getWorkflowNodePortLayout(resolvedNode);

  const changeMinimized = (nextMinimized: boolean) => {
    if (node.minimized === undefined) {
      setUncontrolledMinimized(nextMinimized);
    }
    onMinimizedChange?.(resolvedNode, nextMinimized);
  };

  if (compact) {
    return (
      <div
        data-slot="workflow-node"
        data-compact="true"
        data-selected={selected ? "true" : undefined}
        data-status={resolvedNode.status}
        className={cn(
          "relative overflow-visible rounded-lg border bg-white text-left shadow-sm transition-colors",
          selected ? "border-zinc-950 ring-2 ring-zinc-950/10" : "border-zinc-200",
          className,
        )}
        style={{ width: size.width, height: size.height, ...style }}
        {...props}
      >
        <WorkflowNodeInline
          node={resolvedNode}
          readOnly={readOnly}
          inputDisabled={inputDisabled}
          outputDisabled={outputDisabled}
          onNodeSelect={onNodeSelect}
          onInputClick={onInputClick}
          onOutputClick={onOutputClick}
          onInputPointerUp={onInputPointerUp}
          onOutputPointerDown={onOutputPointerDown}
          onOutputPointerUp={onOutputPointerUp}
          getInputAriaLabel={getInputAriaLabel}
          getOutputAriaLabel={getOutputAriaLabel}
        />
      </div>
    );
  }

  return (
    <div
      data-slot="workflow-node"
      data-minimized={minimized ? "true" : undefined}
      data-selected={selected ? "true" : undefined}
      data-status={resolvedNode.status}
      className={cn(
        "relative flex flex-col overflow-visible rounded-lg border bg-white text-left shadow-sm transition-colors",
        selected ? "border-zinc-950 ring-2 ring-zinc-950/10" : "border-zinc-200",
        className,
      )}
      style={{ width: size.width, height: size.height, ...style }}
      {...props}
    >
      <div
        data-slot="workflow-node-header"
        className={cn(
          "shrink-0 overflow-hidden rounded-t-lg px-3 py-2",
          !minimized && "border-b",
          getWorkflowNodeToneClasses(
            resolvedNode.tone ?? getWorkflowNodeToneFromStatus(resolvedNode.status),
          ),
        )}
        style={{
          minHeight: minimized
            ? workflowNodeMinimizedHeaderHeight
            : getWorkflowNodeHeaderHeight(resolvedNode),
        }}
      >
        <div
          className={cn("flex justify-between gap-3", minimized ? "items-center" : "items-start")}
        >
          <button
            type="button"
            data-slot="workflow-node-select"
            aria-label={resolvedNode.label}
            className="min-w-0 flex-1 rounded-md text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            onClick={(event) => {
              event.stopPropagation();
              onNodeSelect?.(resolvedNode);
            }}
          >
            <div className="truncate text-sm font-semibold text-zinc-950">{resolvedNode.label}</div>
            {getWorkflowNodePackageLabel(resolvedNode) ? (
              <div className="mt-0.5 truncate text-[11px] font-medium text-zinc-600">
                {getWorkflowNodePackageLabel(resolvedNode)}
              </div>
            ) : null}
          </button>
          <div className="mt-0.5 flex shrink-0 items-center gap-1.5">
            {(resolvedNode.eyebrow ?? resolvedNode.category ?? resolvedNode.kind) && !minimized ? (
              <span className="rounded bg-white/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-zinc-600">
                {resolvedNode.eyebrow ?? resolvedNode.category ?? resolvedNode.kind}
              </span>
            ) : null}
            <span
              aria-hidden="true"
              className={cn(
                "block h-2.5 w-2.5 rounded-full",
                getWorkflowNodeToneDotClass(
                  resolvedNode.tone ?? getWorkflowNodeToneFromStatus(resolvedNode.status),
                ),
              )}
            />
            <WorkflowNodeMinimizeButton
              node={resolvedNode}
              minimized={minimized}
              onMinimizedChange={changeMinimized}
            />
            <WorkflowNodeMenu
              node={resolvedNode}
              items={menuItems}
              label={menuLabel}
              onItemSelect={onMenuItemSelect}
            />
          </div>
        </div>
        {resolvedNode.description && !compact && !minimized ? (
          <p className="mt-2 line-clamp-4 text-xs leading-5 text-zinc-600">
            {resolvedNode.description}
          </p>
        ) : null}
      </div>
      {minimized ? (
        <WorkflowNodeMinimizedPorts
          node={resolvedNode}
          inputDisabled={inputDisabled}
          outputDisabled={outputDisabled || readOnly}
          onInputClick={onInputClick}
          onOutputClick={onOutputClick}
          onInputPointerUp={onInputPointerUp}
          onOutputPointerDown={onOutputPointerDown}
          onOutputPointerUp={onOutputPointerUp}
          getInputAriaLabel={getInputAriaLabel}
          getOutputAriaLabel={getOutputAriaLabel}
        />
      ) : (
        <div
          data-slot="workflow-node-ports"
          data-port-layout={portLayout}
          className={cn(
            "grid min-h-0 flex-1 gap-3 px-0 py-3 text-xs",
            portLayout === "duplex" ? "grid-cols-2" : "grid-cols-1",
          )}
        >
          {portLayout !== "output-only" ? (
            <WorkflowNodePortColumn
              title="Inputs"
              direction="input"
              node={resolvedNode}
              ports={resolvedNode.inputs ?? []}
              disabled={inputDisabled}
              showHeader={showPortColumnHeaders}
              onClick={onInputClick}
              onPointerUp={onInputPointerUp}
              getAriaLabel={getInputAriaLabel}
            />
          ) : null}
          {portLayout !== "input-only" ? (
            <WorkflowNodePortColumn
              title="Outputs"
              direction="output"
              node={resolvedNode}
              ports={resolvedNode.outputs ?? []}
              disabled={outputDisabled || readOnly}
              showHeader={showPortColumnHeaders}
              onClick={onOutputClick}
              onPointerDown={onOutputPointerDown}
              onPointerUp={onOutputPointerUp}
              getAriaLabel={getOutputAriaLabel}
            />
          ) : null}
        </div>
      )}
    </div>
  );
}

function WorkflowInputOnlyNode<
  Inputs extends readonly WorkflowNodePort[] = readonly WorkflowNodePort[],
>({ node, ...props }: WorkflowInputOnlyNodeProps<Inputs>) {
  const resolvedNode = React.useMemo<WorkflowNodeData<Inputs, []>>(
    () => ({ ...node, outputs: [] }),
    [node],
  );

  return <WorkflowNode {...props} node={resolvedNode} outputDisabled />;
}

function WorkflowOutputOnlyNode<
  Outputs extends readonly WorkflowNodePort[] = readonly WorkflowNodePort[],
>({ node, ...props }: WorkflowOutputOnlyNodeProps<Outputs>) {
  const resolvedNode = React.useMemo<WorkflowNodeData<[], Outputs>>(
    () => ({ ...node, inputs: [] }),
    [node],
  );

  return <WorkflowNode {...props} node={resolvedNode} inputDisabled />;
}

function WorkflowNodeMinimizeButton({
  node,
  minimized,
  onMinimizedChange,
}: {
  node: WorkflowNodeData;
  minimized: boolean;
  onMinimizedChange: (minimized: boolean) => void;
}) {
  return (
    <button
      type="button"
      data-slot="workflow-node-minimize"
      aria-label={minimized ? `Expand ${node.label}` : `Minimize ${node.label}`}
      aria-pressed={minimized}
      className={workflowNodeControlButtonClassName}
      onPointerDown={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => {
        event.stopPropagation();
        onMinimizedChange(!minimized);
      }}
    >
      {minimized ? (
        <Maximize2Icon className="size-3.5" aria-hidden="true" />
      ) : (
        <Minimize2Icon className="size-3.5" aria-hidden="true" />
      )}
    </button>
  );
}

function WorkflowNodeMenu({
  node,
  items,
  label,
  onItemSelect,
}: {
  node: WorkflowNodeData;
  items: WorkflowNodeMenuItem[];
  label: React.ReactNode;
  onItemSelect?: (item: WorkflowNodeMenuItem, node: WorkflowNodeData) => void;
}) {
  const menuLabel = typeof label === "string" ? label : "Actions";

  if (items.length === 0 && !onItemSelect) {
    return (
      <button
        type="button"
        data-slot="workflow-node-menu-trigger"
        aria-label={`Open ${node.label} menu`}
        className={workflowNodeControlButtonClassName}
        disabled
      >
        <MoreHorizontalIcon className="size-3.5" aria-hidden="true" />
      </button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-slot="workflow-node-menu-trigger"
          aria-label={`Open ${node.label} menu`}
          className={workflowNodeControlButtonClassName}
        >
          <MoreHorizontalIcon className="size-3.5" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        data-slot="workflow-node-menu"
        align="end"
        sideOffset={6}
        className="min-w-40"
        aria-label={menuLabel}
      >
        {label ? <DropdownMenuLabel>{label}</DropdownMenuLabel> : null}
        {items.length > 0 ? (
          items.map((item) => (
            <DropdownMenuItem
              key={item.id}
              disabled={item.disabled}
              variant={item.destructive ? "destructive" : "default"}
              onSelect={() => {
                item.onSelect?.(node);
                onItemSelect?.(item, node);
              }}
            >
              {item.label}
            </DropdownMenuItem>
          ))
        ) : (
          <DropdownMenuItem disabled>No actions</DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function WorkflowNodeInline({
  node,
  readOnly,
  inputDisabled,
  outputDisabled,
  onNodeSelect,
  onInputClick,
  onOutputClick,
  onInputPointerUp,
  onOutputPointerDown,
  onOutputPointerUp,
  getInputAriaLabel,
  getOutputAriaLabel,
}: {
  node: WorkflowNodeData;
  readOnly: boolean;
  inputDisabled: boolean;
  outputDisabled: boolean;
  onNodeSelect?: (node: WorkflowNodeData) => void;
  onInputClick?: (port: WorkflowNodePort, node: WorkflowNodeData) => void;
  onOutputClick?: (port: WorkflowNodePort, node: WorkflowNodeData) => void;
  onInputPointerUp?: (
    port: WorkflowNodePort,
    node: WorkflowNodeData,
    event: React.PointerEvent<HTMLButtonElement>,
  ) => void;
  onOutputPointerDown?: (
    port: WorkflowNodePort,
    node: WorkflowNodeData,
    event: React.PointerEvent<HTMLButtonElement>,
  ) => void;
  onOutputPointerUp?: (
    port: WorkflowNodePort,
    node: WorkflowNodeData,
    event: React.PointerEvent<HTMLButtonElement>,
  ) => void;
  getInputAriaLabel?: (port: WorkflowNodePort, node: WorkflowNodeData) => string;
  getOutputAriaLabel?: (port: WorkflowNodePort, node: WorkflowNodeData) => string;
}) {
  const input = node.inputs?.[0];
  const output = node.outputs?.[0];

  return (
    <div
      data-slot="workflow-node-inline"
      className={cn(
        "relative flex h-12 items-center gap-2 rounded-lg px-3",
        getWorkflowNodeToneClasses(node.tone ?? getWorkflowNodeToneFromStatus(node.status)),
      )}
      title={workflowNodeInlineTitle(node)}
    >
      <WorkflowNodeInlinePort
        direction="input"
        node={node}
        port={input}
        disabled={inputDisabled}
        onClick={onInputClick}
        onPointerUp={onInputPointerUp}
        getAriaLabel={getInputAriaLabel}
      />
      <button
        type="button"
        data-slot="workflow-node-select"
        aria-label={node.label}
        className="min-w-0 flex-1 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1"
        onClick={(event) => {
          event.stopPropagation();
          onNodeSelect?.(node);
        }}
      >
        <div className="truncate text-xs font-semibold text-zinc-950">{node.label}</div>
        <div className="truncate text-[10px] font-medium text-zinc-600">
          {workflowNodeCompactPortSummary(node)}
        </div>
      </button>
      <WorkflowNodeInlinePort
        direction="output"
        node={node}
        port={output}
        disabled={outputDisabled || readOnly}
        onClick={onOutputClick}
        onPointerDown={onOutputPointerDown}
        onPointerUp={onOutputPointerUp}
        getAriaLabel={getOutputAriaLabel}
      />
    </div>
  );
}

function WorkflowNodeInlinePort({
  direction,
  node,
  port,
  disabled,
  onClick,
  onPointerUp,
  onPointerDown,
  getAriaLabel,
}: {
  direction: "input" | "output";
  node: WorkflowNodeData;
  port?: WorkflowNodePort;
  disabled: boolean;
  onClick?: (port: WorkflowNodePort, node: WorkflowNodeData) => void;
  onPointerUp?: (
    port: WorkflowNodePort,
    node: WorkflowNodeData,
    event: React.PointerEvent<HTMLButtonElement>,
  ) => void;
  onPointerDown?: (
    port: WorkflowNodePort,
    node: WorkflowNodeData,
    event: React.PointerEvent<HTMLButtonElement>,
  ) => void;
  getAriaLabel?: (port: WorkflowNodePort, node: WorkflowNodeData) => string;
}) {
  if (!port) {
    return null;
  }

  const isInput = direction === "input";
  const color = getWorkflowNodePortColor(port);
  const interactive = Boolean(onClick || onPointerUp || onPointerDown);

  return (
    <button
      type="button"
      data-slot="workflow-node-port"
      data-port-direction={direction}
      data-port-id={port.id}
      disabled={disabled || !interactive}
      aria-label={getAriaLabel?.(port, node) ?? `${node.label} ${port.label}`}
      className={cn(
        "absolute top-1/2 z-10 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-white outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-60",
        isInput ? "-left-1.5" : "-right-1.5",
      )}
      style={{ backgroundColor: color }}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.(port, node);
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
        onPointerDown?.(port, node, event);
      }}
      onPointerUp={(event) => {
        event.stopPropagation();
        onPointerUp?.(port, node, event);
      }}
    >
      <span data-slot="workflow-node-port-dot" className="block h-full w-full rounded-full" />
    </button>
  );
}

function WorkflowNodeMinimizedPorts({
  node,
  inputDisabled,
  outputDisabled,
  onInputClick,
  onOutputClick,
  onInputPointerUp,
  onOutputPointerDown,
  onOutputPointerUp,
  getInputAriaLabel,
  getOutputAriaLabel,
}: {
  node: WorkflowNodeData;
  inputDisabled: boolean;
  outputDisabled: boolean;
  onInputClick?: (port: WorkflowNodePort, node: WorkflowNodeData) => void;
  onOutputClick?: (port: WorkflowNodePort, node: WorkflowNodeData) => void;
  onInputPointerUp?: (
    port: WorkflowNodePort,
    node: WorkflowNodeData,
    event: React.PointerEvent<HTMLButtonElement>,
  ) => void;
  onOutputPointerDown?: (
    port: WorkflowNodePort,
    node: WorkflowNodeData,
    event: React.PointerEvent<HTMLButtonElement>,
  ) => void;
  onOutputPointerUp?: (
    port: WorkflowNodePort,
    node: WorkflowNodeData,
    event: React.PointerEvent<HTMLButtonElement>,
  ) => void;
  getInputAriaLabel?: (port: WorkflowNodePort, node: WorkflowNodeData) => string;
  getOutputAriaLabel?: (port: WorkflowNodePort, node: WorkflowNodeData) => string;
}) {
  const inputs = node.inputs ?? [];
  const outputs = node.outputs ?? [];

  return (
    <div
      data-slot="workflow-node-minimized-ports"
      className="relative border-t border-zinc-100 bg-white"
      style={{ height: getWorkflowNodeMinimizedPortsHeight(node) }}
    >
      <div className="pointer-events-none absolute inset-x-3 top-1/2 flex -translate-y-1/2 items-center justify-between text-[10px] font-semibold uppercase text-zinc-500">
        <span>{inputs.length} in</span>
        <span>{outputs.length} out</span>
      </div>
      <WorkflowNodeMinimizedPortStack
        direction="input"
        node={node}
        ports={inputs}
        disabled={inputDisabled}
        onClick={onInputClick}
        onPointerUp={onInputPointerUp}
        getAriaLabel={getInputAriaLabel}
      />
      <WorkflowNodeMinimizedPortStack
        direction="output"
        node={node}
        ports={outputs}
        disabled={outputDisabled}
        onClick={onOutputClick}
        onPointerDown={onOutputPointerDown}
        onPointerUp={onOutputPointerUp}
        getAriaLabel={getOutputAriaLabel}
      />
    </div>
  );
}

function WorkflowNodeMinimizedPortStack({
  direction,
  node,
  ports,
  disabled,
  onClick,
  onPointerUp,
  onPointerDown,
  getAriaLabel,
}: {
  direction: "input" | "output";
  node: WorkflowNodeData;
  ports: readonly WorkflowNodePort[];
  disabled: boolean;
  onClick?: (port: WorkflowNodePort, node: WorkflowNodeData) => void;
  onPointerUp?: (
    port: WorkflowNodePort,
    node: WorkflowNodeData,
    event: React.PointerEvent<HTMLButtonElement>,
  ) => void;
  onPointerDown?: (
    port: WorkflowNodePort,
    node: WorkflowNodeData,
    event: React.PointerEvent<HTMLButtonElement>,
  ) => void;
  getAriaLabel?: (port: WorkflowNodePort, node: WorkflowNodeData) => string;
}) {
  const isInput = direction === "input";

  return (
    <>
      {ports.map((port, index) => (
        <button
          key={`${direction}-${port.id}`}
          type="button"
          data-slot="workflow-node-port"
          data-port-direction={direction}
          data-port-id={port.id}
          disabled={disabled || !(onClick || onPointerUp || onPointerDown)}
          aria-label={getAriaLabel?.(port, node) ?? `${node.label} ${port.label}`}
          className={cn(
            "absolute z-10 h-3 w-3 rounded-full border-2 border-white outline-none focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-60",
            isInput ? "-left-1.5" : "-right-1.5",
          )}
          style={{
            backgroundColor: getWorkflowNodePortColor(port),
            top: `${((index + 1) / (ports.length + 1)) * 100}%`,
          }}
          title={`${port.label} ${workflowNodePortSummaryLabel(port)}`}
          onClick={(event) => {
            event.stopPropagation();
            onClick?.(port, node);
          }}
          onPointerDown={(event) => {
            event.stopPropagation();
            onPointerDown?.(port, node, event);
          }}
          onPointerUp={(event) => {
            event.stopPropagation();
            onPointerUp?.(port, node, event);
          }}
        >
          <span data-slot="workflow-node-port-dot" className="block h-full w-full rounded-full" />
        </button>
      ))}
    </>
  );
}

function WorkflowNodePortColumn({
  title,
  direction,
  node,
  ports,
  disabled,
  showHeader,
  onClick,
  onPointerUp,
  onPointerDown,
  getAriaLabel,
}: {
  title: string;
  direction: "input" | "output";
  node: WorkflowNodeData;
  ports: readonly WorkflowNodePort[];
  disabled: boolean;
  showHeader: boolean;
  onClick?: (port: WorkflowNodePort, node: WorkflowNodeData) => void;
  onPointerUp?: (
    port: WorkflowNodePort,
    node: WorkflowNodeData,
    event: React.PointerEvent<HTMLButtonElement>,
  ) => void;
  onPointerDown?: (
    port: WorkflowNodePort,
    node: WorkflowNodeData,
    event: React.PointerEvent<HTMLButtonElement>,
  ) => void;
  getAriaLabel?: (port: WorkflowNodePort, node: WorkflowNodeData) => string;
}) {
  return (
    <div className="flex min-h-0 flex-col">
      {showHeader ? (
        <div className="mb-2 shrink-0 text-[11px] font-semibold uppercase text-zinc-500">
          {title}
        </div>
      ) : (
        <div style={{ display: "none" }}>{title}</div>
      )}
      {ports.length === 0 ? (
        <div className="flex h-16 min-h-0 flex-1 items-center rounded-md border border-dashed border-zinc-200 px-2 py-1.5 text-xs text-zinc-700">
          none
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 gap-2">
          {ports.map((port) => (
            <WorkflowNodePortAnchor
              key={`${direction}-${port.id}`}
              direction={direction}
              node={node}
              port={port}
              disabled={disabled}
              onClick={onClick}
              onPointerUp={onPointerUp}
              onPointerDown={onPointerDown}
              getAriaLabel={getAriaLabel}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function WorkflowNodePortAnchor({
  direction,
  node,
  port,
  disabled,
  onClick,
  onPointerUp,
  onPointerDown,
  getAriaLabel,
}: {
  direction: "input" | "output";
  node: WorkflowNodeData;
  port?: WorkflowNodePort;
  disabled: boolean;
  onClick?: (port: WorkflowNodePort, node: WorkflowNodeData) => void;
  onPointerUp?: (
    port: WorkflowNodePort,
    node: WorkflowNodeData,
    event: React.PointerEvent<HTMLButtonElement>,
  ) => void;
  onPointerDown?: (
    port: WorkflowNodePort,
    node: WorkflowNodeData,
    event: React.PointerEvent<HTMLButtonElement>,
  ) => void;
  getAriaLabel?: (port: WorkflowNodePort, node: WorkflowNodeData) => string;
}) {
  const isInput = direction === "input";

  if (!port) {
    return (
      <div
        data-slot="workflow-node-port"
        data-port-direction={direction}
        className={cn(
          "flex h-16 min-h-0 items-center rounded-md border border-dashed border-zinc-200 px-2 py-1.5 text-xs text-zinc-700",
        )}
      >
        none
      </div>
    );
  }

  const color = getWorkflowNodePortColor(port);
  const typeLabel = getWorkflowNodePortTypeLabel(port);

  return (
    <button
      type="button"
      data-slot="workflow-node-port"
      data-port-direction={direction}
      data-port-id={port.id}
      disabled={disabled || !(onClick || onPointerUp || onPointerDown)}
      aria-label={getAriaLabel?.(port, node) ?? `${node.label} ${port.label}`}
      className={cn(
        "relative block h-16 w-full overflow-visible rounded-md border px-2 py-1.5 text-left outline-none transition-colors",
        "focus-visible:ring-2 focus-visible:ring-zinc-950 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-60",
        isInput ? "pl-3" : "pr-3",
      )}
      style={{
        backgroundColor: hexToRgba(color, 0.08),
        borderColor: hexToRgba(color, 0.32),
        boxShadow: `inset ${isInput ? "3px" : "-3px"} 0 0 ${color}`,
      }}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.(port, node);
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
        onPointerDown?.(port, node, event);
      }}
      onPointerUp={(event) => {
        event.stopPropagation();
        onPointerUp?.(port, node, event);
      }}
    >
      <div
        className={cn(
          "flex h-full min-h-0 flex-col gap-1 overflow-hidden",
          isInput ? "items-start" : "items-end text-right",
        )}
      >
        <span
          data-slot="workflow-node-port-dot"
          className={cn(
            "absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border-2 border-white",
            isInput ? "-left-1.5" : "-right-1.5",
          )}
          style={{ backgroundColor: color }}
          aria-hidden="true"
        />
        <span className="max-w-full truncate text-xs font-medium text-zinc-800">{port.label}</span>
        <span
          className={cn(
            "flex max-w-full flex-nowrap gap-1 overflow-hidden",
            isInput ? "justify-start" : "justify-end",
          )}
        >
          {typeLabel ? (
            <span
              className="max-w-full truncate whitespace-nowrap rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase"
              style={{
                backgroundColor: hexToRgba(color, 0.16),
                color: getWorkflowNodePortBadgeTextColor(color),
              }}
            >
              {formatWorkflowNodePortKind(typeLabel)}
            </span>
          ) : null}
          {port.badge ? (
            <span className="max-w-full truncate whitespace-nowrap rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-zinc-700">
              {port.badge}
            </span>
          ) : null}
          {port.required ? (
            <span className="max-w-full truncate whitespace-nowrap rounded bg-zinc-950 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white">
              required
            </span>
          ) : null}
        </span>
        {port.description ? <span className="sr-only">{port.description}</span> : null}
      </div>
    </button>
  );
}

function workflowNodeCompactPortSummary(node: WorkflowNodeData) {
  const input = node.inputs?.[0];
  const output = node.outputs?.[0];

  if (input && output) {
    return `${workflowNodePortSummaryLabel(input)} -> ${workflowNodePortSummaryLabel(output)}`;
  }

  if (input || output) {
    return workflowNodePortSummaryLabel(input ?? output);
  }

  return "No ports";
}

function workflowNodePortSummaryLabel(port: WorkflowNodePort | undefined) {
  if (!port) {
    return "port";
  }

  return formatWorkflowNodePortKind(getWorkflowNodePortTypeLabel(port) ?? port.badge ?? port.label);
}

function getWorkflowNodePortTypeLabel(port: WorkflowNodePort) {
  if (!port.type) {
    return port.kind;
  }

  if (typeof port.type === "string") {
    return port.type.trim();
  }

  const label = port.type.label ?? port.type.source ?? port.type.kind;
  return typeof label === "string" ? label.trim() : port.kind;
}

function getWorkflowNodePortTypeSource(port: WorkflowNodePort) {
  if (!port.type) {
    return undefined;
  }

  const source = typeof port.type === "string" ? port.type : (port.type.source ?? port.type.kind);
  return typeof source === "string" ? source.trim() : undefined;
}

function getWorkflowNodePortLayout(node: WorkflowNodeData) {
  const hasInputs = (node.inputs?.length ?? 0) > 0;
  const hasOutputs = (node.outputs?.length ?? 0) > 0;

  if (hasInputs && !hasOutputs) {
    return "input-only";
  }

  if (!hasInputs && hasOutputs) {
    return "output-only";
  }

  return "duplex";
}

function workflowNodeUsesCompactVariant(node: WorkflowNodeData) {
  return node.variant === "compact";
}

function workflowNodeUsesMinimizedVariant(node: WorkflowNodeData) {
  return node.minimized === true;
}

function getWorkflowNodeSize(
  node: WorkflowNodeData,
  options: WorkflowNodeLayoutOptions = {},
): WorkflowNodeSize {
  if (workflowNodeUsesMinimizedVariant(node)) {
    return {
      width: workflowNodeMinimizedWidth,
      height: workflowNodeMinimizedHeaderHeight + getWorkflowNodeMinimizedPortsHeight(node),
    };
  }

  if (workflowNodeUsesCompactVariant(node)) {
    return {
      width: workflowNodeInlineWidth,
      height: workflowNodeCompactHeight,
    };
  }

  const rows = Math.max(node.inputs?.length ?? 0, node.outputs?.length ?? 0, 1);
  const headerHeight = getWorkflowNodeHeaderHeight(node);
  const portColumnLabelHeight =
    options.showPortColumnHeaders === false ? 0 : workflowNodePortColumnLabelHeight;
  const portsHeight =
    workflowNodePortColumnsPaddingY +
    portColumnLabelHeight +
    rows * workflowNodePortRowHeight +
    Math.max(rows - 1, 0) * workflowNodePortGap;

  return {
    width: workflowNodeDefaultWidth,
    height: headerHeight + portsHeight,
  };
}

function getWorkflowNodePortCenterOffset(
  node: WorkflowNodeData,
  portIndex: number,
  options: WorkflowNodeLayoutOptions = {},
) {
  if (workflowNodeUsesCompactVariant(node)) {
    return getWorkflowNodeSize(node, options).height / 2;
  }

  if (workflowNodeUsesMinimizedVariant(node)) {
    const ports = Math.max(node.inputs?.length ?? 0, node.outputs?.length ?? 0, 1);
    const top = workflowNodeMinimizedHeaderHeight;

    return top + ((portIndex + 1) / (ports + 1)) * getWorkflowNodeMinimizedPortsHeight(node);
  }

  const headerHeight = getWorkflowNodeHeaderHeight(node);
  const portColumnLabelHeight =
    options.showPortColumnHeaders === false ? 0 : workflowNodePortColumnLabelHeight;

  return (
    headerHeight +
    workflowNodePortColumnsPaddingY / 2 +
    portColumnLabelHeight +
    portIndex * (workflowNodePortRowHeight + workflowNodePortGap) +
    workflowNodePortRowHeight / 2
  );
}

function getWorkflowNodeToneFromStatus(status?: string): WorkflowNodeData["tone"] {
  if (status === "success") {
    return "success";
  }
  if (status === "warning") {
    return "warning";
  }
  if (status === "error") {
    return "error";
  }
  if (status === "running") {
    return "info";
  }
  return "neutral";
}

function getWorkflowNodeToneClasses(tone?: WorkflowNodeData["tone"]) {
  if (tone === "success" || tone === "emerald") {
    return "border-emerald-100 bg-emerald-50";
  }
  if (tone === "warning" || tone === "amber") {
    return "border-amber-100 bg-amber-50";
  }
  if (tone === "error" || tone === "rose") {
    return "border-rose-100 bg-rose-50";
  }
  if (tone === "info" || tone === "sky") {
    return "border-sky-100 bg-sky-50";
  }
  if (tone === "violet") {
    return "border-violet-100 bg-violet-50";
  }
  if (tone === "cyan") {
    return "border-cyan-100 bg-cyan-50";
  }
  if (tone === "indigo") {
    return "border-indigo-100 bg-indigo-50";
  }
  if (tone === "fuchsia") {
    return "border-fuchsia-100 bg-fuchsia-50";
  }
  if (tone === "slate") {
    return "border-slate-100 bg-slate-50";
  }
  return "border-zinc-100 bg-zinc-50";
}

function getWorkflowNodeToneDotClass(tone?: WorkflowNodeData["tone"]) {
  if (tone === "success" || tone === "emerald") {
    return "bg-emerald-500";
  }
  if (tone === "warning" || tone === "amber") {
    return "bg-amber-500";
  }
  if (tone === "error" || tone === "rose") {
    return "bg-rose-500";
  }
  if (tone === "info" || tone === "sky") {
    return "bg-sky-500";
  }
  if (tone === "violet") {
    return "bg-violet-500";
  }
  if (tone === "cyan") {
    return "bg-cyan-500";
  }
  if (tone === "indigo") {
    return "bg-indigo-500";
  }
  if (tone === "fuchsia") {
    return "bg-fuchsia-500";
  }
  if (tone === "slate") {
    return "bg-slate-500";
  }
  return "bg-zinc-500";
}

function getWorkflowNodeDescriptionRows(node: WorkflowNodeData) {
  if (!node.description) {
    return 0;
  }

  return Math.max(
    1,
    Math.min(workflowNodeDescriptionMaxRows, Math.ceil(node.description.length / 58)),
  );
}

function getWorkflowNodeHeaderHeight(node: WorkflowNodeData) {
  return (
    workflowNodeHeaderBaseHeight +
    getWorkflowNodeDescriptionRows(node) * workflowNodeDescriptionLineHeight
  );
}

function getWorkflowNodeMinimizedPortsHeight(node: WorkflowNodeData) {
  const rows = Math.max(node.inputs?.length ?? 0, node.outputs?.length ?? 0, 1);

  return Math.max(40, rows * 16 + 16);
}

function getWorkflowNodePackageLabel(node: WorkflowNodeData) {
  return node.packageLabel;
}

function workflowNodeInlineTitle(node: WorkflowNodeData) {
  const input = node.inputs?.[0];
  const output = node.outputs?.[0];

  if (input && output) {
    return `${node.label} - ${input.label} to ${output.label}`;
  }

  return `${node.label} - ${(input ?? output)?.label ?? "port"}`;
}

const workflowNodePortKindColors: Record<string, string> = {
  asset: "#2563eb",
  audio: "#0d9488",
  boolean: "#059669",
  document: "#7c3aed",
  event: "#ea580c",
  image: "#db2777",
  labels: "#16a34a",
  null: "#71717a",
  number: "#ca8a04",
  object: "#7c3aed",
  page: "#0891b2",
  promise: "#4f46e5",
  result: "#4f46e5",
  string: "#0284c7",
  table: "#ca8a04",
  task: "#dc2626",
  text: "#0284c7",
  unknown: "#71717a",
  video: "#9333ea",
  void: "#71717a",
};

const workflowNodePortFallbackColors = [
  "#0284c7",
  "#16a34a",
  "#ca8a04",
  "#db2777",
  "#7c3aed",
  "#ea580c",
  "#4f46e5",
  "#0d9488",
];

function getWorkflowNodePortColor(port: WorkflowNodePort) {
  if (port.color) {
    return port.color;
  }

  const key = (port.kind ?? getWorkflowNodePortTypeLabel(port) ?? port.badge ?? port.label)
    .toLowerCase()
    .trim();
  const knownColor = workflowNodePortKindColors[key];

  if (knownColor) {
    return knownColor;
  }

  const hash = Array.from(key).reduce((value, char) => value + char.charCodeAt(0), 0);

  return workflowNodePortFallbackColors[hash % workflowNodePortFallbackColors.length] ?? "#71717a";
}

function formatWorkflowNodePortKind(value: string) {
  return value.replace(/[_-]/g, " ");
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = normalizeHexColor(hex);

  if (!normalized) {
    return `rgba(113, 113, 122, ${alpha})`;
  }

  const value = Number.parseInt(normalized.slice(1), 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function normalizeHexColor(value: string) {
  if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
    return value;
  }

  if (/^#[0-9A-Fa-f]{3}$/.test(value)) {
    return `#${value
      .slice(1)
      .split("")
      .map((part) => `${part}${part}`)
      .join("")}`;
  }

  return null;
}

function getWorkflowNodePortBadgeTextColor(color: string) {
  void color;
  return "#18181b";
}

export {
  WorkflowInputOnlyNode,
  WorkflowNode,
  WorkflowOutputOnlyNode,
  getWorkflowNodePortTypeLabel,
  getWorkflowNodePortTypeSource,
  getWorkflowNodePortCenterOffset,
  getWorkflowNodeSize,
};
export type {
  WorkflowInputOnlyNodeData,
  WorkflowInputOnlyNodeProps,
  WorkflowNodeData,
  WorkflowNodeLayoutOptions,
  WorkflowNodeMenuItem,
  WorkflowNodePort,
  WorkflowNodeProps,
  WorkflowNodeSize,
  WorkflowNodeTypeScriptType,
  WorkflowOutputOnlyNodeData,
  WorkflowOutputOnlyNodeProps,
};
