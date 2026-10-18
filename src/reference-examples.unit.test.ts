import { describe, expect, it } from "vitest";

import {
  dataPipelineDocument,
  dataPipelineInvalidConnection,
  mediaPipelineDocument,
  mediaPipelineInvalidConnection,
} from "../examples/workbench/src/reference-examples";
import { compileWorkflowEditorDocument } from "./compiler";
import {
  analyzeWorkflowEditorPortTypes,
  getWorkflowEditorInputDeclarations,
  resolveWorkflowEditorInputValues,
  validateWorkflowEditorConnection,
  validateWorkflowEditorInputValues,
} from "./core";

describe.each([
  ["data pipeline", dataPipelineDocument, dataPipelineInvalidConnection],
  ["AI/media pipeline", mediaPipelineDocument, mediaPipelineInvalidConnection],
])("%s reference example", (_name, build, invalidConnection) => {
  it("is deterministic, type-correct and compiles", () => {
    const document = build();
    expect(build()).toEqual(document);
    expect(
      analyzeWorkflowEditorPortTypes(document).filter(
        (diagnostic) => diagnostic.type === "incompatible-port-type",
      ),
    ).toEqual([]);
    const compiled = compileWorkflowEditorDocument(document);
    expect(compiled.order).toHaveLength(document.nodes.length);
  });

  it("rejects its intentionally invalid connection with a type reason", () => {
    const result = validateWorkflowEditorConnection(build(), invalidConnection);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("type-mismatch");
  });
});

it("keeps the media generation step one opaque external operation", () => {
  const generate = mediaPipelineDocument().nodes.find((node) => node.id === "generate");
  expect(generate?.kind).toBe("asset.operation");
  expect(generate?.data).toMatchObject({
    assetOperation: { id: "image.comfyui.generate", parameters: { provider: "comfyui" } },
  });
});

describe("data pipeline inputs (#115)", () => {
  it("declares a required export date and a defaulted currency", () => {
    const document = dataPipelineDocument();
    expect(
      getWorkflowEditorInputDeclarations(document).map(({ id, required, defaultValue }) => ({
        id,
        required,
        defaultValue,
      })),
    ).toEqual([
      { id: "exportDate", required: true, defaultValue: undefined },
      { id: "currency", required: false, defaultValue: "EUR" },
    ]);
    expect(
      validateWorkflowEditorInputValues(document, { currency: "GBP" }).map(
        (diagnostic) => diagnostic.code,
      ),
    ).toEqual(["missing-input", "invalid-input-type"]);
    expect(validateWorkflowEditorInputValues(document, { exportDate: "2026-10-18" })).toEqual([]);
    expect(resolveWorkflowEditorInputValues(document, { exportDate: "2026-10-18" })).toEqual({
      exportDate: "2026-10-18",
      currency: "EUR",
    });
  });
});
