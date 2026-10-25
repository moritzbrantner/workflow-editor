import { describe, expect, it } from "vitest";

import {
  agentWorkflowDocument,
  agentWorkflowInvalidConnection,
  backendOrchestrationDocument,
  backendOrchestrationInvalidConnection,
  backendOrchestrationRecordedRun,
  crmTypeDefinitions,
  dataPipelineDocument,
  dataPipelineInvalidConnection,
  enrichLeadDocument,
  enrichLeadExampleId,
  leadIntakeDocument,
  leadIntakeInvalidConnection,
  mediaPipelineDocument,
  mediaPipelineInvalidConnection,
} from "../examples/workbench/src/reference-examples";
import { compileWorkflowEditorDocument } from "./compiler";
import {
  createWorkflowEditorEntry,
  createWorkflowEditorLibrary,
  createWorkflowEditorLibraryReferenceResolver,
} from "./persistence";
import {
  analyzeWorkflowEditorPortTypes,
  createWorkflowExecutionSnapshotFromRunnerEvents,
  getWorkflowEditorInputDeclarations,
  resolveWorkflowEditorInputValues,
  validateWorkflowEditorConnection,
  validateWorkflowEditorInputValues,
} from "./core";

// Lead Intake references the nested Enrich Lead workflow through the workbench library.
const crmOptions = {
  typeDefinitions: crmTypeDefinitions,
  resolveWorkflowReference: createWorkflowEditorLibraryReferenceResolver(
    createWorkflowEditorLibrary({
      documents: [
        createWorkflowEditorEntry({
          id: enrichLeadExampleId,
          name: "Enrich Lead",
          document: enrichLeadDocument(),
        }),
      ],
    }),
  ),
};

describe.each([
  ["data pipeline", dataPipelineDocument, dataPipelineInvalidConnection, {}],
  ["AI/media pipeline", mediaPipelineDocument, mediaPipelineInvalidConnection, {}],
  ["agent workflow", agentWorkflowDocument, agentWorkflowInvalidConnection, {}],
  [
    "backend orchestration",
    backendOrchestrationDocument,
    backendOrchestrationInvalidConnection,
    {},
  ],
  ["CRM automation", leadIntakeDocument, leadIntakeInvalidConnection, crmOptions],
])("%s reference example", (_name, build, invalidConnection, options) => {
  it("is deterministic, type-correct and compiles", () => {
    const document = build();
    expect(build()).toEqual(document);
    expect(
      analyzeWorkflowEditorPortTypes(document, options).filter(
        (diagnostic) => diagnostic.type === "incompatible-port-type",
      ),
    ).toEqual([]);
    expect(document.nodes.every((node) => node.category)).toBe(true);
    const compiled = compileWorkflowEditorDocument(document, options);
    expect(compiled.nodes.length).toBeGreaterThanOrEqual(document.nodes.length);
  });

  it("rejects its intentionally invalid connection with a type reason", () => {
    const result = validateWorkflowEditorConnection(build(), invalidConnection, options);
    expect(result.valid).toBe(false);
    expect(result.reason).toBe("type-mismatch");
  });
});

it("routes the agent's failed tool call to a fallback and reviews the draft", () => {
  const document = agentWorkflowDocument();
  const compiled = compileWorkflowEditorDocument(document);
  const kinds = Object.fromEntries(compiled.nodes.map((node) => [node.id, node]));
  expect(kinds.review).toMatchObject({ humanTask: { kind: "approval" } });
  expect(kinds.correct).toMatchObject({ humanTask: { kind: "input" } });
  expect(document.edges).toContainEqual(
    expect.objectContaining({
      sourceNodeId: "search",
      sourcePortId: "error",
      targetNodeId: "fallback",
    }),
  );
});

it("folds the recorded backend run into an overlay for the example's own nodes", () => {
  const document = backendOrchestrationDocument();
  const snapshot = createWorkflowExecutionSnapshotFromRunnerEvents(
    backendOrchestrationRecordedRun,
    {
      mode: "historical",
    },
  )!;
  expect(snapshot).toMatchObject({ runId: "order-1042", state: "succeeded", mode: "historical" });
  expect(Object.keys(snapshot.nodes).sort()).toEqual(document.nodes.map((node) => node.id).sort());
  expect(snapshot.nodes.charge).toMatchObject({ state: "succeeded", attempt: 2 });
  expect(snapshot.nodes.cancel).toMatchObject({ state: "skipped" });
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
