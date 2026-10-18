import {
  defaultWorkflowEditorNodeTemplates,
  normalizeWorkflowEditorDocument,
  type WorkflowEditorConnectionInput,
  type WorkflowEditorDocument,
  type WorkflowEditorNode,
  type WorkflowEditorPortType,
} from "@moritzbrantner/workflow-editor";

/**
 * The two approved reference examples (Decision Atlas 5.1): an editable data pipeline, which a
 * first-time visitor opens into (5.2, 5.4), and an AI/media pipeline whose generation step is one
 * opaque, versioned external operation (ADR 0003). Both are deterministic, offline and authoring
 * only: Pages compiles them but never executes them.
 */

type ExampleNodeData = Record<string, unknown>;
type ExampleDocument = WorkflowEditorDocument<ExampleNodeData>;

export const dataPipelineExampleId = "data-pipeline";
export const mediaPipelineExampleId = "media-pipeline";

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
        x: 1280,
        y: 0,
        inputs: [{ id: "records", label: "Records", type: ts("SalesRecord[]") }],
      },
      {
        id: "quarantine",
        label: "Quarantine batch",
        description: "Keeps invalid batches for review.",
        kind: "data.sink.quarantine",
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
