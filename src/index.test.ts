import { describe, expect, test } from "vitest";

import {
  WorkflowEditor,
  WorkflowWorkbench,
  connectWorkflowEditorNodes,
  createWorkflowEditorHistory,
  createWorkflowEditorLibrary,
  encodeWorkflowEditorSharePayload,
  layoutWorkflowEditorDocument,
  normalizeWorkflowEditorDocument,
} from "@moritzbrantner/workflow-editor";

describe("@moritzbrantner/workflow-editor root exports", () => {
  test("exposes the documented root API surface", () => {
    expect(typeof WorkflowEditor).toBe("function");
    expect(typeof WorkflowWorkbench).toBe("function");
    expect(typeof normalizeWorkflowEditorDocument).toBe("function");
    expect(typeof connectWorkflowEditorNodes).toBe("function");
    expect(typeof layoutWorkflowEditorDocument).toBe("function");
    expect(typeof createWorkflowEditorHistory).toBe("function");
    expect(typeof createWorkflowEditorLibrary).toBe("function");
    expect(typeof encodeWorkflowEditorSharePayload).toBe("function");
  });
});
