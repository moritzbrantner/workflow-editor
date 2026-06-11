import { useMemo, useState } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  WorkflowEditor,
  WorkflowEditorDocumentMenu,
  WorkflowEditorNodeTemplatesPanel,
  WorkflowEditorOverviewPanel,
  WorkflowEditorSettingsPanel,
  WorkflowEditorTypesPanel,
  useWorkflowEditorController,
  defaultWorkflowEditorBuiltInSettings,
  type WorkflowEditorSettings,
} from "@moritzbrantner/workflow-editor/editor";
import {
  createWorkflowEditorLibrary,
  type WorkflowEditorLibrary,
  type WorkflowEditorStorageAdapter,
} from "@moritzbrantner/workflow-editor/persistence";
import {
  WorkflowWorkbenchCanvas,
  WorkflowWorkbenchInspector,
  WorkflowWorkbenchPalette,
} from "@moritzbrantner/workflow-editor/react";

import {
  createStoryWorkflowLibrary,
  storyWorkflowNodeTemplates,
  storyWorkflowTypeDefinitions,
} from "./workflow-editor.story-fixtures";

const meta = {
  title: "WorkflowEditor/WorkflowEditor",
  component: WorkflowEditor,
  parameters: {
    layout: "fullscreen",
  },
  tags: ["autodocs"],
} satisfies Meta<typeof WorkflowEditor>;

export default meta;

type Story = StoryObj<typeof meta>;

function createMemoryWorkflowEditorStorage(
  initialLibrary: WorkflowEditorLibrary,
): WorkflowEditorStorageAdapter {
  let storedLibrary: WorkflowEditorLibrary | null = createWorkflowEditorLibrary(initialLibrary);

  return {
    async loadLibrary() {
      return storedLibrary ? createWorkflowEditorLibrary(storedLibrary) : null;
    },
    async saveLibrary(library) {
      storedLibrary = createWorkflowEditorLibrary(library);
    },
  };
}

function EditorStory({
  compactControls = false,
  readOnly = false,
}: {
  compactControls?: boolean;
  readOnly?: boolean;
}) {
  const initialLibrary = useMemo(() => createStoryWorkflowLibrary(), []);
  const storage = useMemo(
    () => createMemoryWorkflowEditorStorage(initialLibrary),
    [initialLibrary],
  );

  return (
    <div className="h-screen min-h-[680px] bg-zinc-50">
      <WorkflowEditor
        compactControls={compactControls}
        initialLibrary={initialLibrary}
        nodeTemplates={storyWorkflowNodeTemplates}
        readOnly={readOnly}
        storage={storage}
        typeDefinitions={storyWorkflowTypeDefinitions}
      />
    </div>
  );
}

export const Default: Story = {
  render: () => <EditorStory />,
};

export const ReadOnly: Story = {
  render: () => <EditorStory readOnly />,
};

export const CompactControls: Story = {
  render: () => <EditorStory compactControls />,
};

export const WithHeaderMenu: Story = {
  render: () => {
    function HeaderMenuStory() {
      const initialLibrary = useMemo(() => createStoryWorkflowLibrary(), []);
      const storage = useMemo(
        () => createMemoryWorkflowEditorStorage(initialLibrary),
        [initialLibrary],
      );

      return (
        <div className="h-screen min-h-[680px] bg-zinc-50">
          <WorkflowEditor
            initialLibrary={initialLibrary}
            nodeTemplates={storyWorkflowNodeTemplates}
            storage={storage}
            typeDefinitions={storyWorkflowTypeDefinitions}
            chrome={{
              documentControls: (controller) => (
                <header className="border-b bg-white p-2">
                  <WorkflowEditorDocumentMenu controller={controller} />
                </header>
              ),
            }}
          />
        </div>
      );
    }

    return <HeaderMenuStory />;
  },
};

export const UnstyledLayout: Story = {
  render: () => {
    function UnstyledEditorStory() {
      const initialLibrary = useMemo(() => createStoryWorkflowLibrary(), []);
      const storage = useMemo(
        () => createMemoryWorkflowEditorStorage(initialLibrary),
        [initialLibrary],
      );
      const controller = useWorkflowEditorController({
        initialLibrary,
        nodeTemplates: storyWorkflowNodeTemplates,
        storage,
        typeDefinitions: storyWorkflowTypeDefinitions,
      });

      if (!controller.workbench) {
        return null;
      }

      return (
        <div className="grid h-screen min-h-[680px] grid-cols-[18rem_minmax(0,1fr)_22rem] grid-rows-[auto_minmax(0,1fr)] gap-3 bg-zinc-50 p-3">
          <header className="col-span-3 rounded-md border bg-white p-2">
            <WorkflowEditorDocumentMenu controller={controller} />
          </header>
          <WorkflowWorkbenchPalette controller={controller.workbench} />
          <WorkflowWorkbenchCanvas controller={controller.workbench} />
          <WorkflowWorkbenchInspector controller={controller.workbench} />
        </div>
      );
    }

    return <UnstyledEditorStory />;
  },
};

