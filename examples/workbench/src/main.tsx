import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

import {
  compileWorkflowEditorDocument,
  WorkflowEditorCompileError,
  type CompiledWorkflow,
} from "@moritzbrantner/workflow-editor/compiler";
import {
  WorkflowEditor,
  addWorkflowEditorObjectConstructorInputToNode,
  createWorkflowEditorIterationNode,
  createWorkflowEditorEntry,
  createWorkflowEditorLibrary,
  createWorkflowEditorLibraryReferenceResolver,
  defaultWorkflowEditorNodeTemplates,
  defaultWorkflowEditorBuiltInSettings,
  normalizeWorkflowEditorDocument,
  type WorkflowEditorDocument,
  type WorkflowEditorLibrary,
  type WorkflowEditorNode,
  type WorkflowEditorNodeComposition,
  type WorkflowEditorSettings,
  type WorkflowEditorNodeTemplate,
  type WorkflowEditorPortType,
  type WorkflowEditorTypeDefinition,
} from "@moritzbrantner/workflow-editor";

import {
  dataPipelineDocument,
  dataPipelineExampleId,
  mediaPipelineDocument,
  mediaPipelineExampleId,
} from "./reference-examples";
import "./styles.css";

type ExampleNodeData = Record<string, unknown>;
type ExampleDocument = WorkflowEditorDocument<ExampleNodeData>;
type ExampleLibrary = WorkflowEditorLibrary<ExampleNodeData>;

const storageKey = "moritzbrantner.workflow-editor.examples.v1";
const settingsStorageKey = `${storageKey}.settings.v1`;

function loadWorkbenchSettings(): WorkflowEditorSettings {
  const defaults: WorkflowEditorSettings = { editor: defaultWorkflowEditorBuiltInSettings };
  try {
    const stored = JSON.parse(window.localStorage.getItem(settingsStorageKey) ?? "null") as {
      editor?: { portTypeColors?: unknown };
    } | null;
    const colors = stored?.editor?.portTypeColors;
    if (!colors || typeof colors !== "object" || Array.isArray(colors)) {
      return defaults;
    }
    const portTypeColors = Object.fromEntries(
      Object.entries(colors).filter(
        ([name, color]) =>
          name.trim() && typeof color === "string" && /^#[0-9a-f]{6}$/i.test(color),
      ),
    ) as Record<string, string>;
    return { editor: { ...defaultWorkflowEditorBuiltInSettings, portTypeColors } };
  } catch {
    return defaults;
  }
}
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
    id: "template-typed-value",
    label: "Typed value",
    kind: "data.value",
    category: "Types",
    outputs: [{ id: "value", label: "Value", type: { kind: "typescript", source: "unknown" } }],
  },
  {
    id: "template-typed-input",
    label: "Typed input",
    kind: "data.input",
    category: "Types",
    inputs: [{ id: "value", label: "Value", type: { kind: "typescript", source: "unknown" } }],
  },
  {
    id: "template-webhook-trigger",
    label: "Webhook trigger",
    description: "Starts from an external event.",
    kind: "integration.webhook.trigger",
    category: "Integration",
    outputs: [{ id: "event", label: "Event", type: objectType }],
  },
  {
    id: "template-external-asset-operation",
    label: "External asset operation (example)",
    description: "Authoring-only example; an external host must supply the executor.",
    kind: "asset.operation",
    category: "Integration",
    inputs: [{ id: "request", label: "Request", type: anyType }],
    outputs: [{ id: "asset", label: "AssetRef", type: objectType }],
    data: {
      assetOperation: {
        id: "image.comfyui.generate",
        version: "1",
        parameters: {
          provider: "comfyui",
          workflow: {
            schemaVersion: 1,
            kind: "workflow",
            mediaType: "application/json",
            sha256: "a".repeat(64),
            byteLength: 256,
            metadata: { format: "comfyui-api-prompt" },
          },
        },
      },
    },
  },
  {
    id: "template-api-request",
    label: "API request",
    description: "Sends data to another service.",
    kind: "integration.api.request",
    category: "Integration",
    inputs: [{ id: "body", label: "Body", type: objectType }],
    outputs: [{ id: "response", label: "Response", type: objectType }],
    inspectorFields: [
      { path: "url", label: "URL", kind: "text", required: true, pattern: "^https://" },
      {
        path: "method",
        label: "Method",
        kind: "select",
        defaultValue: "GET",
        options: [
          { label: "GET", value: "GET" },
          { label: "POST", value: "POST" },
        ],
      },
      {
        path: "body",
        label: "Body",
        kind: "json",
        visibleWhen: { path: "method", equals: ["POST"] },
      },
      { path: "headers", label: "Headers", kind: "key-value", section: "Advanced" },
      { path: "auth.token", label: "Token", kind: "secret-ref", section: "Advanced" },
    ],
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
    inspectorFields: [
      {
        path: "model",
        label: "Scoring model",
        kind: "select",
        defaultValue: "rules",
        options: [
          { label: "Rules", value: "rules" },
          { label: "ML", value: "ml" },
        ],
      },
      {
        path: "threshold",
        label: "Qualified at",
        kind: "number",
        min: 0,
        max: 100,
        defaultValue: 70,
      },
    ],
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
  {
    // Deliberately invalid host template: its port type is not declared, so the palette lists it
    // disabled with the registry diagnostic instead of hiding it or creating a broken node.
    id: "template-legacy-contact-sync",
    label: "Legacy contact sync",
    description: "Imports contacts from a retired CRM.",
    kind: "crm.legacy.sync",
    category: "CRM",
    inputs: [{ id: "contact", label: "Contact", type: { kind: "ref", name: "LegacyContact" } }],
  },
] satisfies WorkflowEditorNodeTemplate<ExampleNodeData>[];

