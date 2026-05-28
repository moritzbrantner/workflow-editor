import { describe, expect, test } from "vitest";

import {
  normalizeWorkflowEditorDocument,
  type WorkflowEditorDocument,
} from "@moritzbrantner/workflow-editor/core";
import {
  decodeWorkflowEditorSharePayload,
  encodeWorkflowEditorSharePayload,
} from "@moritzbrantner/workflow-editor/share";

const document: WorkflowEditorDocument = normalizeWorkflowEditorDocument({
  nodes: [
    {
      id: "input",
      label: "Input",
      x: 0,
      y: 0,
      outputs: [{ id: "out", label: "Out", type: { kind: "string" } }],
    },
    {
      id: "transform",
      label: "Transform",
      x: 240,
      y: 0,
      inputs: [{ id: "in", label: "In", type: { kind: "string" } }],
      outputs: [{ id: "out", label: "Out", type: { kind: "string" } }],
    },
    {
      id: "output",
      label: "Output",
      x: 480,
      y: 0,
      inputs: [{ id: "in", label: "In", type: { kind: "string" } }],
    },
  ],
  edges: [
    {
      id: "input-transform",
      sourceNodeId: "input",
      sourcePortId: "out",
      targetNodeId: "transform",
      targetPortId: "in",
    },
  ],
});

describe("@moritzbrantner/workflow-editor share", () => {
  test("encodes and decodes plain workflow share payloads", async () => {
    const token = await encodeWorkflowEditorSharePayload({ document });
    expect(token.startsWith("plain.")).toBe(true);
    await expect(decodeWorkflowEditorSharePayload(token)).resolves.toMatchObject({
      document: {
        nodes: expect.arrayContaining([expect.objectContaining({ id: "input" })]),
      },
    });
  });

  test("rejects invalid workflow share payloads", async () => {
    await expect(decodeWorkflowEditorSharePayload("bad")).rejects.toThrow("invalid");
    await expect(decodeWorkflowEditorSharePayload("unknown.payload")).rejects.toThrow(
      "unknown encoding",
    );
  });
});
