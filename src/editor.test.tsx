import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import {
  WorkflowEditor,
  createWorkflowEditorEntry,
  createWorkflowEditorLibrary,
  normalizeWorkflowEditorDocument,
  type WorkflowEditorDocument,
} from "@moritzbrantner/workflow-editor";

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

beforeAll(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserver {
      disconnect() {}
      observe() {}
      unobserve() {}
    },
  );
  Element.prototype.scrollIntoView = vi.fn();
});

afterEach(() => {
  cleanup();
});

describe("@moritzbrantner/workflow-editor editor shell", () => {
  test("manages documents, versions, and history", async () => {
    const storage = {
      loadLibrary: vi.fn(async () => null),
      saveLibrary: vi.fn(async () => {}),
    };
    const initialLibrary = createWorkflowEditorLibrary({
      activeDocumentId: "parent",
      documents: [
        createWorkflowEditorEntry({
          id: "parent",
          name: "Parent",
          document,
        }),
        createWorkflowEditorEntry({
          id: "secondary",
          name: "Secondary",
          document: normalizeWorkflowEditorDocument({ nodes: [], edges: [] }),
        }),
      ],
    });

    render(
      <WorkflowEditor
        initialLibrary={initialLibrary}
        storage={storage}
        nodeTemplates={[{ id: "decision", label: "Decision" }]}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId("active-node-count").textContent).toBe("3 nodes"),
    );

    fireEvent.change(screen.getByLabelText("Document name"), {
      target: { value: "Renamed parent" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Rename" }));
    await waitFor(() =>
      expect(screen.getByRole("option", { name: "Renamed parent" })).not.toBeNull(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Save version" }));
    await waitFor(() =>
      expect(screen.getAllByRole("option", { name: /Renamed parent/u }).length).toBeGreaterThan(1),
    );

    fireEvent.click(screen.getAllByRole("button", { name: /Decision/u })[0]!);
    await waitFor(() =>
      expect(screen.getByTestId("active-node-count").textContent).toBe("4 nodes"),
    );

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() =>
      expect(screen.getByTestId("active-node-count").textContent).toBe("3 nodes"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Redo" }));
    await waitFor(() =>
      expect(screen.getByTestId("active-node-count").textContent).toBe("4 nodes"),
    );

    fireEvent.click(screen.getByRole("button", { name: "Restore version" }));
    await waitFor(() =>
      expect(screen.getByTestId("active-node-count").textContent).toBe("3 nodes"),
    );

    fireEvent.click(screen.getByRole("button", { name: "Duplicate document" }));
    await waitFor(() =>
      expect(screen.getByRole("option", { name: "Renamed parent Copy" })).not.toBeNull(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete document" }));
    await waitFor(() =>
      expect(screen.queryByRole("option", { name: "Renamed parent Copy" })).toBeNull(),
    );

    fireEvent.click(screen.getByRole("button", { name: "New" }));
    await waitFor(() =>
      expect(screen.getByTestId("active-node-count").textContent).toBe("0 nodes"),
    );
  });

  test("reports storage load and save failures", async () => {
    const loadError = new Error("load failed");
    const handleLoadError = vi.fn();

    render(
      <WorkflowEditor
        storage={{
          loadLibrary: vi.fn(async () => {
            throw loadError;
          }),
          saveLibrary: vi.fn(async () => {}),
        }}
        onError={handleLoadError}
      />,
    );

    await waitFor(() => expect(handleLoadError).toHaveBeenCalledWith(loadError));
    cleanup();

    const saveError = new Error("save failed");
    const handleSaveError = vi.fn();

    render(
      <WorkflowEditor
        storage={{
          loadLibrary: vi.fn(async () => null),
          saveLibrary: vi.fn(async () => {
            throw saveError;
          }),
        }}
        onError={handleSaveError}
      />,
    );

    await waitFor(() => expect(handleSaveError).toHaveBeenCalledWith(saveError));
    expect(screen.getByTestId("save-state").textContent).toBe("Save error");
  });
});