export const MovableSettingsPanel: Story = {
  render: () => {
    function MovableSettingsStory() {
      const initialLibrary = useMemo(() => createStoryWorkflowLibrary(), []);
      const storage = useMemo(
        () => createMemoryWorkflowEditorStorage(initialLibrary),
        [initialLibrary],
      );
      const [settings, setSettings] = useState<WorkflowEditorSettings>({
        editor: defaultWorkflowEditorBuiltInSettings,
      });
      const controller = useWorkflowEditorController({
        initialLibrary,
        nodeTemplates: storyWorkflowNodeTemplates,
        settings,
        onSettingsChange: setSettings,
        storage,
        typeDefinitions: storyWorkflowTypeDefinitions,
      });

      return (
        <div className="grid h-screen min-h-[680px] grid-cols-[20rem_minmax(0,1fr)] gap-3 bg-zinc-50 p-3">
          <WorkflowEditorSettingsPanel controller={controller} />
          <WorkflowWorkbenchCanvas controller={controller.workbench} />
        </div>
      );
    }

    return <MovableSettingsStory />;
  },
};

export const FullOverviewPanel: Story = {
  render: () => {
    function FullOverviewStory() {
      const initialLibrary = useMemo(() => createStoryWorkflowLibrary(), []);
      const storage = useMemo(
        () => createMemoryWorkflowEditorStorage(initialLibrary),
        [initialLibrary],
      );
      const [settings, setSettings] = useState<WorkflowEditorSettings>({
        editor: defaultWorkflowEditorBuiltInSettings,
      });
      const [typeDefinitions, setTypeDefinitions] = useState(storyWorkflowTypeDefinitions);
      const [nodeTemplates, setNodeTemplates] = useState(storyWorkflowNodeTemplates);
      const controller = useWorkflowEditorController({
        initialLibrary,
        nodeTemplates,
        onNodeTemplatesChange: setNodeTemplates,
        settings,
        onSettingsChange: setSettings,
        storage,
        typeDefinitions,
        onTypeDefinitionsChange: setTypeDefinitions,
      });

      return (
        <div className="grid h-screen min-h-[680px] grid-cols-[minmax(0,1fr)_24rem] gap-3 bg-zinc-50 p-3">
          <WorkflowWorkbenchCanvas controller={controller.workbench} />
          <div className="min-h-0 overflow-y-auto">
            <WorkflowEditorOverviewPanel controller={controller} />
          </div>
        </div>
      );
    }

    return <FullOverviewStory />;
  },
};

export const ControlledCustomAppSettings: Story = {
  render: () => {
    function CustomSettingsStory() {
      type AppSettings = { environment: string; auditMode: boolean; retryLimit: number };
      const initialLibrary = useMemo(() => createStoryWorkflowLibrary(), []);
      const storage = useMemo(
        () => createMemoryWorkflowEditorStorage(initialLibrary),
        [initialLibrary],
      );
      const [settings, setSettings] = useState<WorkflowEditorSettings<AppSettings>>({
        editor: defaultWorkflowEditorBuiltInSettings,
        app: { environment: "staging", auditMode: true, retryLimit: 3 },
      });
      const controller = useWorkflowEditorController<
        Record<string, unknown>,
        Record<string, unknown>,
        Record<string, unknown>,
        AppSettings
      >({
        initialLibrary,
        nodeTemplates: storyWorkflowNodeTemplates,
        settings,
        settingsFields: [
          {
            key: "environment",
            label: "Environment",
            kind: "select",
            options: [
              { value: "staging", label: "Staging" },
              { value: "production", label: "Production" },
            ],
          },
          { key: "auditMode", label: "Audit mode", kind: "boolean" },
          { key: "retryLimit", label: "Retry limit", kind: "number", min: 0, step: 1 },
        ],
        onSettingsChange: setSettings,
        storage,
        typeDefinitions: storyWorkflowTypeDefinitions,
      });

      return (
        <div className="grid h-screen min-h-[680px] grid-cols-[20rem_minmax(0,1fr)] gap-3 bg-zinc-50 p-3">
          <WorkflowEditorSettingsPanel controller={controller} />
          <WorkflowWorkbenchCanvas controller={controller.workbench} />
        </div>
      );
    }

    return <CustomSettingsStory />;
  },
};

export const ManagedCatalogs: Story = {
  render: () => {
    function ManagedCatalogsStory() {
      const initialLibrary = useMemo(() => createStoryWorkflowLibrary(), []);
      const storage = useMemo(
        () => createMemoryWorkflowEditorStorage(initialLibrary),
        [initialLibrary],
      );
      const [typeDefinitions, setTypeDefinitions] = useState(storyWorkflowTypeDefinitions);
      const [nodeTemplates, setNodeTemplates] = useState(storyWorkflowNodeTemplates);
      const controller = useWorkflowEditorController({
        initialLibrary,
        nodeTemplates,
        onNodeTemplatesChange: setNodeTemplates,
        storage,
        typeDefinitions,
        onTypeDefinitionsChange: setTypeDefinitions,
      });

      return (
        <div className="grid h-screen min-h-[680px] grid-cols-[20rem_minmax(0,1fr)_24rem] gap-3 bg-zinc-50 p-3">
          <WorkflowEditorTypesPanel controller={controller} />
          <WorkflowWorkbenchCanvas controller={controller.workbench} />
          <WorkflowEditorNodeTemplatesPanel controller={controller} />
        </div>
      );
    }

    return <ManagedCatalogsStory />;
  },
};
