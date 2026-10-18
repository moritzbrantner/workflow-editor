import { useEffect, useState } from "react";

import { Button, Input, cn } from "@moritzbrantner/ui";

import {
  addWorkflowEditorArrayConstructorInputToNode,
  addWorkflowEditorObjectDecompositionOutputToNode,
  addWorkflowEditorObjectConstructorInputToNode,
  formatWorkflowEditorArrayConstructorExpression,
  formatWorkflowEditorObjectDecompositionExpression,
  formatWorkflowEditorObjectConstructorExpression,
  getWorkflowEditorArrayConstructorInputs,
  getWorkflowEditorObjectDecompositionOutputs,
  getWorkflowEditorObjectConstructorInputs,
  isWorkflowEditorArrayConstructorNode,
  isWorkflowEditorObjectDecompositionNode,
  isWorkflowEditorObjectConstructorNode,
  removeWorkflowEditorArrayConstructorInput,
  removeWorkflowEditorObjectDecompositionOutput,
  removeWorkflowEditorObjectConstructorInput,
  updateWorkflowEditorObjectDecompositionPropertiesInNode,
  updateWorkflowEditorObjectConstructorPropertiesInNode,
  isWorkflowEditorIterationNode,
  updateWorkflowEditorIterationBound,
  updateWorkflowEditorIterationStateType,
  validateWorkflowEditorIterationNode,
  workflowEditorIterationBound,
  workflowEditorPortTypeSource,
  readWorkflowEditorFieldValue,
  isWorkflowEditorReferenceDepth,
  syncWorkflowEditorReferenceInterface,
  workflowEditorReferenceMatchesInterface,
  type WorkflowEditorWorkflowInterface,
  type WorkflowEditorDocument,
  type WorkflowEditorIterationDiagnostic,
  type WorkflowEditorNode,
} from "../core";
import type { WorkflowWorkbenchInspectorContext } from "../react";
import {
  InspectorPanel,
  type InspectorFieldDefinition,
  type InspectorFieldValue,
} from "./inspector-panel";
import { WorkflowTriggersPanel } from "./triggers-panel";
import { WorkflowInputsPanel } from "./inputs-panel";
import { WorkflowPortPayloadEditor, withWorkflowEditorPortPayload } from "./port-payload-editor";
import {
  applyInspectorFieldDrafts,
  createInspectorFieldSections,
  inspectorFieldIdPrefix,
  validateInspectorFieldDrafts,
  visibleInspectorFields,
} from "./inspector-field-sections";
import { WorkflowSharedFieldsInspector } from "./shared-fields-inspector";

export function DefaultWorkflowInspector<
  TNodeData extends Record<string, unknown>,
  TEdgeData extends Record<string, unknown>,
