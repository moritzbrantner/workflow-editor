import type { WorkflowEditorInspectorFieldDefinition } from "./core-inspector-fields";
import type {
  GraphEditorDocument,
  GraphEditorEdge,
  GraphEditorGroup,
  GraphEditorConnectionInput,
  GraphEditorConnectionValidity,
  GraphEditorNode,
  GraphEditorNodeTemplate,
  GraphEditorPort,
  GraphEditorSelectionItem,
  GraphEditorSelectionState,
  GraphEditorViewport,
} from "@moritzbrantner/graph-editor/core";

export type WorkflowEditorPortType =
  | { kind: "typescript"; source: string }
  | { kind: "any" }
  | { kind: "unknown" }
  | { kind: "never" }
  | { kind: "string" | "number" | "boolean" | "null" | "undefined" }
  | { kind: "literal"; value: string | number | boolean | null }
  | { kind: "array"; element: WorkflowEditorPortType }
  | { kind: "object"; properties?: Record<string, WorkflowEditorPortProperty> }
  | { kind: "union"; types: WorkflowEditorPortType[] }
  | { kind: "intersection"; types: WorkflowEditorPortType[] }
  | { kind: "ref"; name: string };

export type WorkflowEditorPortProperty = {
  type: WorkflowEditorPortType;
  optional?: boolean;
};

export type WorkflowEditorPortDefaultValue =
  | string
  | number
  | boolean
  | null
  | WorkflowEditorPortDefaultValue[]
  | { [key: string]: WorkflowEditorPortDefaultValue };

export type WorkflowEditorObjectConstructorSchema = Extract<
  WorkflowEditorPortType,
  { kind: "object" }
>;

export type WorkflowEditorObjectConstructorProperty = {
  key: string;
  sourceExpression?: string;
  sourceNodeId?: string;
  sourcePortId?: string;
};

export type WorkflowEditorObjectConstructorExpressionEntry = {
  key: string;
  sourceExpression: string;
};

export type WorkflowEditorObjectConstructorExpressionDiagnostic = {
  code:
    | "invalid-object-expression"
    | "unbalanced-expression"
    | "invalid-property"
    | "invalid-property-key"
    | "missing-property-value";
  message: string;
  index?: number;
};

export type WorkflowEditorObjectConstructorInputOptions = {
  portId?: string;
  propertyKey?: string;
  sourceExpression?: string;
  sourceNodeId?: string;
  sourcePortId?: string;
  type?: WorkflowEditorPortType;
};

export type WorkflowEditorArrayConstructorItem = {
  sourceExpression?: string;
  sourceNodeId?: string;
  sourcePortId?: string;
};

export type WorkflowEditorArrayConstructorInputOptions = {
  portId?: string;
  sourceExpression?: string;
  sourceNodeId?: string;
  sourcePortId?: string;
  type?: WorkflowEditorPortType;
};

export type WorkflowEditorObjectDecompositionProperty = {
  key: string;
};

export type WorkflowEditorObjectDecompositionOutputOptions = {
  portId?: string;
  propertyKey?: string;
  type?: WorkflowEditorPortType;
};

export type WorkflowEditorTypeDefinition = {
  name: string;
  type: WorkflowEditorPortType;
  extends?: string[];
};

export type WorkflowEditorTypeValidationOptions = {
  typeDefinitions?: readonly WorkflowEditorTypeDefinition[];
  typeDeclarations?: string;
};

export type WorkflowEditorConnectionValidationOptions = WorkflowEditorTypeValidationOptions & {
  /** An existing edge being rewired; it is ignored when counting connections. */
  replacingEdgeId?: string;
};

export type WorkflowEditorTypeDiagnostic = {
  type:
    | "incompatible-port-type"
    | "incompatible-payload-mode"
    | "incompatible-media-type"
    | "missing-type-definition";
  edgeId?: string;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
  message: string;
};

export type WorkflowEditorPort = Omit<
  GraphEditorPort<WorkflowEditorPortType>,
  "required" | "type"
> & {
  type: WorkflowEditorPortType;
  optional?: boolean;
  defaultValue?: WorkflowEditorPortDefaultValue;
  /** Delivery contract; ports without one deliver a complete (buffered) value. */
  payload?: WorkflowEditorPortPayload;
  /**
   * Connection bounds. Without it, ordinary inputs accept one connection and outputs are
   * unbounded. A declared cardinality without `max` is unbounded. An input that accepts more
   * than one connection must declare an array type `T[]`; each source must be assignable to `T`.
   */
  cardinality?: WorkflowEditorPortCardinality;
};

export type WorkflowEditorPortCardinality = {
  min?: number;
  max?: number;
};

export type WorkflowEditorPortPayloadMode = "buffered" | "streamed";

export type WorkflowEditorPortPayload = {
  mode: WorkflowEditorPortPayloadMode;
  /** Media annotation such as `audio/wav`; `type/*` matches any subtype. */
  mediaType?: string;
};

export type WorkflowEditorWorkflowReference = {
  documentId: string;
  /**
   * Finite re-entry bound for a recursive reference (a positive integer). A reference cycle is
   * bounded when at least one reference on it declares `maxDepth`; unbounded cycles are rejected.
   */
  maxDepth?: number;
};

export type WorkflowEditorCompositionBoundary = {
  wrapperPortId: string;
  nodeId: string;
  portId: string;
};

