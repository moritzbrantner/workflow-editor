import type { WorkflowEditorNodeTemplate } from "./core-types";

export const workflowEditorControlFlowNodeTemplates = [
  {
    id: "control-flow-start",
    label: "Start",
    description: "Begin a workflow branch.",
    kind: "control.start",
    category: "Control flow",
    outputs: [{ id: "out", label: "Out", type: { kind: "any" } }],
  },
  {
    id: "control-flow-if",
    label: "If",
    description: "Route a value by a boolean condition.",
    kind: "control.if",
    category: "Control flow",
    inputs: [
      { id: "value", label: "Value", type: { kind: "any" } },
      { id: "condition", label: "Condition", type: { kind: "boolean" } },
    ],
    outputs: [
      { id: "true", label: "True", type: { kind: "any" } },
      { id: "false", label: "False", type: { kind: "any" } },
    ],
  },
  {
    id: "control-flow-switch",
    label: "Switch",
    description: "Route a value through a matching case or fallback branch.",
    kind: "control.switch",
    category: "Control flow",
    inputs: [
      { id: "value", label: "Value", type: { kind: "any" } },
      { id: "case", label: "Case", type: { kind: "any" } },
    ],
    outputs: [
      { id: "match", label: "Match", type: { kind: "any" } },
      { id: "default", label: "Default", type: { kind: "any" } },
    ],
  },
  {
    id: "control-flow-merge",
    label: "Merge",
    description: "Join two branches into one value.",
    kind: "control.merge",
    category: "Control flow",
    inputs: [
      { id: "a", label: "A", type: { kind: "any" } },
      { id: "b", label: "B", type: { kind: "any" } },
    ],
    outputs: [{ id: "out", label: "Out", type: { kind: "any" } }],
  },
  {
    id: "control-flow-end",
    label: "End",
    description: "Finish a workflow branch.",
    kind: "control.end",
    category: "Control flow",
    inputs: [{ id: "in", label: "In", type: { kind: "any" } }],
  },
] satisfies WorkflowEditorNodeTemplate[];

export const workflowEditorJsonNodeTemplates = [
  {
    id: "json-string",
    label: "String",
    description: "Create a JSON string value.",
    kind: "json.string",
    category: "JSON",
    minimized: true,
    outputs: [{ id: "value", label: "Value", type: { kind: "string" } }],
    data: { value: "", sourceName: "stringValue" },
  },
  {
    id: "json-number",
    label: "Number",
    description: "Create a JSON number value.",
    kind: "json.number",
    category: "JSON",
    minimized: true,
    outputs: [{ id: "value", label: "Value", type: { kind: "number" } }],
    data: { value: 0, sourceName: "numberValue" },
  },
  {
    id: "json-boolean",
    label: "Boolean",
    description: "Create a JSON boolean value.",
    kind: "json.boolean",
    category: "JSON",
    minimized: true,
    outputs: [{ id: "value", label: "Value", type: { kind: "boolean" } }],
    data: { value: false, sourceName: "booleanValue" },
  },
  {
    id: "json-null",
    label: "Null",
    description: "Create a JSON null value.",
    kind: "json.null",
    category: "JSON",
    minimized: true,
    outputs: [{ id: "value", label: "Value", type: { kind: "null" } }],
    data: { value: null, sourceName: "nullValue" },
  },
  {
    id: "json-array",
    label: "Array",
    description: "Create a JSON array value.",
    kind: "json.array",
    category: "JSON",
    inputs: [
      {
        id: "item-add",
        label: "Add item",
        type: { kind: "any" },
        badge: "new",
        metadata: { arrayConstructorRole: "add-item" },
      },
    ],
    outputs: [{ id: "value", label: "Value", type: { kind: "array", element: { kind: "any" } } }],
    data: { items: {} },
  },
  {
    id: "json-object",
    label: "Object",
    description: "Construct a JSON object from named input properties.",
    kind: "json.object",
    category: "JSON",
    inputs: [
      {
        id: "property",
        label: "Add property",
        type: { kind: "any" },
        badge: "new",
        metadata: { objectConstructorRole: "add-property" },
      },
    ],
    outputs: [{ id: "value", label: "Object", type: { kind: "object" } }],
    data: { properties: {} },
  },
  {
    id: "json-object-decompose",
    label: "Object decompose",
    description: "Split a JSON object into named property outputs.",
    kind: "json.object.decompose",
    category: "JSON",
    inputs: [{ id: "object", label: "Object", type: { kind: "object" } }],
    outputs: [
      {
        id: "property",
        label: "Add property",
        type: { kind: "any" },
        badge: "new",
        metadata: { objectDecompositionRole: "add-property" },
      },
    ],
    data: { properties: {} },
  },
] satisfies WorkflowEditorNodeTemplate[];

export const workflowEditorCollectionNodeTemplates = [
  {
    id: "collection-filter",
    label: "Filter",
    description: "Keep items in a collection that satisfy a predicate.",
    kind: "collection.filter",
    category: "Collection",
    inputs: [
      { id: "items", label: "Items", type: { kind: "array", element: { kind: "any" } } },
      { id: "predicate", label: "Predicate", type: { kind: "boolean" } },
    ],
    outputs: [
      {
        id: "items",
        label: "Filtered",
        type: { kind: "array", element: { kind: "any" } },
      },
    ],
    data: { predicate: "" },
  },
  {
    id: "collection-reduce",
    label: "Reduce",
    description: "Fold collection items into a single accumulated value.",
    kind: "collection.reduce",
    category: "Collection",
    inputs: [
      { id: "items", label: "Items", type: { kind: "array", element: { kind: "any" } } },
      { id: "initial", label: "Initial", type: { kind: "any" } },
      { id: "accumulator", label: "Accumulator", type: { kind: "any" } },
    ],
    outputs: [{ id: "value", label: "Value", type: { kind: "any" } }],
    data: { reducer: "" },
  },
  {
    id: "collection-aggregate",
    label: "Aggregate",
    description: "Calculate summary metrics for a collection.",
    kind: "collection.aggregate",
    category: "Collection",
    inputs: [
      { id: "items", label: "Items", type: { kind: "array", element: { kind: "any" } } },
      { id: "value", label: "Value", type: { kind: "any" } },
      { id: "group", label: "Group", type: { kind: "any" } },
    ],
    outputs: [
      {
        id: "summary",
        label: "Summary",
        type: {
          kind: "object",
          properties: {
            count: { type: { kind: "number" } },
            sum: { type: { kind: "number" }, optional: true },
            average: { type: { kind: "number" }, optional: true },
            min: { type: { kind: "number" }, optional: true },
            max: { type: { kind: "number" }, optional: true },
            groups: {
              type: {
                kind: "array",
                element: {
                  kind: "object",
                  properties: {
                    key: { type: { kind: "any" } },
                    count: { type: { kind: "number" } },
                    value: { type: { kind: "any" }, optional: true },
                  },
                },
              },
              optional: true,
            },
          },
        },
      },
    ],
    data: { operation: "count" },
  },
] satisfies WorkflowEditorNodeTemplate[];

export const defaultWorkflowEditorNodeTemplates = [
  ...workflowEditorControlFlowNodeTemplates,
  ...workflowEditorJsonNodeTemplates,
  ...workflowEditorCollectionNodeTemplates,
] satisfies WorkflowEditorNodeTemplate[];