>({ context }: { context: WorkflowWorkbenchInspectorContext<TNodeData, TEdgeData> }) {
  const fieldNodeId = context.selectedNode?.id;
  const [fieldDrafts, setFieldDrafts] = useState<Record<string, InspectorFieldValue>>({});
  useEffect(() => setFieldDrafts({}), [fieldNodeId]);

  if (context.selectedNode) {
    const node = context.selectedNode;
    const allDataFields = context.inspectorFields?.(node) ?? [];
    const initialFieldDrafts = createInspectorFieldSections({
      fields: allDataFields,
      values: (field) => readWorkflowEditorFieldValue(field, node.data),
      readOnly: context.readOnly,
    }).defaultValues;
    const currentFieldDrafts = { ...initialFieldDrafts, ...fieldDrafts };
    const dataFields = visibleInspectorFields(
      allDataFields,
      applyInspectorFieldDrafts(node.data, allDataFields, currentFieldDrafts, initialFieldDrafts),
    );
    const dataFieldSections = createInspectorFieldSections({
      fields: dataFields,
      values: (field) => readWorkflowEditorFieldValue(field, node.data),
      renderers: context.inspectorFieldRenderers,
      readOnly: context.readOnly,
      node: node as WorkflowEditorNode<Record<string, unknown>>,
    });
    const referenceOptions = createWorkflowReferenceOptions(context.documentReferences, node);
    const referencedDocumentId = node.workflowRef?.documentId ?? "";
    const referencedInterface = context.documentReferences?.find(
      (reference) => reference.id === referencedDocumentId,
    )?.interface;
    const referenceMissing =
      referencedDocumentId !== "" &&
      !context.documentReferences?.some((reference) => reference.id === referencedDocumentId);
    const arrayConstructorInputs = getWorkflowEditorArrayConstructorInputs(node);
    const arrayConstructorExpression = formatWorkflowEditorArrayConstructorExpression(node);
    const arrayConstructorDefaultValues = Object.fromEntries(
      arrayConstructorInputs.map((input) => [
        `arrayItem:${input.id}`,
        input.badge ? String(input.badge) : input.id,
      ]),
    );
    const objectConstructorInputs = getWorkflowEditorObjectConstructorInputs(node);
    const objectConstructorExpression = formatWorkflowEditorObjectConstructorExpression(node);
    const objectConstructorDefaultValues = Object.fromEntries(
      objectConstructorInputs.map((input) => [`objectProperty:${input.id}`, input.label]),
    );
    const objectDecompositionOutputs = getWorkflowEditorObjectDecompositionOutputs(node);
    const objectDecompositionExpression = formatWorkflowEditorObjectDecompositionExpression(node);
    const objectDecompositionDefaultValues = Object.fromEntries(
      objectDecompositionOutputs.map((output) => [`objectOutput:${output.id}`, output.label]),
    );
    const jsonValueField = createWorkflowEditorJsonValueField(node);
    const iteration = isWorkflowEditorIterationNode(node)
      ? describeWorkflowEditorIteration(node, context.document.typeDeclarations)
      : null;
    const jsonValueDefault = readWorkflowEditorJsonValueFieldValue(node);

    return (
      <div className="grid gap-3">
        <InspectorPanel
          key={node.id}
          title="Workflow node"
          description={node.kind ?? node.category}
          readOnly={context.readOnly}
          validationMessages={{
            ...(referenceMissing
              ? { workflowDocumentId: `Missing workflow document: ${referencedDocumentId}` }
              : {}),
            ...(node.workflowRef?.maxDepth !== undefined &&
            !isWorkflowEditorReferenceDepth(node.workflowRef.maxDepth)
              ? { maxDepth: "Use a positive whole number." }
              : {}),
            ...iteration?.validationMessages,
            ...validateInspectorFieldDrafts(dataFields, currentFieldDrafts),
          }}
          onValuesChange={(values) =>
            setFieldDrafts(
              Object.fromEntries(
                Object.entries(values).filter(([id]) => id.startsWith(inspectorFieldIdPrefix)),
              ),
            )
          }
          defaultValues={{
            label: node.label,
            description: node.description ?? "",
            kind: node.kind ?? "",
            category: node.category ?? "",
            x: node.x,
            y: node.y,
            status: node.status ?? "idle",
            persistOnCompletion: node.persistence === "on-completion",
            workflowDocumentId: referencedDocumentId,
            maxDepth: node.workflowRef?.maxDepth ?? "",
            arrayExpression: arrayConstructorExpression,
            objectExpression: objectConstructorExpression,
            objectDecompositionExpression,
            ...(jsonValueField ? { jsonValue: jsonValueDefault } : {}),
            ...iteration?.defaultValues,
            ...arrayConstructorDefaultValues,
            ...objectConstructorDefaultValues,
            ...objectDecompositionDefaultValues,
            ...dataFieldSections.defaultValues,
          }}
          sections={[
            {
              id: "node",
              title: "Node",
              fields: [
                { id: "label", label: "Label", type: "text" },
                { id: "description", label: "Description", type: "textarea" },
                { id: "kind", label: "Kind", type: "text", readOnly: true },
                { id: "category", label: "Category", type: "text" },
                { id: "x", label: "X", type: "number", step: 10 },
                { id: "y", label: "Y", type: "number", step: 10 },
                { id: "status", label: "Status", type: "text" },
              ],
            },
            {
              id: "execution",
              title: "Execution",
              fields: [
                {
                  id: "persistOnCompletion",
                  label: "Persist result on completion",
                  type: "boolean",
                },
              ],
            },
            ...dataFieldSections.sections,
            ...(context.documentReferences
              ? [
                  {
                    id: "nested-workflow",
                    title: "Nested workflow",
                    fields: [
                      {
                        id: "workflowDocumentId",
                        label: "Workflow document",
                        type: "select" as const,
                        options: referenceOptions,
                        readOnly: context.readOnly,
                      },
                      ...(referencedDocumentId
                        ? [
                            {
                              id: "maxDepth",
                              label: "Maximum recursion depth",
                              description:
                                "Bounds how often a recursive reference may re-enter. Leave empty when the reference is not recursive.",
                              type: "number" as const,
                              min: 1,
                              step: 1,
                              readOnly: context.readOnly,
                            },
                          ]
                        : []),
                    ],
                  },
                ]
              : []),
            ...(jsonValueField
              ? [
                  {
                    id: "json-value",
                    title: "Output",
                    description: "Choose the value emitted by this source node.",
                    fields: [jsonValueField],
                  },
                ]
              : []),
            ...(isWorkflowEditorArrayConstructorNode(node)
              ? [
                  {
                    id: "array-constructor",
                    title: "Array",
                    description: "Collect input values into array items.",
                    fields: [
                      ...arrayConstructorInputs.map((input, index) =>
                        createWorkflowEditorRemovableInspectorField({
                          id: `arrayItem:${input.id}`,
                          label: input.label,
                          readOnly: true,
                          removeLabel: `Remove array item ${index + 1}`,
                          removeDisabled: context.readOnly,
                          onRemove: () =>
                            context.updateDocument?.(
                              removeWorkflowEditorArrayConstructorInput(
                                context.document,
                                node.id,
                                input.id,
                              ),
                            ),
                        }),
                      ),
                      {
                        id: "arrayExpression",
                        label: "Expression",
                        type: "code" as const,
                        readOnly: true,
                      },
                    ],
                  },
                ]
              : []),
            ...(isWorkflowEditorObjectConstructorNode(node)
              ? [
                  {
                    id: "object-constructor",
                    title: "Object",
                    description: "Map input values to object properties.",
                    fields: [
                      ...objectConstructorInputs.map((input) =>
                        createWorkflowEditorRemovableInspectorField({
                          id: `objectProperty:${input.id}`,
                          label: input.label,
                          placeholder: "propertyName",
                          readOnly: context.readOnly,
                          removeLabel: `Remove property input ${input.label}`,
                          removeDisabled: context.readOnly,
                          onRemove: () =>
                            context.updateDocument?.(
                              removeWorkflowEditorObjectConstructorInput(
                                context.document,
                                node.id,
                                input.id,
                              ),
                            ),
                        }),
                      ),
                      {
                        id: "objectExpression",
                        label: "Expression",
                        type: "code" as const,
                        readOnly: true,
                      },
                    ],
                  },
                ]
              : []),
            ...(isWorkflowEditorObjectDecompositionNode(node)
              ? [
                  {
                    id: "object-decomposition",
                    title: "Object decomposition",
                    description: "Map object properties to output ports.",
                    fields: [
                      ...objectDecompositionOutputs.map((output) =>
                        createWorkflowEditorRemovableInspectorField({
                          id: `objectOutput:${output.id}`,
                          label: output.badge ? `${output.badge}` : output.label,
                          placeholder: "propertyName",
                          readOnly: context.readOnly,
                          removeLabel: `Remove property output ${output.label}`,
                          removeDisabled: context.readOnly,
                          onRemove: () =>
                            context.updateDocument?.(
                              removeWorkflowEditorObjectDecompositionOutput(
                                context.document,
                                node.id,
                                output.id,
                              ),
                            ),
                        }),
                      ),
                      {
                        id: "objectDecompositionExpression",
                        label: "Expression",
                        type: "code" as const,
                        readOnly: true,
                      },
                    ],
                  },
                ]
              : []),
            ...(iteration
              ? [
                  {
                    id: "iteration",
                    title: "Iteration",
                    description:
                      "A bounded loop: the body runs at most the maximum number of times. The editor compiles it; a runner executes it.",
                    fields: [
                      { id: "maxIterations", label: "Maximum iterations", type: "number" as const },
                      {
                        id: "stateType",
                        label: "State type (TypeScript)",
                        type: "text" as const,
                      },
                      {
                        id: "stopCondition",
                        label: "Stop condition",
                        type: "text" as const,
                        readOnly: true,
                      },
                      {
                        id: "resultContract",
                        label: "Result contract",
                        type: "code" as const,
                        readOnly: true,
                      },
                    ],
                  },
                ]
              : []),
          ]}
          onApply={(values) => {
            const patch: Partial<WorkflowEditorNode<TNodeData>> = {
              label: String(values.label ?? node.label),
              description: String(values.description ?? "") || undefined,
              category: String(values.category ?? "") || undefined,
              x: toNumber(values.x, node.x),
              y: toNumber(values.y, node.y),
              status: String(values.status ?? "") || undefined,
              persistence: values.persistOnCompletion === true ? "on-completion" : undefined,
            };

            if (context.documentReferences) {
              patch.workflowRef =
                typeof values.workflowDocumentId === "string" && values.workflowDocumentId
                  ? {
                      documentId: values.workflowDocumentId,
                      ...(readWorkflowReferenceDepth(values.maxDepth) !== undefined
                        ? { maxDepth: readWorkflowReferenceDepth(values.maxDepth) }
                        : {}),
                    }
                  : undefined;
            }

            if (isWorkflowEditorObjectConstructorNode(node)) {
              const propertyKeysByPortId = Object.fromEntries(
                objectConstructorInputs.map((input) => [
                  input.id,
                  String(values[`objectProperty:${input.id}`] ?? input.label),
                ]),
              );
              const nextNode = updateWorkflowEditorObjectConstructorPropertiesInNode(
                node,
                propertyKeysByPortId,
              );

              patch.inputs = nextNode.inputs;
              patch.outputs = nextNode.outputs;
              patch.data = nextNode.data;
            }

            if (isWorkflowEditorObjectDecompositionNode(node)) {
              const propertyKeysByPortId = Object.fromEntries(
                objectDecompositionOutputs.map((output) => [
                  output.id,
                  String(values[`objectOutput:${output.id}`] ?? output.label),
                ]),
              );
              const nextNode = updateWorkflowEditorObjectDecompositionPropertiesInNode(
                node,
                propertyKeysByPortId,
              );

              patch.inputs = nextNode.inputs;
              patch.outputs = nextNode.outputs;
              patch.data = nextNode.data;
            }

            if (iteration) {
              const bound = values.maxIterations;
              let single: WorkflowEditorDocument<TNodeData, TEdgeData> = {
                nodes: [node],
                edges: [],
              };
              single = updateWorkflowEditorIterationBound(
                single,
                node.id,
                bound === "" || bound === undefined || bound === null ? null : Number(bound),
              );
              const stateSource = String(values.stateType ?? "").trim();
              if (stateSource) {
                single = updateWorkflowEditorIterationStateType(single, node.id, {
                  kind: "typescript",
                  source: stateSource,
                });
              }
              const [updated] = single.nodes;
              patch.data = updated!.data;
              patch.inputs = updated!.inputs;
              patch.outputs = updated!.outputs;
            }

            if (jsonValueField) {
              patch.data = {
                ...(isRecord(node.data) ? node.data : {}),
                value: parseWorkflowEditorJsonValueFieldValue(node, values.jsonValue),
              } as unknown as TNodeData;
            }

            if (dataFields.length > 0) {
              patch.data = applyInspectorFieldDrafts(
                (patch.data ?? node.data) as TNodeData | undefined,
                dataFields,
                values,
                initialFieldDrafts,
              );
            }

            context.updateSelectedNode(patch);
          }}
        />
        {context.selectedNodes.length > 1 && context.inspectorFields ? (
          <WorkflowSharedFieldsInspector context={context} />
        ) : null}
        {node.inputs?.length || node.outputs?.length ? (
          <section className="grid gap-2 px-4" aria-label="Port delivery">
            <h3 className="text-sm font-semibold">Port delivery</h3>
            {(["inputs", "outputs"] as const).flatMap((direction) =>
              (node[direction] ?? []).map((port) => (
                <WorkflowPortPayloadEditor
                  key={`${node.id}:${direction}:${port.id}:${JSON.stringify(port.payload ?? null)}`}
                  port={port}
                  direction={direction}
                  readOnly={context.readOnly}
                  onApply={(payload) =>
                    context.updateSelectedNode({
                      [direction]: withWorkflowEditorPortPayload(node[direction], port.id, payload),
                    } as Partial<WorkflowEditorNode<TNodeData>>)
                  }
                />
              )),
            )}
          </section>
        ) : null}
        {isWorkflowEditorArrayConstructorNode(node) ? (
          <div className="flex flex-wrap gap-2 px-4">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={context.readOnly}
              onClick={() => {
                const nextNode = addWorkflowEditorArrayConstructorInputToNode(node);
                context.updateSelectedNode({
                  inputs: nextNode.inputs,
                  outputs: nextNode.outputs,
                  data: nextNode.data,
                } as Partial<WorkflowEditorNode<TNodeData>>);
              }}
            >
              Add item input
            </Button>
          </div>
        ) : null}
        {isWorkflowEditorObjectConstructorNode(node) ? (
          <div className="flex flex-wrap gap-2 px-4">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={context.readOnly}
              onClick={() => {
                const nextNode = addWorkflowEditorObjectConstructorInputToNode(node);
                context.updateSelectedNode({
                  inputs: nextNode.inputs,
                  outputs: nextNode.outputs,
                  data: nextNode.data,
                } as Partial<WorkflowEditorNode<TNodeData>>);
              }}
            >
              Add property input
            </Button>
          </div>
        ) : null}
        {isWorkflowEditorObjectDecompositionNode(node) ? (
          <div className="flex flex-wrap gap-2 px-4">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={context.readOnly}
              onClick={() => {
                const nextNode = addWorkflowEditorObjectDecompositionOutputToNode(node);
                context.updateSelectedNode({
                  inputs: nextNode.inputs,
                  outputs: nextNode.outputs,
                  data: nextNode.data,
                } as Partial<WorkflowEditorNode<TNodeData>>);
              }}
            >
              Add property output
            </Button>
          </div>
        ) : null}
        {context.documentReferences ? (
          <div className="flex flex-wrap gap-2 px-4 pb-4">
            {referencedInterface ? (
              <WorkflowReferenceInterfaceSummary
                workflowInterface={referencedInterface}
                matches={workflowEditorReferenceMatchesInterface(node, referencedInterface)}
                readOnly={context.readOnly || !context.updateDocument}
                onSync={() =>
                  context.updateDocument?.(
                    syncWorkflowEditorReferenceInterface(
                      context.document,
                      node.id,
                      referencedInterface,
                    ),
                  )
                }
              />
            ) : null}
            {referencedDocumentId ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={referenceMissing || !context.openSelectedNodeWorkflow}
                onClick={context.openSelectedNodeWorkflow}
              >
                Open workflow
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={context.readOnly || !context.createSelectedNodeWorkflow}
                onClick={context.createSelectedNodeWorkflow}
              >
                Create nested workflow
              </Button>
            )}
          </div>
        ) : null}
      </div>
    );
  }

  if (context.selectedEdge) {
    const edge = context.selectedEdge;

    return (
      <InspectorPanel
        key={edge.id}
        title="Workflow edge"
        description={`${edge.sourceNodeId} -> ${edge.targetNodeId}`}
        readOnly={context.readOnly}
        defaultValues={{
          id: edge.id,
          status: edge.status ?? "idle",
          source: edge.sourcePortId,
          target: edge.targetPortId,
        }}
        fields={[
          { id: "id", label: "ID", type: "text", readOnly: true },
          { id: "source", label: "Source port", type: "text", readOnly: true },
          { id: "target", label: "Target port", type: "text", readOnly: true },
          { id: "status", label: "Status", type: "text" },
        ]}
        onApply={(values) => {
          context.updateSelectedEdge({
            status: String(values.status ?? "") || undefined,
          });
        }}
      />
    );
  }

  return (
    <div className="grid">
      <div className="p-4 pb-0 text-sm text-muted-foreground">
        Select a workflow node or edge to inspect its configuration.
      </div>
      <WorkflowTriggersPanel
        key={JSON.stringify(context.document.triggers ?? [])}
        triggers={context.document.triggers}
        readOnly={context.readOnly || !context.updateDocument}
        activation={context.triggerActivation}
        onApply={(triggers) =>
          context.updateDocument?.({
            ...context.document,
            ...(triggers.length ? { triggers } : { triggers: undefined }),
          })
        }
      />
      <WorkflowInputsPanel
        key={`${context.document.nodes.length}:${(context.inputProfiles?.profiles ?? []).map((profile) => profile.id).join(",")}`}
        document={context.document as WorkflowEditorDocument<unknown, unknown>}
        typeDefinitions={context.typeDefinitions}
        readOnly={context.readOnly}
        inputProfiles={context.inputProfiles}
      />
    </div>
  );
}

