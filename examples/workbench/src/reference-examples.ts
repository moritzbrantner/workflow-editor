import {
  defaultWorkflowEditorNodeTemplates,
  normalizeWorkflowEditorDocument,
  type WorkflowEditorConnectionInput,
  type WorkflowEditorDocument,
  type WorkflowEditorNode,
  type WorkflowEditorPortType,
  type WorkflowEditorTypeDefinition,
  type WorkflowRunnerLifecycleEvent,
} from "@moritzbrantner/workflow-editor";

/**
 * Reference applications (#22). The two approved example families (Decision Atlas 5.1) are an
 * editable data pipeline, which a first-time visitor opens into (5.2, 5.4), and an AI/media
 * pipeline whose generation step is one opaque, versioned external operation (ADR 0003). The
 * agent, backend orchestration and CRM examples cover the other reference applications named in
 * #22. All are deterministic, offline and authoring only: Pages compiles them but never executes
 * them. See docs/reference-examples.md.
 */

type ExampleNodeData = Record<string, unknown>;
type ExampleDocument = WorkflowEditorDocument<ExampleNodeData>;

export const dataPipelineExampleId = "data-pipeline";
export const mediaPipelineExampleId = "media-pipeline";
export const agentWorkflowExampleId = "agent-workflow";
export const backendOrchestrationExampleId = "backend-orchestration";
export const leadIntakeExampleId = "lead-intake";
export const enrichLeadExampleId = "enrich-lead";

const ts = (source: string): WorkflowEditorPortType => ({ kind: "typescript", source });