function newtonSquareRootBody(): WorkflowEditorNodeComposition<ExampleNodeData> {
  return {
    nodes: [
      {
        id: "newton-step",
        label: "Newton step",
        description: "next = (estimate + target / estimate) / 2",
        kind: "math.sqrt.newtonStep",
        x: 0,
        y: 0,
        inputs: [
          { id: "estimate", label: "Estimate", type: numberType },
          { id: "target", label: "Target", type: numberType },
        ],
        outputs: [{ id: "next", label: "Next", type: numberType }],
      },
      {
        id: "within-tolerance",
        label: "Within tolerance",
        kind: "math.compare.withinTolerance",
        x: 260,
        y: 0,
        inputs: [
          { id: "previous", label: "Previous", type: numberType },
          { id: "next", label: "Next", type: numberType },
        ],
        outputs: [{ id: "converged", label: "Converged", type: booleanType }],
        data: { tolerance: 1e-9 },
      },
    ],
    edges: [
      {
        id: "step-next",
        sourceNodeId: "newton-step",
        sourcePortId: "next",
        targetNodeId: "within-tolerance",
        targetPortId: "next",
      },
    ],
    inputBoundaries: [
      { wrapperPortId: "state", nodeId: "newton-step", portId: "estimate" },
      { wrapperPortId: "state", nodeId: "within-tolerance", portId: "previous" },
      { wrapperPortId: "target", nodeId: "newton-step", portId: "target" },
    ],
    outputBoundaries: [
      { wrapperPortId: "next", nodeId: "newton-step", portId: "next" },
      { wrapperPortId: "converged", nodeId: "within-tolerance", portId: "converged" },
    ],
  };
}

function newtonSquareRootIteration(id: string, x: number, y: number) {
  return createWorkflowEditorIterationNode<ExampleNodeData>({
    id,
    label: "Refine square root",
    x,
    y,
    stateType: { kind: "typescript", source: "number" },
    maxIterations: 10,
    invariantInputs: [{ id: "target", label: "Target", type: numberType }],
    body: newtonSquareRootBody(),
  });
}

const {
  id: _iterationId,
  x: _iterationX,
  y: _iterationY,
  ...newtonIteration
} = newtonSquareRootIteration("template", 0, 0);

const iterationTemplates: WorkflowEditorNodeTemplate<ExampleNodeData>[] = [
  {
    ...newtonIteration,
    id: "template-bounded-newton-iteration",
    label: "Bounded iteration (Newton step)",
    description: "Refines a square root at most 10 times; a runner executes it.",
    category: "Control flow",
  },
];

const nodeTemplates: ReadonlyArray<WorkflowEditorNodeTemplate<ExampleNodeData>> = [
  ...domainTemplates,
  ...iterationTemplates,
  ...(defaultWorkflowEditorNodeTemplates as ReadonlyArray<
    WorkflowEditorNodeTemplate<ExampleNodeData>
  >),
];

