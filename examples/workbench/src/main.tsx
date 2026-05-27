import { StrictMode, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";

import {
  WorkflowEditor,
  addWorkflowEditorObjectConstructorInputToNode,
  createWorkflowEditorEntry,
  createWorkflowEditorLibrary,
  defaultWorkflowEditorNodeTemplates,
  normalizeWorkflowEditorDocument,
  type WorkflowEditorDocument,
  type WorkflowEditorLibrary,
  type WorkflowEditorNode,
  type WorkflowEditorNodeTemplate,
  type WorkflowEditorPortType,
  type WorkflowEditorTypeDefinition,
} from "@moritzbrantner/workflow-editor";

import "./styles.css";

type ExampleNodeData = Record<string, unknown>;
type ExampleDocument = WorkflowEditorDocument<ExampleNodeData>;
type ExampleLibrary = WorkflowEditorLibrary<ExampleNodeData>;

const storageKey = "moritzbrantner.workflow-editor.examples.v1";
const seededAt = "2026-05-27T00:00:00.000Z";

const stringType = { kind: "string" } satisfies WorkflowEditorPortType;
const numberType = { kind: "number" } satisfies WorkflowEditorPortType;
const booleanType = { kind: "boolean" } satisfies WorkflowEditorPortType;
const anyType = { kind: "any" } satisfies WorkflowEditorPortType;
const objectType = { kind: "object" } satisfies WorkflowEditorPortType;
const leadType = { kind: "ref", name: "Lead" } satisfies WorkflowEditorPortType;
const qualifiedLeadType = { kind: "ref", name: "QualifiedLead" } satisfies WorkflowEditorPortType;
const incidentType = { kind: "ref", name: "Incident" } satisfies WorkflowEditorPortType;

const typeDefinitions: readonly WorkflowEditorTypeDefinition[] = [
  {
    name: "Lead",
    type: {
      kind: "object",
      properties: {
        email: { type: stringType },
        company: { type: stringType },
        source: { type: stringType, optional: true },
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
        owner: { type: stringType },
      },
    },
  },
  {
    name: "Incident",
    type: {
      kind: "object",
      properties: {
        title: { type: stringType },
        service: { type: stringType },
        severity: { type: stringType },
        customerImpact: { type: booleanType },
      },
    },
  },
] satisfies readonly WorkflowEditorTypeDefinition[];

const domainTemplates = [
  {
    id: "template-webhook-trigger",
    label: "Webhook trigger",
    description: "Starts from an external event.",
    kind: "integration.webhook.trigger",
    category: "Integration",
    outputs: [{ id: "event", label: "Event", type: objectType }],
  },
  {
    id: "template-api-request",
    label: "API request",
    description: "Sends data to another service.",
    kind: "integration.api.request",
    category: "Integration",
    inputs: [{ id: "body", label: "Body", type: objectType }],
    outputs: [{ id: "response", label: "Response", type: objectType }],
  },
  {
    id: "template-lead-source",
    label: "Lead source",
    description: "Produces a typed lead object.",
    kind: "crm.lead.source",
    category: "CRM",
    outputs: [{ id: "lead", label: "Lead", type: leadType }],
  },
  {
    id: "template-score-lead",
    label: "Score lead",
    description: "Calculates a qualification score.",
    kind: "crm.lead.score",
    category: "CRM",
    inputs: [{ id: "lead", label: "Lead", type: leadType }],
    outputs: [{ id: "score", label: "Score", type: numberType }],
  },
  {
    id: "template-qualification-rule",
    label: "Qualification rule",
    description: "Returns true when a lead should convert.",
    kind: "crm.lead.qualify",
    category: "CRM",
    inputs: [{ id: "score", label: "Score", type: numberType }],
    outputs: [{ id: "qualified", label: "Qualified", type: booleanType }],
  },
  {
    id: "template-create-deal",
    label: "Create deal",
    description: "Creates a pipeline opportunity.",
    kind: "crm.deal.create",
    category: "CRM",
    inputs: [{ id: "lead", label: "Lead", type: qualifiedLeadType }],
  },
  {
    id: "template-send-message",
    label: "Send message",
    description: "Delivers a notification or email.",
    kind: "messaging.send",
    category: "Messaging",
    inputs: [{ id: "message", label: "Message", type: objectType }],
  },
  {
    id: "template-approval",
    label: "Approval",
    description: "Waits for a human decision.",
    kind: "human.approval",
    category: "Human task",
    inputs: [{ id: "request", label: "Request", type: objectType }],
    outputs: [{ id: "approved", label: "Approved", type: booleanType }],
  },
] satisfies WorkflowEditorNodeTemplate<ExampleNodeData>[];

const nodeTemplates: ReadonlyArray<WorkflowEditorNodeTemplate<ExampleNodeData>> = [
  ...domainTemplates,
  ...(defaultWorkflowEditorNodeTemplates as ReadonlyArray<
    WorkflowEditorNodeTemplate<ExampleNodeData>
  >),
];

function createExamplesLibrary(): ExampleLibrary {
  const documents = [
    createWorkflowEditorEntry({
      id: "lead-intake",
      name: "Lead Intake Automation",
      description: "Branching, typed ports, and nested workflow references.",
      tags: ["crm", "branching", "nested"],
      createdAt: seededAt,
      updatedAt: seededAt,
      document: leadIntakeDocument(),
    }),
    createWorkflowEditorEntry({
      id: "enrich-lead",
      name: "Enrich Lead",
      description: "Nested document referenced from the lead intake workflow.",
      tags: ["nested", "integration"],
      createdAt: seededAt,
      updatedAt: seededAt,
      document: enrichLeadDocument(),
    }),
    createWorkflowEditorEntry({
      id: "campaign-payload",
      name: "Campaign Payload Builder",
      description: "JSON object construction with editable property inputs.",
      tags: ["json", "object"],
      createdAt: seededAt,
      updatedAt: seededAt,
      document: campaignPayloadDocument(),
    }),
    createWorkflowEditorEntry({
      id: "incident-escalation",
      name: "Incident Escalation",
      description: "Control flow, notifications, and approval handoff.",
      tags: ["incident", "approval"],
      createdAt: seededAt,
      updatedAt: seededAt,
      document: incidentEscalationDocument(),
    }),
    createWorkflowEditorEntry({
      id: "approval-checklist",
      name: "Approval Checklist",
      description: "Nested approval workflow for human review.",
      tags: ["nested", "human-task"],
      createdAt: seededAt,
      updatedAt: seededAt,
      document: approvalChecklistDocument(),
    }),
  ];

  return createWorkflowEditorLibrary({
    activeDocumentId: "lead-intake",
    documents,
  });
}

function leadIntakeDocument(): ExampleDocument {
  return normalizeWorkflowEditorDocument({
    viewport: { x: 35, y: 25, zoom: 0.82 },
    nodes: [
      {
        id: "lead-source",
        label: "Website form",
        description: "New trial signups from the website.",
        kind: "crm.lead.source",
        category: "CRM",
        x: 0,
        y: 40,
        tone: "info",
        outputs: [{ id: "lead", label: "Lead", type: leadType }],
      },
      {
        id: "dedupe",
        label: "Deduplicate",
        description: "Merge repeat contacts before enrichment.",
        kind: "crm.lead.dedupe",
        category: "CRM",
        x: 280,
        y: 40,
        inputs: [{ id: "lead", label: "Lead", type: leadType }],
        outputs: [{ id: "lead", label: "Lead", type: leadType }],
      },
      {
        id: "enrich",
        label: "Enrich lead",
        description: "Opens the nested Enrich Lead workflow.",
        kind: "workflow.reference",
        category: "Nested workflow",
        x: 560,
        y: 40,
        workflowRef: { documentId: "enrich-lead" },
        inputs: [{ id: "lead", label: "Lead", type: leadType }],
        outputs: [{ id: "lead", label: "Lead", type: leadType }],
      },
      {
        id: "score",
        label: "Score lead",
        kind: "crm.lead.score",
        category: "CRM",
        x: 840,
        y: -80,
        inputs: [{ id: "lead", label: "Lead", type: leadType }],
        outputs: [{ id: "score", label: "Score", type: numberType }],
      },
      {
        id: "qualification",
        label: "Qualification rule",
        kind: "crm.lead.qualify",
        category: "CRM",
        x: 1120,
        y: -80,
        inputs: [{ id: "score", label: "Score", type: numberType }],
        outputs: [{ id: "qualified", label: "Qualified", type: booleanType }],
      },
      {
        id: "route",
        label: "Route by fit",
        kind: "control.if",
        category: "Control flow",
        x: 1120,
        y: 140,
        inputs: [
          { id: "value", label: "Lead", type: leadType },
          { id: "condition", label: "Qualified", type: booleanType },
        ],
        outputs: [
          { id: "true", label: "Sales", type: qualifiedLeadType },
          { id: "false", label: "Nurture", type: leadType },
        ],
      },
      {
        id: "create-deal",
        label: "Create deal",
        kind: "crm.deal.create",
        category: "CRM",
        x: 1420,
        y: 20,
        tone: "success",
        inputs: [{ id: "lead", label: "Qualified lead", type: qualifiedLeadType }],
      },
      {
        id: "nurture",
        label: "Nurture sequence",
        kind: "messaging.sequence",
        category: "Messaging",
        x: 1420,
        y: 260,
        inputs: [{ id: "lead", label: "Lead", type: leadType }],
      },
    ],
    edges: [
      edge("lead-source", "lead", "dedupe", "lead"),
      edge("dedupe", "lead", "enrich", "lead"),
      edge("enrich", "lead", "score", "lead"),
      edge("score", "score", "qualification", "score"),
      edge("enrich", "lead", "route", "value"),
      edge("qualification", "qualified", "route", "condition"),
      edge("route", "true", "create-deal", "lead"),
      edge("route", "false", "nurture", "lead"),
    ],
  });
}

function enrichLeadDocument(): ExampleDocument {
  return normalizeWorkflowEditorDocument({
    viewport: { x: 80, y: 40, zoom: 0.9 },
    nodes: [
      {
        id: "incoming-lead",
        label: "Incoming lead",
        kind: "control.start",
        category: "Control flow",
        x: 0,
        y: 80,
        outputs: [{ id: "lead", label: "Lead", type: leadType }],
      },
      {
        id: "company-lookup",
        label: "Company lookup",
        kind: "integration.api.request",
        category: "Integration",
        x: 300,
        y: 0,
        inputs: [{ id: "lead", label: "Lead", type: leadType }],
        outputs: [{ id: "company", label: "Company", type: objectType }],
      },
      {
        id: "email-verification",
        label: "Email verification",
        kind: "integration.api.request",
        category: "Integration",
        x: 300,
        y: 180,
        inputs: [{ id: "lead", label: "Lead", type: leadType }],
        outputs: [{ id: "verified", label: "Verified", type: booleanType }],
      },
      {
        id: "merge-profile",
        label: "Merge profile",
        kind: "json.object",
        category: "JSON",
        x: 650,
        y: 70,
        inputs: [
          { id: "lead", label: "Lead", type: leadType },
          { id: "company", label: "Company", type: objectType },
          { id: "verified", label: "Verified", type: booleanType },
        ],
        outputs: [{ id: "lead", label: "Enriched lead", type: leadType }],
      },
      {
        id: "return-lead",
        label: "Return enriched lead",
        kind: "control.end",
        category: "Control flow",
        x: 980,
        y: 80,
        inputs: [{ id: "lead", label: "Lead", type: leadType }],
      },
    ],
    edges: [
      edge("incoming-lead", "lead", "company-lookup", "lead"),
      edge("incoming-lead", "lead", "email-verification", "lead"),
      edge("incoming-lead", "lead", "merge-profile", "lead"),
      edge("company-lookup", "company", "merge-profile", "company"),
      edge("email-verification", "verified", "merge-profile", "verified"),
      edge("merge-profile", "lead", "return-lead", "lead"),
    ],
  });
}

function campaignPayloadDocument(): ExampleDocument {
  const payload = createObjectConstructorNode("build-payload", "Build campaign payload", 680, 80, [
    { portId: "email", propertyKey: "email", sourceExpression: "lead.email", type: stringType },
    { portId: "plan", propertyKey: "plan", sourceExpression: "plan", type: stringType },
    {
      portId: "trialDays",
      propertyKey: "trialDays",
      sourceExpression: "trialDays",
      type: numberType,
    },
    { portId: "vip", propertyKey: "vip", sourceExpression: "vip", type: booleanType },
  ]);

  return normalizeWorkflowEditorDocument({
    viewport: { x: 70, y: 50, zoom: 0.86 },
    nodes: [
      {
        id: "email",
        label: "Email",
        kind: "json.string",
        category: "JSON",
        x: 40,
        y: 0,
        outputs: [{ id: "value", label: "Value", type: stringType }],
        data: { value: "ada@example.com" },
      },
      {
        id: "plan",
        label: "Plan",
        kind: "json.string",
        category: "JSON",
        x: 40,
        y: 150,
        outputs: [{ id: "value", label: "Value", type: stringType }],
        data: { value: "pro" },
      },
      {
        id: "trial-days",
        label: "Trial days",
        kind: "json.number",
        category: "JSON",
        x: 330,
        y: 0,
        outputs: [{ id: "value", label: "Value", type: numberType }],
        data: { value: 14 },
      },
      {
        id: "vip",
        label: "VIP",
        kind: "json.boolean",
        category: "JSON",
        x: 330,
        y: 150,
        outputs: [{ id: "value", label: "Value", type: booleanType }],
        data: { value: true },
      },
      payload,
      {
        id: "send-webhook",
        label: "Send campaign webhook",
        kind: "integration.api.request",
        category: "Integration",
        x: 1060,
        y: 125,
        inputs: [{ id: "body", label: "Body", type: objectType }],
        outputs: [{ id: "response", label: "Response", type: objectType }],
      },
    ],
    edges: [
      edge("email", "value", "build-payload", "email"),
      edge("plan", "value", "build-payload", "plan"),
      edge("trial-days", "value", "build-payload", "trialDays"),
      edge("vip", "value", "build-payload", "vip"),
      edge("build-payload", "value", "send-webhook", "body"),
    ],
  });
}

function incidentEscalationDocument(): ExampleDocument {
  return normalizeWorkflowEditorDocument({
    viewport: { x: 60, y: 35, zoom: 0.82 },
    nodes: [
      {
        id: "monitor",
        label: "Monitor alert",
        kind: "integration.webhook.trigger",
        category: "Integration",
        x: 0,
        y: 90,
        outputs: [{ id: "incident", label: "Incident", type: incidentType }],
      },
      {
        id: "classify",
        label: "Classify severity",
        kind: "incident.classify",
        category: "Incident",
        x: 300,
        y: 90,
        inputs: [{ id: "incident", label: "Incident", type: incidentType }],
        outputs: [
          { id: "incident", label: "Incident", type: incidentType },
          { id: "critical", label: "Critical", type: booleanType },
        ],
      },
      {
        id: "route",
        label: "Critical?",
        kind: "control.if",
        category: "Control flow",
        x: 650,
        y: 90,
        inputs: [
          { id: "value", label: "Incident", type: incidentType },
          { id: "condition", label: "Critical", type: booleanType },
        ],
        outputs: [
          { id: "true", label: "Escalate", type: incidentType },
          { id: "false", label: "Track", type: incidentType },
        ],
      },
      {
        id: "approval",
        label: "Approval checklist",
        kind: "workflow.reference",
        category: "Nested workflow",
        x: 1000,
        y: -40,
        workflowRef: { documentId: "approval-checklist" },
        inputs: [{ id: "request", label: "Incident", type: incidentType }],
        outputs: [{ id: "approved", label: "Approved", type: booleanType }],
      },
      {
        id: "page",
        label: "Page on-call",
        kind: "messaging.send",
        category: "Messaging",
        x: 1350,
        y: -40,
        tone: "warning",
        inputs: [
          { id: "incident", label: "Incident", type: incidentType },
          { id: "approved", label: "Approved", type: booleanType },
        ],
      },
      {
        id: "log",
        label: "Create ticket",
        kind: "integration.api.request",
        category: "Integration",
        x: 1000,
        y: 260,
        inputs: [{ id: "body", label: "Incident", type: incidentType }],
        outputs: [{ id: "ticket", label: "Ticket", type: objectType }],
      },
    ],
    edges: [
      edge("monitor", "incident", "classify", "incident"),
      edge("classify", "incident", "route", "value"),
      edge("classify", "critical", "route", "condition"),
      edge("route", "true", "approval", "request"),
      edge("approval", "approved", "page", "approved"),
      edge("route", "true", "page", "incident"),
      edge("route", "false", "log", "body"),
    ],
  });
}

function approvalChecklistDocument(): ExampleDocument {
  return normalizeWorkflowEditorDocument({
    viewport: { x: 90, y: 40, zoom: 0.95 },
    nodes: [
      {
        id: "request",
        label: "Approval request",
        kind: "control.start",
        category: "Control flow",
        x: 0,
        y: 60,
        outputs: [{ id: "request", label: "Request", type: objectType }],
      },
      {
        id: "notify",
        label: "Notify owner",
        kind: "messaging.send",
        category: "Messaging",
        x: 310,
        y: 0,
        inputs: [{ id: "message", label: "Message", type: objectType }],
        outputs: [{ id: "sent", label: "Sent", type: booleanType }],
      },
      {
        id: "approval",
        label: "Wait for approval",
        kind: "human.approval",
        category: "Human task",
        x: 310,
        y: 150,
        inputs: [{ id: "request", label: "Request", type: objectType }],
        outputs: [{ id: "approved", label: "Approved", type: booleanType }],
      },
      {
        id: "record",
        label: "Record decision",
        kind: "integration.api.request",
        category: "Integration",
        x: 670,
        y: 90,
        inputs: [
          { id: "request", label: "Request", type: objectType },
          { id: "approved", label: "Approved", type: booleanType },
        ],
        outputs: [{ id: "record", label: "Record", type: objectType }],
      },
    ],
    edges: [
      edge("request", "request", "notify", "message"),
      edge("request", "request", "approval", "request"),
      edge("request", "request", "record", "request"),
      edge("approval", "approved", "record", "approved"),
    ],
  });
}

function createObjectConstructorNode(
  id: string,
  label: string,
  x: number,
  y: number,
  properties: Array<{
    portId: string;
    propertyKey: string;
    sourceExpression: string;
    type: WorkflowEditorPortType;
  }>,
): WorkflowEditorNode<ExampleNodeData> {
  let node: WorkflowEditorNode<ExampleNodeData> = {
    id,
    label,
    kind: "json.object",
    category: "JSON",
    x,
    y,
    inputs: [
      {
        id: "property",
        label: "Add property",
        type: anyType,
        badge: "new",
        metadata: { objectConstructorRole: "add-property" },
      },
    ],
    outputs: [{ id: "value", label: "Object", type: objectType }],
    data: { properties: {} },
  };

  for (const property of properties) {
    node = addWorkflowEditorObjectConstructorInputToNode(node, property);
  }

  return node;
}

function edge(
  sourceNodeId: string,
  sourcePortId: string,
  targetNodeId: string,
  targetPortId: string,
) {
  return {
    id: `${sourceNodeId}:${sourcePortId}->${targetNodeId}:${targetPortId}`,
    sourceNodeId,
    sourcePortId,
    targetNodeId,
    targetPortId,
  };
}

function App() {
  const [resetToken, setResetToken] = useState(0);
  const initialLibrary = useMemo(createExamplesLibrary, [resetToken]);

  const resetExamples = () => {
    window.localStorage.removeItem(storageKey);
    setResetToken((current) => current + 1);
  };

  return (
    <main className="grid h-screen min-h-0 min-w-80 overflow-hidden bg-[#f6f7f8] bg-[linear-gradient(180deg,rgba(217,226,236,0.55),rgba(246,247,248,0)_24rem)] p-[0.45rem] font-sans text-[#17202a]">
      <WorkflowEditor
        key={resetToken}
        storageKey={storageKey}
        initialLibrary={initialLibrary}
        className="grid h-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-[0.35rem] [&_[data-slot='workbench-layout']]:min-h-0 [&_[data-slot='workbench-layout']>div]:min-h-0"
        nodeTemplates={nodeTemplates}
        typeDefinitions={typeDefinitions}
        compactControls
        showDocumentPath={false}
        showDocumentStats={false}
        showWorkbenchStats={false}
        renderCompactMenuActions={() => (
          <button
            type="button"
            className="min-h-8 w-full cursor-pointer rounded-[0.4rem] border border-[#aeb9c6] bg-[#1f2937] px-[0.62rem] py-[0.36rem] text-[0.82rem] font-[650] text-white hover:bg-[#111827]"
            onClick={resetExamples}
          >
            Reset examples
          </button>
        )}
        renderNodeTemplate={(template) => (
          <span className="grid w-full min-w-0 gap-[0.3rem]">
            <span className="flex min-w-0 items-center justify-between gap-3">
              <strong className="[overflow-wrap:anywhere] text-[0.9rem] font-[680] text-[#17202a]">
                {template.label}
              </strong>
              <small className="flex-none text-[0.74rem] text-[#697586]">
                {template.category ?? template.kind ?? "Node"}
              </small>
            </span>
            {template.description ? (
              <em className="block [overflow-wrap:anywhere] text-[0.78rem] leading-[1.3] text-[#52606d] not-italic">
                {template.description}
              </em>
            ) : null}
          </span>
        )}
      />
    </main>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
