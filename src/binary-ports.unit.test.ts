// Independent acceptance for issue #61 (TECH-003): buffered and streamed binary ports.
// Authored before implementation from the issue's "Selection and slice contract" comment.
//
// Contract under test:
// - `WorkflowEditorPort.payload?: { mode: "buffered" | "streamed"; mediaType?: string }`; a port
//   without `payload` delivers a complete value and is treated as buffered.
// - Connection validation: TypeScript assignability first ("type-mismatch"), then delivery mode
//   ("payload-mode-mismatch", message names both modes and an explicit conversion), then media
//   type ("media-type-mismatch", exact or `type/*` wildcard on either side). Rejected connections
//   leave the document unchanged. Output fan-out needs no Tee node.
// - Whole-document analysis reports existing mismatched edges with distinct diagnostic codes
//   (`WorkflowEditorTypeDiagnostic.type`): "incompatible-payload-mode" / "incompatible-media-type".
// - Shape validation rejects a malformed payload; valid payloads survive normalization, export /
//   restore, composition boundaries and compilation unchanged.
import { describe, expect, test } from "vitest";

import { compileWorkflowEditorDocument } from "./compiler";
import {
  analyzeWorkflowEditorPortTypes,
  connectWorkflowEditorNodes,
  createWorkflowEditorComposedNode,
  normalizeWorkflowEditorDocument,
  validateWorkflowEditorConnection,
  WorkflowEditorDocumentValidationError,
  type WorkflowEditorDocument,
  type WorkflowEditorEdge,
  type WorkflowEditorPort,
  type WorkflowEditorPortType,
} from "./index";
import { buildWorkflowEditorDocumentFile, restoreWorkflowEditorDocumentFile } from "./persistence";

type Payload = { mode: "buffered" | "streamed"; mediaType?: string };

const native = (source: string): WorkflowEditorPortType => ({ kind: "typescript", source });
const bytes = native("Uint8Array");

// The payload field does not exist on the port type yet; cast so the runtime assertions still run.
function port(id: string, payload?: Payload, type: WorkflowEditorPortType = bytes) {
  return { id, label: id, type, ...(payload ? { payload } : {}) } as WorkflowEditorPort;
}

function payloadOf(value: WorkflowEditorPort | undefined): unknown {
  return (value as (WorkflowEditorPort & { payload?: Payload }) | undefined)?.payload;
}

function pair(
  sourcePort: WorkflowEditorPort,
  targetPort: WorkflowEditorPort,
  edges: WorkflowEditorEdge[] = [],
): WorkflowEditorDocument {
  return {
    nodes: [
      { id: "source", label: "Source", kind: "audio.source", x: 0, y: 0, outputs: [sourcePort] },
      { id: "target", label: "Target", kind: "audio.sink", x: 300, y: 0, inputs: [targetPort] },
    ],
    edges,
  };
}

const connection = {
  sourceNodeId: "source",
  sourcePortId: "out",
  targetNodeId: "target",
  targetPortId: "in",
};

const buffered = (mediaType?: string): Payload => ({
  mode: "buffered",
  ...(mediaType ? { mediaType } : {}),
});
const streamed = (mediaType?: string): Payload => ({
  mode: "streamed",
  ...(mediaType ? { mediaType } : {}),
});

describe("delivery mode validation", () => {
  test.each([
    ["streamed → buffered", streamed("audio/wav"), buffered("audio/wav")],
    ["buffered → streamed", buffered("audio/wav"), streamed("audio/wav")],
    ["streamed → port without payload", streamed(), undefined],
    ["port without payload → streamed", undefined, streamed()],
  ])("rejects %s and explains the conversion", (_name, source, target) => {
    const document = pair(port("out", source), port("in", target));
    const validity = validateWorkflowEditorConnection(document, connection);

    expect(validity).toMatchObject({ valid: false, reason: "payload-mode-mismatch" });
    expect(validity.message).toMatch(/streamed/i);
    expect(validity.message).toMatch(/buffered/i);
    expect(validity.message).toMatch(/conversion/i);
  });

  test.each([
    ["buffered → buffered", buffered("audio/wav"), buffered("audio/wav")],
    ["streamed → streamed", streamed("audio/wav"), streamed("audio/wav")],
    ["buffered → port without payload", buffered("audio/wav"), undefined],
    ["port without payload → buffered", undefined, buffered("audio/wav")],
    ["port without payload → port without payload", undefined, undefined],
  ])("accepts %s", (_name, source, target) => {
    const document = pair(port("out", source), port("in", target));

    expect(validateWorkflowEditorConnection(document, connection)).toEqual({ valid: true });
  });

  test("checks TypeScript assignability before the delivery mode", () => {
    const document = pair(port("out", streamed()), port("in", buffered(), native("string")));

    expect(validateWorkflowEditorConnection(document, connection)).toMatchObject({
      valid: false,
      reason: "type-mismatch",
    });
  });

  test("leaves the document unchanged when a cross-mode connection is rejected", () => {
    const document = pair(port("out", streamed("audio/wav")), port("in", buffered("audio/wav")));
    const before = structuredClone(document);
    const result = connectWorkflowEditorNodes(document, connection);

    expect(result.edges).toHaveLength(0);
    expect(result).toEqual(before);
  });
});