function link(
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

function defaultTemplate(
  kind: string,
  id: string,
  label: string,
  x: number,
  y: number,
): WorkflowEditorNode<ExampleNodeData> {
  return {
    ...(defaultWorkflowEditorNodeTemplates.find(
      (item) => item.kind === kind,
    )! as WorkflowEditorNode<ExampleNodeData>),
    id,
    label,
    x,
    y,
  };
}

/** Source → transform → validate → branch → output, with a quarantine path for invalid batches. */
export function dataPipelineDocument(): ExampleDocument {
  return normalizeWorkflowEditorDocument<ExampleNodeData>({
    typeDeclarations: [
      "type SalesCsvRow = { region: string; amount: string; currency: string };",
      'type SalesRecord = { region: string; amountCents: number; currency: "EUR" | "USD" };',
    ].join("\n"),
    viewport: { x: 25, y: 35, zoom: 0.7 },
    nodes: [
      {
        // Typed workflow inputs (#115): the export date is required, the currency defaults to EUR.
        id: "parameters",
        label: "Parameters",
        description: "Run inputs: fill them in document settings or pick a saved input profile.",
        kind: "control.start",
        category: "Control flow",
        x: -320,
        y: 120,
        outputs: [
          { id: "exportDate", label: "Export date", type: ts("string") },
          {
            id: "currency",
            label: "Currency",
            type: ts('"EUR" | "USD"'),
            optional: true,
            defaultValue: "EUR",
          },
        ],
      },
      {
        id: "sales-source",
        label: "Sales CSV",
        description: "Reads the daily sales export.",
        kind: "data.source.csv",
        category: "Data",
        x: 0,
        y: 120,
        inputs: [{ id: "exportDate", label: "Export date", type: ts("string") }],
        outputs: [{ id: "rows", label: "Rows", type: ts("SalesCsvRow[]") }],
        data: { path: "exports/sales-2026-10-18.csv" },
      },
      {
        id: "normalize",
        label: "Normalize amounts",
        description: "Parses amounts into integer cents.",
        kind: "data.transform.map",
        category: "Data",
        x: 320,
        y: 120,
        inputs: [
          { id: "rows", label: "Rows", type: ts("SalesCsvRow[]") },
          { id: "currency", label: "Currency", type: ts('"EUR" | "USD"') },
        ],
        outputs: [{ id: "records", label: "Records", type: ts("SalesRecord[]") }],
      },
      {
        id: "validate",
        label: "Validate records",
        description: "Checks currencies and non-negative amounts.",
        kind: "data.validate",
        category: "Data",
        x: 640,
        y: 120,
        inputs: [{ id: "records", label: "Records", type: ts("SalesRecord[]") }],
        outputs: [
          { id: "records", label: "Records", type: ts("SalesRecord[]") },
          { id: "valid", label: "Valid", type: { kind: "boolean" } },
        ],
      },
      defaultTemplate("control.if", "route", "Route by validity", 960, 120),
      {
        id: "warehouse",
        label: "Load warehouse",
        description: "Appends the batch to the sales table.",
        kind: "data.sink.warehouse",
        category: "Data",
        x: 1280,
        y: 0,
        inputs: [{ id: "records", label: "Records", type: ts("SalesRecord[]") }],
      },
      {
        id: "quarantine",
        label: "Quarantine batch",
        description: "Keeps invalid batches for review.",
        kind: "data.sink.quarantine",
        category: "Data",
        x: 1280,
        y: 260,
        inputs: [{ id: "records", label: "Records", type: ts("SalesRecord[]") }],
      },
    ],
    edges: [
      link("parameters", "exportDate", "sales-source", "exportDate"),
      link("parameters", "currency", "normalize", "currency"),
      link("sales-source", "rows", "normalize", "rows"),
      link("normalize", "records", "validate", "records"),
      link("validate", "records", "route", "value"),
      link("validate", "valid", "route", "condition"),
      link("route", "true", "warehouse", "records"),
      link("route", "false", "quarantine", "records"),
    ],
  }).document;
}

/** Raw CSV rows cannot be loaded into the warehouse without normalizing them first. */
export const dataPipelineInvalidConnection: WorkflowEditorConnectionInput = {
  sourceNodeId: "sales-source",
  sourcePortId: "rows",
  targetNodeId: "warehouse",
  targetPortId: "records",
};

/**
 * Media input → external AI/media operation → output processing → published artifact. The
 * generation step is one opaque, pinned ComfyUI workflow reference; Pages runs no model.
 */
export function mediaPipelineDocument(): ExampleDocument {
  return normalizeWorkflowEditorDocument<ExampleNodeData>({
    typeDeclarations: [
      "type MediaAsset = { uri: string; mediaType: string; sha256: string };",
      "type GenerationRequest = { source: MediaAsset; prompt: string };",
    ].join("\n"),
    viewport: { x: 25, y: 35, zoom: 0.7 },
    nodes: [
      {
        id: "product-photo",
        label: "Product photo",
        description: "Uploaded source image.",
        kind: "media.input",
        category: "Media",
        x: 0,
        y: 0,
        outputs: [{ id: "image", label: "Image", type: ts("MediaAsset") }],
      },
      {
        ...defaultTemplate("json.string", "prompt", "Style prompt", 0, 220),
        data: { value: "studio lighting, white background", sourceName: "prompt" },
      },
      {
        id: "build-request",
        label: "Build request",
        kind: "media.request.build",
        category: "Media",
        x: 320,
        y: 100,
        inputs: [
          { id: "image", label: "Image", type: ts("MediaAsset") },
          { id: "prompt", label: "Prompt", type: { kind: "string" } },
        ],
        outputs: [{ id: "request", label: "Request", type: ts("GenerationRequest") }],
      },
      {
        id: "generate",
        label: "Generate variant (ComfyUI)",
        description: "One external, versioned operation; an external host supplies the executor.",
        kind: "asset.operation",
        category: "Integration",
        x: 640,
        y: 100,
        inputs: [{ id: "request", label: "Request", type: ts("GenerationRequest") }],
        outputs: [{ id: "asset", label: "Asset", type: ts("MediaAsset") }],
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
                sha256: "b".repeat(64),
                byteLength: 512,
                metadata: { format: "comfyui-api-prompt" },
              },
            },
          },
        },
      },
      {
        id: "resize",
        label: "Resize for web",
        kind: "media.image.resize",
        category: "Media",
        x: 960,
        y: 100,
        inputs: [{ id: "image", label: "Image", type: ts("MediaAsset") }],
        outputs: [{ id: "image", label: "Image", type: ts("MediaAsset") }],
        data: { width: 1200, format: "image/webp" },
      },
      {
        id: "publish",
        label: "Publish artifact",
        description: "Stores the image and returns its reference.",
        kind: "artifact.publish",
        category: "Artifacts",
        x: 1280,
        y: 100,
        inputs: [{ id: "image", label: "Image", type: ts("MediaAsset") }],
      },
    ],
    edges: [
      link("product-photo", "image", "build-request", "image"),
      link("prompt", "value", "build-request", "prompt"),
      link("build-request", "request", "generate", "request"),
      link("generate", "asset", "resize", "image"),
      link("resize", "image", "publish", "image"),
    ],
  }).document;
}

