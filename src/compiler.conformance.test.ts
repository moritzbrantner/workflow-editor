import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { compileWorkflowEditorDocument } from "./compiler";
import type { WorkflowEditorDocument } from "./core-types";

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