function createWorkflowEditorRemovableInspectorField({
  id,
  label,
  onRemove,
  placeholder,
  readOnly = false,
  removeDisabled = false,
  removeLabel,
}: {
  id: string;
  label: string;
  onRemove: () => void;
  placeholder?: string;
  readOnly?: boolean;
  removeDisabled?: boolean;
  removeLabel: string;
}): InspectorFieldDefinition {
  return {
    id,
    label,
    type: "custom",
    placeholder,
    render: (value, onChange) => (
      <div className="flex items-center gap-2">
        <Input
          aria-label={label}
          className={cn(
            "h-8 min-w-0 flex-1 rounded-md border border-input bg-background px-2 text-sm",
            readOnly && "text-muted-foreground",
          )}
          disabled={readOnly}
          placeholder={placeholder}
          value={String(value ?? "")}
          onChange={(event) => onChange(event.currentTarget.value)}
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-label={removeLabel}
          disabled={removeDisabled}
          onClick={onRemove}
        >
          Remove
        </Button>
      </div>
    ),
  };
}

const iterationFieldByCode: Record<WorkflowEditorIterationDiagnostic["code"], string> = {
  "iteration-bound-required": "maxIterations",
  "iteration-bound-invalid": "maxIterations",
  "iteration-state-type": "stateType",
  "iteration-stop-type": "stopCondition",
  "iteration-body-missing": "stopCondition",
  "iteration-boundary-invalid": "stopCondition",
  "nested-iteration-not-supported": "stopCondition",
  "iteration-input-unconnected": "stopCondition",
};