function createExamplesLibrary(): ExampleLibrary {
  const documents = [
    createWorkflowEditorEntry({
      id: dataPipelineExampleId,
      name: "Sales Data Pipeline",
      description:
        "Source → normalize → validate → branch → warehouse or quarantine; compiled, not executed, in Pages.",
      tags: ["data", "pipeline", "example"],
      createdAt: seededAt,
      updatedAt: seededAt,
      document: dataPipelineDocument(),
    }),
    createWorkflowEditorEntry({
      id: mediaPipelineExampleId,
      name: "Product Image Generation",
      description:
        "Photo and prompt → one external ComfyUI operation → resize → published artifact; no model runs in Pages.",
      tags: ["media", "ai", "asset", "example"],
      createdAt: seededAt,
      updatedAt: seededAt,
      document: mediaPipelineDocument(),
    }),
    createWorkflowEditorEntry({
      id: "typescript-ports",
      name: "TypeScript ports",
      createdAt: seededAt,
      updatedAt: seededAt,
      document: typescriptPortsDocument(),
    }),
    createWorkflowEditorEntry({
      id: "bounded-approximation",
      name: "Bounded Approximation (Newton √2)",
      description:
        "Refines √2 at most 10 times and stops early once converged; compiled, not executed, in Pages.",
      tags: ["iteration", "example"],
      createdAt: seededAt,
      updatedAt: seededAt,
      document: boundedApproximationDocument(),
    }),
    createWorkflowEditorEntry({
      id: "external-asset-handoff",
      name: "External Asset Handoff (example)",
      description: "Typed opaque operation reference; no ComfyUI model or executor runs in Pages.",
      tags: ["integration", "asset", "example"],
      createdAt: seededAt,
      updatedAt: seededAt,
      document: externalAssetHandoffDocument(),
    }),
    createWorkflowEditorEntry({
      id: "binary-audio-ports",
      name: "Binary Audio Ports",
      description:
        "Buffered WAV values and streamed WAV chunks fan out to two consumers each; a runner moves the bytes.",
      tags: ["binary", "audio", "example"],
      createdAt: seededAt,
      updatedAt: seededAt,
      document: binaryAudioPortsDocument(),
    }),
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
    // First-time visitors open into the editable data pipeline (Decision Atlas 5.4).
    activeDocumentId: dataPipelineExampleId,
    documents,
  });
}

function externalAssetHandoffDocument(): ExampleDocument {
  const externalOperation = domainTemplates.find(
    (template) => template.id === "template-external-asset-operation",
  );
  if (!externalOperation) throw new Error("External operation example template is missing");
  return normalizeWorkflowEditorDocument({
    nodes: [
      {
        id: "start",
        label: "Start",
        kind: "control.start",
        x: 0,
        y: 0,
        outputs: [{ id: "out", label: "Request", type: anyType }],
      },
      { ...externalOperation, id: "generate", x: 300, y: 0 },
      {
        id: "end",
        label: "End",
        kind: "control.end",
        x: 620,
        y: 0,
        inputs: [{ id: "in", label: "AssetRef", type: objectType }],
      },
    ],
    edges: [
      {
        id: "start-generate",
        sourceNodeId: "start",
        sourcePortId: "out",
        targetNodeId: "generate",
        targetPortId: "request",
      },
      {
        id: "generate-end",
        sourceNodeId: "generate",
        sourcePortId: "asset",
        targetNodeId: "end",
        targetPortId: "in",
      },
    ],
  }).document;
}

function boundedApproximationDocument(): ExampleDocument {
  const number = (id: string, label: string, value: number, y: number) => ({
    ...defaultWorkflowEditorNodeTemplates.find((item) => item.kind === "json.number")!,
    id,
    label,
    x: 0,
    y,
    data: { value, sourceName: id === "target" ? "target" : "initialGuess" },
  });
  return normalizeWorkflowEditorDocument({
    viewport: { x: 25, y: 35, zoom: 0.72 },
    nodes: [
      number("target", "Target", 2, 0) as WorkflowEditorNode<ExampleNodeData>,
      number("initial-guess", "Initial guess", 1, 180) as WorkflowEditorNode<ExampleNodeData>,
      newtonSquareRootIteration("refine", 320, 60),
      {
        id: "approximation",
        label: "Approximation",
        kind: "control.end",
        x: 700,
        y: 60,
        inputs: [{ id: "in", label: "Result", type: { kind: "typescript", source: "unknown" } }],
      },
    ],
    edges: [
      edge("initial-guess", "value", "refine", "state"),
      edge("target", "value", "refine", "target"),
      edge("refine", "result", "approximation", "in"),
    ],
  }).document;
}

