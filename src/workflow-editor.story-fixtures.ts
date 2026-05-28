import {
  createWorkflowEditorEntry,
  createWorkflowEditorLibrary,
  normalizeWorkflowEditorDocument,
  type WorkflowEditorDocument,
  type WorkflowEditorLibrary,
  type WorkflowEditorNodeTemplate,
  type WorkflowEditorPortType,
  type WorkflowEditorTypeDefinition,
} from "@moritzbrantner/workflow-editor";

export type StoryWorkflowNodeData = Record<string, unknown>;
export type StoryWorkflowDocument = WorkflowEditorDocument<StoryWorkflowNodeData>;
export type StoryWorkflowLibrary = WorkflowEditorLibrary<StoryWorkflowNodeData>;

const seededAt = "2026-05-28T00:00:00.000Z";
const stringType = { kind: "string" } satisfies WorkflowEditorPortType;
const numberType = { kind: "number" } satisfies WorkflowEditorPortType;
const booleanType = { kind: "boolean" } satisfies WorkflowEditorPortType;
const objectType = { kind: "object" } satisfies WorkflowEditorPortType;
const leadType = { kind: "ref", name: "Lead" } satisfies WorkflowEditorPortType;

export const storyWorkflowTypeDefinitions = [
  {
    name: "Lead",
    type: {
      kind: "object",
      properties: {
        email: { type: stringType },
        company: { type: stringType },
        score: { type: numberType, optional: true },
      },
    },
  },
  {
    name: "QualifiedLead",
    extends: ["Lead"],
    type: {
      kind: "object",
      properties: {
        email: { type: stringType },
        company: { type: stringType },
        score: { type: numberType },
        approved: { type: booleanType },
      },
    },
  },
] satisfies readonly WorkflowEditorTypeDefinition[];

export const storyWorkflowDocument: StoryWorkflowDocument = normalizeWorkflowEditorDocument({
  nodes: [
    {
      id: "lead-source",
      label: "Lead source",
      x: 0,
      y: 0,
      category: "CRM",
      outputs: [{ id: "lead", label: "Lead", type: leadType }],
    },
    {
      id: "score-lead",
      label: "Score lead",
      x: 280,
      y: 0,
      category: "CRM",
      inputs: [{ id: "lead", label: "Lead", type: leadType }],
      outputs: [{ id: "score", label: "Score", type: numberType }],
    },
    {
      id: "approval",
      label: "Approval",
      x: 560,
      y: 0,
      category: "Human task",
      inputs: [{ id: "score", label: "Score", type: numberType }],
      outputs: [{ id: "approved", label: "Approved", type: booleanType }],
    },
    {
      id: "notify",
      label: "Notify sales",
      x: 840,
      y: 0,
      category: "Messaging",
      inputs: [{ id: "message", label: "Message", type: objectType }],
    },
  ],
  edges: [
    {
      id: "lead-source-score-lead",
      sourceNodeId: "lead-source",
      sourcePortId: "lead",
      targetNodeId: "score-lead",
      targetPortId: "lead",
    },
    {
      id: "score-lead-approval",
      sourceNodeId: "score-lead",
      sourcePortId: "score",
      targetNodeId: "approval",
      targetPortId: "score",
    },
  ],
  viewport: { x: 40, y: 120, zoom: 0.85 },
});

export const emptyStoryWorkflowDocument: StoryWorkflowDocument = normalizeWorkflowEditorDocument({
  nodes: [],
  edges: [],
});

export const storyWorkflowNodeTemplates = [
  {
    id: "template-lead-source",
    label: "Lead source",
    description: "Produces a typed lead object.",
    kind: "crm.lead.source",
    categoryPath: ["CRM", "Sources"],
    outputs: [{ id: "lead", label: "Lead", type: leadType }],
  },
  {
    id: "template-score-lead",
    label: "Score lead",
    description: "Calculates a qualification score.",
    kind: "crm.lead.score",
    categoryPath: ["CRM", "Scoring"],
    inputs: [{ id: "lead", label: "Lead", type: leadType }],
    outputs: [{ id: "score", label: "Score", type: numberType }],
  },
  {
    id: "template-approval",
    label: "Approval",
    description: "Waits for a human decision.",
    kind: "human.approval",
    categoryPath: ["Human task"],
    inputs: [{ id: "request", label: "Request", type: objectType }],
    outputs: [{ id: "approved", label: "Approved", type: booleanType }],
  },
  {
    id: "template-notify",
    label: "Notify sales",
    description: "Sends a sales notification.",
    kind: "messaging.notify",
    categoryPath: ["Messaging"],
    inputs: [{ id: "message", label: "Message", type: objectType }],
  },
] satisfies WorkflowEditorNodeTemplate<StoryWorkflowNodeData>[];

export function createStoryWorkflowLibrary(): StoryWorkflowLibrary {
  return createWorkflowEditorLibrary({
    activeDocumentId: "story-workflow",
    documents: [
      createWorkflowEditorEntry({
        id: "story-workflow",
        name: "Lead Qualification",
        description: "A compact workflow used by Storybook stories.",
        tags: ["storybook", "crm"],
        createdAt: seededAt,
        updatedAt: seededAt,
        document: storyWorkflowDocument,
      }),
    ],
  });
}
