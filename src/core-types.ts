import type {
  WorkflowBuilderConnection as UiWorkflowBuilderConnection,
  WorkflowBuilderConnectionValidity as UiWorkflowBuilderConnectionValidity,
} from "./react/workflow-builder";
import type {
  WorkflowNodeData as UiWorkflowNodeData,
  WorkflowNodePort as UiWorkflowNodePort,
} from "./react/workflow-node";

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

export type WorkflowEditorPort = Omit<UiWorkflowNodePort, "kind" | "type"> & {
  type: WorkflowEditorPortType;
  color?: string;
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
  UiWorkflowNodeData,
  "inputs" | "metadata" | "outputs"
> & {
  categoryPath?: readonly string[];
  x: number;
  y: number;
  inputs?: WorkflowEditorPort[];
  outputs?: WorkflowEditorPort[];
  data?: TData;
  workflowRef?: WorkflowEditorWorkflowReference;
  composition?: WorkflowEditorNodeComposition<TData>;
};

export type WorkflowEditorEdge<TData = Record<string, unknown>> = {
  id: string;
  sourceNodeId: string;
  sourcePortId: string;
  targetNodeId: string;
  targetPortId: string;
  status?: "idle" | "running" | "success" | "error" | "warning" | string;
  data?: TData;
};

export type WorkflowEditorViewport = {
  x: number;
  y: number;
  zoom: number;
};

export type WorkflowEditorDocument<
  TNodeData = Record<string, unknown>,
  TEdgeData = Record<string, unknown>,
> = {
  nodes: Array<WorkflowEditorNode<TNodeData>>;
  edges: Array<WorkflowEditorEdge<TEdgeData>>;
  viewport?: WorkflowEditorViewport;
};

export type WorkflowEditorDocumentNormalizationMode = "strict" | "repair";

export type WorkflowEditorDocumentDiagnosticCode =
  | "invalid-document"
  | "invalid-node"
  | "invalid-edge"
  | "duplicate-node-id"
  | "duplicate-edge-id"
  | "missing-edge-node"
  | "missing-edge-port"
  | "self-edge"
  | "cycle";

export type WorkflowEditorDocumentDiagnostic = {
  code: WorkflowEditorDocumentDiagnosticCode;
  message: string;
  path: string;
  nodeId?: string;
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

export type WorkflowEditorConnectionInput = UiWorkflowBuilderConnection;

export type WorkflowEditorConnectionInvalidReason =
  | NonNullable<UiWorkflowBuilderConnectionValidity["reason"]>
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

export type WorkflowEditorSelectionItem =
  | {
      type: "node";
      id: string;
    }
  | {
      type: "edge";
      id: string;
    };

export type WorkflowEditorSelectionState = {
  nodeIds: string[];
  edgeIds: string[];
  primary?: WorkflowEditorSelectionItem;
};

export type WorkflowEditorNodeTemplate<TData = Record<string, unknown>> = Omit<
  WorkflowEditorNode<TData>,
  "x" | "y"
>;