function describeWorkflowEditorIteration<TData>(
  node: WorkflowEditorNode<TData>,
  typeDeclarations: string | undefined,
) {
  const bound = workflowEditorIterationBound(node);
  const state = node.inputs?.find((port) => port.id === "state");
  const result = node.outputs?.find((port) => port.id === "result");
  const converged = node.composition?.outputBoundaries.find(
    (boundary) => boundary.wrapperPortId === "converged",
  );
  const validationMessages: Record<string, string> = {};
  for (const diagnostic of validateWorkflowEditorIterationNode(node, { typeDeclarations })) {
    const field = iterationFieldByCode[diagnostic.code];
    validationMessages[field] = [validationMessages[field], diagnostic.message]
      .filter(Boolean)
      .join(" ");
  }
  return {
    defaultValues: {
      maxIterations: typeof bound === "number" && Number.isFinite(bound) ? bound : "",
      stateType: state ? workflowEditorPortTypeSource(state.type) : "",
      stopCondition: converged
        ? `Body output ${converged.nodeId}.${converged.portId} (boolean)`
        : "None — stops only at the limit",
      resultContract: result ? workflowEditorPortTypeSource(result.type) : "",
    },
    validationMessages,
  };
}

function toNumber(value: InspectorFieldValue, fallback: number) {
  const nextValue = typeof value === "number" ? value : Number(value);
  return Number.isFinite(nextValue) ? nextValue : fallback;
}

