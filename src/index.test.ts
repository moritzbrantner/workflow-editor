import { describe, expect, test } from "vitest";

import { GraphCanvas, GraphNode, normalizeGraphEditorDocument } from "@moritzbrantner/graph-editor";
import * as workflowEditorPackage from "@moritzbrantner/workflow-editor";
import {
  WorkflowEditor,
  WorkflowWorkbench,
  connectWorkflowEditorNodes,
  createWorkflowEditorHistory,
  createWorkflowEditorLibrary,
  encodeWorkflowEditorSharePayload,
  layoutWorkflowEditorDocument,
  normalizeWorkflowEditorDocument,
  toUiWorkflowBuilderNodes,
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
    expect(typeof toUiWorkflowBuilderNodes).toBe("function");
  });

  test("keeps generic graph exports in the graph-editor package", () => {
    expect(typeof GraphCanvas).toBe("function");
    expect(typeof GraphNode).toBe("function");
    expect(typeof normalizeGraphEditorDocument).toBe("function");
    expect("GraphCanvas" in workflowEditorPackage).toBe(false);
    expect("normalizeGraphEditorDocument" in workflowEditorPackage).toBe(false);
  });
});