describe("media type validation", () => {
  test("rejects mismatched declared media types after the mode check and names both", () => {
    const document = pair(port("out", buffered("audio/wav")), port("in", buffered("image/png")));
    const validity = validateWorkflowEditorConnection(document, connection);

    expect(validity).toMatchObject({ valid: false, reason: "media-type-mismatch" });
    expect(validity.message).toContain("audio/wav");
    expect(validity.message).toContain("image/png");
  });

  test("reports the delivery mode before the media type", () => {
    const document = pair(port("out", streamed("audio/wav")), port("in", buffered("image/png")));

    expect(validateWorkflowEditorConnection(document, connection)).toMatchObject({
      valid: false,
      reason: "payload-mode-mismatch",
    });
  });

  test.each([
    ["exact", "audio/wav", "audio/wav"],
    ["target wildcard", "audio/wav", "audio/*"],
    ["source wildcard", "audio/*", "audio/wav"],
    ["source only", "audio/wav", undefined],
    ["target only", undefined, "audio/wav"],
  ])("accepts %s media types", (_name, sourceMedia, targetMedia) => {
    for (const mode of [buffered, streamed]) {
      const document = pair(port("out", mode(sourceMedia)), port("in", mode(targetMedia)));
      expect(validateWorkflowEditorConnection(document, connection)).toEqual({ valid: true });
    }
  });

  test.each([
    ["different subtype", "audio/wav", "audio/mpeg"],
    ["wildcard of another top-level type", "audio/*", "image/png"],
    ["different wildcard families", "image/png", "audio/*"],
  ])("rejects %s", (_name, sourceMedia, targetMedia) => {
    const document = pair(port("out", streamed(sourceMedia)), port("in", streamed(targetMedia)));
    const before = structuredClone(document);

    expect(validateWorkflowEditorConnection(document, connection)).toMatchObject({
      valid: false,
      reason: "media-type-mismatch",
    });
    expect(connectWorkflowEditorNodes(document, connection)).toEqual(before);
  });
});

function fanOutDocument(): WorkflowEditorDocument {
  return {
    nodes: [
      {
        id: "wav-source",
        label: "WAV source",
        kind: "audio.source",
        x: 0,
        y: 0,
        outputs: [port("wav", buffered("audio/wav")), port("chunks", streamed("audio/wav"))],
      },
      ...["archive", "waveform"].map((id, index) => ({
        id,
        label: id,
        kind: "audio.buffered-sink",
        x: 300,
        y: index * 200,
        inputs: [port("wav", buffered("audio/wav"))],
      })),
      ...["preview", "transcribe"].map((id, index) => ({
        id,
        label: id,
        kind: "audio.streamed-sink",
        x: 300,
        y: 400 + index * 200,
        inputs: [port("chunks", streamed("audio/wav"))],
      })),
    ],
    edges: [],
  };
}

describe("output fan-out", () => {
  test("connects one buffered and one streamed output to two compatible inputs each", () => {
    let document = fanOutDocument();
    const targets = [
      ["wav", "archive", "wav"],
      ["wav", "waveform", "wav"],
      ["chunks", "preview", "chunks"],
      ["chunks", "transcribe", "chunks"],
    ] as const;

    for (const [sourcePortId, targetNodeId, targetPortId] of targets) {
      const next = { sourceNodeId: "wav-source", sourcePortId, targetNodeId, targetPortId };
      expect(validateWorkflowEditorConnection(document, next)).toEqual({ valid: true });
      document = connectWorkflowEditorNodes(document, next);
    }

    expect(document.nodes).toHaveLength(5);
    expect(document.edges).toHaveLength(4);
    expect(document.edges.filter((edge) => edge.sourcePortId === "wav")).toHaveLength(2);
    expect(document.edges.filter((edge) => edge.sourcePortId === "chunks")).toHaveLength(2);
    expect(analyzeWorkflowEditorPortTypes(document)).toEqual([]);
  });

  test("rejects a cross-mode branch from a fanned-out output", () => {
    const document = connectWorkflowEditorNodes(fanOutDocument(), {
      sourceNodeId: "wav-source",
      sourcePortId: "chunks",
      targetNodeId: "preview",
      targetPortId: "chunks",
    });

    expect(
      validateWorkflowEditorConnection(document, {
        sourceNodeId: "wav-source",
        sourcePortId: "chunks",
        targetNodeId: "archive",
        targetPortId: "wav",
      }),
    ).toMatchObject({ valid: false, reason: "payload-mode-mismatch" });
  });
});