function createWorkflowEditorJsonValueField<TData>(
  node: WorkflowEditorNode<TData>,
): InspectorFieldDefinition | null {
  switch (node.kind) {
    case "json.string":
      return {
        id: "jsonValue",
        label: "Value",
        type: "text",
        placeholder: "Text",
      };
    case "json.number":
      return {
        id: "jsonValue",
        label: "Value",
        type: "number",
      };
    case "json.boolean":
      return {
        id: "jsonValue",
        label: "Value",
        type: "select",
        options: [
          { label: "False", value: "false" },
          { label: "True", value: "true" },
        ],
      };
    case "json.null":
      return {
        id: "jsonValue",
        label: "Value",
        type: "code",
        readOnly: true,
      };
    default:
      return null;
  }
}

function readWorkflowEditorJsonValueFieldValue<TData>(
  node: WorkflowEditorNode<TData>,
): InspectorFieldValue {
  const value = isRecord(node.data) ? node.data.value : undefined;

  switch (node.kind) {
    case "json.string":
      return typeof value === "string" ? value : "";
    case "json.number":
      return typeof value === "number" && Number.isFinite(value) ? value : 0;
    case "json.boolean":
      return value === true ? "true" : "false";
    case "json.null":
      return "null";
    default:
      return undefined;
  }
}

