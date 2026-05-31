import { useMemo } from "react";
import type { Meta, StoryObj } from "@storybook/react-vite";

import {
  WorkflowEditor,
  WorkflowEditorDocumentMenu,
  WorkflowWorkbenchCanvas,
  WorkflowWorkbenchInspector,
  WorkflowWorkbenchPalette,
  createWorkflowEditorLibrary,
  useWorkflowEditorController,
  type WorkflowEditorLibrary,
  type WorkflowEditorStorageAdapter,
} from "@moritzbrantner/workflow-editor";

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
