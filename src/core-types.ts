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
};

export type WorkflowEditorTypeDiagnostic = {
  type: "incompatible-port-type" | "missing-type-definition";
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
};

export type WorkflowEditorWorkflowReference = {
  documentId: string;
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
};

export type WorkflowEditorEdge<TData = Record<string, unknown>> = GraphEditorEdge<TData>;

export type WorkflowEditorGroup<TData = Record<string, unknown>> = GraphEditorGroup<TData>;

export type WorkflowEditorViewport = GraphEditorViewport;

export type WorkflowEditorDocument<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
> = Omit<GraphEditorDocument<TNodeData, TEdgeData, WorkflowEditorPortType>, "edges" | "nodes"> & {
  nodes: Array<WorkflowEditorNode<TNodeData>>;
  edges: Array<WorkflowEditorEdge<TEdgeData>>;
};

export type WorkflowEditorDocumentNormalizationMode = "strict" | "repair";

export type WorkflowEditorDocumentDiagnosticCode =
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
  | "invalid-group";

export type WorkflowEditorDocumentDiagnostic = {
  code: WorkflowEditorDocumentDiagnosticCode;
  message: string;
  path: string;
  nodeId?: string;
  groupId?: string;
  edgeId?: string;
  sourceNodeId?: string;
  targetNodeId?: string;
};

export type WorkflowEditorDocumentValidationOptions = {
  allowCycles?: boolean;
};

export type WorkflowEditorDocumentNormalizationOptions = WorkflowEditorDocumentValidationOptions & {
  mode?: WorkflowEditorDocumentNormalizationMode;
};

export type WorkflowEditorConnectionInput = GraphEditorConnectionInput;

export type WorkflowEditorConnectionInvalidReason =
  | NonNullable<GraphEditorConnectionValidity["reason"]>
  | "cycle"
  | "missing-node";

export type WorkflowEditorConnectionValidity = {
  valid: boolean;
  reason?: WorkflowEditorConnectionInvalidReason;
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
};