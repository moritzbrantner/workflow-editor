import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { compileWorkflowEditorDocument } from "./compiler";
import type { WorkflowEditorDocument, WorkflowEditorPortType } from "./core-types";

const compiledV1Fixture = JSON.parse(
  readFileSync(resolve(process.cwd(), "fixtures/compiled-v1-simple.json"), "utf8"),
) as unknown;

const sourceDocument: WorkflowEditorDocument = {
  nodes: [
    {
      id: "end",
      label: "End",
      kind: "control.end",
      x: 200,
      y: 0,
      inputs: [
        {
          id: "in",
          label: "In",
          type: { kind: "string" },
          optional: true,
          defaultValue: "fallback",
        },
      ],
      data: { result: "complete" },
    },
    {
      id: "start",
      label: "Start",
      kind: "control.start",
      x: 0,
      y: 0,
      outputs: [{ id: "out", label: "Out", type: { kind: "any" } }],
    },
  ],
  edges: [
    {
      id: "edge",
      sourceNodeId: "start",
      sourcePortId: "out",
      targetNodeId: "end",
      targetPortId: "in",
    },
  ],
};

describe("compiled workflow v1 conformance", () => {
  it("emits the canonical fixture consumed by workflow-engine and workflow-runner", () => {
    expect(compileWorkflowEditorDocument(sourceDocument)).toEqual(compiledV1Fixture);
  });
});

const externalAssetV1Fixture = JSON.parse(
  readFileSync(resolve(process.cwd(), "fixtures/compiled-v1-external-asset.json"), "utf8"),
) as unknown;

