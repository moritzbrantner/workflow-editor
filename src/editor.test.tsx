import { NativeWorkflowTypes } from "./editor/native-types";
import { buildWorkflowEditorBundle, stringifyWorkflowEditorBundle } from "./bundle";
import { parameterDocument } from "./core-workflow-inputs.unit.test";
import {
  connectWorkflowEditorNodes,
  addWorkflowEditorObjectDecompositionOutputToNode,
  defaultWorkflowEditorNodeTemplates,
} from "./core";
import { createWorkflowEditorHistory, commitWorkflowEditorHistory } from "./history";
import { type ReactNode, useState } from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";

import {
  WorkflowEditor,
  WorkflowEditorAppSettingsPanel,
  WorkflowEditorBuiltInSettingsPanel,
  WorkflowEditorDocumentPath,
  WorkflowEditorDocumentMenu,
  WorkflowEditorHistoryControls,
  WorkflowEditorImportExportControls,
  WorkflowEditorNodeTemplatesPanel,
  WorkflowEditorSaveStateBadge,
  WorkflowEditorTypesPanel,
  WorkflowEditorVersionControls,
  createWorkflowEditorEntry,
  createWorkflowEditorLibrary,
  defaultWorkflowEditorBuiltInSettings,
  normalizeWorkflowEditorDocument,
  resolveWorkflowEditorSettings,
  useWorkflowEditorController,
  type WorkflowEditorDocument,
  type WorkflowEditorLibrary,
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
}).document;

