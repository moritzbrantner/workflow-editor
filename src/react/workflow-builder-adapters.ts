import type {
  WorkflowBuilderEdge as UiWorkflowBuilderEdge,
  WorkflowBuilderNodeData as UiWorkflowBuilderNodeData,
  WorkflowBuilderViewport as UiWorkflowBuilderViewport,
} from "./workflow-builder";
import type {
  WorkflowNodeData as UiWorkflowNodeData,
  WorkflowNodePort as UiWorkflowNodePort,
} from "./workflow-node";
import { formatWorkflowEditorJsonPrimitiveNodeValue } from "../core-node-metrics";
import {
  formatWorkflowEditorIterationSummary,
  isWorkflowEditorIterationNode,
} from "../core-iteration";
import { formatWorkflowEditorPortPayload } from "../core-payload";
import { workflowEditorPortTypeSource } from "../core-type-source";
import { resolveWorkflowEditorPortTypeColor } from "../port-type-colors";
import type {
  WorkflowEditorEdge,
  WorkflowEditorNode,
  WorkflowEditorPort,
  WorkflowEditorPortDefaultValue,
  WorkflowEditorPortType,
  WorkflowEditorViewport,
} from "../core-types";

type WorkflowEditorPortColorOptions = {
  portTypeColors?: Readonly<Record<string, string>>;
};

export function toUiWorkflowBuilderNodes<TData = Record<string, unknown>>(
  nodes: Array<WorkflowEditorNode<TData>>,
  edges?: readonly WorkflowEditorEdge<unknown>[],
  options: { portTypeColors?: Readonly<Record<string, string>> } = {},
): UiWorkflowBuilderNodeData[] {
  const connectedInputs = edges ? createWorkflowEditorConnectedInputLookup(edges) : undefined;

  return nodes.map((node) => {
    const jsonPrimitiveValue = formatWorkflowEditorJsonPrimitiveNodeValue(node);
    const minimized = node.minimized ?? (jsonPrimitiveValue === undefined ? undefined : true);

    return {
      id: node.id,
      label: node.label,
      // Node-face split (#47, Decision Atlas 5.6): description, category and kind are inspector
      // metadata, so the canvas node does not repeat them. An authored eyebrow still shows.
      description: undefined,
      kind: undefined,
      category: undefined,
      status: node.status,
      eyebrow: node.eyebrow,
      // The iteration summary is derived from its bound and body, so it always wins.
      packageLabel: isWorkflowEditorIterationNode(node)
        ? formatWorkflowEditorIterationSummary(node)
        : (node.packageLabel ?? jsonPrimitiveValue),
      tone: node.tone,
      variant: node.variant,
      minimized,
      tags: node.tags,
      x: node.x,
      y: node.y,
      inputs: node.inputs?.map((port) =>
        toUiWorkflowEditorPort(port, {
          connected: connectedInputs?.has(workflowEditorPortKey(node.id, port.id)) ?? false,
          direction: "input",
          portTypeColors: options.portTypeColors,
        }),
      ),
      outputs: node.outputs?.map((port) =>
        toUiWorkflowEditorPort(
          {
            ...port,
            badge:
              port.badge ??
              (port.id === "value" && minimized === true ? jsonPrimitiveValue : undefined),
          },
          { portTypeColors: options.portTypeColors },
        ),
      ),
      metadata: node.data as Record<string, unknown> | undefined,
    };
  });
}

export function fromUiWorkflowBuilderNodes<TData = Record<string, unknown>>(
  uiNodes: UiWorkflowBuilderNodeData[],
  previousNodes: Array<WorkflowEditorNode<TData>>,
): Array<WorkflowEditorNode<TData>> {
  const previousLookup = new Map(previousNodes.map((node) => [node.id, node]));

  return uiNodes.map((node) => {
    const previousNode = previousLookup.get(node.id);

    return {
      id: node.id,
      label: node.label,
      // The canvas never edits these (#47), so they come from the document node.
      description: node.description ?? previousNode?.description,
      kind: node.kind ?? previousNode?.kind,
      category: node.category ?? previousNode?.category,
      categoryPath: previousNode?.categoryPath ? [...previousNode.categoryPath] : undefined,
      status: node.status,
      eyebrow: node.eyebrow,
      packageLabel:
        previousNode && isWorkflowEditorIterationNode(previousNode)
          ? previousNode.packageLabel
          : node.packageLabel,
      tone: node.tone,
      variant: node.variant,
      minimized: node.minimized,
      tags: node.tags,
      x: node.x,
      y: node.y,
      inputs: previousNode?.inputs ?? restoreWorkflowEditorPortsFromUi(node.inputs),
      outputs: previousNode?.outputs ?? restoreWorkflowEditorPortsFromUi(node.outputs),
      data: (node.metadata as TData | undefined) ?? previousNode?.data,
      workflowRef: previousNode?.workflowRef,
      composition: previousNode?.composition,
    };
  });
}