const externalAssetDocument: WorkflowEditorDocument = {
  // Deliberately unsorted: the compiler, not the host, owns DAG ordering.
  nodes: [
    {
      id: "end",
      label: "End",
      kind: "control.end",
      x: 440,
      y: 0,
      inputs: [{ id: "in", type: { kind: "object" } }],
    },
    {
      id: "generate",
      label: "Generate image",
      kind: "asset.operation",
      x: 220,
      y: 0,
      inputs: [{ id: "request", type: { kind: "any" } }],
      outputs: [{ id: "asset", type: { kind: "object" } }],
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
      id: "start",
      label: "Start",
      kind: "control.start",
      x: 0,
      y: 0,
      outputs: [{ id: "out", type: { kind: "any" } }],
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
};

describe("external operation handoff conformance", () => {
  it("compiles an opaque, pinned asset operation without expanding a provider-native graph", () => {
    const before = structuredClone(externalAssetDocument);
    const compiled = compileWorkflowEditorDocument(externalAssetDocument);

    expect(compiled).toEqual(externalAssetV1Fixture);
    expect(compiled.nodes.map((node) => node.kind)).toEqual([
      "control.start",
      "asset.operation",
      "control.end",
    ]);
    expect(compiled.nodes[1]?.data).toEqual(externalAssetDocument.nodes[1]?.data);
    expect(externalAssetDocument).toEqual(before);
    expect(compileWorkflowEditorDocument(externalAssetDocument)).toEqual(compiled);
  });
});

// Issue #61 acceptance: buffered WAV fan-out and streamed WAV chunk fan-out without a Tee node.
// Payload delivery mode and media type are copied onto compiled ports only when declared.
const binaryPortsV1Fixture = JSON.parse(
  readFileSync(resolve(process.cwd(), "fixtures/compiled-v1-binary-ports.json"), "utf8"),
) as unknown;

const wavBytes = { kind: "typescript", source: "Uint8Array" } as const;
const bufferedWav = { mode: "buffered", mediaType: "audio/wav" } as const;
const streamedWav = { mode: "streamed", mediaType: "audio/wav" } as const;

const binaryPortsDocument = {
  // Deliberately unsorted: the compiler owns DAG, node and edge ordering.
  nodes: [
    {
      id: "waveform",
      label: "Render waveform",
      kind: "audio.waveform",
      x: 320,
      y: 160,
      inputs: [{ id: "wav", label: "WAV", type: wavBytes, payload: bufferedWav }],
    },
    {
      id: "transcribe",
      label: "Transcribe stream",
      kind: "audio.transcribe",
      x: 320,
      y: 480,
      inputs: [{ id: "chunks", label: "WAV chunks", type: wavBytes, payload: streamedWav }],
      outputs: [{ id: "text", label: "Text", type: { kind: "typescript", source: "string" } }],
    },
    {
      id: "wav-source",
      label: "WAV source",
      kind: "audio.source",
      x: 0,
      y: 240,
      outputs: [
        { id: "wav", label: "WAV", type: wavBytes, payload: bufferedWav },
        { id: "chunks", label: "WAV chunks", type: wavBytes, payload: streamedWav },
      ],
    },
    {
      id: "archive",
      label: "Archive WAV",
      kind: "audio.archive",
      x: 320,
      y: 0,
      inputs: [{ id: "wav", label: "WAV", type: wavBytes, payload: bufferedWav }],
    },
    {
      id: "live-preview",
      label: "Live preview",
      kind: "audio.preview",
      x: 320,
      y: 320,
      inputs: [{ id: "chunks", label: "WAV chunks", type: wavBytes, payload: streamedWav }],
    },
  ],
  edges: [
    {
      id: "wav-waveform",
      sourceNodeId: "wav-source",
      sourcePortId: "wav",
      targetNodeId: "waveform",
      targetPortId: "wav",
    },
    {
      id: "chunks-transcribe",
      sourceNodeId: "wav-source",
      sourcePortId: "chunks",
      targetNodeId: "transcribe",
      targetPortId: "chunks",
    },
    {
      id: "wav-archive",
      sourceNodeId: "wav-source",
      sourcePortId: "wav",
      targetNodeId: "archive",
      targetPortId: "wav",
    },
    {
      id: "chunks-preview",
      sourceNodeId: "wav-source",
      sourcePortId: "chunks",
      targetNodeId: "live-preview",
      targetPortId: "chunks",
    },
  ],
} as unknown as WorkflowEditorDocument;

describe("binary port payload conformance", () => {
  it("emits the pinned buffered and streamed WAV fan-out fixture", () => {
    const before = structuredClone(binaryPortsDocument);
    const compiled = compileWorkflowEditorDocument(binaryPortsDocument);

    expect(compiled).toEqual(binaryPortsV1Fixture);
    expect(binaryPortsDocument).toEqual(before);
    expect(compileWorkflowEditorDocument(binaryPortsDocument)).toEqual(compiled);
  });
});

// Issue #64 acceptance (TECH-002): a document with a bounded iteration node compiles to compiled
// v2. The iteration node carries a structured `iteration` contract with its compiled body; its
// `data.iteration` is not duplicated in compiled `data`. Documents without iteration nodes keep
// emitting compiled v1 (the fixtures above are unchanged).
// The exact TypeScript source of the generated `result` type is not pinned: both the fixture's and
// the compiler's result type must equal `workflowEditorIterationResultType(state)` semantically
// (mutually assignable) and are then compared structurally with that one string masked.
// Existing JSON primitive normalization keeps `data.sourceName` unique in document order, so the
// second json.number ("initial-guess") compiles with "numberValue2". An empty
// compiled `data` object on the iteration node is treated like an omitted one.
const boundedIterationV2Fixture = JSON.parse(
  readFileSync(resolve(process.cwd(), "fixtures/compiled-v2-bounded-iteration.json"), "utf8"),
) as Record<string, unknown>;

type IterationExports = {
  workflowEditorIterationResultType?: (stateType: WorkflowEditorPortType) => WorkflowEditorPortType;
  isWorkflowEditorPortTypeAssignable: (
    source: WorkflowEditorPortType,
    target: WorkflowEditorPortType,
  ) => boolean;
};

const numberType = { kind: "number" } as const;
const tsType = (source: string) => ({ kind: "typescript", source }) as const;

function boundedIterationDocument(resultType: WorkflowEditorPortType): WorkflowEditorDocument {
  return {
    // Deliberately unsorted: the compiler owns DAG, node and edge ordering (also inside the body).
    nodes: [
      {
        id: "approximation",
        label: "Approximation",
        kind: "control.end",
        x: 560,
        y: 0,
        inputs: [{ id: "in", label: "In", type: tsType("unknown") }],
      },
      {
        id: "refine",
        label: "Refine square root",
        kind: "control.iterate",
        x: 280,
        y: 0,
        inputs: [
          { id: "state", label: "State", type: tsType("number") },
          { id: "target", label: "Target", type: numberType },
        ],
        outputs: [{ id: "result", label: "Result", type: resultType }],
        data: { iteration: { maxIterations: 10 } },
        composition: {
          nodes: [
            {
              id: "within-tolerance",
              label: "Within tolerance",
              kind: "math.compare.withinTolerance",
              x: 240,
              y: 0,
              inputs: [
                { id: "previous", label: "Previous", type: numberType },
                { id: "next", label: "Next", type: numberType },
              ],
              outputs: [{ id: "converged", label: "Converged", type: { kind: "boolean" } }],
              data: { tolerance: 1e-9 },
            },
            {
              id: "newton-step",
              label: "Newton step",
              kind: "math.sqrt.newtonStep",
              x: 0,
              y: 0,
              inputs: [
                { id: "estimate", label: "Estimate", type: numberType },
                { id: "target", label: "Target", type: numberType },
              ],
              outputs: [{ id: "next", label: "Next", type: numberType }],
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
            { wrapperPortId: "target", nodeId: "newton-step", portId: "target" },
            { wrapperPortId: "state", nodeId: "within-tolerance", portId: "previous" },
            { wrapperPortId: "state", nodeId: "newton-step", portId: "estimate" },
          ],
          outputBoundaries: [
            { wrapperPortId: "converged", nodeId: "within-tolerance", portId: "converged" },
            { wrapperPortId: "next", nodeId: "newton-step", portId: "next" },
          ],
        },
      },
      {
        id: "target",
        label: "Target",
        kind: "json.number",
        x: 0,
        y: 0,
        outputs: [{ id: "value", label: "Value", type: numberType }],
        data: { value: 2, sourceName: "numberValue" },
      },
      {
        id: "initial-guess",
        label: "Initial guess",
        kind: "json.number",
        x: 0,
        y: 160,
        outputs: [{ id: "value", label: "Value", type: numberType }],
        data: { value: 1, sourceName: "numberValue" },
      },
    ],
    edges: [
      {
        id: "target-invariant",
        sourceNodeId: "target",
        sourcePortId: "value",
        targetNodeId: "refine",
        targetPortId: "target",
      },
      {
        id: "refine-approximation",
        sourceNodeId: "refine",
        sourcePortId: "result",
        targetNodeId: "approximation",
        targetPortId: "in",
      },
      {
        id: "guess-state",
        sourceNodeId: "initial-guess",
        sourcePortId: "value",
        targetNodeId: "refine",
        targetPortId: "state",
      },
    ],
  };
}

type CompiledShape = {
  version?: unknown;
  nodes: Array<{
    id: string;
    data?: Record<string, unknown>;
    outputs?: Array<{ id: string; type: WorkflowEditorPortType }>;
  }>;
};

function maskIterationResultType(compiled: unknown) {
  const copy = structuredClone(compiled) as CompiledShape;
  const refine = copy.nodes.find((node) => node.id === "refine");
  const result = refine?.outputs?.find((port) => port.id === "result");
  const type = result?.type;
  if (result) result.type = { kind: "typescript", source: "<iteration result>" };
  if (refine?.data && Object.keys(refine.data).length === 0) delete refine.data;
  return { masked: copy, resultType: type };
}

describe("compiled workflow v2 bounded iteration conformance", () => {
  it("emits the pinned Newton square-root fixture deterministically without mutating input", async () => {
    const coreExports = (await import("./core")) as unknown as IterationExports;
    const compilerExports = (await import("./compiler")) as unknown as {
      compiledWorkflowIterationVersion?: number;
    };
    expect(compilerExports.compiledWorkflowIterationVersion).toBe(2);
    expect(typeof coreExports.workflowEditorIterationResultType).toBe("function");
    const expectedResultType = coreExports.workflowEditorIterationResultType!(tsType("number"));

    const document = boundedIterationDocument(expectedResultType);
    const before = structuredClone(document);
    const compiled = compileWorkflowEditorDocument(document);

    expect((compiled as { version: unknown }).version).toBe(2);
    const actual = maskIterationResultType(compiled);
    const pinned = maskIterationResultType(boundedIterationV2Fixture);
    expect(actual.masked).toEqual(pinned.masked);

    expect(actual.resultType).toEqual(expectedResultType);
    expect(pinned.resultType?.kind).toBe("typescript");
    expect(
      coreExports.isWorkflowEditorPortTypeAssignable(pinned.resultType!, expectedResultType),
    ).toBe(true);
    expect(
      coreExports.isWorkflowEditorPortTypeAssignable(expectedResultType, pinned.resultType!),
    ).toBe(true);

    expect(document).toEqual(before);
    expect(compileWorkflowEditorDocument(document)).toEqual(compiled);
  });

  it("keeps documents without iteration nodes on compiled v1", () => {
    expect(compileWorkflowEditorDocument(sourceDocument).version).toBe(1);
    expect(compileWorkflowEditorDocument(binaryPortsDocument).version).toBe(1);
  });
});