const editorTestStorage = {
  loadLibrary: vi.fn(async () => ({ status: "empty" as const })),
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
      loadLibrary: vi.fn(async () => ({ status: "empty" as const })),
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
          document: normalizeWorkflowEditorDocument({ nodes: [], edges: [] }).document,
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

    fireEvent.click(screen.getByRole("button", { name: "Confirm restore" }));
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

    await waitFor(() =>
      expect(handleLoadError).toHaveBeenCalledWith(
        expect.objectContaining({ message: expect.stringContaining(loadError.message) }),
      ),
    );
    cleanup();

    const saveError = new Error("save failed");
    const handleSaveError = vi.fn();

    render(
      <WorkflowEditor
        storage={{
          loadLibrary: vi.fn(async () => ({ status: "empty" as const })),
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

  test("keeps the save badge on the import error while an in-flight save completes", async () => {
    let finishSave: (() => void) | undefined;
    const saveLibrary = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishSave = resolve;
        }),
    );

    render(
      <WorkflowEditor
        storage={{ loadLibrary: vi.fn(async () => ({ status: "empty" as const })), saveLibrary }}
        onError={vi.fn()}
      />,
    );
    // The initial save is still pending when the import is rejected.
    await waitFor(() => expect(saveLibrary).toHaveBeenCalled());
    fireEvent.change(screen.getByLabelText("Import workflow JSON"), {
      target: { files: [new File(["{not json"], "broken.json", { type: "application/json" })] },
    });
    await screen.findByRole("alert");
    expect(screen.getByTestId("save-state").textContent).toBe("Save error");

    await act(async () => finishSave?.());
    expect(screen.getByTestId("save-state").textContent).toBe("Save error");

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.getByTestId("save-state").textContent).toBe("Saved");
  });

  test("fills typed inputs, saves named profiles and runs with validated values", async () => {
    const saveLibrary = vi.fn(async (_library: WorkflowEditorLibrary) => {});
    const onRunWorkflow = vi.fn();
    render(
      <WorkflowEditor
        initialLibrary={createWorkflowEditorLibrary({
          documents: [
            createWorkflowEditorEntry({ id: "w", name: "W", document: parameterDocument }),
          ],
        })}
        storage={{ loadLibrary: vi.fn(async () => ({ status: "empty" as const })), saveLibrary }}
        onRunWorkflow={onRunWorkflow}
      />,
    );
    // Let the stored library load first; edits before that would be replaced by it.
    await waitFor(() => expect(saveLibrary).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Expand info panel" }));
    const run = screen.getByRole("button", { name: "Run with these inputs" }) as HTMLButtonElement;
    expect(run.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Input Region"), { target: { value: '"eu"' } });
    fireEvent.change(screen.getByLabelText("Profile name"), { target: { value: "EU nightly" } });
    fireEvent.click(screen.getByRole("button", { name: "Save profile" }));
    await waitFor(() =>
      expect(saveLibrary.mock.calls.at(-1)?.[0].documents[0]?.inputProfiles).toEqual([
        expect.objectContaining({ name: "EU nightly", values: { region: "eu" } }),
      ]),
    );
    fireEvent.click(screen.getByRole("button", { name: "Run with these inputs" }));
    expect(onRunWorkflow).toHaveBeenCalledWith(
      { region: "eu", limit: 100 },
      expect.objectContaining({ name: "EU nightly" }),
    );
  });

  test("explains a rejected import until it is dismissed", async () => {
    const handleError = vi.fn();
    const saveLibrary = vi.fn(async () => {});

    render(
      <WorkflowEditor
        storage={{ loadLibrary: vi.fn(async () => ({ status: "empty" as const })), saveLibrary }}
        onError={handleError}
      />,
    );
    // Let the initial save settle so it cannot overwrite the import's error state.
    await waitFor(() => expect(saveLibrary).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByTestId("save-state").textContent).toBe("Saved"));
    const savesBeforeImport = saveLibrary.mock.calls.length;

    fireEvent.change(screen.getByLabelText("Import workflow JSON"), {
      target: { files: [new File(["{not json"], "broken.json", { type: "application/json" })] },
    });

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Import rejected:");
    expect(alert.textContent).toContain(handleError.mock.calls[0]?.[0].message);
    expect(screen.getByTestId("save-state").textContent).toBe("Save error");
    expect(saveLibrary).toHaveBeenCalledTimes(savesBeforeImport);

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("alert")).toBeNull();
  });

  test("imports a workflow bundle after previewing and resolving collisions", async () => {
    const reference = (id: string, documentId: string) => ({
      id,
      label: id,
      x: 0,
      y: 0,
      workflowRef: { documentId },
    });
    const sourceLibrary = createWorkflowEditorLibrary({
      activeDocumentId: "root",
      documents: [
        createWorkflowEditorEntry({
          id: "root",
          name: "Root",
          document: { nodes: [reference("call-child", "child")], edges: [] },
        }),
        createWorkflowEditorEntry({ id: "child", name: "Child", document }),
      ],
    });
    const built = buildWorkflowEditorBundle(sourceLibrary, "root");
    if (!built.ok) {
      throw new Error("bundle export failed");
    }
    const saveLibrary = vi.fn(async (_library: WorkflowEditorLibrary) => {});

    render(
      <WorkflowEditor
        initialLibrary={sourceLibrary}
        storage={{ loadLibrary: vi.fn(async () => ({ status: "empty" as const })), saveLibrary }}
      />,
    );
    await waitFor(() => expect(saveLibrary).toHaveBeenCalled());

    fireEvent.change(screen.getByLabelText("Import workflow bundle"), {
      target: {
        files: [new File([stringifyWorkflowEditorBundle(built.value)], "root.bundle.json")],
      },
    });

    const plan = await screen.findByRole("region", { name: "Bundle import" });
    expect(plan.textContent).toContain("Already in library");
    const confirm = screen.getByRole("button", { name: "Confirm import" });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Collision strategy"), {
      target: { value: "duplicate" },
    });
    expect(plan.textContent).toContain("→ root-copy");
    fireEvent.click(screen.getByRole("button", { name: "Confirm import" }));

    await waitFor(() => {
      const saved = saveLibrary.mock.calls.at(-1)?.[0];
      expect(saved?.activeDocumentId).toBe("root-copy");
      expect(
        saved?.documents.find((entry) => entry.id === "root-copy")?.document.nodes[0]?.workflowRef,
      ).toEqual({ documentId: "child-copy" });
    });
    expect(screen.queryByRole("region", { name: "Bundle import" })).toBeNull();
  });

  test("rejects exporting a bundle with a missing reference", async () => {
    const handleError = vi.fn();
    render(
      <WorkflowEditor
        initialLibrary={createWorkflowEditorLibrary({
          documents: [
            createWorkflowEditorEntry({
              id: "root",
              name: "Root",
              document: {
                nodes: [
                  { id: "call", label: "Call", x: 0, y: 0, workflowRef: { documentId: "gone" } },
                ],
                edges: [],
              },
            }),
          ],
        })}
        storage={{
          loadLibrary: vi.fn(async () => ({ status: "empty" as const })),
          saveLibrary: vi.fn(async () => {}),
        }}
        onError={handleError}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Export bundle" }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Bundle export rejected:");
    expect(alert.textContent).toContain('references missing workflow "gone"');
    expect(handleError).toHaveBeenCalled();
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
          loadLibrary: vi.fn(async () => ({ status: "empty" as const })),
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

  test("modular chrome reflects save state and history availability", async () => {
    render(
      <EditorControllerHarness>
        {(controller) => (
          <>
            <WorkflowEditorSaveStateBadge controller={controller} />
            <WorkflowEditorHistoryControls controller={controller} />
            <button
              type="button"
              onClick={() =>
                controller.actions.updateActiveDocument({
                  ...controller.activeDocument,
                  nodes: [
                    ...controller.activeDocument.nodes,
                    {
                      id: "new-node",
                      label: "New node",
                      x: 720,
                      y: 0,
                    },
                  ],
                })
              }
            >
              Mutate document
            </button>
            <pre data-testid="chrome-document-json">
              {JSON.stringify(controller.activeDocument)}
            </pre>
          </>
        )}
      </EditorControllerHarness>,
    );

    await waitFor(() => expect(screen.getByTestId("save-state").textContent).toBe("Saved"));
    expect(screen.getByRole("button", { name: "Undo" })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: "Redo" })).toHaveProperty("disabled", true);

    fireEvent.click(screen.getByRole("button", { name: "Mutate document" }));
    await waitFor(() => expect(screen.getByTestId("save-state").textContent).toBe("Saved"));
    expect(screen.getByRole("button", { name: "Undo" })).toHaveProperty("disabled", false);

    fireEvent.click(screen.getByRole("button", { name: "Undo" }));
    await waitFor(() =>
      expect(screen.getByTestId("chrome-document-json").textContent).not.toContain("new-node"),
    );
    expect(screen.getByRole("button", { name: "Redo" })).toHaveProperty("disabled", false);

    fireEvent.click(screen.getByRole("button", { name: "Redo" }));
    await waitFor(() =>
      expect(screen.getByTestId("chrome-document-json").textContent).toContain("new-node"),
    );
  });

  test("modular version controls save select and restore snapshots", async () => {
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
          loadLibrary: vi.fn(async () => ({ status: "empty" as const })),
          saveLibrary: vi.fn(async () => {}),
        }}
        chrome={{
          documentControls: (controller) => (
            <>
              <WorkflowEditorVersionControls controller={controller} />
              <button
                type="button"
                onClick={() =>
                  controller.actions.updateActiveDocument({
                    ...controller.activeDocument,
                    nodes: [
                      ...controller.activeDocument.nodes,
                      {
                        id: "after-version",
                        label: "After version",
                        x: 720,
                        y: 0,
                      },
                    ],
                  })
                }
              >
                Mutate document
              </button>
              <pre data-testid="version-document-json">
                {JSON.stringify(controller.activeDocument)}
              </pre>
            </>
          ),
          documentPath: "hidden",
          palette: "hidden",
          inspector: "hidden",
          workbenchToolbar: "hidden",
        }}
      />,
    );

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "Save version" })).not.toBeNull(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save version" }));
    await waitFor(() =>
      expect(screen.getByRole("combobox", { name: "Saved versions" }).textContent).toContain(
        "Parent",
      ),
    );

    fireEvent.click(screen.getByRole("button", { name: "Mutate document" }));
    await waitFor(() =>
      expect(screen.getByTestId("version-document-json").textContent).toContain("after-version"),
    );
    fireEvent.click(screen.getByRole("button", { name: "Restore version" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm restore" }));
    await waitFor(() =>
      expect(screen.getByTestId("version-document-json").textContent).not.toContain(
        "after-version",
      ),
    );
  });

  test("modular import export controls trigger file actions", async () => {
    const handleExportDocument = vi.fn();
    const handleImportDocumentFromFile = vi.fn(async () => {});

    render(
      <WorkflowEditorImportExportControls
        controller={
          {
            activeEntry: {
              id: "parent",
              name: "Parent",
            },
            readOnly: false,
            actions: {
              exportDocument: handleExportDocument,
              importDocumentFromFile: handleImportDocumentFromFile,
            },
          } as unknown as Parameters<typeof WorkflowEditorImportExportControls>[0]["controller"]
        }
      />,
    );

    expect(screen.getByRole("button", { name: "Export JSON" })).toHaveProperty("disabled", false);
    fireEvent.click(screen.getByRole("button", { name: "Export JSON" }));
    expect(handleExportDocument).toHaveBeenCalledTimes(1);

    const importedFile = new File(
      [JSON.stringify({ format: "@moritzbrantner/workflow-editor/document" })],
      "imported.json",
      { type: "application/json" },
    );

    fireEvent.change(screen.getByLabelText("Import workflow JSON"), {
      target: { files: [importedFile] },
    });
    expect(handleImportDocumentFromFile).toHaveBeenCalledWith(importedFile);
  });

  test("modular document path renders current missing and selectable entries", () => {
    const handleSelectDocumentPathItem = vi.fn();

    render(
      <WorkflowEditorDocumentPath
        controller={
          {
            documentPathEntries: [
              {
                documentId: "parent",
                entry: {
                  id: "parent",
                  name: "Parent",
                },
              },
              {
                documentId: "missing",
                entry: null,
              },
              {
                documentId: "child",
                entry: {
                  id: "child",
                  name: "Child",
                },
              },
            ],
            actions: {
              selectDocumentPathItem: handleSelectDocumentPathItem,
            },
          } as unknown as Parameters<typeof WorkflowEditorDocumentPath>[0]["controller"]
        }
      />,
    );

    expect(screen.getByText("Path")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Parent" })).toHaveProperty("disabled", false);
    expect(screen.getByRole("button", { name: "Missing: missing" })).toHaveProperty(
      "disabled",
      true,
    );
    expect(screen.getByRole("button", { name: "Child" })).toHaveProperty("disabled", true);

    fireEvent.click(screen.getByRole("button", { name: "Parent" }));
    expect(handleSelectDocumentPathItem).toHaveBeenCalledWith(0);
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

  test("port edits retain property types from the host catalog through history", () => {
    const definitions: WorkflowEditorTypeDefinition[] = [
      { name: "TextCustomer", type: { kind: "typescript", source: "{ id: string }" } },
      { name: "NumberCustomer", type: { kind: "typescript", source: "{ id: number }" } },
    ];
    const decompose = addWorkflowEditorObjectDecompositionOutputToNode(
      {
        ...defaultWorkflowEditorNodeTemplates.find(
          (template) => template.kind === "json.object.decompose",
        )!,
        id: "decompose",
        x: 100,
        y: 0,
      },
      { portId: "id", propertyKey: "id" },
    );
    const initial = connectWorkflowEditorNodes(
      {
        nodes: [
          {
            id: "source",
            label: "Source",
            x: 0,
            y: 0,
            outputs: [
              { id: "out", label: "Out", type: { kind: "typescript", source: "TextCustomer" } },
            ],
          },
          decompose,
        ],
        edges: [],
      },
      {
        sourceNodeId: "source",
        sourcePortId: "out",
        targetNodeId: "decompose",
        targetPortId: "object",
      },
      { typeDefinitions: definitions },
    );
    function Host() {
      const [history, setHistory] = useState(() => createWorkflowEditorHistory(initial));
      return (
        <>
          <NativeWorkflowTypes
            document={history.present}
            definitions={definitions}
            selectedNodeId="source"
            readOnly={false}
            onChange={(next) => setHistory(commitWorkflowEditorHistory(history, next))}
          />
          <output data-testid="property-type">
            {JSON.stringify(
              history.present.nodes
                .find((node) => node.id === "decompose")
                ?.outputs?.find((port) => port.id === "id")?.type,
            )}
          </output>
        </>
      );
    }
    render(<Host />);
    expect(screen.getByTestId("property-type").textContent).toBe('{"kind":"string"}');
    fireEvent.change(screen.getByLabelText("Output Out TypeScript type"), {
      target: { value: "NumberCustomer" },
    });
    fireEvent.keyDown(screen.getByLabelText("Output Out TypeScript type"), { key: "Enter" });
    expect(screen.getByTestId("property-type").textContent).toBe('{"kind":"number"}');
  });

  test("host catalog edits reproject inferred ports of the active document", async () => {
    const definitions: WorkflowEditorTypeDefinition[] = [
      { name: "Customer", type: { kind: "typescript", source: "{ id: string }" } },
    ];
    const decompose = addWorkflowEditorObjectDecompositionOutputToNode(
      {
        ...defaultWorkflowEditorNodeTemplates.find(
          (template) => template.kind === "json.object.decompose",
        )!,
        id: "decompose",
        x: 100,
        y: 0,
      },
      { portId: "id", propertyKey: "id" },
    );
    const connected = connectWorkflowEditorNodes(
      {
        nodes: [
          {
            id: "source",
            label: "Source",
            x: 0,
            y: 0,
            outputs: [
              { id: "out", label: "Out", type: { kind: "typescript", source: "Customer" } },
            ],
          },
          decompose,
        ],
        edges: [],
      },
      {
        sourceNodeId: "source",
        sourcePortId: "out",
        targetNodeId: "decompose",
        targetPortId: "object",
      },
      { typeDefinitions: definitions },
    );
    let current: any;
    const propertyType = () =>
      JSON.stringify(
        current.activeDocument?.nodes
          .find((node: { id: string }) => node.id === "decompose")
          ?.outputs?.find((port: { id: string }) => port.id === "id")?.type,
      );
    render(
      <EditorControllerHarness typeDefinitions={definitions} onTypeDefinitionsChange={() => {}}>
        {(controller) => {
          current = controller;
          return null;
        }}
      </EditorControllerHarness>,
    );
    await waitFor(() => expect(current.activeDocument).toBeTruthy());
    act(() => current.actions.updateActiveDocument(connected));
    expect(propertyType()).toBe('{"kind":"string"}');
    act(() =>
      current.catalog.actions.updateTypeDefinition("Customer", {
        name: "Customer",
        type: { kind: "typescript", source: "{ id: number }" },
      }),
    );
    await waitFor(() => expect(propertyType()).toBe('{"kind":"number"}'));
  });

  test("types panel follows declaration undo redo and saved-version restoration", async () => {
    render(
      <EditorControllerHarness>
        {(controller) => (
          <>
            <WorkflowEditorSaveStateBadge controller={controller} />
            <WorkflowEditorHistoryControls controller={controller} />
            <WorkflowEditorVersionControls controller={controller} />
            <WorkflowEditorTypesPanel controller={controller} />
          </>
        )}
      </EditorControllerHarness>,
    );
    await waitFor(() => expect(screen.getByTestId("save-state").textContent).toBe("Saved"));
    const first = "type Customer = string;";
    const second = "type Customer = number;";
    fireEvent.change(screen.getByLabelText("TypeScript declarations"), {
      target: { value: first },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply declarations" }));
    fireEvent.click(screen.getByRole("button", { name: "Save version", exact: true }));
    fireEvent.change(screen.getByLabelText("TypeScript declarations"), {
      target: { value: second },
    });
    fireEvent.click(screen.getByRole("button", { name: "Apply declarations" }));
    fireEvent.click(screen.getByRole("button", { name: "Undo", exact: true }));
    expect((screen.getByLabelText("TypeScript declarations") as HTMLTextAreaElement).value).toBe(
      first,
    );
    fireEvent.click(screen.getByRole("button", { name: "Redo", exact: true }));
    expect((screen.getByLabelText("TypeScript declarations") as HTMLTextAreaElement).value).toBe(
      second,
    );
    fireEvent.click(screen.getByRole("button", { name: "Restore version", exact: true }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm restore" }));
    expect((screen.getByLabelText("TypeScript declarations") as HTMLTextAreaElement).value).toBe(
      first,
    );
    await waitFor(() => expect(screen.getByTestId("save-state").textContent).toBe("Saved"));
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

  test("keeps an unreadable stored library until the user recovers or discards it", async () => {
    const backupLibrary = createWorkflowEditorLibrary({
      documents: [createWorkflowEditorEntry({ id: "backup", name: "From backup" })],
      activeDocumentId: "backup",
    });
    const saveLibrary = vi.fn(async () => {});
    const storage = {
      loadLibrary: vi.fn(async () => ({
        status: "recoverable-error" as const,
        raw: "{",
        diagnostics: [
          { code: "invalid-json" as const, message: "Saved library is not valid JSON" },
        ],
      })),
      loadBackup: vi.fn(async () => ({ status: "loaded" as const, library: backupLibrary })),
      saveLibrary,
    };

    render(<WorkflowEditor storage={storage} />);

    const alert = await screen.findByRole("alert", { name: "Saved library could not be loaded" });
    expect(alert.textContent).toContain("Saved library is not valid JSON");
    expect(screen.getByRole("button", { name: "Download saved data" })).toBeTruthy();
    await screen.findByRole("button", { name: "Restore backup" });
    expect(saveLibrary).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Restore backup" }));
    await waitFor(() => expect(saveLibrary).toHaveBeenCalled());
    expect(saveLibrary.mock.calls.at(-1)?.[0]).toMatchObject({ activeDocumentId: "backup" });
    expect(screen.queryByRole("alert", { name: "Saved library could not be loaded" })).toBeNull();
    cleanup();

    const discardSave = vi.fn(async () => {});
    render(
      <WorkflowEditor storage={{ loadLibrary: storage.loadLibrary, saveLibrary: discardSave }} />,
    );
    await screen.findByRole("alert", { name: "Saved library could not be loaded" });
    expect(screen.queryByRole("button", { name: "Restore backup" })).toBeNull();
    expect(discardSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Discard and start fresh" }));
    await waitFor(() => expect(discardSave).toHaveBeenCalled());
  });
});