/** The style prompt is text, not an image, so it cannot feed the resize step. */
export const mediaPipelineInvalidConnection: WorkflowEditorConnectionInput = {
  sourceNodeId: "prompt",
  sourcePortId: "value",
  targetNodeId: "resize",
  targetPortId: "image",
};

const humanTask = (kind: string) =>
  defaultWorkflowEditorNodeTemplates.find(
    (template) => template.kind === kind,
  )! as WorkflowEditorNode<ExampleNodeData>;

/**
 * Agent workflow: plan → tool call (retried by the runner, with a fallback tool on failure) →
 * draft → human review → final reply. A rejected draft goes to a typed correction task (#105).
 */
export function agentWorkflowDocument(): ExampleDocument {
  return normalizeWorkflowEditorDocument<ExampleNodeData>({
    typeDeclarations: [
      "type SupportRequest = { ticketId: string; customer: string; question: string };",
      "type AgentPlan = { ticketId: string; steps: string[] };",
      "type ToolResult = { tool: string; content: string; sources: string[] };",
      "type ToolError = { tool: string; message: string; retryable: boolean };",
      "type DraftReply = { ticketId: string; body: string; citations: string[] };",
    ].join("\n"),
    viewport: { x: 25, y: 35, zoom: 0.6 },
    nodes: [
      {
        id: "request",
        label: "Support request",
        description: "The customer's question.",
        kind: "control.start",
        category: "Control flow",
        x: 0,
        y: 120,
        outputs: [{ id: "request", label: "Request", type: ts("SupportRequest") }],
      },
      {
        id: "plan",
        label: "Plan steps",
        description: "The model decides which tools to call.",
        kind: "agent.plan",
        category: "Agent",
        x: 300,
        y: 120,
        inputs: [{ id: "request", label: "Request", type: ts("SupportRequest") }],
        outputs: [{ id: "plan", label: "Plan", type: ts("AgentPlan") }],
        data: { model: "host-configured" },
      },
      {
        id: "search",
        label: "Search knowledge base",
        description: "Tool call; the runner retries it up to three times before the error branch.",
        kind: "agent.tool.call",
        category: "Agent",
        x: 600,
        y: 40,
        inputs: [{ id: "plan", label: "Plan", type: ts("AgentPlan") }],
        outputs: [
          { id: "result", label: "Result", type: ts("ToolResult") },
          { id: "error", label: "Error", type: ts("ToolError") },
        ],
        data: { tool: "kb.search", retry: { maxAttempts: 3, backoff: "exponential" } },
      },
      {
        id: "fallback",
        label: "Fallback: search docs",
        description: "Runs only when the knowledge base search fails.",
        kind: "agent.tool.call",
        category: "Agent",
        x: 900,
        y: 220,
        inputs: [
          { id: "error", label: "Error", type: ts("ToolError") },
          { id: "plan", label: "Plan", type: ts("AgentPlan") },
        ],
        outputs: [{ id: "result", label: "Result", type: ts("ToolResult") }],
        data: { tool: "docs.search" },
      },
      {
        ...defaultTemplate("control.merge", "evidence", "Collect evidence", 1200, 80),
        category: "Control flow",
        description: "Whichever tool answered.",
        inputs: [
          {
            id: "items",
            label: "Results",
            type: ts("ToolResult[]"),
            cardinality: { min: 1, max: 2 },
          },
        ],
        outputs: [
          {
            id: "out",
            label: "Evidence",
            type: ts("ToolResult[]"),
            metadata: { workflowTypeInference: "items" },
          },
        ],
      },
      {
        id: "draft",
        label: "Draft reply",
        description: "The model writes a cited answer.",
        kind: "agent.generate",
        category: "Agent",
        x: 1500,
        y: 120,
        inputs: [
          { id: "request", label: "Request", type: ts("SupportRequest") },
          { id: "evidence", label: "Evidence", type: ts("ToolResult[]") },
        ],
        outputs: [{ id: "reply", label: "Reply", type: ts("DraftReply") }],
      },
      {
        ...humanTask("human.task.approval"),
        id: "review",
        label: "Review reply",
        x: 1800,
        y: 120,
        data: { prompt: "Send this reply to the customer?" },
      },
      {
        ...humanTask("human.task.input"),
        id: "correct",
        label: "Correct reply",
        x: 2100,
        y: 280,
        outputs: [{ id: "value", label: "Corrected reply", type: ts("DraftReply") }],
        data: { prompt: "Rewrite the reply so it can be sent." },
      },
      {
        ...defaultTemplate("control.merge", "reviewed", "Reviewed reply", 2400, 120),
        category: "Control flow",
        inputs: [
          {
            id: "items",
            label: "Replies",
            type: ts("DraftReply[]"),
            cardinality: { min: 1, max: 2 },
          },
        ],
        outputs: [
          {
            id: "out",
            label: "Reply",
            type: ts("DraftReply[]"),
            metadata: { workflowTypeInference: "items" },
          },
        ],
      },
      {
        id: "send",
        label: "Final reply",
        description: "The workflow output: the reviewed reply.",
        kind: "control.end",
        category: "Control flow",
        x: 2700,
        y: 120,
        inputs: [{ id: "reply", label: "Reply", type: ts("DraftReply[]") }],
      },
    ],
    edges: [
      link("request", "request", "plan", "request"),
      link("plan", "plan", "search", "plan"),
      link("search", "error", "fallback", "error"),
      link("plan", "plan", "fallback", "plan"),
      link("search", "result", "evidence", "items"),
      link("fallback", "result", "evidence", "items"),
      link("request", "request", "draft", "request"),
      link("evidence", "out", "draft", "evidence"),
      link("draft", "reply", "review", "request"),
      link("review", "approved", "reviewed", "items"),
      link("review", "rejected", "correct", "context"),
      link("correct", "value", "reviewed", "items"),
      link("reviewed", "out", "send", "reply"),
    ],
  }).document;
}