function binaryAudioPortsDocument(): ExampleDocument {
  const bytes = { kind: "typescript", source: "Uint8Array" } as const;
  const bufferedWav = { mode: "buffered", mediaType: "audio/wav" } as const;
  const streamedWav = { mode: "streamed", mediaType: "audio/wav" } as const;
  const consumer = (
    id: string,
    label: string,
    payload: typeof bufferedWav | typeof streamedWav,
    y: number,
  ): WorkflowEditorNode<ExampleNodeData> => ({
    id,
    label,
    kind: `audio.${id}`,
    x: 420,
    y,
    inputs: [{ id: "audio", label: "Audio", type: bytes, payload }],
  });
  return normalizeWorkflowEditorDocument({
    viewport: { x: 25, y: 35, zoom: 0.72 },
    nodes: [
      {
        id: "recorder",
        label: "WAV recorder",
        kind: "audio.source",
        x: 0,
        y: 150,
        outputs: [
          { id: "recording", label: "Recording", type: bytes, payload: bufferedWav },
          { id: "chunks", label: "Live chunks", type: bytes, payload: streamedWav },
        ],
      },
      consumer("archive", "Archive recording", bufferedWav, 0),
      consumer("waveform", "Render waveform", bufferedWav, 150),
      consumer("monitor", "Live monitor", streamedWav, 300),
      consumer("transcribe", "Live transcription", streamedWav, 450),
    ],
    edges: [
      edge("recorder", "recording", "archive", "audio"),
      edge("recorder", "recording", "waveform", "audio"),
      edge("recorder", "chunks", "monitor", "audio"),
      edge("recorder", "chunks", "transcribe", "audio"),
    ],
  }).document;
}

function typescriptPortsDocument(): ExampleDocument {
  const template = (
    kind: string,
    id: string,
    label: string,
    x: number,
    y: number,
  ): WorkflowEditorNode<ExampleNodeData> => ({
    ...defaultWorkflowEditorNodeTemplates.find((item) => item.kind === kind)!,
    id,
    label,
    x,
    y,
  });
  return normalizeWorkflowEditorDocument({
    typeDeclarations: "type Customer = { id: string; name?: string };",
    viewport: { x: 25, y: 35, zoom: 0.72 },
    nodes: [
      {
        id: "customer",
        label: "Customer source",
        kind: "data.value",
        x: 0,
        y: 0,
        outputs: [
          { id: "value", label: "Value", type: { kind: "typescript", source: "Customer" } },
        ],
      },
      {
        id: "receiver",
        label: "Customer receiver",
        kind: "data.input",
        x: 340,
        y: 0,
        inputs: [
          { id: "value", label: "Value", type: { kind: "typescript", source: "{ id: string }" } },
        ],
      },
      {
        id: "number",
        label: "Number receiver",
        kind: "data.input",
        x: 340,
        y: 190,
        inputs: [{ id: "value", label: "Value", type: numberType }],
      },
      template("control.if", "branch", "Customer branch", 0, 250),
      {
        id: "fallback",
        label: "Fallback",
        kind: "data.value",
        x: 0,
        y: 520,
        outputs: [
          { id: "value", label: "Value", type: { kind: "typescript", source: '"anonymous"' } },
        ],
      },
      template("control.merge", "merge", "Possible customer", 340, 390),
    ],
    edges: [],
  }).document;
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
      {
        id: "routed-leads",
        label: "Routed leads",
        description: "Collects every routed lead into one list (up to 3 sources).",
        kind: "control.merge",
        category: "Control flow",
        x: 1420,
        y: 480,
        inputs: [
          {
            id: "items",
            label: "Items",
            type: { kind: "array", element: leadType },
            cardinality: { min: 1, max: 3 },
          },
        ],
        outputs: [
          {
            id: "out",
            label: "Out",
            type: { kind: "array", element: leadType },
            metadata: { workflowTypeInference: "items" },
          },
        ],
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
      edge("route", "true", "routed-leads", "items"),
      edge("route", "false", "routed-leads", "items"),
    ],
  }).document;
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
  }).document;
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
  }).document;
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
  }).document;
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
  }).document;
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
  const [compilation, setCompilation] = useState<CompilationResult | null>(null);
  const [editorSettings, setEditorSettings] = useState(loadWorkbenchSettings);
  const initialLibrary = useMemo(createExamplesLibrary, [resetToken]);
  // The latest library, so "Compile workflow" can resolve Workflow References (#95).
  const libraryRef = useRef<WorkflowEditorLibrary | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(settingsStorageKey, JSON.stringify(editorSettings));
    } catch {
      // Keep host settings usable when local storage is unavailable.
    }
  }, [editorSettings]);

  const resetExamples = () => {
    window.localStorage.removeItem(storageKey);
    window.localStorage.removeItem(settingsStorageKey);
    setEditorSettings({ editor: defaultWorkflowEditorBuiltInSettings });
    setResetToken((current) => current + 1);
  };

  return (
    <main className="grid h-screen min-h-0 min-w-80 overflow-hidden bg-[#f6f7f8] bg-[linear-gradient(180deg,rgba(217,226,236,0.55),rgba(246,247,248,0)_24rem)] p-[0.45rem] font-sans text-[#17202a]">
      <h1 className="sr-only">Workflow Editor</h1>
      <WorkflowEditor
        key={resetToken}
        storageKey={storageKey}
        initialLibrary={initialLibrary}
        onLibraryChange={(library) => {
          libraryRef.current = library as unknown as WorkflowEditorLibrary;
        }}
        settings={editorSettings}
        onSettingsChange={setEditorSettings}
        className="grid h-full min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-[0.35rem] [&_[data-slot='workbench-layout']]:min-h-0 [&_[data-slot='workbench-layout']>div]:min-h-0"
        nodeTemplates={nodeTemplates}
        typeDefinitions={typeDefinitions}
        compactControls
        showDocumentPath={false}
        showDocumentStats={false}
        showWorkbenchStats={false}
        renderToolbarActions={(context) => (
          <button
            type="button"
            className="min-h-8 cursor-pointer rounded-[0.4rem] border border-[#aeb9c6] bg-white px-[0.62rem] py-[0.3rem] text-[0.82rem] font-[600] text-[#17202a] hover:bg-[#eef2f6]"
            onClick={() =>
              setCompilation(
                compileExample(
                  context.document,
                  libraryRef.current ?? (initialLibrary as unknown as WorkflowEditorLibrary),
                ),
              )
            }
          >
            Compile workflow
          </button>
        )}
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
      {compilation ? (
        <CompilationPanel result={compilation} onClose={() => setCompilation(null)} />
      ) : null}
    </main>
  );
}

