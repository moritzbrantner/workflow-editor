import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getWorkflowNodeSize } from "./react/workflow-node";
import {
  selectionStateToSingleSelection,
  toggleWorkflowEditorSelectionItem,
} from "./react-selection";
import { formatShortcutLabel } from "./shortcut-label";
import {
  clampWorkflowOverlayPosition,
  getWorkflowOverlayMaxHeight,
  getWorkflowPalettePinnedStyle,
} from "./react/overlay-position";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import {
  WorkflowEditorComposedNodesPanel,
  WorkflowEditorCurrentNodeTypesPanel,
  WorkflowEditorCurrentNodesPanel,
  WorkflowWorkbench,
  WorkflowWorkbenchInspector,
  WorkflowWorkbenchOverlayPanel,
  WorkflowWorkbenchPalette,
  WorkflowWorkbenchToolbar,
  connectWorkflowEditorNodes,
  createWorkflowEditorGroup,
  findWorkflowEditorNode,
  getWorkflowEditorObjectConstructorInputs,
  normalizeWorkflowEditorDocument,
  toUiWorkflowBuilderNodes,
  useWorkflowWorkbenchController,
  workflowEditorJsonNodeTemplates,
  type WorkflowEditorDocument,
  type WorkflowEditorSelectionState,
  type WorkflowEditorTypeDefinition,
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
        selectedGroupIds={selection.groupIds}
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

function WorkbenchPanelHarness({
  initialDocument = document,
  panel,
}: {
  initialDocument?: WorkflowEditorDocument;
  panel: "nodes" | "types" | "composed";
}) {
  const [currentDocument, setCurrentDocument] = useState(initialDocument);
  const [selection, setSelection] = useState<WorkflowEditorSelectionState>({
    nodeIds: [],
    edgeIds: [],
  });
  const controller = useWorkflowWorkbenchController({
    document: currentDocument,
    selectedNodeIds: selection.nodeIds,
    selectedEdgeIds: selection.edgeIds,
    selectedGroupIds: selection.groupIds,
    onDocumentChange: setCurrentDocument,
    onSelectionStateChange: setSelection,
  });

  return (
    <>
      {panel === "nodes" ? <WorkflowEditorCurrentNodesPanel controller={controller} /> : null}
      {panel === "types" ? <WorkflowEditorCurrentNodeTypesPanel controller={controller} /> : null}
      {panel === "composed" ? <WorkflowEditorComposedNodesPanel controller={controller} /> : null}
      <pre data-testid="panel-document-json">{JSON.stringify(currentDocument)}</pre>
      <pre data-testid="panel-selection-json">{JSON.stringify(selection)}</pre>
    </>
  );
}

function ModularWorkbenchChromeHarness({
  initialDocument = document,
  initialSelection = { nodeIds: [], edgeIds: [] },
  readOnly = false,
  documentReferences,
  renderInspector,
  renderToolbarActions,
  nodeTemplates = [
    {
      id: "decision",
      label: "Decision",
      categoryPath: ["Logic", "Branching"],
    },
    {
      id: "delay",
      label: "Delay",
      category: "Timing",
    },
  ],
}: {
  initialDocument?: WorkflowEditorDocument;
  initialSelection?: WorkflowEditorSelectionState;
  readOnly?: boolean;
  documentReferences?: Array<{ id: string; name: string }>;
  renderInspector?: Parameters<typeof useWorkflowWorkbenchController>[0]["renderInspector"];
  renderToolbarActions?: Parameters<
    typeof useWorkflowWorkbenchController
  >[0]["renderToolbarActions"];
  nodeTemplates?: Parameters<typeof useWorkflowWorkbenchController>[0]["nodeTemplates"];
}) {
  const [currentDocument, setCurrentDocument] = useState(initialDocument);
  const [selection, setSelection] = useState(initialSelection);
  const controller = useWorkflowWorkbenchController({
    document: currentDocument,
    selectedNodeIds: selection.nodeIds,
    selectedEdgeIds: selection.edgeIds,
    selectedGroupIds: selection.groupIds,
    readOnly,
    nodeTemplates,
    documentReferences,
    renderInspector,
    renderToolbarActions,
    onDocumentChange: setCurrentDocument,
    onSelectionStateChange: setSelection,
  });

  return (
    <>
      <WorkflowWorkbenchToolbar controller={controller} />
      <WorkflowWorkbenchPalette controller={controller} />
      <WorkflowWorkbenchInspector controller={controller} />
      <WorkflowWorkbenchOverlayPanel className="custom-panel" style={{ left: 12, top: 18 }}>
        Overlay child
      </WorkflowWorkbenchOverlayPanel>
      <pre data-testid="modular-document-json">{JSON.stringify(currentDocument)}</pre>
      <pre data-testid="modular-selection-json">{JSON.stringify(selection)}</pre>
    </>
  );
}

function readPanelDocument() {
  return JSON.parse(screen.getByTestId("panel-document-json").textContent ?? "") as
    | WorkflowEditorDocument
    | never;
}

function readModularDocument() {
  return JSON.parse(screen.getByTestId("modular-document-json").textContent ?? "") as
    | WorkflowEditorDocument
    | never;
}

function readModularSelection() {
  return JSON.parse(screen.getByTestId("modular-selection-json").textContent ?? "") as
    | WorkflowEditorSelectionState
    | never;
}

function readPanelSelection() {
  return JSON.parse(screen.getByTestId("panel-selection-json").textContent ?? "") as
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
  test("maps and toggles workflow selection state branches", () => {
    expect(
      selectionStateToSingleSelection(document, {
        nodeIds: [],
        edgeIds: [],
        primary: { type: "node", id: "input" },
      }),
    ).toEqual(expect.objectContaining({ id: "input", type: "node" }));
    expect(
      selectionStateToSingleSelection(document, {
        nodeIds: [],
        edgeIds: [],
        primary: { type: "edge", id: "input-transform" },
      }),
    ).toEqual(expect.objectContaining({ id: "input-transform", type: "edge" }));
    expect(
      selectionStateToSingleSelection(document, {
        nodeIds: ["transform"],
        edgeIds: [],
        primary: { type: "node", id: "missing" },
      }),
    ).toBeNull();
    expect(selectionStateToSingleSelection(document, { nodeIds: ["output"], edgeIds: [] })).toEqual(
      expect.objectContaining({ id: "output", type: "node" }),
    );
    expect(
      selectionStateToSingleSelection(document, { nodeIds: [], edgeIds: ["input-transform"] }),
    ).toEqual(expect.objectContaining({ id: "input-transform", type: "edge" }));
    expect(selectionStateToSingleSelection(document, { nodeIds: [], edgeIds: [] })).toBeNull();

    expect(
      toggleWorkflowEditorSelectionItem(
        { nodeIds: ["input"], edgeIds: [], groupIds: ["group-1"] },
        { type: "node", id: "input" },
      ),
    ).toEqual({
      nodeIds: [],
      edgeIds: [],
      groupIds: ["group-1"],
      primary: { type: "node", id: "input" },
    });
    expect(
      toggleWorkflowEditorSelectionItem({ nodeIds: [], edgeIds: [] }, { type: "node", id: "input" })
        .nodeIds,
    ).toEqual(["input"]);
    expect(
      toggleWorkflowEditorSelectionItem(
        { nodeIds: [], edgeIds: ["input-transform"], groupIds: ["group-1"] },
        { type: "edge", id: "input-transform" },
      ),
    ).toEqual({
      nodeIds: [],
      edgeIds: [],
      groupIds: ["group-1"],
      primary: { type: "edge", id: "input-transform" },
    });
    expect(
      toggleWorkflowEditorSelectionItem(
        { nodeIds: [], edgeIds: [] },
        { type: "edge", id: "input-transform" },
      ).edgeIds,
    ).toEqual(["input-transform"]);
    expect(
      toggleWorkflowEditorSelectionItem(
        { nodeIds: [], edgeIds: [], groupIds: ["group-1"] },
        { type: "group", id: "group-1" },
      ),
    ).toEqual({
      nodeIds: [],
      edgeIds: [],
      primary: { type: "group", id: "group-1" },
    });
    expect(
      toggleWorkflowEditorSelectionItem(
        { nodeIds: [], edgeIds: [] },
        { type: "group", id: "group-1" },
      ).groupIds,
    ).toEqual(["group-1"]);
  });

  test("formats shortcut labels and computes overlay positioning branches", () => {
    expect(
      formatShortcutLabel("mod + ctrl + control + cmd + command + meta + alt + shift + x + enter"),
    ).toBe("Mod+Ctrl+Ctrl+Meta+Meta+Meta+Alt+Shift+X+Enter");

    const container = globalThis.document.createElement("div");
    const overlay = globalThis.document.createElement("div");
    container.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        right: 400,
        bottom: 300,
        width: 400,
        height: 300,
        x: 0,
        y: 0,
        toJSON: () => {},
      }) as DOMRect;
    overlay.getBoundingClientRect = () =>
      ({
        left: 0,
        top: 0,
        right: 120,
        bottom: 90,
        width: 120,
        height: 90,
        x: 0,
        y: 0,
        toJSON: () => {},
      }) as DOMRect;

    expect(clampWorkflowOverlayPosition({ x: -20, y: 500 }, container, overlay)).toEqual({
      x: 12,
      y: 198,
    });
    expect(clampWorkflowOverlayPosition({ x: 20, y: 20 }, null, overlay)).toEqual({
      x: 20,
      y: 20,
    });
    expect(
      clampWorkflowOverlayPosition({ x: 20, y: 20 }, container, overlay, {
        width: 0,
        height: 20,
      }),
    ).toEqual({ x: 20, y: 20 });
    expect(getWorkflowOverlayMaxHeight(-4)).toBe("calc(100% - 12px)");
    expect(getWorkflowPalettePinnedStyle("top-left")).toEqual({ left: "0.75rem", top: "0.75rem" });
    expect(getWorkflowPalettePinnedStyle("top-right")).toEqual({
      right: "0.75rem",
      top: "0.75rem",
    });
    expect(getWorkflowPalettePinnedStyle("bottom-left")).toEqual({
      bottom: "0.75rem",
      left: "0.75rem",
    });
    expect(getWorkflowPalettePinnedStyle("bottom-right")).toEqual({
      bottom: "0.75rem",
      right: "0.75rem",
    });
  });

  test("hides visible input and output headers in the workflow workbench", () => {
    render(<WorkflowWorkbench document={document} />);

    for (const header of [...screen.getAllByText("Inputs"), ...screen.getAllByText("Outputs")]) {
      expect(getComputedStyle(header).display).toBe("none");
    }
  });

  test("renders, selects, changes document state, and respects read-only mode", () => {
    const handleDocumentChange = vi.fn();
    const handleSelectionChange = vi.fn();
    const { rerender } = render(
      <WorkflowWorkbench
        document={document}
        selectedNodeId="input"
        nodeTemplates={[
          {
            id: "decision",
            label: "Decision",
            inputs: [{ id: "in", label: "In", type: { kind: "string" } }],
            outputs: [{ id: "out", label: "Out", type: { kind: "string" } }],
          },
        ]}
        renderNodeTemplate={(template) => template.label}
        onDocumentChange={handleDocumentChange}
        onSelectionChange={handleSelectionChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Input" }));
    expect(handleSelectionChange).toHaveBeenCalledWith(
      expect.objectContaining({ id: "input", type: "node" }),
    );

    fireEvent.click(screen.getAllByRole("button", { name: /Decision/ })[0]!);
    expect(handleDocumentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: expect.arrayContaining([expect.objectContaining({ id: "decision" })]),
      }),
    );

    handleDocumentChange.mockClear();
    rerender(
      <WorkflowWorkbench
        document={document}
        selectedNodeId="input"
        readOnly
        nodeTemplates={[{ id: "decision", label: "Decision" }]}
        renderNodeTemplate={(template) => template.label}
        onDocumentChange={handleDocumentChange}
      />,
    );
    fireEvent.click(screen.getAllByRole("button", { name: /Decision/ })[0]!);
    expect(handleDocumentChange).not.toHaveBeenCalled();
  });

  test("supports controlled multi-selection and keyboard selection shortcuts", () => {
    const handleSelectionStateChange = vi.fn();
    const handleSelectionChange = vi.fn();

    render(
      <WorkflowWorkbench
        document={document}
        selectedNodeIds={["input", "transform"]}
        onSelectionChange={handleSelectionChange}
        onSelectionStateChange={handleSelectionStateChange}
        renderInspector={(context) => (
          <div data-testid="selected-node-labels">
            {context.selectedNodes.map((node) => node.label).join(",")}
          </div>
        )}
      />,
    );

    expect(screen.getAllByTestId("selected-node-labels")[0]?.textContent).toBe("Input,Transform");
    expect(screen.getAllByTestId("selection-count")[0]?.textContent).toBe("2 selected");

    fireEvent.keyDown(window, { key: "a", metaKey: true });
    expect(handleSelectionStateChange).toHaveBeenLastCalledWith({
      nodeIds: ["input", "transform", "output"],
      edgeIds: [],
      primary: { type: "node", id: "output" },
    });
    expect(handleSelectionChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "output", type: "node" }),
    );
  });

  test("duplicates and arranges selected nodes from the workbench toolbar", () => {
    const handleDocumentChange = vi.fn();

    const { rerender } = render(
      <WorkflowWorkbench
        document={document}
        selectedNodeIds={["input", "transform"]}
        onDocumentChange={handleDocumentChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));
    expect(handleDocumentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: expect.arrayContaining([
          expect.objectContaining({ id: "input-copy" }),
          expect.objectContaining({ id: "transform-copy" }),
        ]),
        edges: expect.arrayContaining([
          expect.objectContaining({
            sourceNodeId: "input-copy",
            targetNodeId: "transform-copy",
          }),
        ]),
      }),
    );

    handleDocumentChange.mockClear();
    rerender(
      <WorkflowWorkbench
        document={document}
        selectedNodeIds={["input", "transform"]}
        onDocumentChange={handleDocumentChange}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Arrange selection" }));
    expect(handleDocumentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: expect.arrayContaining([
          expect.objectContaining({ id: "input", x: 0 }),
          expect.objectContaining({ id: "output", x: 480, y: 0 }),
        ]),
      }),
    );

    handleDocumentChange.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "Arrange all" }));
    expect(handleDocumentChange).toHaveBeenCalled();
  });

  test("groups and ungroups selected nodes from the workbench toolbar", async () => {
    render(
      <StatefulWorkbench
        initialSelection={{
          nodeIds: ["input", "transform"],
          edgeIds: [],
          primary: { type: "node", id: "transform" },
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Group", exact: true }));

    await waitFor(() => {
      expect(readStatefulDocument().groups).toEqual([
        expect.objectContaining({
          id: "group-1",
          label: "Group 1",
          nodeIds: ["input", "transform"],
        }),
      ]);
      expect(readStatefulSelection()).toEqual({
        nodeIds: [],
        edgeIds: [],
        groupIds: ["group-1"],
        primary: { type: "group", id: "group-1" },
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "Ungroup", exact: true }));

    await waitFor(() => {
      expect(readStatefulDocument().groups).toBeUndefined();
      expect(readStatefulSelection().nodeIds).toEqual(["input", "transform"]);
    });
  });

  test("selects and drags grouped nodes as a group", async () => {
    const groupedDocument = createWorkflowEditorGroup(document, ["input", "transform"]);
    render(<StatefulWorkbench initialDocument={groupedDocument} />);

    fireEvent.click(screen.getByRole("button", { name: "Input" }));

    await waitFor(() => {
      expect(readStatefulSelection()).toMatchObject({
        groupIds: ["group-1"],
        primary: { type: "group", id: "group-1" },
      });
    });

    const inputNode = globalThis.document.querySelector<HTMLElement>(
      "[data-slot='workflow-builder-node'][data-node-id='input']",
    )!;
    const surface = globalThis.document.querySelector<HTMLElement>(
      "[data-slot='workflow-builder-surface']",
    )!;

    fireEvent.mouseDown(inputNode, { button: 0, clientX: 0, clientY: 0 });
    fireEvent.mouseMove(surface, { clientX: 40, clientY: 24 });

    await waitFor(() => {
      expect(readStatefulDocument().nodes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: "input", x: 40, y: 24 }),
          expect.objectContaining({ id: "transform", x: 280, y: 24 }),
        ]),
      );
    });
  });

  test("minimizes grouped nodes into a compact group wrapper", async () => {
    const groupedDocument = createWorkflowEditorGroup(document, ["input", "transform"]);
    render(
      <StatefulWorkbench
        initialDocument={groupedDocument}
        initialSelection={{
          nodeIds: [],
          edgeIds: [],
          groupIds: ["group-1"],
          primary: { type: "group", id: "group-1" },
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Minimize Group 1 group" }));

    await waitFor(() => {
      expect(readStatefulDocument().groups?.[0]).toMatchObject({
        id: "group-1",
        minimized: true,
      });
    });

    expect(
      globalThis.document.querySelector(
        "[data-slot='workflow-builder-node'][data-node-id='input'][data-hidden='true']",
      ),
    ).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Expand Group 1 group" }));

    await waitFor(() => {
      expect(readStatefulDocument().groups?.[0]?.minimized).toBeUndefined();
    });
  });

  test("renames workflow nodes inline from the canvas", async () => {
    render(
      <StatefulWorkbench
        initialSelection={{
          nodeIds: ["input"],
          edgeIds: [],
          primary: { type: "node", id: "input" },
        }}
      />,
    );

    fireEvent.doubleClick(screen.getByRole("button", { name: "Input" }));

    const renameInput = screen.getByLabelText("Input node name") as HTMLInputElement;
    expect(renameInput.value).toBe("Input");

    fireEvent.change(renameInput, { target: { value: " Source " } });
    fireEvent.keyDown(renameInput, { key: "Enter" });

    await waitFor(() => {
      const nextDocument = readStatefulDocument();
      expect(nextDocument.nodes.find((node) => node.id === "input")).toEqual(
        expect.objectContaining({ id: "input", label: "Source" }),
      );
      expect(readStatefulSelection()).toEqual({
        nodeIds: ["input"],
        edgeIds: [],
        primary: { type: "node", id: "input" },
      });
    });
  });

  test("cancels inline node renames with Escape", () => {
    const handleDocumentChange = vi.fn();
    render(
      <WorkflowWorkbench
        document={document}
        selectedNodeId="input"
        onDocumentChange={handleDocumentChange}
      />,
    );

    fireEvent.doubleClick(screen.getByRole("button", { name: "Input" }));
    const renameInput = screen.getByLabelText("Input node name");
    fireEvent.change(renameInput, { target: { value: "Source" } });
    fireEvent.keyDown(renameInput, { key: "Escape" });

    expect(screen.queryByLabelText("Input node name")).toBeNull();
    expect(handleDocumentChange).not.toHaveBeenCalled();
  });

  test("commits inline node renames on blur", async () => {
    render(
      <StatefulWorkbench
        initialSelection={{
          nodeIds: ["input"],
          edgeIds: [],
          primary: { type: "node", id: "input" },
        }}
      />,
    );

    fireEvent.doubleClick(screen.getByRole("button", { name: "Input" }));
    const renameInput = screen.getByLabelText("Input node name");
    fireEvent.change(renameInput, { target: { value: "Source" } });
    fireEvent.blur(renameInput);

    await waitFor(() => {
      expect(readStatefulDocument().nodes.find((node) => node.id === "input")?.label).toBe(
        "Source",
      );
    });
  });

  test("keeps the existing label for empty inline node rename drafts", () => {
    const handleDocumentChange = vi.fn();
    render(
      <WorkflowWorkbench
        document={document}
        selectedNodeId="input"
        onDocumentChange={handleDocumentChange}
      />,
    );

    fireEvent.doubleClick(screen.getByRole("button", { name: "Input" }));
    const renameInput = screen.getByLabelText("Input node name");
    fireEvent.change(renameInput, { target: { value: "   " } });
    fireEvent.blur(renameInput);

    expect(screen.queryByLabelText("Input node name")).toBeNull();
    expect(handleDocumentChange).not.toHaveBeenCalled();
  });

  test("does not start inline node renames in read-only mode", () => {
    const handleDocumentChange = vi.fn();
    render(
      <WorkflowWorkbench
        document={document}
        selectedNodeId="input"
        readOnly
        onDocumentChange={handleDocumentChange}
      />,
    );

    fireEvent.doubleClick(screen.getByRole("button", { name: "Input" }));

    expect(screen.queryByLabelText("Input node name")).toBeNull();
    expect(handleDocumentChange).not.toHaveBeenCalled();
  });

  test("does not run graph shortcuts while editing inline node names", async () => {
    render(
      <StatefulWorkbench
        initialSelection={{
          nodeIds: ["input"],
          edgeIds: [],
          primary: { type: "node", id: "input" },
        }}
      />,
    );

    fireEvent.doubleClick(screen.getByRole("button", { name: "Input" }));
    const renameInput = screen.getByLabelText("Input node name");
    fireEvent.keyDown(renameInput, { key: "d", metaKey: true });
    fireEvent.change(renameInput, { target: { value: "Source" } });
    fireEvent.keyDown(renameInput, { key: "Enter" });

    await waitFor(() => {
      expect(readStatefulDocument().nodes).toHaveLength(3);
      expect(readStatefulDocument().nodes.find((node) => node.id === "input")?.label).toBe(
        "Source",
      );
    });
  });

  test("does not open nested workflows when double-clicking a node label to rename", () => {
    const handleOpenWorkflowReference = vi.fn();
    render(
      <WorkflowWorkbench
        document={normalizeWorkflowEditorDocument({
          nodes: [
            {
              ...document.nodes[0]!,
              workflowRef: { documentId: "child" },
            },
          ],
          edges: [],
        })}
        selectedNodeId="input"
        documentReferences={[{ id: "child", name: "Child workflow" }]}
        onOpenWorkflowReference={handleOpenWorkflowReference}
      />,
    );

    fireEvent.doubleClick(screen.getByRole("button", { name: "Input" }));

    expect(screen.getByLabelText("Input node name")).not.toBeNull();
    expect(handleOpenWorkflowReference).not.toHaveBeenCalled();
  });

  test("uses the visible node action menu for node deletion", async () => {
    render(<StatefulWorkbench />);

    expect(screen.queryByRole("button", { name: "Open Input menu" })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Input node actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));

    await waitFor(() => {
      expect(readStatefulDocument().nodes.map((node) => node.id)).toEqual(["transform", "output"]);
    });
  });

  test("snaps dragged nodes to compatible ports even when the edge already exists", () => {
    const handleDocumentChange = vi.fn();
    render(<WorkflowWorkbench document={document} onDocumentChange={handleDocumentChange} />);

    const inputWidth = getWorkflowNodeSize(
      toUiWorkflowBuilderNodes([document.nodes[0]!])[0]!,
    ).width;
    const transformNode = globalThis.document.querySelector<HTMLElement>(
      "[data-slot='workflow-builder-node'][data-node-id='transform']",
    )!;
    const surface = globalThis.document.querySelector<HTMLElement>(
      "[data-slot='workflow-builder-surface']",
    )!;

    fireEvent.mouseDown(transformNode, { button: 0, clientX: 0, clientY: 0 });
    fireEvent.mouseMove(surface, {
      clientX: inputWidth + 20 - document.nodes[1]!.x,
      clientY: 0,
    });

    expect(handleDocumentChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        nodes: expect.arrayContaining([
          expect.objectContaining({ id: "transform", x: inputWidth, y: 0 }),
        ]),
        edges: expect.arrayContaining([
          expect.objectContaining({
            id: "input-transform",
            sourceNodeId: "input",
            targetNodeId: "transform",
          }),
        ]),
      }),
    );
  });

  test("uses type definitions for workbench connection validation", () => {
    const handleDocumentChange = vi.fn();
    const typedDocument = normalizeWorkflowEditorDocument({
      nodes: [
        {
          id: "source",
          label: "Source",
          x: 0,
          y: 0,
          outputs: [{ id: "out", label: "Out", type: { kind: "ref", name: "AdminUser" } }],
        },
        {
          id: "target",
          label: "Target",
          x: 240,
          y: 0,
          inputs: [{ id: "in", label: "In", type: { kind: "ref", name: "User" } }],
        },
      ],
      edges: [],
    });

    const typeDefinitions: readonly WorkflowEditorTypeDefinition[] = [
      {
        name: "User",
        type: {
          kind: "object",
          properties: {
            id: { type: { kind: "string" } },
          },
        },
      },
      {
        name: "AdminUser",
        extends: ["User"],
        type: {
          kind: "object",
          properties: {
            permissions: {
              type: { kind: "array", element: { kind: "string" } },
            },
          },
        },
      },
    ];
    const connected = connectWorkflowEditorNodes(
      typedDocument,
      {
        sourceNodeId: "source",
        sourcePortId: "out",
        targetNodeId: "target",
        targetPortId: "in",
      },
      { typeDefinitions },
    );

    render(
      <WorkflowWorkbench
        document={connected}
        typeDefinitions={typeDefinitions}
        onDocumentChange={handleDocumentChange}
      />,
    );

    expect(connected).toEqual(
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

  test("assigns workflow references from the default inspector", () => {
    const handleDocumentChange = vi.fn();
    render(
      <WorkflowWorkbench
        document={document}
        selectedNodeId="input"
        documentReferences={[{ id: "child", name: "Child workflow" }]}
        onDocumentChange={handleDocumentChange}
      />,
    );

    fireEvent.click(screen.getAllByLabelText("Workflow document")[0]!);
    fireEvent.click(screen.getByRole("option", { name: "Child workflow" }));
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
            workflowRef: { documentId: "child" },
          }),
        ]),
      }),
    );
  });

  test("edits built-in JSON source values from the default inspector", () => {
    const handleDocumentChange = vi.fn();
    const sourceDocument = normalizeWorkflowEditorDocument({
      nodes: [
        {
          id: "flag",
          label: "Flag",
          kind: "json.boolean",
          category: "JSON",
          minimized: false,
          x: 0,
          y: 0,
          outputs: [{ id: "value", label: "Value", type: { kind: "boolean" } }],
          data: { value: false },
        },
      ],
      edges: [],
    });

    render(
      <WorkflowWorkbench
        document={sourceDocument}
        selectedNodeId="flag"
        onDocumentChange={handleDocumentChange}
      />,
    );

    fireEvent.click(screen.getAllByLabelText("Value")[0]!);
    fireEvent.click(screen.getByRole("option", { name: "True" }));
    fireEvent.click(
      screen
        .getAllByRole("button", { name: "Apply" })
        .find((button) => !(button as HTMLButtonElement).disabled)!,
    );

    expect(handleDocumentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: [
          expect.objectContaining({
            id: "flag",
            data: expect.objectContaining({ sourceName: "booleanValue", value: true }),
          }),
        ],
      }),
    );
  });

  test("keeps node kind read-only in the default inspector", () => {
    const handleDocumentChange = vi.fn();

    render(
      <WorkflowWorkbench
        document={document}
        selectedNodeId="input"
        onDocumentChange={handleDocumentChange}
      />,
    );

    const labelField = screen.getAllByLabelText("Label")[0] as HTMLInputElement;
    const kindField = screen.getAllByLabelText("Kind")[0] as HTMLInputElement;

    expect(kindField.disabled || kindField.readOnly).toBe(true);

    fireEvent.change(labelField, { target: { value: "Source" } });
    fireEvent.change(kindField, { target: { value: "json.boolean" } });
    fireEvent.click(
      screen
        .getAllByRole("button", { name: "Apply" })
        .find((button) => !(button as HTMLButtonElement).disabled)!,
    );

    const nextDocument = handleDocumentChange.mock.calls.at(-1)?.[0] as WorkflowEditorDocument;
    const inputNode = nextDocument.nodes.find((node) => node.id === "input");

    expect(inputNode?.label).toBe("Source");
    expect(inputNode?.kind).toBeUndefined();
  });

  test("uses object property keys instead of source expressions as inspector labels", () => {
    const objectTemplate = workflowEditorJsonNodeTemplates.find(
      (template) => template.id === "json-object",
    )!;
    const objectDocument = normalizeWorkflowEditorDocument<Record<string, unknown>>({
      nodes: [
        {
          id: "employee",
          label: "Employee",
          x: 0,
          y: 0,
          outputs: [{ id: "firstName", label: "First name", type: { kind: "string" } }],
        },
        {
          ...objectTemplate,
          id: "employee-object",
          x: 240,
          y: 0,
        },
      ],
      edges: [],
    });
    const connectedDocument = connectWorkflowEditorNodes(objectDocument, {
      sourceNodeId: "employee",
      sourcePortId: "firstName",
      targetNodeId: "employee-object",
      targetPortId: "property",
    });

    render(<WorkflowWorkbench document={connectedDocument} selectedNodeId="employee-object" />);

    expect(screen.getByLabelText("firstName")).not.toBeNull();
    expect(screen.queryByLabelText("employee.firstName")).toBeNull();
  });

  test("does not show object constructor schema in the default inspector", () => {
    const handleDocumentChange = vi.fn();
    const objectTemplate = workflowEditorJsonNodeTemplates.find(
      (template) => template.id === "json-object",
    )!;
    const objectDocument = normalizeWorkflowEditorDocument<Record<string, unknown>>({
      nodes: [{ ...objectTemplate, id: "profile", x: 0, y: 0 }],
      edges: [],
    });

    render(
      <WorkflowWorkbench
        document={objectDocument}
        selectedNodeId="profile"
        onDocumentChange={handleDocumentChange}
      />,
    );

    expect(screen.queryByLabelText("Schema")).toBeNull();
  });

  test("edits object constructor expressions live from rendered workflow nodes", () => {
    const handleDocumentChange = vi.fn();
    const objectTemplate = workflowEditorJsonNodeTemplates.find(
      (template) => template.id === "json-object",
    )!;
    const objectDocument = normalizeWorkflowEditorDocument<Record<string, unknown>>({
      nodes: [{ ...objectTemplate, id: "profile", x: 0, y: 0 }],
      edges: [],
    });

    render(
      <WorkflowWorkbench
        document={objectDocument}
        selectedNodeId="profile"
        onDocumentChange={handleDocumentChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("Object object expression"), {
      target: { value: "{ name: profile.name, age: profile.age }" },
    });

    const nextDocument = handleDocumentChange.mock.calls.at(-1)?.[0] as WorkflowEditorDocument;
    const profileNode = findWorkflowEditorNode(nextDocument, "profile")!;

    expect(
      getWorkflowEditorObjectConstructorInputs(profileNode).map((input) => [
        input.label,
        input.badge,
      ]),
    ).toEqual([
      ["name", "profile.name"],
      ["age", "profile.age"],
    ]);
    expect(profileNode.outputs?.[0]?.type).toEqual({
      kind: "object",
      properties: {
        name: { type: { kind: "any" } },
        age: { type: { kind: "any" } },
      },
    });
  });

  test("shows object constructor expression validation without changing schema", () => {
    const handleDocumentChange = vi.fn();
    const objectTemplate = workflowEditorJsonNodeTemplates.find(
      (template) => template.id === "json-object",
    )!;
    const objectDocument = normalizeWorkflowEditorDocument<Record<string, unknown>>({
      nodes: [{ ...objectTemplate, id: "profile", x: 0, y: 0 }],
      edges: [],
    });

    render(
      <WorkflowWorkbench
        document={objectDocument}
        selectedNodeId="profile"
        onDocumentChange={handleDocumentChange}
      />,
    );

    fireEvent.change(screen.getByLabelText("Object object expression"), {
      target: { value: "{ name profile.name }" },
    });

    expect(screen.getByRole("alert").textContent).toBe(
      "Object properties must use key: value syntax.",
    );
    expect(handleDocumentChange).not.toHaveBeenCalled();
  });

  test("edits JSON string and number source values and keeps null read-only", () => {
    const stringChange = vi.fn();
    const stringDocument = normalizeWorkflowEditorDocument({
      nodes: [
        {
          id: "title",
          label: "Title",
          kind: "json.string",
          category: "JSON",
          x: 0,
          y: 0,
          outputs: [{ id: "value", label: "Value", type: { kind: "string" } }],
          data: { value: "draft" },
        },
      ],
      edges: [],
    });

    const { unmount } = render(
      <WorkflowWorkbench
        document={stringDocument}
        selectedNodeId="title"
        onDocumentChange={stringChange}
      />,
    );

    fireEvent.change(screen.getAllByLabelText("Value")[0]!, { target: { value: "published" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Apply" })[0]!);
    expect(stringChange).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: [
          expect.objectContaining({
            id: "title",
            data: expect.objectContaining({ sourceName: "stringValue", value: "published" }),
          }),
        ],
      }),
    );

    unmount();

    const numberChange = vi.fn();
    const numberDocument = normalizeWorkflowEditorDocument({
      nodes: [
        {
          id: "count",
          label: "Count",
          kind: "json.number",
          category: "JSON",
          x: 0,
          y: 0,
          outputs: [{ id: "value", label: "Value", type: { kind: "number" } }],
          data: { value: 1 },
        },
      ],
      edges: [],
    });

    const renderedNumber = render(
      <WorkflowWorkbench
        document={numberDocument}
        selectedNodeId="count"
        onDocumentChange={numberChange}
      />,
    );

    fireEvent.change(screen.getAllByLabelText("Value")[0]!, { target: { value: "42" } });
    fireEvent.click(screen.getAllByRole("button", { name: "Apply" })[0]!);
    expect(numberChange).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: [
          expect.objectContaining({
            id: "count",
            data: expect.objectContaining({ sourceName: "numberValue", value: 42 }),
          }),
        ],
      }),
    );

    renderedNumber.unmount();

    const nullDocument = normalizeWorkflowEditorDocument({
      nodes: [
        {
          id: "nothing",
          label: "Nothing",
          kind: "json.null",
          category: "JSON",
          x: 0,
          y: 0,
          outputs: [{ id: "value", label: "Value", type: { kind: "null" } }],
          data: { value: null },
        },
      ],
      edges: [],
    });

    render(<WorkflowWorkbench document={nullDocument} selectedNodeId="nothing" />);

    const nullValue = screen.getAllByLabelText("Value")[0] as HTMLTextAreaElement;

    expect(nullValue.disabled).toBe(true);
    expect(nullValue.value).toBe("null");
  });

  test("edits JSON primitive source values from rendered workflow nodes", async () => {
    const primitiveDocument = normalizeWorkflowEditorDocument({
      nodes: [
        {
          id: "flag",
          label: "Flag",
          kind: "json.boolean",
          category: "JSON",
          minimized: false,
          x: 0,
          y: 0,
          outputs: [{ id: "value", label: "Value", type: { kind: "boolean" } }],
          data: { value: false },
        },
        {
          id: "title",
          label: "Title",
          kind: "json.string",
          category: "JSON",
          minimized: false,
          x: 360,
          y: 0,
          outputs: [{ id: "value", label: "Value", type: { kind: "string" } }],
          data: { value: "draft" },
        },
        {
          id: "count",
          label: "Count",
          kind: "json.number",
          category: "JSON",
          minimized: false,
          x: 720,
          y: 0,
          outputs: [{ id: "value", label: "Value", type: { kind: "number" } }],
          data: { value: 1 },
        },
        {
          id: "nothing",
          label: "Nothing",
          kind: "json.null",
          category: "JSON",
          minimized: false,
          x: 1080,
          y: 0,
          outputs: [{ id: "value", label: "Value", type: { kind: "null" } }],
          data: { value: null },
        },
      ],
      edges: [],
    });

    render(<StatefulWorkbench initialDocument={primitiveDocument} />);

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Set Flag to true" })).toBeTruthy(),
    );

    fireEvent.click(screen.getByRole("button", { name: "Set Flag to true" }));
    expect(readStatefulDocument().nodes.find((node) => node.id === "flag")?.data).toMatchObject({
      sourceName: "booleanValue",
      value: true,
    });

    fireEvent.change(screen.getByLabelText("Title JSON value"), {
      target: { value: "published" },
    });
    expect(readStatefulDocument().nodes.find((node) => node.id === "title")?.data).toMatchObject({
      sourceName: "stringValue",
      value: "published",
    });

    fireEvent.change(screen.getByLabelText("Count JSON value"), { target: { value: "42" } });
    expect(readStatefulDocument().nodes.find((node) => node.id === "count")?.data).toMatchObject({
      sourceName: "numberValue",
      value: 42,
    });

    const nullValue = screen.getByLabelText("Nothing JSON value") as HTMLInputElement;
    expect(nullValue.disabled).toBe(true);
    expect(nullValue.value).toBe("null");
  });

  test("keeps JSON primitive value controls visible while minimized", async () => {
    const primitiveDocument = normalizeWorkflowEditorDocument({
      nodes: [
        {
          id: "title",
          label: "Title",
          kind: "json.string",
          category: "JSON",
          minimized: true,
          x: 0,
          y: 0,
          outputs: [{ id: "value", label: "Value", type: { kind: "string" } }],
          data: { value: "draft" },
        },
      ],
      edges: [],
    });

    render(<StatefulWorkbench initialDocument={primitiveDocument} />);

    const valueInput = await screen.findByLabelText("Title JSON value");
    fireEvent.change(valueInput, { target: { value: "published" } });

    expect(readStatefulDocument().nodes.find((node) => node.id === "title")?.data).toMatchObject({
      value: "published",
    });
  });

  test("indicates JSON primitive source values on workflow nodes", () => {
    const uiNodes = toUiWorkflowBuilderNodes([
      {
        id: "flag",
        label: "Flag",
        description: "Create a JSON boolean value.",
        kind: "json.boolean",
        category: "JSON",
        x: 0,
        y: 0,
        outputs: [{ id: "value", label: "Value", type: { kind: "boolean" } }],
        data: { value: true },
      },
      {
        id: "title",
        label: "Title",
        kind: "json.string",
        category: "JSON",
        x: 0,
        y: 0,
        outputs: [{ id: "value", label: "Value", type: { kind: "string" } }],
        data: { value: "published" },
      },
    ]);

    expect(uiNodes[0]?.packageLabel).toBe("true");
    expect(uiNodes[0]?.minimized).toBe(true);
    expect(uiNodes[0]?.description).toBeUndefined();
    expect(uiNodes[0]?.outputs?.[0]?.badge).toBe("true");
    expect(uiNodes[1]?.packageLabel).toBe('"published"');
    expect(uiNodes[1]?.minimized).toBe(true);
    expect(uiNodes[1]?.outputs?.[0]?.badge).toBe('"published"');
  });

  test("renders palette empty and filtered states with custom workbench chrome", () => {
    const { rerender } = render(
      <WorkflowWorkbench
        document={document}
        selectedNodeId="input"
        nodeTemplates={[]}
        renderInspector={(context) => (
          <div data-testid="custom-inspector">{context.selectedNode?.label}</div>
        )}
        renderToolbarActions={() => <button type="button">Custom action</button>}
      />,
    );

    expect(screen.getByText("No node templates")).not.toBeNull();
    expect(screen.getByTestId("custom-inspector").textContent).toBe("Input");
    expect(screen.getByRole("button", { name: "Custom action" })).not.toBeNull();

    rerender(
      <WorkflowWorkbench
        document={document}
        nodeTemplates={[
          {
            id: "decision",
            label: "Decision",
            categoryPath: ["Control", "Branching"],
          },
        ]}
      />,
    );

    fireEvent.change(screen.getByLabelText("Search node palette"), {
      target: { value: "missing" },
    });
    expect(screen.getByText("No matching node templates")).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Minimize node palette" }));
    expect(screen.queryByLabelText("Search node palette")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Expand node palette" }));
    expect(screen.getByLabelText("Search node palette")).not.toBeNull();
  });

  test("supports hidden and custom workbench chrome", () => {
    render(
      <WorkflowWorkbench
        document={document}
        nodeTemplates={[{ id: "decision", label: "Decision" }]}
        chrome={{
          toolbar: (controller) => (
            <div data-testid="custom-toolbar">{controller.document.nodes.length}</div>
          ),
          palette: "hidden",
          inspector: "hidden",
        }}
      />,
    );

    expect(screen.getByTestId("custom-toolbar").textContent).toBe(String(document.nodes.length));
    expect(screen.queryByLabelText("Search node palette")).toBeNull();
    expect(screen.queryByText("Info")).toBeNull();
  });

  test("supports inline palette and inspector components from a controller", () => {
    const Harness = () => {
      const [currentDocument, setCurrentDocument] = useState(document);
      const controller = useWorkflowWorkbenchController({
        document: currentDocument,
        nodeTemplates: [{ id: "decision", label: "Decision" }],
        selectedNodeId: "input",
        onDocumentChange: setCurrentDocument,
      });

      return (
        <div>
          <WorkflowWorkbenchPalette controller={controller} />
          <WorkflowWorkbenchInspector controller={controller} />
        </div>
      );
    };

    render(<Harness />);

    fireEvent.click(screen.getByRole("button", { name: "Decision" }));
    expect(screen.getByLabelText("Search node palette")).not.toBeNull();
    expect(screen.getByText("Workflow node")).not.toBeNull();
  });

  test("adds palette templates from canvas drops and updates viewport from wheel events", () => {
    const handleDocumentChange = vi.fn();
    const handleViewportChange = vi.fn();
    render(
      <WorkflowWorkbench
        document={document}
        nodeTemplates={[{ id: "decision", label: "Decision" }]}
        onDocumentChange={handleDocumentChange}
        onViewportChange={handleViewportChange}
      />,
    );

    const surface = globalThis.document.querySelector<HTMLElement>(
      "[data-slot='workflow-builder-surface']",
    )!;
    const viewport = globalThis.document.querySelector<HTMLElement>(
      "[data-slot='workflow-builder-viewport']",
    )!;
    viewport.getBoundingClientRect = () =>
      ({
        left: 10,
        top: 20,
        right: 810,
        bottom: 620,
        width: 800,
        height: 600,
        x: 10,
        y: 20,
        toJSON: () => {},
      }) as DOMRect;

    fireEvent.drop(surface, {
      clientX: 210,
      clientY: 220,
      dataTransfer: {
        types: ["application/x-workflow-editor-node-template"],
        getData: (type: string) =>
          type === "application/x-workflow-editor-node-template" ? "decision" : "",
        dropEffect: "none",
      },
    });

    expect(handleDocumentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: expect.arrayContaining([expect.objectContaining({ id: "decision" })]),
      }),
    );

    handleDocumentChange.mockClear();
    fireEvent.wheel(surface, { deltaX: 12, deltaY: 0 });
    expect(handleViewportChange).toHaveBeenCalledWith({ x: -12, y: 0, zoom: 1 });
    expect(handleDocumentChange).toHaveBeenCalledWith(
      expect.objectContaining({ viewport: { x: -12, y: 0, zoom: 1 } }),
    );
  });

  test("deduplicates palette template ids when adding repeated nodes", () => {
    const handleDocumentChange = vi.fn();
    render(
      <WorkflowWorkbench
        document={normalizeWorkflowEditorDocument({
          nodes: [{ id: "decision", label: "Decision", x: 0, y: 0 }],
          edges: [],
        })}
        nodeTemplates={[{ id: "decision", label: "Decision" }]}
        onDocumentChange={handleDocumentChange}
      />,
    );

    const decisionButtons = screen.getAllByRole("button", { name: /Decision/u });
    fireEvent.click(decisionButtons.at(-1)!);

    expect(handleDocumentChange).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: expect.arrayContaining([expect.objectContaining({ id: "decision-2" })]),
      }),
    );
  });

  test("current nodes panel selects renames duplicates deletes and arranges nodes", () => {
    render(<WorkbenchPanelHarness panel="nodes" />);

    fireEvent.click(screen.getByRole("button", { name: "Input" }));
    expect(readPanelSelection()).toEqual({
      nodeIds: ["input"],
      edgeIds: [],
      primary: { type: "node", id: "input" },
    });

    fireEvent.change(screen.getByLabelText("Rename Input"), { target: { value: "Source" } });
    fireEvent.blur(screen.getByLabelText("Rename Input"));
    expect(readPanelDocument().nodes.find((node) => node.id === "input")?.label).toBe("Source");

    fireEvent.click(screen.getAllByRole("button", { name: "Duplicate" })[0]!);
    expect(readPanelDocument().nodes.some((node) => node.id === "input-copy")).toBe(true);

    fireEvent.click(screen.getAllByRole("button", { name: "Arrange selection" })[0]!);
    expect(readPanelDocument().nodes.find((node) => node.id === "input")).toEqual(
      expect.objectContaining({ x: 0 }),
    );

    fireEvent.click(screen.getAllByRole("button", { name: "Delete" })[0]!);
    expect(readPanelDocument().nodes.some((node) => node.id === "input")).toBe(false);
  });

  test("current node types panel groups by kind and selects matching nodes", () => {
    const typedDocument = normalizeWorkflowEditorDocument({
      ...document,
      nodes: document.nodes.map((node, index) =>
        Object.assign({}, node, { kind: index < 2 ? "io" : "terminal" }),
      ),
    });

    render(<WorkbenchPanelHarness panel="types" initialDocument={typedDocument} />);

    fireEvent.click(screen.getByRole("button", { name: /io/u }));
    expect(readPanelSelection().nodeIds).toEqual(["input", "transform"]);
  });

  test("composed nodes panel manages composed document nodes", () => {
    const composedDocument = normalizeWorkflowEditorDocument({
      nodes: [
        {
          id: "wrapped",
          label: "Wrapped",
          x: 0,
          y: 0,
          composition: {
            nodes: [{ id: "inner", label: "Inner", x: 0, y: 0 }],
            edges: [],
            inputBoundaries: [],
            outputBoundaries: [],
          },
        },
      ],
      edges: [],
    });

    render(<WorkbenchPanelHarness panel="composed" initialDocument={composedDocument} />);

    expect(screen.getByRole("button", { name: "Wrapped" })).not.toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Wrapped" }));
    expect(readPanelSelection().nodeIds).toEqual(["wrapped"]);

    fireEvent.change(screen.getByLabelText("Rename composed node Wrapped"), {
      target: { value: "Restorable" },
    });
    fireEvent.blur(screen.getByLabelText("Rename composed node Wrapped"));
    expect(readPanelDocument().nodes[0]?.label).toBe("Restorable");

    fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));
    expect(readPanelDocument().nodes.some((node) => node.id === "wrapped-copy")).toBe(true);

    fireEvent.click(screen.getAllByRole("button", { name: "Restore" })[0]!);
    expect(readPanelDocument().nodes.some((node) => node.id === "inner")).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(readPanelDocument().nodes.some((node) => node.id === "wrapped-copy")).toBe(false);
  });

  test("modular toolbar disables mutations in read-only mode and renders custom actions", () => {
    render(
      <ModularWorkbenchChromeHarness
        readOnly
        initialSelection={{
          nodeIds: ["input", "transform"],
          edgeIds: [],
          primary: { type: "node", id: "transform" },
        }}
        renderToolbarActions={(context) => (
          <button type="button">Custom {context.selectedNodes.length}</button>
        )}
      />,
    );

    expect(screen.getByTestId("selection-count").textContent).toBe("2 selected");
    expect((screen.getByRole("button", { name: "Duplicate" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect((screen.getByRole("button", { name: "Paste" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(
      (screen.getByRole("button", { name: "Arrange selection" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect((screen.getByRole("button", { name: "Group" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(
      (screen.getByRole("button", { name: "Arrange all" }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect((screen.getByRole("button", { name: "Delete" }) as HTMLButtonElement).disabled).toBe(
      true,
    );
    expect(screen.getByRole("button", { name: "Custom 2" })).not.toBeNull();
  });

  test("modular toolbar exposes nested workflow create and open states", () => {
    const referencedDocument = normalizeWorkflowEditorDocument({
      ...document,
      nodes: [
        { ...document.nodes[0]!, workflowRef: { documentId: "child" } },
        document.nodes[1]!,
        document.nodes[2]!,
      ],
    });

    const { unmount } = render(
      <ModularWorkbenchChromeHarness
        initialSelection={{
          nodeIds: ["input"],
          edgeIds: [],
          primary: { type: "node", id: "input" },
        }}
        documentReferences={[{ id: "child", name: "Child" }]}
      />,
    );

    expect(
      screen
        .getAllByRole("button", { name: "Create nested workflow" })
        .some((button) => (button as HTMLButtonElement).disabled),
    ).toBe(true);

    unmount();
    render(
      <ModularWorkbenchChromeHarness
        initialDocument={referencedDocument}
        initialSelection={{
          nodeIds: ["input"],
          edgeIds: [],
          primary: { type: "node", id: "input" },
        }}
        documentReferences={[{ id: "child", name: "Child" }]}
      />,
    );

    expect(
      screen
        .getAllByRole("button", { name: "Open workflow" })
        .some((button) => (button as HTMLButtonElement).disabled),
    ).toBe(true);
  });

  test("modular palette handles nested groups, empty search, and node creation", () => {
    render(<ModularWorkbenchChromeHarness />);

    expect(screen.getByRole("region", { name: "Logic" })).not.toBeNull();
    expect(screen.getByRole("region", { name: "Branching" })).not.toBeNull();
    expect(screen.getByRole("region", { name: "Timing" })).not.toBeNull();

    fireEvent.change(screen.getByLabelText("Search node palette"), {
      target: { value: "missing" },
    });
    expect(screen.getByText("No matching node templates")).not.toBeNull();

    fireEvent.change(screen.getByLabelText("Search node palette"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Decision" }));
    expect(readModularDocument().nodes.some((node) => node.id === "decision")).toBe(true);
    expect(readModularSelection()).toEqual({
      nodeIds: ["decision"],
      edgeIds: [],
      primary: { type: "node", id: "decision" },
    });
  });

  test("headless graph controller routes workflow actions through npm runtime state", async () => {
    function GraphControllerHarness() {
      const [currentDocument, setCurrentDocument] = useState(document);
      const [selection, setSelection] = useState<WorkflowEditorSelectionState>({
        nodeIds: [],
        edgeIds: [],
      });
      const controller = useWorkflowWorkbenchController({
        document: currentDocument,
        selectedNodeIds: selection.nodeIds,
        selectedEdgeIds: selection.edgeIds,
        selectedGroupIds: selection.groupIds,
        nodeTemplates: [{ id: "decision", label: "Decision" }],
        onDocumentChange: setCurrentDocument,
        onSelectionStateChange: setSelection,
      });

      return (
        <>
          <button
            type="button"
            onClick={() => {
              controller.graph.actions.setSelection({
                nodeIds: ["input", "transform"],
                edgeIds: [],
                primary: { type: "node", id: "transform" },
              });
              controller.graph.actions.groupSelection();
            }}
          >
            Same tick group
          </button>
          <button type="button" onClick={() => controller.graph.actions.runCommand("undo")}>
            Graph undo
          </button>
          <button type="button" onClick={() => controller.graph.actions.runCommand("redo")}>
            Graph redo
          </button>
          <button
            type="button"
            onClick={() => controller.graph.actions.runCommand("ungroup-selection")}
          >
            Graph ungroup
          </button>
          <button type="button" onClick={() => controller.graph.actions.runCommand("select-all")}>
            Graph select all
          </button>
          <button type="button" onClick={() => controller.graph.actions.runCommand("fit-view")}>
            Graph fit
          </button>
          <button
            type="button"
            onClick={() =>
              controller.graph.actions.addTemplateNode(
                { id: "decision", label: "Decision" },
                { x: Number.NaN, y: Number.NaN },
              )
            }
          >
            Graph add invalid position
          </button>
          <pre data-testid="graph-document-json">{JSON.stringify(currentDocument)}</pre>
          <pre data-testid="graph-selection-json">{JSON.stringify(selection)}</pre>
          <pre data-testid="graph-command-json">
            {JSON.stringify(controller.graph.commands.map((command) => command.id))}
          </pre>
        </>
      );
    }

    const readGraphDocument = () =>
      JSON.parse(screen.getByTestId("graph-document-json").textContent ?? "") as
        | WorkflowEditorDocument
        | never;
    const readGraphSelection = () =>
      JSON.parse(screen.getByTestId("graph-selection-json").textContent ?? "") as
        | WorkflowEditorSelectionState
        | never;

    render(<GraphControllerHarness />);

    expect(JSON.parse(screen.getByTestId("graph-command-json").textContent ?? "")).toContain(
      "group-selection",
    );

    fireEvent.click(screen.getByRole("button", { name: "Same tick group" }));
    await waitFor(() => expect(readGraphDocument().groups).toHaveLength(1));
    expect(readGraphSelection().primary?.type).toBe("group");

    fireEvent.click(screen.getByRole("button", { name: "Graph undo" }));
    await waitFor(() => expect(readGraphDocument().groups ?? []).toHaveLength(0));

    fireEvent.click(screen.getByRole("button", { name: "Graph redo" }));
    await waitFor(() => expect(readGraphDocument().groups).toHaveLength(1));

    fireEvent.click(screen.getByRole("button", { name: "Graph ungroup" }));
    await waitFor(() => expect(readGraphDocument().groups ?? []).toHaveLength(0));
    expect(readGraphSelection().nodeIds).toEqual(["input", "transform"]);

    fireEvent.click(screen.getByRole("button", { name: "Graph select all" }));
    expect(readGraphSelection().nodeIds).toEqual(["input", "transform", "output"]);

    fireEvent.click(screen.getByRole("button", { name: "Graph fit" }));
    expect(readGraphDocument().viewport).toEqual({ x: 96, y: 96, zoom: 1 });

    fireEvent.click(screen.getByRole("button", { name: "Graph add invalid position" }));
    await waitFor(() =>
      expect(readGraphDocument().nodes).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: "decision", x: 228, y: 204 })]),
      ),
    );
  });

  test("modular palette renders overlay mode with no node templates", () => {
    function EmptyOverlayPalette() {
      const controller = useWorkflowWorkbenchController({
        document,
        nodeTemplates: [],
      });

      return <WorkflowWorkbenchPalette controller={controller} mode="overlay" />;
    }

    render(<EmptyOverlayPalette />);

    expect(
      globalThis.document.querySelector('[data-slot="workflow-palette-overlay"]'),
    ).not.toBeNull();
    expect(screen.getByText("No node templates")).not.toBeNull();
  });

  test("modular inspector render override and overlay panel render", () => {
    render(
      <ModularWorkbenchChromeHarness
        initialSelection={{
          nodeIds: ["input"],
          edgeIds: [],
          primary: { type: "node", id: "input" },
        }}
        renderInspector={(context) => <div>Inspector {context.selectedNode?.label}</div>}
      />,
    );

    expect(screen.getByText("Inspector Input")).not.toBeNull();
    const overlay = globalThis.document.querySelector<HTMLElement>(
      "[data-slot='workflow-overlay-panel']",
    );
    expect(overlay?.textContent).toBe("Overlay child");
    expect(overlay?.className).toContain("custom-panel");
    expect(overlay?.style.left).toBe("12px");
  });
});