/** The raw request cannot skip planning, tools and review to become the final reply. */
export const agentWorkflowInvalidConnection: WorkflowEditorConnectionInput = {
  sourceNodeId: "request",
  sourcePortId: "request",
  targetNodeId: "send",
  targetPortId: "reply",
};

/**
 * Backend orchestration: an HTTP order fans out to payment, inventory and label tasks, which fan
 * in to a confirmation. A failed charge takes the error path and cancels the order.
 */
export function backendOrchestrationDocument(): ExampleDocument {
  return normalizeWorkflowEditorDocument<ExampleNodeData>({
    typeDeclarations: [
      "type OrderLine = { sku: string; quantity: number };",
      "type Order = { orderId: string; lines: OrderLine[]; totalCents: number };",
      "type PaymentReceipt = { orderId: string; chargeId: string };",
      "type PaymentFailure = { orderId: string; code: string; message: string };",
      "type Reservation = { orderId: string; warehouse: string };",
      "type ShippingLabel = { orderId: string; trackingNumber: string };",
      'type OrderOutcome = { orderId: string; status: "confirmed" | "cancelled" };',
    ].join("\n"),
    viewport: { x: 25, y: 35, zoom: 0.65 },
    nodes: [
      {
        id: "order",
        label: "Order received",
        description: "POST /orders from the shop.",
        kind: "control.start",
        category: "Control flow",
        x: 0,
        y: 160,
        outputs: [{ id: "order", label: "Order", type: ts("Order") }],
        data: { trigger: { kind: "http", method: "POST", path: "/orders" } },
      },
      {
        id: "charge",
        label: "Charge payment",
        description: "Calls the payment provider; declined charges take the Failure output.",
        kind: "http.request",
        category: "HTTP",
        x: 320,
        y: 0,
        inputs: [{ id: "order", label: "Order", type: ts("Order") }],
        outputs: [
          { id: "receipt", label: "Receipt", type: ts("PaymentReceipt") },
          { id: "failure", label: "Failure", type: ts("PaymentFailure") },
        ],
        data: {
          method: "POST",
          url: "https://payments.example.invalid/charges",
          retry: { maxAttempts: 3, backoff: "exponential" },
        },
      },
      {
        id: "reserve",
        label: "Reserve inventory",
        kind: "http.request",
        category: "HTTP",
        x: 320,
        y: 180,
        inputs: [{ id: "order", label: "Order", type: ts("Order") }],
        outputs: [{ id: "reservation", label: "Reservation", type: ts("Reservation") }],
        data: { method: "POST", url: "https://inventory.example.invalid/reservations" },
      },
      {
        id: "label",
        label: "Create shipping label",
        kind: "task.run",
        category: "Task",
        x: 320,
        y: 340,
        inputs: [{ id: "order", label: "Order", type: ts("Order") }],
        outputs: [{ id: "label", label: "Label", type: ts("ShippingLabel") }],
        data: { queue: "shipping" },
      },
      {
        id: "confirm",
        label: "Confirm order",
        description: "Waits for all three tasks.",
        kind: "task.run",
        category: "Task",
        x: 680,
        y: 160,
        inputs: [
          { id: "receipt", label: "Receipt", type: ts("PaymentReceipt") },
          { id: "reservation", label: "Reservation", type: ts("Reservation") },
          { id: "label", label: "Label", type: ts("ShippingLabel") },
        ],
        outputs: [{ id: "outcome", label: "Outcome", type: ts("OrderOutcome") }],
      },
      {
        id: "cancel",
        label: "Cancel order",
        description: "Releases the reservation and voids the label.",
        kind: "task.run",
        category: "Task",
        x: 680,
        y: -160,
        inputs: [
          { id: "failure", label: "Failure", type: ts("PaymentFailure") },
          { id: "reservation", label: "Reservation", type: ts("Reservation") },
        ],
        outputs: [{ id: "outcome", label: "Outcome", type: ts("OrderOutcome") }],
      },
      {
        ...defaultTemplate("control.merge", "outcome", "Order outcome", 1000, 0),
        category: "Control flow",
        inputs: [
          {
            id: "items",
            label: "Outcomes",
            type: ts("OrderOutcome[]"),
            cardinality: { min: 1, max: 2 },
          },
        ],
        outputs: [
          {
            id: "out",
            label: "Outcome",
            type: ts("OrderOutcome[]"),
            metadata: { workflowTypeInference: "items" },
          },
        ],
      },
      {
        id: "respond",
        label: "Respond to shop",
        kind: "control.end",
        category: "Control flow",
        x: 1300,
        y: 0,
        inputs: [{ id: "outcome", label: "Outcome", type: ts("OrderOutcome[]") }],
      },
    ],
    edges: [
      link("order", "order", "charge", "order"),
      link("order", "order", "reserve", "order"),
      link("order", "order", "label", "order"),
      link("charge", "receipt", "confirm", "receipt"),
      link("reserve", "reservation", "confirm", "reservation"),
      link("label", "label", "confirm", "label"),
      link("charge", "failure", "cancel", "failure"),
      link("reserve", "reservation", "cancel", "reservation"),
      link("confirm", "outcome", "outcome", "items"),
      link("cancel", "outcome", "outcome", "items"),
      link("outcome", "out", "respond", "outcome"),
    ],
  }).document;
}