type CompilationResult =
  | { ok: true; compiled: CompiledWorkflow; summary: string }
  | { ok: false; problems: string[] };

/** Compiles the authored document; Pages has no runner, so nothing is executed. */
function compileExample(
  document: ExampleDocument,
  library: WorkflowEditorLibrary,
): CompilationResult {
  try {
    const compiled = compileWorkflowEditorDocument(document as WorkflowEditorDocument, {
      typeDefinitions,
      resolveWorkflowReference: createWorkflowEditorLibraryReferenceResolver(library),
    });
    const iterations = compiled.nodes.flatMap((node) => ("iteration" in node ? [node] : []));
    const loops = iterations.map(
      ({ iteration }) =>
        `max ${iteration.maxIterations}, ${iteration.stop.kind === "body-output" ? "stops when converged" : "stops only at the limit"}`,
    );
    const detail = loops.length
      ? `${loops.length} bounded iteration${loops.length === 1 ? "" : "s"} (${loops.join("; ")})`
      : `${compiled.nodes.length} nodes`;
    return {
      ok: true,
      compiled,
      summary: `Compiled contract v${compiled.version} · ${detail} · not executed`,
    };
  } catch (error) {
    if (error instanceof WorkflowEditorCompileError) {
      return {
        ok: false,
        problems: error.diagnostics.map(
          (diagnostic) => `${diagnostic.code} — ${diagnostic.message}`,
        ),
      };
    }
    return { ok: false, problems: [error instanceof Error ? error.message : String(error)] };
  }
}

function CompilationPanel({ result, onClose }: { result: CompilationResult; onClose: () => void }) {
  return (
    <section
      aria-label={result.ok ? "Compiled contract" : "Compilation failed"}
      className="fixed top-14 right-3 z-50 grid max-h-[70vh] w-[min(30rem,calc(100vw-1.5rem))] gap-2 overflow-auto rounded-[0.5rem] border border-[#aeb9c6] bg-white p-3 text-[0.82rem] shadow-lg"
    >
      <div className="flex items-start justify-between gap-2">
        {result.ok ? (
          <strong className="[overflow-wrap:anywhere]">{result.summary}</strong>
        ) : (
          <strong>Compilation failed</strong>
        )}
        <button
          type="button"
          className="cursor-pointer rounded border border-[#aeb9c6] px-2 py-0.5"
          aria-label="Close compiled contract"
          onClick={onClose}
        >
          Close
        </button>
      </div>
      {result.ok ? (
        <pre className="max-h-[50vh] overflow-auto rounded bg-[#f6f7f8] p-2 text-[0.72rem]">
          {JSON.stringify(result.compiled, null, 2)}
        </pre>
      ) : (
        <ul role="alert" className="grid list-disc gap-1 pl-5 text-[#b42318]">
          {result.problems.map((problem) => (
            <li key={problem} className="[overflow-wrap:anywhere]">
              {problem}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
