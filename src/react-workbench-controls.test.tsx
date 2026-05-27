import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import {
  WorkflowEditor,
  WorkflowWorkbench,
  addWorkflowEditorArrayConstructorInput,
  addWorkflowEditorObjectDecompositionOutput,
  addWorkflowEditorObjectConstructorInput,
  createWorkflowEditorEntry,
  createWorkflowEditorLibrary,
  getWorkflowEditorArrayConstructorInputs,
  getWorkflowEditorObjectConstructorInputs,
  getWorkflowEditorObjectDecompositionOutputs,
  normalizeWorkflowEditorDocument,
  workflowEditorJsonNodeTemplates,
  type WorkflowEditorDocument,
  type WorkflowEditorSelectionState,
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

function StatefulWorkbench({
  initialDocument = document,
  initialSelection = { nodeIds: [], edgeIds: [] },
  readOnly = false,
  documentReferences,
}: {
  initialDocument?: WorkflowEditorDocument;
  initialSelection?: WorkflowEditorSelectionState;
  readOnly?: boolean;
  documentReferences?: Array<{ id: string; name: string }>;
}) {
  const [currentDocument, setCurrentDocument] = useState(initialDocument);
  const [selection, setSelection] = useState(initialSelection);

  return (
    <>
      <WorkflowWorkbench
        document={currentDocument}
        selectedNodeIds={selection.nodeIds}
        selectedEdgeIds={selection.edgeIds}
        readOnly={readOnly}
        documentReferences={documentReferences}
        onDocumentChange={setCurrentDocument}
        onSelectionStateChange={setSelection}
      />
      <pre data-testid="stateful-document-json">{JSON.stringify(currentDocument)}</pre>
      <pre data-testid="stateful-selection-json">{JSON.stringify(selection)}</pre>
    </>
  );
}

function readStatefulDocument() {
  return JSON.parse(screen.getByTestId("stateful-document-json").textContent ?? "") as
    | WorkflowEditorDocument
    | never;
}

function readStatefulSelection() {
  return JSON.parse(screen.getByTestId("stateful-selection-json").textContent ?? "") as
    | WorkflowEditorSelectionState
    | never;
}

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

describe("@moritzbrantner/workflow-editor React workbench", () => {
  test("handles keyboard mutation shortcuts, clipboard shortcuts, and escape", async () => {
    render(
      <StatefulWorkbench
        initialSelection={{
          nodeIds: ["input", "transform"],
          edgeIds: [],
          primary: { type: "node", id: "transform" },
        }}
      />,
    );

    fireEvent.keyDown(window, { key: "d", metaKey: true });
    expect(readStatefulDocument().nodes.map((node) => node.id)).toEqual(
      expect.arrayContaining(["input-copy", "transform-copy"]),
    );
    expect(readStatefulDocument().edges).toHaveLength(2);

    fireEvent.keyDown(window, { key: "c", metaKey: true });
    fireEvent.keyDown(window, { key: "v", metaKey: true });
    await waitFor(() => expect(readStatefulDocument().nodes).toHaveLength(7));
    expect(readStatefulDocument().edges).toHaveLength(3);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(readStatefulSelection()).toEqual({ nodeIds: [], edgeIds: [] });
  });

  test("deletes selected nodes and edges from keyboard shortcuts", () => {
    const { unmount } = render(
      <StatefulWorkbench
        initialSelection={{
          nodeIds: ["input"],
          edgeIds: [],
          primary: { type: "node", id: "input" },
        }}
      />,
    );

    fireEvent.keyDown(window, { key: "Backspace" });
    expect(readStatefulDocument().nodes.map((node) => node.id)).toEqual(["transform", "output"]);
    expect(readStatefulDocument().edges).toHaveLength(0);

    unmount();
    render(
      <StatefulWorkbench
        initialSelection={{
          nodeIds: [],
          edgeIds: ["input-transform"],
          primary: { type: "edge", id: "input-transform" },
        }}
      />,
    );

    fireEvent.keyDown(window, { key: "Delete" });
    expect(readStatefulDocument().nodes).toHaveLength(3);
    expect(readStatefulDocument().edges).toHaveLength(0);
  });

  test("ignores global shortcuts from editable inspector fields", () => {
    render(
      <StatefulWorkbench
        initialSelection={{
          nodeIds: ["input"],
          edgeIds: [],
          primary: { type: "node", id: "input" },
        }}
      />,
    );

    const labelInput = screen.getAllByLabelText("Label")[0]!;
    fireEvent.keyDown(labelInput, { key: "Backspace" });
    fireEvent.keyDown(labelInput, { key: "d", metaKey: true });

    expect(readStatefulDocument().nodes).toHaveLength(3);
    expect(readStatefulDocument().edges).toHaveLength(1);
  });

  test("blocks keyboard graph mutations in read-only mode", () => {
    const handleDocumentChange = vi.fn();
    render(
      <WorkflowWorkbench
        document={document}
        selectedNodeIds={["input"]}
        readOnly
        onDocumentChange={handleDocumentChange}
      />,
    );

    fireEvent.keyDown(window, { key: "Delete" });
    fireEvent.keyDown(window, { key: "Backspace" });
    fireEvent.keyDown(window, { key: "d", metaKey: true });
    fireEvent.keyDown(window, { key: "v", metaKey: true });

    expect(handleDocumentChange).not.toHaveBeenCalled();
  });

  test("edits edge status from the default inspector", () => {
    const handleDocumentChange = vi.fn();
    render(
      <WorkflowWorkbench
        document={document}
        selectedEdgeId="input-transform"
        onDocumentChange={handleDocumentChange}
      />,
    );

    expect(screen.getAllByText("Workflow edge")).not.toHaveLength(0);
    fireEvent.change(screen.getAllByLabelText("Status")[0]!, { target: { value: "success" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Apply" })[0]!);

    expect(handleDocumentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        edges: [
          expect.objectContaining({
            id: "input-transform",
            status: "success",
          }),
        ],
      }),
    );
  });

  test("ignores invalid UI connection attempts without mutating the document", () => {
    const handleDocumentChange = vi.fn();
    const typedDocument = normalizeWorkflowEditorDocument({
      nodes: [
        {
          id: "source",
          label: "Source",
          x: 0,
          y: 0,
          outputs: [{ id: "out", label: "Out", type: { kind: "string" } }],
        },
        {
          id: "target",
          label: "Target",
          x: 240,
          y: 0,
          inputs: [{ id: "in", label: "In", type: { kind: "number" } }],
        },
      ],
      edges: [],
    });

    render(<WorkflowWorkbench document={typedDocument} onDocumentChange={handleDocumentChange} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Start Source Out" })[0]!);
    fireEvent.click(screen.getAllByRole("button", { name: "Connect to Target In" })[0]!);

    expect(handleDocumentChange).not.toHaveBeenCalled();
  });

  test("commits TypeScript-assignable UI connection attempts through any inputs", async () => {
    const handleDocumentChange = vi.fn();
    const typedDocument = normalizeWorkflowEditorDocument({
      nodes: [
        {
          id: "source",
          label: "Source",
          x: 0,
          y: 0,
          outputs: [{ id: "out", label: "Out", type: { kind: "number" } }],
        },
        {
          id: "target",
          label: "Target",
          x: 240,
          y: 0,
          inputs: [{ id: "in", label: "In", type: { kind: "any" } }],
        },
      ],
      edges: [],
    });

    render(<WorkflowWorkbench document={typedDocument} onDocumentChange={handleDocumentChange} />);

    fireEvent.click(screen.getAllByRole("button", { name: "Start Source Out" })[0]!);
    await waitFor(() =>
      expect(
        (screen.getAllByRole("button", { name: "Connect to Target In" })[0]! as HTMLButtonElement)
          .disabled,
      ).toBe(false),
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Connect to Target In" })[0]!);

    await waitFor(() => expect(handleDocumentChange).toHaveBeenCalledTimes(1));
    expect(handleDocumentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        edges: [
          expect.objectContaining({
            id: "source:out->target:in",
            sourceNodeId: "source",
            sourcePortId: "out",
            targetNodeId: "target",
            targetPortId: "in",
          }),
        ],
      }),
    );
  });

  test("clears workflow references back to none from the default inspector", () => {
    const referencedDocument = normalizeWorkflowEditorDocument({
      ...document,
      nodes: [
        { ...document.nodes[0]!, workflowRef: { documentId: "child" } },
        document.nodes[1]!,
        document.nodes[2]!,
      ],
    });
    const handleDocumentChange = vi.fn();
    render(
      <WorkflowWorkbench
        document={referencedDocument}
        selectedNodeId="input"
        documentReferences={[{ id: "child", name: "Child workflow" }]}
        onDocumentChange={handleDocumentChange}
      />,
    );

    fireEvent.click(screen.getAllByLabelText("Workflow document")[0]!);
    fireEvent.click(screen.getByRole("option", { name: "None" }));
    fireEvent.click(
      screen
        .getAllByRole("button", { name: "Apply" })
        .find((button) => !(button as HTMLButtonElement).disabled)!,
    );

    expect(handleDocumentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: expect.arrayContaining([
          expect.objectContaining({
            id: "input",
            workflowRef: undefined,
          }),
        ]),
      }),
    );
  });

  test("updates node coordinates with valid numbers and ignores invalid values", () => {
    const handleDocumentChange = vi.fn();
    render(
      <WorkflowWorkbench
        document={document}
        selectedNodeId="input"
        onDocumentChange={handleDocumentChange}
      />,
    );

    fireEvent.change(screen.getAllByLabelText("X")[0]!, { target: { value: "120" } });
    fireEvent.change(screen.getAllByLabelText("Y")[0]!, { target: { value: "not-a-number" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Apply" })[0]!);

    expect(handleDocumentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: expect.arrayContaining([
          expect.objectContaining({
            id: "input",
            x: 120,
            y: 0,
          }),
        ]),
      }),
    );
  });

  test("adds and removes JSON composition ports from inspector controls", () => {
    const arrayTemplate = workflowEditorJsonNodeTemplates.find(
      (template) => template.id === "json-array",
    )!;
    const objectTemplate = workflowEditorJsonNodeTemplates.find(
      (template) => template.id === "json-object",
    )!;
    const decomposeTemplate = workflowEditorJsonNodeTemplates.find(
      (template) => template.id === "json-object-decompose",
    )!;
    const objectDocument = normalizeWorkflowEditorDocument<Record<string, unknown>>({
      nodes: [
        { ...arrayTemplate, id: "array", x: -280, y: 0 },
        { ...objectTemplate, id: "object", x: 0, y: 0 },
        { ...decomposeTemplate, id: "decompose", x: 280, y: 0 },
      ],
      edges: [],
    });
    const renderedObject = render(
      <StatefulWorkbench
        initialDocument={objectDocument}
        initialSelection={{
          nodeIds: ["object"],
          edgeIds: [],
          primary: { type: "node", id: "object" },
        }}
      />,
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Add property input" })[0]!);
    expect(
      getWorkflowEditorObjectConstructorInputs(
        readStatefulDocument().nodes.find((node) => node.id === "object")!,
      ),
    ).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Remove property input property" }));
    expect(
      getWorkflowEditorObjectConstructorInputs(
        readStatefulDocument().nodes.find((node) => node.id === "object")!,
      ),
    ).toHaveLength(0);

    const updatedDocument = readStatefulDocument();
    renderedObject.unmount();
    const renderedDecompose = render(
      <StatefulWorkbench
        initialDocument={updatedDocument}
        initialSelection={{
          nodeIds: ["decompose"],
          edgeIds: [],
          primary: { type: "node", id: "decompose" },
        }}
      />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Add property output" })[0]!);
    expect(
      getWorkflowEditorObjectDecompositionOutputs(
        readStatefulDocument().nodes.find((node) => node.id === "decompose")!,
      ),
    ).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Remove property output property" }));
    expect(
      getWorkflowEditorObjectDecompositionOutputs(
        readStatefulDocument().nodes.find((node) => node.id === "decompose")!,
      ),
    ).toHaveLength(0);

    const decomposeUpdatedDocument = readStatefulDocument();
    renderedDecompose.unmount();
    render(
      <StatefulWorkbench
        initialDocument={decomposeUpdatedDocument}
        initialSelection={{
          nodeIds: ["array"],
          edgeIds: [],
          primary: { type: "node", id: "array" },
        }}
      />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: "Add item input" })[0]!);
    expect(
      getWorkflowEditorArrayConstructorInputs(
        readStatefulDocument().nodes.find((node) => node.id === "array")!,
      ),
    ).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Remove array item 1" }));
    expect(
      getWorkflowEditorArrayConstructorInputs(
        readStatefulDocument().nodes.find((node) => node.id === "array")!,
      ),
    ).toHaveLength(0);
  });

  test("disables JSON dynamic inspector controls in read-only mode", () => {
    const arrayTemplate = workflowEditorJsonNodeTemplates.find(
      (template) => template.id === "json-array",
    )!;
    const objectTemplate = workflowEditorJsonNodeTemplates.find(
      (template) => template.id === "json-object",
    )!;
    const decomposeTemplate = workflowEditorJsonNodeTemplates.find(
      (template) => template.id === "json-object-decompose",
    )!;
    let readonlyDocument = normalizeWorkflowEditorDocument<Record<string, unknown>>({
      nodes: [
        { ...arrayTemplate, id: "array", x: -280, y: 0 },
        { ...objectTemplate, id: "object", x: 0, y: 0 },
        { ...decomposeTemplate, id: "decompose", x: 280, y: 0 },
      ],
      edges: [],
    });

    readonlyDocument = addWorkflowEditorArrayConstructorInput(readonlyDocument, "array");
    readonlyDocument = addWorkflowEditorObjectConstructorInput(readonlyDocument, "object");
    readonlyDocument = addWorkflowEditorObjectDecompositionOutput(readonlyDocument, "decompose");

    const renderedObject = render(
      <StatefulWorkbench
        initialDocument={readonlyDocument}
        readOnly
        initialSelection={{
          nodeIds: ["object"],
          edgeIds: [],
          primary: { type: "node", id: "object" },
        }}
      />,
    );

    expect(
      (screen.getByRole("button", { name: "Add property input" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Remove property input property" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    renderedObject.unmount();
    const renderedDecompose = render(
      <StatefulWorkbench
        initialDocument={readonlyDocument}
        readOnly
        initialSelection={{
          nodeIds: ["decompose"],
          edgeIds: [],
          primary: { type: "node", id: "decompose" },
        }}
      />,
    );

    expect(
      (screen.getByRole("button", { name: "Add property output" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Remove property output property" }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    renderedDecompose.unmount();
    render(
      <StatefulWorkbench
        initialDocument={readonlyDocument}
        readOnly
        initialSelection={{
          nodeIds: ["array"],
          edgeIds: [],
          primary: { type: "node", id: "array" },
        }}
      />,
    );

    expect(
      (screen.getByRole("button", { name: "Add item input" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole("button", { name: "Remove array item 1" }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  test("creates and opens referenced workflows with breadcrumbs in the editor shell", async () => {
    const handlePathChange = vi.fn();
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
      ],
    });

    render(
      <WorkflowEditor
        initialLibrary={initialLibrary}
        storage={storage}
        onDocumentPathChange={handlePathChange}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId("active-node-count").textContent).toBe("3 nodes"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Input" }));
    fireEvent.click(
      screen
        .getAllByRole("button", { name: "Create nested workflow" })
        .find((button) => !(button as HTMLButtonElement).disabled)!,
    );

    await waitFor(() =>
      expect(screen.getByTestId("active-node-count").textContent).toBe("0 nodes"),
    );
    expect((screen.getByRole("button", { name: "Parent" }) as HTMLButtonElement).disabled).toBe(
      false,
    );
    expect(
      (screen.getByRole("button", { name: "Input Workflow" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(handlePathChange).toHaveBeenLastCalledWith([
      { documentId: "parent" },
      expect.objectContaining({ documentId: expect.stringMatching(/^workflow-/) }),
    ]);

    fireEvent.click(screen.getByRole("button", { name: "Parent" }));
    await waitFor(() =>
      expect(screen.getByTestId("active-node-count").textContent).toBe("3 nodes"),
    );
  });

  test("allows recursive drill-in until the configured editor depth", async () => {
    const storage = {
      loadLibrary: vi.fn(async () => null),
      saveLibrary: vi.fn(async () => {}),
    };
    const recursiveDocument = normalizeWorkflowEditorDocument({
      nodes: [
        {
          id: "self",
          label: "Self",
          x: 0,
          y: 0,
          workflowRef: { documentId: "recursive" },
        },
      ],
      edges: [],
    });
    const initialLibrary = createWorkflowEditorLibrary({
      activeDocumentId: "recursive",
      documents: [
        createWorkflowEditorEntry({
          id: "recursive",
          name: "Recursive",
          document: recursiveDocument,
        }),
      ],
    });

    render(
      <WorkflowEditor
        initialLibrary={initialLibrary}
        storage={storage}
        maxNestedWorkflowDepth={2}
      />,
    );

    await waitFor(() =>
      expect(screen.getByTestId("active-node-count").textContent).toBe("1 nodes"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Self" }));
    fireEvent.click(
      screen
        .getAllByRole("button", { name: "Open workflow" })
        .find((button) => !(button as HTMLButtonElement).disabled)!,
    );
    await waitFor(() =>
      expect(screen.getAllByRole("button", { name: "Recursive" })).toHaveLength(2),
    );
    fireEvent.click(screen.getByRole("button", { name: "Self" }));
    const cappedOpenButtons = screen.queryAllByRole("button", { name: "Open workflow" });
    expect(cappedOpenButtons.every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
  });
});