function parseWorkflowEditorJsonValueFieldValue<TData>(
  node: WorkflowEditorNode<TData>,
  value: InspectorFieldValue,
) {
  switch (node.kind) {
    case "json.string":
      return String(value ?? "");
    case "json.number":
      return toNumber(value, 0);
    case "json.boolean":
      return value === true || value === "true";
    case "json.null":
      return null;
    default:
      return isRecord(node.data) ? node.data.value : undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function createWorkflowReferenceOptions<TNodeData extends Record<string, unknown>>(
  references:
    | WorkflowWorkbenchInspectorContext<TNodeData, Record<string, unknown>>["documentReferences"]
    | undefined,
  node: WorkflowEditorNode<TNodeData>,
) {
  const options = [
    { label: "None", value: "" },
    ...(references?.map((reference) => ({
      label: reference.missing ? `Missing: ${reference.id}` : reference.name,
      value: reference.id,
    })) ?? []),
  ];
  const referencedDocumentId = node.workflowRef?.documentId;

  if (referencedDocumentId && !options.some((option) => option.value === referencedDocumentId)) {
    options.push({ label: `Missing: ${referencedDocumentId}`, value: referencedDocumentId });
  }

  return options;
}

function readWorkflowReferenceDepth(value: unknown) {
  if (value === "" || value === undefined || value === null) return undefined;
  const depth = typeof value === "number" ? value : Number(value);
  return isWorkflowEditorReferenceDepth(depth) ? depth : undefined;
}

/** The referenced workflow's start/end interface and a one-step port sync (#95). */
function WorkflowReferenceInterfaceSummary({
  workflowInterface,
  matches,
  readOnly,
  onSync,
}: {
  workflowInterface: WorkflowEditorWorkflowInterface;
  matches: boolean;
  readOnly: boolean;
  onSync: () => void;
}) {
  const list = (ports: WorkflowEditorWorkflowInterface["inputs"]) =>
    ports.length
      ? ports
          .map(
            (port) =>
              `${port.id}${port.optional ? "?" : ""}: ${workflowEditorPortTypeSource(port.type)}`,
          )
          .join(", ")
      : "none";
  return (
    <section
      aria-label="Workflow interface"
      className="grid w-full gap-1 text-xs text-muted-foreground"
    >
      <p>
        <span className="font-medium text-foreground">Inputs</span> {list(workflowInterface.inputs)}
      </p>
      <p>
        <span className="font-medium text-foreground">Outputs</span>{" "}
        {list(workflowInterface.outputs)}
      </p>
      {matches ? (
        <p>Ports match the workflow interface.</p>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span role="status">Ports differ from the workflow interface.</span>
          <Button type="button" size="sm" variant="outline" disabled={readOnly} onClick={onSync}>
            Sync ports with interface
          </Button>
        </div>
      )}
    </section>
  );
}
