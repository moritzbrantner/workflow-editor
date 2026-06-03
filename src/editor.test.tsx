import { type ReactNode, useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import {
  WorkflowEditor,
  WorkflowEditorAppSettingsPanel,
  WorkflowEditorBuiltInSettingsPanel,
  WorkflowEditorDocumentMenu,
  WorkflowEditorNodeTemplatesPanel,
  WorkflowEditorTypesPanel,
  createWorkflowEditorEntry,
  createWorkflowEditorLibrary,
  defaultWorkflowEditorBuiltInSettings,
  normalizeWorkflowEditorDocument,
  resolveWorkflowEditorSettings,
  useWorkflowEditorController,
  type WorkflowEditorDocument,
  type WorkflowEditorSettings,
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

const editorTestStorage = {
  loadLibrary: vi.fn(async () => null),
  saveLibrary: vi.fn(async () => {}),
};

function EditorControllerHarness<
  TAppSettings extends Record<string, unknown> = Record<string, unknown>,
>({
  appSettings,
  children,
  nodeTemplates,
  onNodeTemplatesChange,
  onSettingsChange,
  onTypeDefinitionsChange,
  settingsFields,
  typeDefinitions,
}: {
  appSettings?: TAppSettings;
  children: (
    controller: ReturnType<
      typeof useWorkflowEditorController<
        Record<string, unknown>,
        Record<string, unknown>,
        Record<string, unknown>,
        TAppSettings
      >
    >,
  ) => ReactNode;
  nodeTemplates?: Array<{
    id: string;
    label: string;
    inputs?: unknown;
    outputs?: unknown;
    data?: unknown;
  }>;
  onNodeTemplatesChange?: (templates: readonly any[]) => void;
  onSettingsChange?: (settings: WorkflowEditorSettings<TAppSettings>) => void;
  onTypeDefinitionsChange?: (definitions: readonly WorkflowEditorTypeDefinition[]) => void;
  settingsFields?: Parameters<
    typeof useWorkflowEditorController<
      Record<string, unknown>,
      Record<string, unknown>,
      Record<string, unknown>,
      TAppSettings
    >
  >[0]["settingsFields"];
  typeDefinitions?: readonly WorkflowEditorTypeDefinition[];
}) {
  const [settings, setSettings] = useState<Partial<WorkflowEditorSettings<TAppSettings>>>({
    editor: defaultWorkflowEditorBuiltInSettings,
    ...(appSettings ? { app: appSettings } : {}),
  });
  const [types, setTypes] = useState(typeDefinitions ?? []);
  const [templates, setTemplates] = useState(nodeTemplates ?? []);
  const controller = useWorkflowEditorController({
    storage: editorTestStorage,
    settings,
    settingsFields,
    onSettingsChange: onSettingsChange
      ? (next) => {
          setSettings(next);
          onSettingsChange(next);
        }
      : undefined,
    typeDefinitions: types,
    onTypeDefinitionsChange: onTypeDefinitionsChange
      ? (next) => {
          setTypes([...next]);
          onTypeDefinitionsChange(next);
        }
      : undefined,
    nodeTemplates: templates as any,
    onNodeTemplatesChange: onNodeTemplatesChange
      ? (next) => {
          setTemplates([...next] as any);
          onNodeTemplatesChange(next);
        }
      : undefined,
  });

  return children(controller);
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

  test("places document controls through custom editor chrome", async () => {
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
        storage={{
          loadLibrary: vi.fn(async () => null),
          saveLibrary: vi.fn(async () => {}),
        }}
        chrome={{
          documentControls: (controller) => (
            <header data-testid="external-document-menu">
              <WorkflowEditorDocumentMenu controller={controller} />
            </header>
          ),
          documentPath: "hidden",
          palette: "hidden",
          inspector: "hidden",
          workbenchToolbar: "hidden",
        }}
      />,
    );

    await waitFor(() => expect(screen.getByTestId("external-document-menu")).not.toBeNull());
    expect(screen.getByRole("button", { name: "New" })).not.toBeNull();
    expect(screen.queryByText("Path")).toBeNull();
  });

  test("resolves settings while keeping scalar props compatible", () => {
    expect(
      resolveWorkflowEditorSettings({
        readOnly: false,
        settings: { editor: { ...defaultWorkflowEditorBuiltInSettings, readOnly: true } },
      }).editor.readOnly,
    ).toBe(false);
  });

  test("settings panels update built-in and app settings", async () => {
    const handleSettingsChange = vi.fn();

    render(
      <EditorControllerHarness
        appSettings={{ mode: "basic", audits: false }}
        settingsFields={[
          {
            key: "mode",
            label: "Mode",
            kind: "select",
            options: [
              { value: "basic", label: "Basic" },
              { value: "advanced", label: "Advanced" },
            ],
          },
          { key: "audits", label: "Audits", kind: "boolean" },
        ]}
        onSettingsChange={handleSettingsChange}
      >
        {(controller) => (
          <>
            <WorkflowEditorBuiltInSettingsPanel controller={controller} />
            <WorkflowEditorAppSettingsPanel controller={controller} />
          </>
        )}
      </EditorControllerHarness>,
    );

    fireEvent.click(screen.getByLabelText("Read only"));
    expect(handleSettingsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ editor: expect.objectContaining({ readOnly: true }) }),
    );

    fireEvent.change(screen.getByLabelText("Mode"), { target: { value: "advanced" } });
    expect(handleSettingsChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ app: expect.objectContaining({ mode: "advanced" }) }),
    );
  });

  test("settings controls are disabled without onSettingsChange", () => {
    render(
      <EditorControllerHarness>
        {(controller) => <WorkflowEditorBuiltInSettingsPanel controller={controller} />}
      </EditorControllerHarness>,
    );

    expect(screen.getByLabelText("Read only")).toHaveProperty("disabled", true);
  });

  test("type definition panel creates updates deletes and blocks duplicate names", () => {
    const handleTypeDefinitionsChange = vi.fn();

    render(
      <EditorControllerHarness
        typeDefinitions={[
          { name: "User", type: { kind: "object" } },
          { name: "Account", type: { kind: "object" } },
        ]}
        onTypeDefinitionsChange={handleTypeDefinitionsChange}
      >
        {(controller) => <WorkflowEditorTypesPanel controller={controller} />}
      </EditorControllerHarness>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(handleTypeDefinitionsChange).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ name: "Type" })]),
    );

    handleTypeDefinitionsChange.mockClear();
    fireEvent.click(screen.getByRole("button", { name: "User" }));
    fireEvent.change(screen.getByLabelText("Type name"), { target: { value: "Account" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText("Duplicate type name: Account")).not.toBeNull();
    expect(handleTypeDefinitionsChange).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Type name"), { target: { value: "Customer" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(handleTypeDefinitionsChange).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ name: "Customer" })]),
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(handleTypeDefinitionsChange).toHaveBeenCalled();
  });

  test("node template panel creates updates deletes and reports invalid JSON", () => {
    const handleNodeTemplatesChange = vi.fn();

    render(
      <EditorControllerHarness
        nodeTemplates={[{ id: "input", label: "Input" }]}
        onNodeTemplatesChange={handleNodeTemplatesChange}
      >
        {(controller) => <WorkflowEditorNodeTemplatesPanel controller={controller} />}
      </EditorControllerHarness>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    expect(handleNodeTemplatesChange).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: "template" })]),
    );

    handleNodeTemplatesChange.mockClear();
    fireEvent.change(screen.getByLabelText("Template inputs JSON"), { target: { value: "{" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(screen.getByText(/Invalid JSON in inputs/u)).not.toBeNull();
    expect(handleNodeTemplatesChange).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("Template inputs JSON"), { target: { value: "[]" } });
    fireEvent.change(screen.getByLabelText("Template label"), { target: { value: "Input node" } });
    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(handleNodeTemplatesChange).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ label: "Input node" })]),
    );

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(handleNodeTemplatesChange).toHaveBeenCalled();
  });
});