/** A declined charge cannot confirm the order: the failure is not a receipt. */
export const backendOrchestrationInvalidConnection: WorkflowEditorConnectionInput = {
  sourceNodeId: "charge",
  sourcePortId: "failure",
  targetNodeId: "confirm",
  targetPortId: "receipt",
};

const runAt = (second: number) => `2026-10-25T09:00:${String(second).padStart(2, "0")}.000Z`;

/**
 * A recorded Workflow Runner event stream for one order (run "order-1042"): the charge times out
 * once and succeeds on retry, the three tasks fan in to the confirmation and the cancel path is
 * skipped. It feeds the execution overlay demonstration (Storybook, docs/execution-overlay.md);
 * Pages never shows it as a run, because Pages executes nothing (Decision Atlas 5.7, 5.8).
 */
export const backendOrchestrationRecordedRun: readonly WorkflowRunnerLifecycleEvent[] = [
  { type: "run.started", runId: "order-1042", timestamp: runAt(0) },
  { type: "node.started", runId: "order-1042", nodeId: "order", attempt: 1, timestamp: runAt(0) },
  {
    type: "node.succeeded",
    runId: "order-1042",
    nodeId: "order",
    attempt: 1,
    timestamp: runAt(1),
    outputs: { order: {} },
  },
  { type: "node.started", runId: "order-1042", nodeId: "charge", attempt: 1, timestamp: runAt(1) },
  { type: "node.started", runId: "order-1042", nodeId: "reserve", attempt: 1, timestamp: runAt(1) },
  { type: "node.started", runId: "order-1042", nodeId: "label", attempt: 1, timestamp: runAt(1) },
  {
    type: "node.succeeded",
    runId: "order-1042",
    nodeId: "reserve",
    attempt: 1,
    timestamp: runAt(3),
    outputs: { reservation: {} },
  },
  {
    type: "node.succeeded",
    runId: "order-1042",
    nodeId: "label",
    attempt: 1,
    timestamp: runAt(4),
    outputs: { label: {} },
  },
  {
    type: "node.retrying",
    runId: "order-1042",
    nodeId: "charge",
    attempt: 1,
    nextAttempt: 2,
    reason: "Payment gateway timed out",
    timestamp: runAt(6),
  },
  {
    type: "node.succeeded",
    runId: "order-1042",
    nodeId: "charge",
    attempt: 2,
    timestamp: runAt(9),
    outputs: { receipt: {} },
  },
  { type: "node.skipped", runId: "order-1042", nodeId: "cancel", timestamp: runAt(9) },
  { type: "node.started", runId: "order-1042", nodeId: "confirm", attempt: 1, timestamp: runAt(9) },
  {
    type: "node.succeeded",
    runId: "order-1042",
    nodeId: "confirm",
    attempt: 1,
    timestamp: runAt(10),
    outputs: { outcome: {} },
  },
  {
    type: "node.started",
    runId: "order-1042",
    nodeId: "outcome",
    attempt: 1,
    timestamp: runAt(10),
  },
  {
    type: "node.succeeded",
    runId: "order-1042",
    nodeId: "outcome",
    attempt: 1,
    timestamp: runAt(10),
    outputs: { out: {} },
  },
  {
    type: "node.started",
    runId: "order-1042",
    nodeId: "respond",
    attempt: 1,
    timestamp: runAt(10),
  },
  {
    type: "node.succeeded",
    runId: "order-1042",
    nodeId: "respond",
    attempt: 1,
    timestamp: runAt(11),
  },
  { type: "run.succeeded", runId: "order-1042", timestamp: runAt(11) },
];