export function toUiWorkflowBuilderEdges<TData = Record<string, unknown>>(
  edges: Array<WorkflowEditorEdge<TData>>,
  nodes?: Array<WorkflowEditorNode<unknown>>,
  options: { portTypeColors?: Readonly<Record<string, string>> } = {},
): UiWorkflowBuilderEdge[] {
  const nodeById = nodes ? new Map(nodes.map((node) => [node.id, node] as const)) : undefined;

  return edges.map(
    (edge) =>
      ({
        id: edge.id,
        sourceNodeId: edge.sourceNodeId,
        sourcePortId: edge.sourcePortId,
        targetNodeId: edge.targetNodeId,
        targetPortId: edge.targetPortId,
        color: workflowEditorEdgePortColor(edge, nodeById, options.portTypeColors),
        status: edge.status,
        metadata: edge.data as Record<string, unknown> | undefined,
      }) as UiWorkflowBuilderEdge & { color?: string },
  );
}

export function fromUiWorkflowBuilderEdges<TData = Record<string, unknown>>(
  uiEdges: UiWorkflowBuilderEdge[],
  previousEdges: Array<WorkflowEditorEdge<TData>>,
): Array<WorkflowEditorEdge<TData>> {
  const previousLookup = new Map(previousEdges.map((edge) => [edge.id, edge]));

  return uiEdges.map((edge) => {
    const previousEdge = previousLookup.get(edge.id);

    return {
      id: edge.id,
      sourceNodeId: edge.sourceNodeId,
      sourcePortId: edge.sourcePortId,
      targetNodeId: edge.targetNodeId,
      targetPortId: edge.targetPortId,
      status: edge.status,
      data: (edge.metadata as TData | undefined) ?? previousEdge?.data,
    };
  });
}

export function toUiWorkflowBuilderViewport(
  viewport: WorkflowEditorViewport | undefined,
): UiWorkflowBuilderViewport | undefined {
  return viewport;
}

function toUiWorkflowEditorPort(
  port: WorkflowEditorPort,
  options: WorkflowEditorPortColorOptions & {
    connected?: boolean;
    direction?: "input" | "output";
  } = {},
): UiWorkflowNodePort {
  const color = workflowEditorPortPresentationColor(port, options.portTypeColors);
  const defaultValueBadge =
    options.direction === "input" && options.connected !== true
      ? formatWorkflowEditorPortDefaultValue(port)
      : undefined;

  return {
    ...port,
    kind: formatWorkflowEditorPortType(port.type),
    required:
      (port as { required?: boolean }).required ??
      (options.direction === "input" && port.optional ? false : undefined),
    badge:
      port.badge ??
      (port.payload ? formatWorkflowEditorPortPayload(port.payload) : undefined) ??
      defaultValueBadge ??
      (options.direction === "input" && port.optional ? "optional" : undefined),
    type: {
      label: formatWorkflowEditorPortType(port.type),
      source: getWorkflowEditorPortTypeSignature(port.type),
      metadata: { workflowEditorType: port.type },
    },
    color,
    metadata: {
      ...port.metadata,
      workflowEditorType: port.type,
      workflowEditorPortColor: color,
    },
  } as UiWorkflowNodePort & {
    color?: string;
    type?: {
      label?: string;
      source: string;
      metadata?: Record<string, unknown>;
    };
  };
}

function createWorkflowEditorConnectedInputLookup(edges: readonly WorkflowEditorEdge<unknown>[]) {
  return new Set(edges.map((edge) => workflowEditorPortKey(edge.targetNodeId, edge.targetPortId)));
}

function workflowEditorPortKey(nodeId: string, portId: string) {
  return `${nodeId}:${portId}`;
}

function formatWorkflowEditorPortDefaultValue(port: WorkflowEditorPort): string | undefined {
  if (!("defaultValue" in port)) {
    return undefined;
  }

  if (port.defaultValue === undefined) {
    return undefined;
  }

  return `default ${formatWorkflowEditorPortDefaultValueLiteral(port.defaultValue)}`;
}

function formatWorkflowEditorPortDefaultValueLiteral(
  value: WorkflowEditorPortDefaultValue,
): string {
  const serialized = JSON.stringify(value);
  return serialized.length > 24 ? `${serialized.slice(0, 21)}...` : serialized;
}

function restoreWorkflowEditorPortsFromUi(
  ports: UiWorkflowNodeData["inputs"] | UiWorkflowNodeData["outputs"] | undefined,
): WorkflowEditorPort[] | undefined {
  return ports?.map((port) => {
    const { kind: _kind, ...rest } = port;
    return {
      ...rest,
      type: getWorkflowEditorPortTypeFromUi(port) ?? ({ kind: "unknown" } as const),
    };
  });
}