export type WorkflowEditorNodeComposition<TNodeData = Record<string, unknown>> = {
  nodes: Array<WorkflowEditorNode<TNodeData>>;
  edges: Array<WorkflowEditorEdge>;
  inputBoundaries: WorkflowEditorCompositionBoundary[];
  outputBoundaries: WorkflowEditorCompositionBoundary[];
};

export type WorkflowEditorNode<TData = Record<string, unknown>> = Omit<
  GraphEditorNode<TData, WorkflowEditorPortType>,
  "inputs" | "outputs"
> & {
  inputs?: WorkflowEditorPort[];
  outputs?: WorkflowEditorPort[];
  workflowRef?: WorkflowEditorWorkflowReference;
  composition?: WorkflowEditorNodeComposition<TData>;
  /**
   * When the runner persists this node's result (Runner TECH-011). Absent means the default:
   * results persist with the terminal run result. `"on-completion"` asks the runner to hand the
   * result to host persistence as soon as this node completes.
   */
  persistence?: WorkflowEditorNodePersistence;
};

export type WorkflowEditorNodePersistence = "on-completion";

export type WorkflowEditorEdge<TData = Record<string, unknown>> = GraphEditorEdge<TData>;

export type WorkflowEditorGroup<TData = Record<string, unknown>> = GraphEditorGroup<TData>;

export type WorkflowEditorViewport = GraphEditorViewport;

export type WorkflowEditorDocument<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
> = Omit<GraphEditorDocument<TNodeData, TEdgeData, WorkflowEditorPortType>, "edges" | "nodes"> & {
  nodes: Array<WorkflowEditorNode<TNodeData>>;
  edges: Array<WorkflowEditorEdge<TEdgeData>>;
  typeDeclarations?: string;
};

export type WorkflowEditorDocumentDiagnosticCode =
  | "invalid-port-type"
  | "invalid-port-payload"
  | "invalid-type-declarations"
  | "invalid-document"
  | "invalid-node"
  | "invalid-edge"
  | "duplicate-node-id"
  | "duplicate-edge-id"
  | "duplicate-group-id"
  | "duplicate-group-node"
  | "missing-edge-node"
  | "missing-edge-port"
  | "missing-group-node"
  | "self-edge"
  | "cycle"
  | "invalid-group"
  | "port-cardinality-max"
  | "invalid-port-cardinality";

export type WorkflowEditorDiagnosticSeverity = "error" | "warning";

export type WorkflowEditorDocumentDiagnostic = {
  code: WorkflowEditorDocumentDiagnosticCode;
  severity: WorkflowEditorDiagnosticSeverity;
  message: string;
  path: string;
  nodeId?: string;
  groupId?: string;
  edgeId?: string;
  sourceNodeId?: string;
  targetNodeId?: string;
};

/**
 * Per-rule document validation policy. An allowed condition is reported as a `warning` and its
 * content is kept; a disallowed condition is an `error`. `unknownPortBehavior: "ignore"` keeps an
 * edge to an undeclared port without a diagnostic.
 */
export type WorkflowEditorValidationPolicy = {
  allowCycles: boolean;
  allowDanglingEdges: boolean;
  allowSelfEdges: boolean;
  /** Connections beyond a port's `max`; allowed ones are kept as warnings and are repairable. */
  allowExcessConnections: boolean;
  unknownPortBehavior: "error" | "warning" | "ignore";
};

export type WorkflowEditorDocumentValidationOptions = {
  /** Defaults to `workflowEditorValidationPolicies.strict`. */
  policy?: WorkflowEditorValidationPolicy;
};

export type WorkflowEditorDocumentNormalizationOptions = WorkflowEditorDocumentValidationOptions;

export type WorkflowEditorDocumentNormalizationResult<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
> = {
  document: WorkflowEditorDocument<TNodeData, TEdgeData>;
  /** Warning-severity diagnostics for content the policy allowed and kept. */
  diagnostics: WorkflowEditorDocumentDiagnostic[];
};

export type WorkflowEditorConnectionInput = GraphEditorConnectionInput;

export type WorkflowEditorConnectionInvalidReason =
  | NonNullable<GraphEditorConnectionValidity["reason"]>
  | "cycle"
  | "media-type-mismatch"
  | "missing-node"
  | "payload-mode-mismatch"
  | "source-cardinality"
  | "target-cardinality";

export type WorkflowEditorConnectionValidity = {
  valid: boolean;
  reason?: WorkflowEditorConnectionInvalidReason;
  message?: string;
};

export type WorkflowEditorSelection<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
> =
  | {
      type: "node";
      id: string;
      node: WorkflowEditorNode<TNodeData>;
    }
  | {
      type: "edge";
      id: string;
      edge: WorkflowEditorEdge<TEdgeData>;
    }
  | null;

export type WorkflowEditorSelectionItem = GraphEditorSelectionItem;

export type WorkflowEditorSelectionState = GraphEditorSelectionState;

export type WorkflowEditorNodeTemplate<TData = Record<string, unknown>> = Omit<
  GraphEditorNodeTemplate<TData, WorkflowEditorPortType>,
  "inputs" | "outputs"
> & {
  inputs?: WorkflowEditorPort[];
  outputs?: WorkflowEditorPort[];
  workflowRef?: WorkflowEditorWorkflowReference;
  composition?: WorkflowEditorNodeComposition<TData>;
  /** Typed inspector fields for the data of nodes created from this template (matched by kind). */
  inspectorFields?: WorkflowEditorInspectorFieldDefinition[];
};