// CRM automation (Lead Intake + nested Enrich Lead) uses named object type definitions rather than
// TypeScript declarations, so the workbench passes `crmTypeDefinitions` to the editor and compiler.
const stringType = { kind: "string" } satisfies WorkflowEditorPortType;
const numberType = { kind: "number" } satisfies WorkflowEditorPortType;
const booleanType = { kind: "boolean" } satisfies WorkflowEditorPortType;
const objectType = { kind: "object" } satisfies WorkflowEditorPortType;
export const leadType = { kind: "ref", name: "Lead" } satisfies WorkflowEditorPortType;
export const qualifiedLeadType = {
  kind: "ref",
  name: "QualifiedLead",
} satisfies WorkflowEditorPortType;

export const crmTypeDefinitions: readonly WorkflowEditorTypeDefinition[] = [
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
];

/**
 * CRM automation: lead intake → nested enrichment (a Workflow Reference to Enrich Lead) → scoring →
 * conditional assignment, with the account owner notified about every qualified lead.
 */
export function leadIntakeDocument(): ExampleDocument {
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
        workflowRef: { documentId: enrichLeadExampleId },
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
        id: "notify-owner",
        label: "Notify account owner",
        description: "Tells the assigned owner about the new deal.",
        kind: "messaging.send",
        category: "Messaging",
        x: 1420,
        y: -200,
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
      link("lead-source", "lead", "dedupe", "lead"),
      link("dedupe", "lead", "enrich", "lead"),
      link("enrich", "lead", "score", "lead"),
      link("score", "score", "qualification", "score"),
      link("enrich", "lead", "route", "value"),
      link("qualification", "qualified", "route", "condition"),
      link("route", "true", "create-deal", "lead"),
      link("route", "true", "notify-owner", "lead"),
      link("route", "false", "nurture", "lead"),
      link("route", "true", "routed-leads", "items"),
      link("route", "false", "routed-leads", "items"),
    ],
  }).document as ExampleDocument;
}

/** The nested workflow that Lead Intake references: two lookups fanned in to one profile. */
export function enrichLeadDocument(): ExampleDocument {
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
      link("incoming-lead", "lead", "company-lookup", "lead"),
      link("incoming-lead", "lead", "email-verification", "lead"),
      link("incoming-lead", "lead", "merge-profile", "lead"),
      link("company-lookup", "company", "merge-profile", "company"),
      link("email-verification", "verified", "merge-profile", "verified"),
      link("merge-profile", "lead", "return-lead", "lead"),
    ],
  }).document as ExampleDocument;
}

/** An unqualified lead from the nurture branch cannot create a deal. */
export const leadIntakeInvalidConnection: WorkflowEditorConnectionInput = {
  sourceNodeId: "route",
  sourcePortId: "false",
  targetNodeId: "create-deal",
  targetPortId: "lead",
};