function getWorkflowEditorPortTypeFromUi(port: UiWorkflowNodePort): WorkflowEditorPortType | null {
  const legacyPort = port as UiWorkflowNodePort & {
    type?: { metadata?: Record<string, unknown> };
  };
  const metadataType =
    legacyPort.type?.metadata?.workflowEditorType ?? port.metadata?.workflowEditorType;

  return isWorkflowEditorPortTypeLike(metadataType) ? metadataType : null;
}

function workflowEditorEdgePortColor<TData = Record<string, unknown>>(
  edge: WorkflowEditorEdge<TData>,
  nodeById?: ReadonlyMap<string, WorkflowEditorNode<unknown>>,
  portTypeColors?: Readonly<Record<string, string>>,
) {
  if (!nodeById) {
    return undefined;
  }

  const sourcePort = nodeById
    .get(edge.sourceNodeId)
    ?.outputs?.find((port) => port.id === edge.sourcePortId);
  const targetPort = nodeById
    .get(edge.targetNodeId)
    ?.inputs?.find((port) => port.id === edge.targetPortId);
  const port = sourcePort ?? targetPort;

  return port ? workflowEditorPortPresentationColor(port, portTypeColors) : undefined;
}

/** A configured type-wide color overrides a legacy per-port color without changing document data. */
function workflowEditorPortPresentationColor(
  port: WorkflowEditorPort,
  portTypeColors?: Readonly<Record<string, string>>,
): string {
  const name = workflowEditorPortTypeSource(port.type).trim();
  const typeColor = resolveWorkflowEditorPortTypeColor(port.type, portTypeColors);
  return portTypeColors && Object.hasOwn(portTypeColors, name)
    ? typeColor
    : (port.color ?? typeColor);
}

function formatWorkflowEditorPortType(type: WorkflowEditorPortType): string {
  switch (type.kind) {
    case "literal":
      return JSON.stringify(type.value);
    case "array": {
      const element = formatWorkflowEditorPortType(type.element);
      return /^[A-Za-z0-9_]+$/.test(element) ? `${element}[]` : `(${element})[]`;
    }
    case "object":
      return "object";
    case "union": {
      const label = type.types.map(formatWorkflowEditorPortType).join(" | ");
      return label.length <= 36 ? label : "union";
    }
    case "intersection": {
      const label = type.types.map(formatWorkflowEditorPortType).join(" & ");
      return label.length <= 36 ? label : "intersection";
    }
    case "typescript":
      return type.source;
    case "ref":
      return type.name;
    default:
      return type.kind;
  }
}

function getWorkflowEditorPortTypeSignature(type: WorkflowEditorPortType): string {
  switch (type.kind) {
    case "literal":
      return `literal:${JSON.stringify(type.value)}`;
    case "array":
      return `array:${getWorkflowEditorPortTypeSignature(type.element)}`;
    case "object": {
      const properties = type.properties
        ? Object.entries(type.properties)
            .sort(([left], [right]) => left.localeCompare(right))
            .map(
              ([key, property]) =>
                `${key}${property.optional ? "?" : ""}:${getWorkflowEditorPortTypeSignature(
                  property.type,
                )}`,
            )
            .join(",")
        : "";
      return `object:{${properties}}`;
    }
    case "union":
      return `union:${type.types.map(getWorkflowEditorPortTypeSignature).join("|")}`;
    case "intersection":
      return `intersection:${type.types.map(getWorkflowEditorPortTypeSignature).join("&")}`;
    case "typescript":
      return `typescript:${type.source}`;
    case "ref":
      return `ref:${type.name}`;
    default:
      return type.kind;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isWorkflowEditorPortTypeLike(value: unknown, depth = 0): value is WorkflowEditorPortType {
  if (depth > 100 || !isRecord(value) || typeof value.kind !== "string") {
    return false;
  }

  switch (value.kind) {
    case "any":
    case "unknown":
    case "never":
    case "string":
    case "number":
    case "boolean":
    case "null":
    case "undefined":
      return true;
    case "literal":
      return (
        typeof value.value === "string" ||
        typeof value.value === "number" ||
        typeof value.value === "boolean" ||
        value.value === null
      );
    case "array":
      return isWorkflowEditorPortTypeLike(value.element, depth + 1);
    case "object":
      return (
        value.properties === undefined ||
        (isRecord(value.properties) &&
          Object.values(value.properties).every(
            (property) =>
              isRecord(property) &&
              isWorkflowEditorPortTypeLike(property.type, depth + 1) &&
              (property.optional === undefined || typeof property.optional === "boolean"),
          ))
      );
    case "union":
    case "intersection":
      return (
        Array.isArray(value.types) &&
        value.types.every((type) => isWorkflowEditorPortTypeLike(type, depth + 1))
      );
    case "ref":
      return typeof value.name === "string" && value.name.trim() !== "";
    default:
      return false;
  }
}