describe("whole-document analysis", () => {
  const edge: WorkflowEditorEdge = { id: "edge", ...connection };

  test("reports an existing cross-mode edge as an incompatible payload mode", () => {
    const diagnostics = analyzeWorkflowEditorPortTypes(
      pair(port("out", streamed("audio/wav")), port("in", buffered("audio/wav")), [edge]),
    );

    expect(diagnostics).toEqual([
      expect.objectContaining({
        type: "incompatible-payload-mode",
        edgeId: "edge",
        sourceNodeId: "source",
        sourcePortId: "out",
        targetNodeId: "target",
        targetPortId: "in",
      }),
    ]);
  });

  test("reports an existing edge with mismatched media types as an incompatible media type", () => {
    const diagnostics = analyzeWorkflowEditorPortTypes(
      pair(port("out", buffered("audio/wav")), port("in", buffered("image/png")), [edge]),
    );

    expect(diagnostics).toEqual([
      expect.objectContaining({ type: "incompatible-media-type", edgeId: "edge" }),
    ]);
  });

  test("does not report compatible binary edges", () => {
    expect(
      analyzeWorkflowEditorPortTypes(
        pair(port("out", streamed("audio/wav")), port("in", streamed("audio/*")), [edge]),
      ),
    ).toEqual([]);
  });
});

describe("payload shape validation", () => {
  test.each([
    ["an unknown mode", { mode: "chunked" }],
    ["a missing mode", { mediaType: "audio/wav" }],
    ["a non-string media type", { mode: "buffered", mediaType: 42 }],
    ["a non-object payload", "streamed"],
  ])("rejects %s", (_name, payload) => {
    const document = pair(port("out"), port("in"));
    (document.nodes[0]!.outputs![0] as unknown as { payload: unknown }).payload = payload;

    expect(() => normalizeWorkflowEditorDocument(document).document).toThrow(
      WorkflowEditorDocumentValidationError,
    );
    expect(() => normalizeWorkflowEditorDocument(document).document).toThrow(
      "Invalid workflow port payload at source.out",
    );
  });

  test("keeps valid payloads unchanged through normalization", () => {
    const normalized = normalizeWorkflowEditorDocument(
      pair(port("out", streamed("audio/wav")), port("in", buffered())),
    ).document;

    expect(payloadOf(normalized.nodes[0]?.outputs?.[0])).toEqual(streamed("audio/wav"));
    expect(payloadOf(normalized.nodes[1]?.inputs?.[0])).toEqual(buffered());
  });
});

describe("persistence and composition", () => {
  test("export and restore preserve port payloads exactly", () => {
    const document = connectWorkflowEditorNodes(fanOutDocument(), {
      sourceNodeId: "wav-source",
      sourcePortId: "chunks",
      targetNodeId: "preview",
      targetPortId: "chunks",
    });
    const file = buildWorkflowEditorDocumentFile(document, {
      exportedAt: "2026-10-17T00:00:00.000Z",
    });
    const restored = restoreWorkflowEditorDocumentFile(JSON.parse(JSON.stringify(file))).document;
    const source = restored.nodes.find((node) => node.id === "wav-source");

    expect(source?.outputs?.map(payloadOf)).toEqual([buffered("audio/wav"), streamed("audio/wav")]);
    expect(restored.nodes.find((node) => node.id === "preview")?.inputs?.map(payloadOf)).toEqual([
      streamed("audio/wav"),
    ]);
    expect(restored.edges).toHaveLength(1);
  });

  test("composition boundary ports keep the inner port payload", () => {
    const composed = createWorkflowEditorComposedNode(fanOutDocument(), ["wav-source"], {
      id: "composed",
      label: "Composed source",
    });

    expect(composed).not.toBeNull();
    const outputs = composed!.outputs ?? [];
    expect(outputs).toHaveLength(2);
    expect(outputs.map(payloadOf)).toEqual([buffered("audio/wav"), streamed("audio/wav")]);
  });
});

describe("compilation", () => {
  test("copies payload onto compiled ports only when declared", () => {
    const compiled = compileWorkflowEditorDocument({
      nodes: [
        {
          id: "source",
          label: "Source",
          kind: "audio.source",
          x: 0,
          y: 0,
          outputs: [port("out", streamed("audio/wav")), port("plain", undefined, native("string"))],
        },
        {
          id: "target",
          label: "Target",
          kind: "audio.sink",
          x: 300,
          y: 0,
          inputs: [port("in", streamed("audio/*"))],
        },
      ],
      edges: [{ id: "edge", ...connection }],
    });
    const [streamedOutput, plainOutput] = compiled.nodes[0]?.outputs ?? [];

    expect(streamedOutput).toEqual({
      id: "out",
      type: bytes,
      payload: { mode: "streamed", mediaType: "audio/wav" },
    });
    expect(plainOutput).toEqual({ id: "plain", type: native("string") });
    expect(plainOutput).not.toHaveProperty("payload");
    expect(compiled.nodes[1]?.inputs).toEqual([
      { id: "in", type: bytes, payload: { mode: "streamed", mediaType: "audio/*" } },
    ]);
  });
});
